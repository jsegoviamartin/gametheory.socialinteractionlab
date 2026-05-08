import json
import logging
import random

from django.utils import timezone
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

from .models import PublicGoodsGameData
from game.exports import export_public_goods_all

logger = logging.getLogger(__name__)

# ======================================================
# GAME SETTINGS
# ======================================================
TOTAL_ROUNDS = 25
ENDOWMENT = 20
MULTIPLIER = 1.6

PUNISHMENT_COST = 4.0
PUNISHMENT_IMPACT = 12.0
REWARD_COST = 4.0
REWARD_IMPACT = 12.0


class PublicGoodsConsumer(AsyncWebsocketConsumer):
    """
    Consolidated Public Goods Game WebSocket Consumer.
    Only keeps matches in the DB if they reach Round 25.
    Otherwise, cleans up incomplete data.
    """

    async def connect(self):
        self.match_id = self.scope["url_route"]["kwargs"]["match_id"]
        self.room_group_name = f"public_goods_{self.match_id}"
        self.player_fingerprint = None
        self.player_index = None

        logger.info(f"🔌 WS CONNECT | match={self.match_id}")

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        logger.warning(
            f"❌ WS DISCONNECT | match={self.match_id} | code={close_code} | player={self.player_index}"
        )
        
        # Termination logic if a player leaves an active match
        if self.player_index:
             # In online mode, ANY disconnect ends the game. 
             # In bot mode, the user leaving ends the game.
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
            elif action == "contribute":
                await self.handle_contribution(data)
            elif action == "stage2_action":
                await self.handle_stage2_action(data)
            elif action == "stage2_done":
                await self.handle_stage2_done(data)
            elif action == "terminate":
                await self.handle_terminate(data)
        except Exception as e:
            logger.error(f"Error in receive: {e}")

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
            "endowment": match_row.endowment,
            "multiplier": match_row.multiplier,
            "punishment_cost": match_row.punishment_cost,
            "punishment_value": match_row.punishment_value,
            "reward_cost": match_row.reward_cost,
            "reward_value": match_row.reward_value,
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
    # CONTRIBUTION
    # --------------------------------------------------
    async def handle_contribution(self, data):
        try:
            amount = data.get("amount")
            client_round = data.get("round")
            if amount is None: return

            round_row = await self.get_current_round_row()
            if not round_row or round_row.round_completed_at is not None:
                return
            
            # If Stage 1 results are already out for this round, ignore late contributions
            if round_row.group_return is not None:
                return

            # Ensure client and server agree on which round this contribution is for
            if client_round is not None and round_row.round_number != client_round:
                logger.warning(f"⚠️ contribution round mismatch: client={client_round}, server={round_row.round_number}")
                return

            await self.save_round_contribution(round_row.id, self.player_index, amount)

            if round_row.game_mode == "bot":
                await self.fill_bots(round_row.id)

            if await self.check_round_complete(round_row.id):
                logger.info(f"✅ Round {round_row.round_number} complete for match {self.match_id}. Finalizing...")
                results = await self.safe_finalize_round(round_row.id)
                if results:
                    logger.info(f"📣 Broadcasting results for Round {round_row.round_number}")
                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {
                            "type": "broadcast_round_results",
                            "payload": results,
                        }
                    )
                else:
                    logger.warning(f"⚠️ safe_finalize_round returned None for Round {round_row.round_number}")
        except Exception as e:
            logger.error(f"❌ ERROR in handle_contribution: {str(e)}")

    async def handle_stage2_action(self, data):
        target_index = data.get("target_index")
        action_type = data.get("action_type") # reward | punish
        client_round = data.get("round")
        if target_index is None or action_type is None: return

        round_row = await self.get_current_round_row()
        if not round_row: return
        
        # Ensure client and server agree on the round
        if client_round is not None and round_row.round_number != client_round:
            logger.warning(f"⚠️ stage2_action round mismatch: client={client_round}, server={round_row.round_number}")
            return
            
        # Check if player is already marked as done
        is_done = await self.check_player_stage2_done(round_row.id, self.player_index)
        if is_done:
            logger.warning(f"⚠️ Player {self.player_index} attempted multiple actions in Stage 2")
            return

        await self.save_action(target_index, action_type)

    async def handle_stage2_done(self, data):
        client_round = data.get("round")
        round_row = await self.get_current_round_row()
        if not round_row: return

        # Ensure client and server agree on the round
        if client_round is not None and round_row.round_number != client_round:
            logger.warning(f"⚠️ stage2_done round mismatch: client={client_round}, server={round_row.round_number}")
            return

        await self.mark_stage2_done(round_row.id, self.player_index)
        
        if round_row.game_mode == "bot":
            # Bots are always "done" immediately or we can simulate them
            pass

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
        return PublicGoodsGameData.objects.get(match_id=self.match_id, round_number=round_num)

    @database_sync_to_async
    def get_current_round_row(self):
        last_row = PublicGoodsGameData.objects.filter(match_id=self.match_id).order_by('round_number').last()
        if not last_row: return None

        if last_row.round_completed_at is not None:
            if last_row.round_number >= TOTAL_ROUNDS:
                return last_row

            next_num = last_row.round_number + 1
            r1 = PublicGoodsGameData.objects.get(match_id=self.match_id, round_number=1)
            
            row, created = PublicGoodsGameData.objects.get_or_create(
                match_id=self.match_id,
                round_number=next_num,
                defaults={
                    "room_type": r1.room_type,
                    "game_mode": r1.game_mode,
                    "experiment_id": r1.experiment_id,
                    "condition_id": r1.condition_id,
                    "total_rounds": r1.total_rounds,
                    "endowment": r1.endowment,
                    "multiplier": r1.multiplier,
                    "punishment_cost": r1.punishment_cost,
                    "punishment_value": r1.punishment_value,
                    "reward_cost": r1.reward_cost,
                    "reward_value": r1.reward_value,
                    "player_1_fingerprint": r1.player_1_fingerprint,
                    "player_2_fingerprint": r1.player_2_fingerprint,
                    "player_3_fingerprint": r1.player_3_fingerprint,
                    "player_4_fingerprint": r1.player_4_fingerprint,
                    "player_1_ip": r1.player_1_ip,
                    "player_2_ip": r1.player_2_ip,
                    "player_3_ip": r1.player_3_ip,
                    "player_4_ip": r1.player_4_ip,
                    "player_1_cumulative_contribution": last_row.player_1_cumulative_contribution,
                    "player_2_cumulative_contribution": last_row.player_2_cumulative_contribution,
                    "player_3_cumulative_contribution": last_row.player_3_cumulative_contribution,
                    "player_4_cumulative_contribution": last_row.player_4_cumulative_contribution,
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
                    "group_return": None,
                    "total_contributions": None,
                }
            )
            if not created:
                # Security: reset fields if reusing a row from a potentially dirty database
                for i in range(1, 5):
                    setattr(row, f"player_{i}_contribution", None)
                    setattr(row, f"player_{i}_payoff", 0)
                    setattr(row, f"player_{i}_stage1_payoff", 0)
                    setattr(row, f"player_{i}_stage2_done", False)
                row.round_completed_at = None
                row.total_contributions = None
                row.group_return = None
                row.save()
            return row
        return last_row

    @database_sync_to_async
    def save_round_contribution(self, row_id, player_index, amount):
        row = PublicGoodsGameData.objects.get(id=row_id)
        setattr(row, f"player_{player_index}_contribution", amount)
        row.save()

    @database_sync_to_async
    def fill_bots(self, row_id):
        row = PublicGoodsGameData.objects.get(id=row_id)
        for i in [2, 3, 4]:
            field = f"player_{i}_contribution"
            if getattr(row, field) is None:
                setattr(row, field, random.randint(0, int(row.endowment or 20)))
        row.save()

    @database_sync_to_async
    def check_round_complete(self, row_id):
        row = PublicGoodsGameData.objects.get(id=row_id)
        return all([
            row.player_1_contribution is not None,
            row.player_2_contribution is not None,
            row.player_3_contribution is not None,
            row.player_4_contribution is not None,
        ])

    @database_sync_to_async
    def check_player_stage2_done(self, row_id, player_index):
        row = PublicGoodsGameData.objects.get(id=row_id)
        return getattr(row, f"player_{player_index}_stage2_done", False)

    @database_sync_to_async
    def mark_stage2_done(self, row_id, player_index):
        row = PublicGoodsGameData.objects.get(id=row_id)
        setattr(row, f"player_{player_index}_stage2_done", True)
        
        if row.game_mode == "bot":
            # BOTS: Perform random actions before finishing
            room_type = (row.room_type or "basic").lower().strip()
            can_reward = "reward" in room_type or "mixed" in room_type
            can_punish = "punish" in room_type or "mixed" in room_type
            
            # Use local list to avoid multiple saves
            new_actions = list(row.round_actions)

            if can_reward or can_punish:
                for b_idx in [2, 3, 4]:
                    targets = [1, 2, 3, 4]
                    targets.remove(b_idx)
                    target = random.choice(targets)
                    
                    possible_actions = []
                    if can_reward: possible_actions.append("reward")
                    if can_punish: possible_actions.append("punish")
                    
                    if possible_actions:
                        action = random.choice(possible_actions)
                        new_actions.append({
                            "actor": b_idx,
                            "target": target,
                            "type": action
                        })

            row.round_actions = new_actions
            row.player_2_stage2_done = True
            row.player_3_stage2_done = True
            row.player_4_stage2_done = True
        row.save()

    @database_sync_to_async
    def check_stage2_complete(self, row_id):
        row = PublicGoodsGameData.objects.get(id=row_id)
        return all([
            row.player_1_stage2_done,
            row.player_2_stage2_done,
            row.player_3_stage2_done,
            row.player_4_stage2_done,
        ])

    @database_sync_to_async
    def save_action(self, target_index, action_type):
        row = PublicGoodsGameData.objects.filter(match_id=self.match_id).order_by('round_number').last()
        if not row: return
        
        # Add to round_actions JSON list
        new_actions = list(row.round_actions)
        new_actions.append({
            "actor": self.player_index,
            "target": target_index,
            "type": action_type
        })
        row.round_actions = new_actions
        row.save()

    @database_sync_to_async
    def finalize_stage_2(self, row_id):
        from django.db import transaction
        try:
            with transaction.atomic():
                row = PublicGoodsGameData.objects.select_for_update().get(id=row_id)
                if row.round_completed_at is not None: return None
                
                # Fetch all actions for this round from the row itself
                actions = row.round_actions
                
                # Start from stage1 payoffs
                payoffs = [
                    row.player_1_stage1_payoff,
                    row.player_2_stage1_payoff,
                    row.player_3_stage1_payoff,
                    row.player_4_stage1_payoff
                ]
                
                # Master row (Round 1) to track cumulative totals
                if row.round_number == 1:
                    r1 = row
                else:
                    r1 = PublicGoodsGameData.objects.get(match_id=self.match_id, round_number=1)

                for act in actions:
                    actor_idx = act['actor']
                    target_idx = act['target']
                    action_type = act['type']
                    
                    # Actor pays cost from dynamic row
                    cost = row.reward_cost if action_type == 'reward' else row.punishment_cost
                    payoffs[actor_idx - 1] -= cost
                    
                    # Target receives impact
                    impact = row.reward_value if action_type == 'reward' else -row.punishment_value
                    payoffs[target_idx - 1] += impact

                    # Update cumulative tracking for actor
                    prefix = f"player_{actor_idx}"
                    reward_list = list(getattr(row, f"{prefix}_reward_list"))
                    punish_list = list(getattr(row, f"{prefix}_punish_list"))
                    reward_counts = dict(getattr(row, f"{prefix}_reward_counts"))
                    punish_counts = dict(getattr(row, f"{prefix}_punish_counts"))

                    if action_type == 'reward':
                        reward_list.append(target_idx)
                        reward_counts[str(target_idx)] = reward_counts.get(str(target_idx), 0) + 1
                    else:
                        punish_list.append(target_idx)
                        punish_counts[str(target_idx)] = punish_counts.get(str(target_idx), 0) + 1

                    # Save back to row
                    setattr(row, f"{prefix}_reward_list", reward_list)
                    setattr(row, f"{prefix}_punish_list", punish_list)
                    setattr(row, f"{prefix}_reward_counts", reward_counts)
                    setattr(row, f"{prefix}_punish_counts", punish_counts)

                # Update row payoffs
                for i in range(4):
                    p_num = i + 1
                    setattr(row, f"player_{p_num}_payoff", payoffs[i])
                    
                    # Update cumulative totals
                    delta = payoffs[i] - (getattr(row, f"player_{p_num}_stage1_payoff") or 0)
                    curr_cum_p = getattr(row, f"player_{p_num}_cumulative_payoff")
                    setattr(row, f"player_{p_num}_cumulative_payoff", curr_cum_p + delta)

                row.round_completed_at = timezone.now()
                if row.round_number == TOTAL_ROUNDS:
                    r1.completed_at = timezone.now()
                    export_public_goods_all()

                row.save()
                if row.round_number == TOTAL_ROUNDS and r1 != row:
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
                    "actions": actions,
                    "total": row.total_contributions,
                    "group_return": row.group_return,
                    "contributions": {
                        "player_1": row.player_1_contribution,
                        "player_2": row.player_2_contribution,
                        "player_3": row.player_3_contribution,
                        "player_4": row.player_4_contribution,
                    },
                }
        except Exception as e:
            import traceback
            logger.error(f"finalize_stage_2 error: {e}")
            traceback.print_exc()
            return None

    @database_sync_to_async
    def safe_finalize_round(self, row_id):
        from django.db import transaction
        try:
            with transaction.atomic():
                row = PublicGoodsGameData.objects.select_for_update().get(id=row_id)
                if row.round_completed_at is not None or row.group_return is not None:
                    return None
                
                contribs = [row.player_1_contribution, row.player_2_contribution, 
                            row.player_3_contribution, row.player_4_contribution]
                total = sum(contribs)
                ret = total * row.multiplier / 4
                
                payoffs = []
                for i, c in enumerate(contribs):
                    p = row.endowment - c + ret
                    payoffs.append(p)
                    setattr(row, f"player_{i+1}_stage1_payoff", p)
                    setattr(row, f"player_{i+1}_payoff", p) # initial payoff
                    
                    p_num = i + 1
                    curr_c = getattr(row, f"player_{p_num}_cumulative_contribution")
                    curr_p = getattr(row, f"player_{p_num}_cumulative_payoff")
                    setattr(row, f"player_{p_num}_cumulative_contribution", curr_c + c)
                    setattr(row, f"player_{p_num}_cumulative_payoff", curr_p + p)

                row.group_return = ret
                row.total_contributions = total
                
                # If basic, finalize now
                if row.room_type == "basic":
                    row.round_completed_at = timezone.now()
                    
                # Master row (Round 1) to track completion
                if row.round_number == 1:
                    r1 = row
                else:
                    r1 = PublicGoodsGameData.objects.get(match_id=self.match_id, round_number=1)

                if row.round_number == r1.total_rounds:
                    r1.completed_at = timezone.now()
                
                # FINAL SAVE
                row.save()
                if row.round_number == r1.total_rounds and r1 != row:
                    r1.save()

                if row.round_number == r1.total_rounds:
                    export_public_goods_all()

                return {
                    "round": row.round_number,
                    "room_type": row.room_type,
                    "contributions": {f"player_{i+1}": contribs[i] for i in range(4)},
                    "payoffs": {f"player_{i+1}": payoffs[i] for i in range(4)},
                    "players": {
                        "player_1": row.player_1_fingerprint,
                        "player_2": row.player_2_fingerprint,
                        "player_3": row.player_3_fingerprint,
                        "player_4": row.player_4_fingerprint,
                    },
                    "total": total,
                    "group_return": ret,
                }
        except Exception as e:
            logger.error(f"Finalize error: {e}")
            return None
    @database_sync_to_async
    def assign_player(self, fp):
        from django.db import transaction
        with transaction.atomic():
            row = PublicGoodsGameData.objects.select_for_update().filter(match_id=self.match_id, round_number=1).first()
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
        row = PublicGoodsGameData.objects.filter(match_id=self.match_id, round_number=1).first()
        return row and row.game_mode == "online"

    @database_sync_to_async
    def is_bot_match(self):
        row = PublicGoodsGameData.objects.filter(match_id=self.match_id, round_number=1).first()
        return row and row.game_mode == "bot"

    @database_sync_to_async
    def abort_match_if_not_complete(self):
        """
        Deletes the match data if the game session ends before Round 25.
        This ensures only finished games exist in the database.
        """
        r1 = PublicGoodsGameData.objects.filter(match_id=self.match_id, round_number=1).first()
        if r1 and r1.completed_at is None:
            logger.warning(f"🧹 Pruning incomplete match {self.match_id}")
            PublicGoodsGameData.objects.filter(match_id=self.match_id).delete()
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
