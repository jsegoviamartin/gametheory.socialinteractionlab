import json
import logging
import random

from django.utils import timezone
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

from .models import CommonPoolGameData

logger = logging.getLogger(__name__)

# ======================================================
# GAME SETTINGS (DEFAULTS)
# ======================================================
TOTAL_ROUNDS = 20
INITIAL_FISH_STOCK = 100
MAX_FISH_STOCK = 100
MAX_EXTRACTION = 10

class CommonPoolConsumer(AsyncWebsocketConsumer):
    """
    Consolidated Common-pool Resource WebSocket Consumer.
    Cleans up incomplete match data if match aborted.
    """

    async def connect(self):
        self.match_id = self.scope["url_route"]["kwargs"]["match_id"]
        self.room_group_name = f"common_pool_{self.match_id}"
        self.player_fingerprint = None
        self.player_index = None

        logger.info(f"🔌 CPR WS CONNECT | match={self.match_id}")

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        logger.warning(
            f"❌ CPR WS DISCONNECT | match={self.match_id} | code={close_code} | player={self.player_index}"
        )
        
        if self.player_index:
             if await self.is_online_match() or await self.is_bot_match():
                 if await self.abort_match_if_not_complete():
                      await self.channel_layer.group_send(
                        self.room_group_name,
                        {
                            "type": "broadcast_termination",
                            "reason": f"Connection lost with player {self.player_index}."
                        }
                    )

        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            action = data.get("action")

            if action == "join":
                await self.handle_join(data)
            elif action == "contribute": # frontend sends 'contribute' action
                await self.handle_extraction(data)
            elif action == "stage2_action":
                await self.handle_stage2_action(data)
            elif action == "stage2_done":
                await self.handle_stage2_done(data)
            elif action == "terminate":
                await self.handle_terminate(data)
        except Exception as e:
            logger.error(f"Error in CPR receive: {e}")

    # --------------------------------------------------
    # JOIN
    # --------------------------------------------------
    async def handle_join(self, data):
        self.player_fingerprint = data.get("player_fingerprint")
        if not self.player_fingerprint:
            await self.send_json({"type": "error", "message": "Missing fingerprint"})
            return

        self.player_index = await self.assign_player(self.player_fingerprint)
        if not self.player_index:
            await self.send_json({"type": "error", "message": "Match full"})
            return

        match_row = await self.get_round_data(1)
        
        await self.send_json({
            "type": "joined",
            "player_index": self.player_index,
            "all_players": [
                match_row.player_1_fingerprint,
                match_row.player_2_fingerprint,
                match_row.player_3_fingerprint,
                match_row.player_4_fingerprint,
            ],
            "room_type": match_row.room_type,
            "total_rounds": match_row.total_rounds,
            "initial_fish_stock": match_row.initial_fish_stock,
            "max_fish_stock": match_row.max_fish_stock,
            "max_extraction": match_row.max_extraction,
        })

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "player_joined_broadcast",
                "player_index": self.player_index,
                "fingerprint": self.player_fingerprint
            }
        )

    async def player_joined_broadcast(self, event):
        await self.send_json({
            "type": "player_connected",
            "player_index": event["player_index"],
            "fingerprint": event["fingerprint"]
        })

    # --------------------------------------------------
    # EXTRACTION / HARVEST
    # --------------------------------------------------
    async def handle_extraction(self, data):
        try:
            amount = data.get("amount") # requested amount
            client_round = data.get("round")
            if amount is None: return

            round_row = await self.get_current_round_row()
            if not round_row or round_row.round_completed_at is not None:
                return
            
            # If results already calculated, ignore
            if round_row.new_fish_born is not None:
                return

            if client_round is not None and round_row.round_number != client_round:
                logger.warning(f"⚠️ CPR extraction round mismatch: client={client_round}, server={round_row.round_number}")
                return

            # Keep extraction within limits (0 to 10)
            amount = max(0, min(10, int(amount)))

            await self.save_round_extraction(round_row.id, self.player_index, amount)

            if round_row.game_mode == "bot":
                await self.fill_bots(round_row.id)

            if await self.check_round_complete(round_row.id):
                logger.info(f"✅ CPR Round {round_row.round_number} complete. Finalizing...")
                results = await self.safe_finalize_round(round_row.id)
                if results:
                    logger.info(f"📣 CPR Broadcasting results for Round {round_row.round_number}")
                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {
                            "type": "broadcast_round_results",
                            "payload": results,
                        }
                    )
        except Exception as e:
            logger.error(f"❌ ERROR in handle_extraction: {str(e)}")

    async def handle_stage2_action(self, data):
        # Placeholders for cumulative/Stage 2 updates
        target_index = data.get("target_index")
        action_type = data.get("action_type") # reward | punish
        client_round = data.get("round")
        if target_index is None or action_type is None: return

        round_row = await self.get_current_round_row()
        if not round_row: return
        
        if client_round is not None and round_row.round_number != client_round:
            return
            
        is_done = await self.check_player_stage2_done(round_row.id, self.player_index)
        if is_done: return

        await self.save_action(target_index, action_type)

    async def handle_stage2_done(self, data):
        client_round = data.get("round")
        round_row = await self.get_current_round_row()
        if not round_row: return

        if client_round is not None and round_row.round_number != client_round:
            return

        await self.mark_stage2_done(round_row.id, self.player_index)
        
        if await self.check_stage2_complete(round_row.id):
            final_results = await self.finalize_stage_2(round_row.id)
            if final_results:
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        "type": "broadcast_stage2_results",
                        "payload": final_results,
                    }
                )

    # --------------------------------------------------
    # DATABASE HELPERS
    # --------------------------------------------------
    @database_sync_to_async
    def get_round_data(self, round_num):
        return CommonPoolGameData.objects.get(match_id=self.match_id, round_number=round_num)

    @database_sync_to_async
    def get_current_round_row(self):
        last_row = CommonPoolGameData.objects.filter(match_id=self.match_id).order_by('round_number').last()
        if not last_row: return None

        if last_row.round_completed_at is not None:
            if last_row.round_number >= TOTAL_ROUNDS:
                return last_row

            next_num = last_row.round_number + 1
            r1 = CommonPoolGameData.objects.get(match_id=self.match_id, round_number=1)
            
            row, created = CommonPoolGameData.objects.get_or_create(
                match_id=self.match_id,
                round_number=next_num,
                defaults={
                    "room_type": r1.room_type,
                    "game_mode": r1.game_mode,
                    "total_rounds": r1.total_rounds,
                    "initial_fish_stock": r1.initial_fish_stock,
                    "max_fish_stock": r1.max_fish_stock,
                    "max_extraction": r1.max_extraction,
                    "fish_stock": last_row.next_fish_stock if last_row.next_fish_stock is not None else 100,
                    "player_1_fingerprint": r1.player_1_fingerprint,
                    "player_2_fingerprint": r1.player_2_fingerprint,
                    "player_3_fingerprint": r1.player_3_fingerprint,
                    "player_4_fingerprint": r1.player_4_fingerprint,
                    "player_1_ip": r1.player_1_ip,
                    "player_2_ip": r1.player_2_ip,
                    "player_3_ip": r1.player_3_ip,
                    "player_4_ip": r1.player_4_ip,
                    "player_1_cumulative_extraction": last_row.player_1_cumulative_extraction,
                    "player_2_cumulative_extraction": last_row.player_2_cumulative_extraction,
                    "player_3_cumulative_extraction": last_row.player_3_cumulative_extraction,
                    "player_4_cumulative_extraction": last_row.player_4_cumulative_extraction,
                    "player_1_cumulative_payoff": last_row.player_1_cumulative_payoff,
                    "player_2_cumulative_payoff": last_row.player_2_cumulative_payoff,
                    "player_3_cumulative_payoff": last_row.player_3_cumulative_payoff,
                    "player_4_cumulative_payoff": last_row.player_4_cumulative_payoff,
                    # Action tracking lists
                    "player_1_reward_list": last_row.player_1_reward_list,
                    "player_1_punish_list": last_row.player_1_punish_list,
                    "player_1_reward_counts": last_row.player_1_reward_counts,
                    "player_1_punish_counts": last_row.player_1_punish_counts,
                    "player_2_reward_list": last_row.player_2_reward_list,
                    "player_2_punish_list": last_row.player_2_punish_list,
                    "player_2_reward_counts": last_row.player_2_reward_counts,
                    "player_2_punish_counts": last_row.player_2_punish_counts,
                    "player_3_reward_list": last_row.player_3_reward_list,
                    "player_3_punish_list": last_row.player_3_punish_list,
                    "player_3_reward_counts": last_row.player_3_reward_counts,
                    "player_3_punish_counts": last_row.player_3_punish_counts,
                    "player_4_reward_list": last_row.player_4_reward_list,
                    "player_4_punish_list": last_row.player_4_punish_list,
                    "player_4_reward_counts": last_row.player_4_reward_counts,
                    "player_4_punish_counts": last_row.player_4_punish_counts,
                }
            )
            if not created:
                for i in range(1, 5):
                    setattr(row, f"player_{i}_extraction", None)
                    setattr(row, f"player_{i}_actual_catch", 0)
                    setattr(row, f"player_{i}_payoff", 0)
                    setattr(row, f"player_{i}_stage1_payoff", None)
                    setattr(row, f"player_{i}_stage2_done", False)
                row.round_completed_at = None
                row.total_extractions = None
                row.new_fish_born = None
                row.next_fish_stock = None
                row.save()
            return row
        return last_row

    @database_sync_to_async
    def save_round_extraction(self, row_id, player_index, amount):
        row = CommonPoolGameData.objects.get(id=row_id)
        setattr(row, f"player_{player_index}_extraction", amount)
        row.save()

    @database_sync_to_async
    def fill_bots(self, row_id):
        row = CommonPoolGameData.objects.get(id=row_id)
        for i in [2, 3, 4]:
            field = f"player_{i}_extraction"
            if getattr(row, field) is None:
                setattr(row, field, random.randint(0, 10))
        row.save()

    @database_sync_to_async
    def check_round_complete(self, row_id):
        row = CommonPoolGameData.objects.get(id=row_id)
        return all([
            row.player_1_extraction is not None,
            row.player_2_extraction is not None,
            row.player_3_extraction is not None,
            row.player_4_extraction is not None,
        ])

    @database_sync_to_async
    def check_player_stage2_done(self, row_id, player_index):
        row = CommonPoolGameData.objects.get(id=row_id)
        return getattr(row, f"player_{player_index}_stage2_done", False)

    @database_sync_to_async
    def mark_stage2_done(self, row_id, player_index):
        row = CommonPoolGameData.objects.get(id=row_id)
        setattr(row, f"player_{player_index}_stage2_done", True)
        
        if row.game_mode == "bot":
            row.player_2_stage2_done = True
            row.player_3_stage2_done = True
            row.player_4_stage2_done = True
        row.save()

    @database_sync_to_async
    def check_stage2_complete(self, row_id):
        row = CommonPoolGameData.objects.get(id=row_id)
        return all([
            row.player_1_stage2_done,
            row.player_2_stage2_done,
            row.player_3_stage2_done,
            row.player_4_stage2_done,
        ])

    @database_sync_to_async
    def save_action(self, target_index, action_type):
        row = CommonPoolGameData.objects.filter(match_id=self.match_id).order_by('round_number').last()
        if not row: return
        new_actions = list(row.round_actions)
        new_actions.append({
            "actor": self.player_index,
            "target": target_index,
            "type": action_type
        })
        row.round_actions = new_actions
        row.save()

    @database_sync_to_async
    def safe_finalize_round(self, row_id):
        from django.db import transaction
        try:
            with transaction.atomic():
                row = CommonPoolGameData.objects.select_for_update().get(id=row_id)
                if row.round_completed_at is not None or row.new_fish_born is not None:
                    return None
                
                stock = row.fish_stock
                reqs = [
                    row.player_1_extraction or 0,
                    row.player_2_extraction or 0,
                    row.player_3_extraction or 0,
                    row.player_4_extraction or 0
                ]
                total_requested = sum(reqs)
                row.total_extractions = total_requested
                
                catches = [0, 0, 0, 0]
                if total_requested <= stock:
                    catches = list(reqs)
                else:
                    raw_catches = [stock * (req / total_requested) if total_requested > 0 else 0 for req in reqs]
                    catches = [round(x) for x in raw_catches]
                    
                    total_allocated = sum(catches)
                    if total_allocated > stock:
                        diff = total_allocated - stock
                        for _ in range(diff):
                            idx_to_reduce = max(range(4), key=lambda idx: (catches[idx] > 0, catches[idx] - raw_catches[idx]))
                            catches[idx_to_reduce] -= 1
                    elif total_allocated < stock and stock < total_requested:
                        diff = stock - total_allocated
                        for _ in range(diff):
                            idx_to_increase = max(range(4), key=lambda idx: (reqs[idx] > catches[idx], raw_catches[idx] - catches[idx]))
                            catches[idx_to_increase] += 1
                
                for i in range(4):
                    setattr(row, f"player_{i+1}_actual_catch", catches[i])
                
                actual_total_catch = sum(catches)
                fish_left = max(0, stock - actual_total_catch)
                
                new_fish_born = round(0.8 * fish_left * (1 - fish_left / 100))
                row.new_fish_born = new_fish_born
                
                next_stock = min(100, fish_left + new_fish_born)
                row.next_fish_stock = next_stock
                
                payoffs = [float(c) for c in catches]
                is_final_round = (row.round_number == row.total_rounds)
                
                for i in range(4):
                    p_val = payoffs[i]
                    setattr(row, f"player_{i+1}_stage1_payoff", p_val)
                    if row.room_type == "basic":
                        setattr(row, f"player_{i+1}_payoff", p_val)
                
                if row.round_number == 1:
                    r1 = row
                else:
                    r1 = CommonPoolGameData.objects.get(match_id=self.match_id, round_number=1)
                
                for i in range(4):
                    p_num = i + 1
                    curr_cum_ext = getattr(row, f"player_{p_num}_cumulative_extraction")
                    setattr(row, f"player_{p_num}_cumulative_extraction", curr_cum_ext + reqs[i])
                    
                    curr_cum_p = getattr(row, f"player_{p_num}_cumulative_payoff")
                    setattr(row, f"player_{p_num}_cumulative_payoff", curr_cum_p + payoffs[i])
                
                if is_final_round:
                    bonus = 0.4 * next_stock
                    for i in range(4):
                        p_num = i + 1
                        if row.room_type == "basic":
                            curr_payoff = getattr(row, f"player_{p_num}_payoff")
                            setattr(row, f"player_{p_num}_payoff", curr_payoff + bonus)
                        
                        curr_cum_p = getattr(row, f"player_{p_num}_cumulative_payoff")
                        setattr(row, f"player_{p_num}_cumulative_payoff", curr_cum_p + bonus)
                
                if row.room_type == "basic":
                    row.round_completed_at = timezone.now()
                
                if is_final_round:
                    r1.completed_at = timezone.now()
                
                row.save()
                if is_final_round and r1 != row:
                    r1.save()
                
                return {
                    "round": row.round_number,
                    "room_type": row.room_type,
                    "contributions": {f"player_{i+1}": reqs[i] for i in range(4)},
                    "payoffs": {f"player_{i+1}": getattr(row, f"player_{i+1}_payoff") for i in range(4)},
                    "players": {
                        "player_1": row.player_1_fingerprint,
                        "player_2": row.player_2_fingerprint,
                        "player_3": row.player_3_fingerprint,
                        "player_4": row.player_4_fingerprint,
                    },
                    "total": total_requested,
                    "group_return": 0,
                    "fish_stock": stock,
                    "next_fish_stock": next_stock,
                    "new_fish_born": new_fish_born,
                    "actual_catches": {f"player_{i+1}": catches[i] for i in range(4)}
                }
        except Exception as e:
            logger.error(f"Finalize CPR error: {e}")
            return None

    @database_sync_to_async
    def finalize_stage_2(self, row_id):
        # Per user request, keep logic simple/blank for now.
        # We just finalize the round.
        try:
            row = CommonPoolGameData.objects.get(id=row_id)
            if row.round_completed_at is not None: return None
            
            payoffs = [
                row.player_1_stage1_payoff or 0,
                row.player_2_stage1_payoff or 0,
                row.player_3_stage1_payoff or 0,
                row.player_4_stage1_payoff or 0
            ]
            
            for i in range(4):
                setattr(row, f"player_{i+1}_payoff", payoffs[i])
                
            row.round_completed_at = timezone.now()
            
            is_final_round = (row.round_number == row.total_rounds)
            if row.round_number == 1:
                r1 = row
            else:
                r1 = CommonPoolGameData.objects.get(match_id=self.match_id, round_number=1)
                
            if is_final_round:
                r1.completed_at = timezone.now()
                
            row.save()
            if is_final_round and r1 != row:
                r1.save()
                
            return {
                "type": "stage2_results",
                "round": row.round_number,
                "room_type": row.room_type,
                "payoffs": {f"player_{i+1}": payoffs[i] for i in range(4)},
                "players": {
                    "player_1": row.player_1_fingerprint,
                    "player_2": row.player_2_fingerprint,
                    "player_3": row.player_3_fingerprint,
                    "player_4": row.player_4_fingerprint,
                },
                "actions": row.round_actions,
                "total": row.total_extractions,
                "group_return": 0,
                "contributions": {
                    "player_1": row.player_1_extraction,
                    "player_2": row.player_2_extraction,
                    "player_3": row.player_3_extraction,
                    "player_4": row.player_4_extraction,
                },
            }
        except Exception as e:
            logger.error(f"finalize_stage_2 error: {e}")
            return None

    @database_sync_to_async
    def assign_player(self, fp):
        from django.db import transaction
        with transaction.atomic():
            row = CommonPoolGameData.objects.select_for_update().filter(match_id=self.match_id, round_number=1).first()
            if not row: return None
            for i in range(1, 5):
                field = f"player_{i}_fingerprint"
                val = getattr(row, field)
                if val == fp: return i
                if val is None:
                    setattr(row, field, fp)
                    row.save()
                    return i
        return None

    @database_sync_to_async
    def is_online_match(self):
        row = CommonPoolGameData.objects.filter(match_id=self.match_id, round_number=1).first()
        return row and row.game_mode == "online"

    @database_sync_to_async
    def is_bot_match(self):
        row = CommonPoolGameData.objects.filter(match_id=self.match_id, round_number=1).first()
        return row and row.game_mode == "bot"

    @database_sync_to_async
    def abort_match_if_not_complete(self):
        r1 = CommonPoolGameData.objects.filter(match_id=self.match_id, round_number=1).first()
        if r1 and r1.completed_at is None:
            logger.warning(f"Pruning incomplete CPR match {self.match_id}")
            CommonPoolGameData.objects.filter(match_id=self.match_id).delete()
            return True
        return False

    async def handle_terminate(self, data):
        if await self.abort_match_if_not_complete():
            await self.channel_layer.group_send(self.room_group_name, {"type": "broadcast_termination", "reason": data.get("reason", "Game ended.")})

    async def broadcast_termination(self, event):
        await self.send_json({"type": "terminated", "reason": event["reason"]})

    async def broadcast_round_results(self, event):
        await self.send_json({"type": "round_results", **event["payload"]})

    async def broadcast_stage2_results(self, event):
        await self.send_json({"type": "stage2_results", **event["payload"]})

    async def send_json(self, payload):
        await self.send(text_data=json.dumps(payload))
