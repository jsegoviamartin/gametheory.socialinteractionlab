from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from asgiref.sync import sync_to_async, async_to_sync
from .models import UltimatumGameRound
from .game_logic import update_game_stats
import random
import json, asyncio, logging
logger = logging.getLogger(__name__)

from game.exports import export_ultimatum_all

import math
import hashlib


# Separate timeout constants
PROPOSER_TIMEOUT = 25  # 25 seconds for making offers
RESPONSE_TIMEOUT = 25  # 25 seconds for responding to offers

class UltimatumGameConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        self.match_id = self.scope["url_route"]["kwargs"]["match_id"]
        self.player_fingerprint = None
        self.offer_timeout_task = None
        self.response_timeout_task = None  # NEW: Separate timeout for responses

        # Extract IP address from the connection
        self.client_ip = self.scope.get('client', ['unknown', None])[0]
        if hasattr(self.scope, 'headers'):
            for header_name, header_value in self.scope['headers']:
                if header_name == b'x-forwarded-for':
                    self.client_ip = header_value.decode().split(',')[0].strip()
                    break
                elif header_name == b'x-real-ip':
                    self.client_ip = header_value.decode()
                    break

        # Fallback to extracting from scope
        if self.client_ip == 'unknown':
            if 'forwarded' in self.scope:
                forwarded = self.scope['forwarded']
                if forwarded and len(forwarded) > 0:
                    self.client_ip = forwarded[0].get('for', 'unknown')

        self.match_exists = await self.check_match_exists(self.match_id)

        if not self.match_exists:
            logger.warning("Match %s not found – closing WS", self.match_id)
            print(f"Match {self.match_id} not found – closing WS")
            await self.close(code=4004)
            return

        self.room_group_name = f"ultimatum_game_{self.match_id}"
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()
        try:
            game_state = await self.get_game_state()

            await self.send(text_data=json.dumps({
                "game_state": game_state
            }))
            logger.info(f"Player connected to match {self.match_id} from IP {self.client_ip}")
        except Exception as e:
            logger.error(f"Error sending initial game state: {e}")
            await self.send(text_data=json.dumps({
                "error": "Failed to load game state"
            }))

    # OFFER TIMEOUT HELPERS
    async def start_offer_timeout(self):
        """(Re)start a 25-second timer for making offers."""
        await self.cancel_offer_timeout()
        self.offer_timeout_task = asyncio.create_task(self._offer_timeout_loop())

    async def cancel_offer_timeout(self):
        if self.offer_timeout_task and not self.offer_timeout_task.done():
            self.offer_timeout_task.cancel()
        self.offer_timeout_task = None

    async def _offer_timeout_loop(self):
        try:
            await asyncio.sleep(PROPOSER_TIMEOUT)
            current_round = await self.get_current_round()
            if not current_round:
                return

            # Decide whether *this* player still owes an offer
            first = await database_sync_to_async(
                lambda: UltimatumGameRound.objects.get(
                    game_match_uuid=self.match_id, round_number=1
                )
            )()

            needs_offer = (
                (self.player_fingerprint == first.player_1_fingerprint and
                current_round.player_1_coins_to_offer is None)
                or
                (self.player_fingerprint == first.player_2_fingerprint and
                 current_round.player_2_coins_to_offer is None)
            )
            if needs_offer:
                await self.handle_player_timeout("offer")
        except asyncio.CancelledError:
            pass    # normal path when player makes an offer

    # NEW: RESPONSE TIMEOUT HELPERS
    async def start_response_timeout(self):
        """Start a 10-second timer for responding to offers."""
        await self.cancel_response_timeout()
        self.response_timeout_task = asyncio.create_task(self._response_timeout_loop())

    async def cancel_response_timeout(self):
        if self.response_timeout_task and not self.response_timeout_task.done():
            self.response_timeout_task.cancel()
        self.response_timeout_task = None

    async def _response_timeout_loop(self):
        try:
            await asyncio.sleep(RESPONSE_TIMEOUT)
            current_round = await self.get_current_round()
            if not current_round:
                return

            # Decide whether *this* player still owes a response
            first = await database_sync_to_async(
                lambda: UltimatumGameRound.objects.get(
                    game_match_uuid=self.match_id, round_number=1
                )
            )()

            # Check if both offers are made and this player needs to respond
            both_offers_made = (current_round.player_1_coins_to_offer is not None and
                              current_round.player_2_coins_to_offer is not None)

            if both_offers_made:
                needs_response = (
                    (self.player_fingerprint == first.player_1_fingerprint and
                     current_round.player_1_response_to_p2_offer is None)
                    or
                    (self.player_fingerprint == first.player_2_fingerprint and
                     current_round.player_2_response_to_p1_offer is None)
                )
                if needs_response:
                    await self.handle_player_timeout("response")
        except asyncio.CancelledError:
            pass    # normal path when player responds

    async def handle_player_timeout(self, timeout_type="offer"):
        """Handle player timeout for either offer or response phase."""
        logging.warning("Player %s timed-out (%s phase) in match %s",
                        self.player_fingerprint, timeout_type, self.match_id)

        await self.channel_layer.group_send(self.room_group_name, {
            "type": "match_terminated",
            "reason": "timeout",
            "timeout_type": timeout_type,
            "disconnected_player": self.player_fingerprint,
        })
        await self.close(code=4001)

    # --------------------------------------------------------------
    async def disconnect(self, code):
        logger.info(f"Player {getattr(self, 'player_fingerprint', 'unknown')} disconnecting from match {self.match_id} with code {code}")

        # Cancel both timers
        await self.cancel_offer_timeout()
        await self.cancel_response_timeout()

        if hasattr(self, "room_group_name"):
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

        if hasattr(self, 'match_exists') and self.match_exists:
            try:
                is_complete = await self.is_match_complete()

                if not is_complete:
                    logger.info(f"Player disconnected from incomplete match {self.match_id} - terminating match for all players")

                    await self.channel_layer.group_send(self.room_group_name, {
                        "type": "match_terminated",
                        "reason": "Player disconnected",
                        "disconnected_player": getattr(self, 'player_fingerprint', 'unknown')
                    })

                    await asyncio.sleep(0.5)

                    deleted = await self.delete_match_completely()
                    if deleted:
                        logger.info(f"Incomplete match {self.match_id} deleted due to player disconnect")

                    await self.channel_layer.group_send(self.room_group_name, {
                        "type": "force_disconnect",
                        "reason": "player_disconnected",
                    })
                else:
                    logger.info(f"Match {self.match_id} is complete - keeping match data")

            except Exception as e:
                logger.error(f"Error during disconnect cleanup: {e}")

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({"error": "Invalid JSON"}))
            return

        action = data.get("action")
        fp = data.get("player_fingerprint")
        if action == "leave":
            await self.close(code=4001)
            return
        if not action or not fp:
            await self.send(text_data=json.dumps({"error": "Missing action or player_fingerprint"}))
            return

        self.player_fingerprint = fp

        logger.info(f"Received action {action} from player {fp} in match {self.match_id}")

        try:
            gs = await self.get_game_state()
            if gs.get("error"):
                await self.send(text_data=json.dumps({"error": gs["error"]}))
                return

            if gs.get("gameOver"):
                await self.send(text_data=json.dumps({"error": "Game is already over"}))
                return
        except Exception as e:
            logger.error(f"Error getting game state: {e}")
            await self.send(text_data=json.dumps({"error": "Failed to get game state"}))
            return

        # Handle join
        if action == "join":
            try:
                join_result = await self.handle_join_with_ip(fp, self.client_ip)
                if not join_result:
                    await self.send(text_data=json.dumps({"error": "Cannot join match"}))
                    return

                updated_game_state = await self.get_game_state()
                await self.channel_layer.group_send(self.room_group_name, {
                    "type": "game_state_update",
                    "game_state": updated_game_state,
                })

                # Start offer timeout for new rounds
                await self.start_offer_timeout()
                return
            except Exception as e:
                logger.error(f"Error handling join: {e}")
                await self.send(text_data=json.dumps({"error": "Failed to join match"}))
                return

        # Handle make offer
        if action == "make_offer":
            try:
                # Expect new format: {"coins_to_keep": 30, "coins_to_offer": 70}
                coins_to_keep = data.get("coins_to_keep")
                coins_to_offer = data.get("coins_to_offer")

                if coins_to_keep is None or coins_to_offer is None:
                    await self.send(text_data=json.dumps({"error": "Missing coins_to_keep or coins_to_offer"}))
                    return

                if not (0 <= coins_to_keep <= 100) or not (0 <= coins_to_offer <= 100):
                    await self.send(text_data=json.dumps({"error": "Invalid coin amounts"}))
                    return

                if coins_to_keep + coins_to_offer != 100:
                    await self.send(text_data=json.dumps({"error": "Coins to keep + coins to offer must equal 100"}))
                    return

                offer_data = {
                    "coins_to_keep": coins_to_keep,
                    "coins_to_offer": coins_to_offer
                }

                if not await self.process_offer(fp, offer_data):
                    await self.send(text_data=json.dumps({"error": "Cannot make offer"}))
                    return

                # Cancel offer timeout for this player
                await self.cancel_offer_timeout()

                await self.channel_layer.group_send(self.room_group_name, {
                    "type": "game_action",
                    "player_fingerprint": fp,
                    "action": "make_offer",
                    "coins_to_keep": coins_to_keep,
                    "coins_to_offer": coins_to_offer,
                })

                # Check if bot needs to make offer
                await self.handle_bot_offer_if_needed()

                # NEW: Check if both offers are now made and start response timeout
                current_round = await self.get_current_round()
                if (current_round and
                    current_round.player_1_coins_to_offer is not None and
                    current_round.player_2_coins_to_offer is not None):
                    logger.info(f"Both offers made in match {self.match_id}, starting response timeout")
                    await self.start_response_timeout()

            except Exception as e:
                logger.error(f"Error processing offer: {e}")
                await self.send(text_data=json.dumps({"error": "Failed to process offer"}))

        # Handle respond to offer
        elif action == "respond_to_offer":
            try:
                target_player = data.get("target_player")
                response = data.get("response")

                if response not in ["accept", "reject"]:
                    await self.send(text_data=json.dumps({"error": "Invalid response"}))
                    return

                if not await self.process_response(fp, target_player, response):
                    await self.send(text_data=json.dumps({"error": "Cannot respond to offer"}))
                    return

                # Cancel response timeout for this player
                await self.cancel_response_timeout()

                await self.channel_layer.group_send(self.room_group_name, {
                    "type": "game_action",
                    "player_fingerprint": fp,
                    "action": "respond_to_offer",
                    "target_player": target_player,
                    "response": response,
                })

                # Check if bot needs to respond
                await self.handle_bot_response_if_needed()

                # Check if round is complete
                if await self.check_round_complete():
                    logger.info(f"Round complete in match {self.match_id}, calculating results...")

                    # Cancel any remaining timeouts
                    await self.cancel_offer_timeout()
                    await self.cancel_response_timeout()

                    await self.calculate_round_results()
                    gs = await self.get_game_state()

                    await self.channel_layer.group_send(self.room_group_name, {
                        "type": "game_state_update",
                        "game_state": gs,
                    })

                    if gs.get("gameOver"):
                        logger.info(f"Game over for match {self.match_id}")
                        await self.channel_layer.group_send(self.room_group_name, {
                            "type": "game_over",
                            "player1_score": gs.get("player1Score", 0),
                            "player2_score": gs.get("player2Score", 0),
                        })
                        # NEW: write CSV/SQL now that the match is complete
                        await database_sync_to_async(export_ultimatum_all)()
                    else:
                        logger.info(f"Creating next round for match {self.match_id}")
                        next_round_created = await self.create_next_round()
                        if next_round_created:
                            updated_gs = await self.get_game_state()
                            await self.channel_layer.group_send(self.room_group_name, {
                                "type": "game_state_update",
                                "game_state": updated_gs,
                            })
                            # Start offer timeout for new round
                            await self.start_offer_timeout()

            except Exception as e:
                logger.error(f"Error processing response: {e}")
                await self.send(text_data=json.dumps({"error": "Failed to process response"}))

    # Group message handlers
    async def match_terminated(self, event):
        try:
            await self.send(text_data=json.dumps({
                "match_terminated": True,
                "reason": event["reason"],
                "timeout_type": event.get("timeout_type", "unknown"),
                "message": f"Match ended: {event['reason']}",
                "disconnected_player": event.get("disconnected_player", "unknown")
            }))
        except Exception as e:
            logger.error(f"Error sending match termination: {e}")

    async def force_disconnect(self, event):
        try:
            logger.info(f"Force disconnecting player from match {self.match_id}")
            await self.close(code=4001, reason=event.get("reason", "player_disconnected"))
        except Exception as e:
            logger.error(f"Error during force disconnect: {e}")

    async def _broadcast_round_results(self, round_obj: UltimatumGameRound):
        """Send a lightweight snapshot of the round that just ended."""
        payload = {
            "type": "round_results",
            "round_number": round_obj.round_number,
            "p1_offer": round_obj.player_1_coins_to_offer,
            "p2_offer": round_obj.player_2_coins_to_offer,
            "p1_response": round_obj.player_1_response_to_p2_offer,  # what P1 said to P2's offer
            "p2_response": round_obj.player_2_response_to_p1_offer,  # what P2 said to P1's offer
            "p1_earned": round_obj.player_1_coins_made_in_round,
            "p2_earned": round_obj.player_2_coins_made_in_round,
        }
        await self.channel_layer.group_send(
            self.room_group_name,
            {"type": "round_results", "summary": payload},
        )
        # await self.channel_layer.group_send(self.room_group_name, payload)


    async def game_action(self, event):
        try:
            await self.send(text_data=json.dumps({
                "player_fingerprint": event["player_fingerprint"],
                "action": event["action"],
                "coins_to_keep": event.get("coins_to_keep"),
                "coins_to_offer": event.get("coins_to_offer"),
                "response": event.get("response"),
                "target_player": event.get("target_player"),
            }))
        except Exception as e:
            logger.error(f"Error sending game action: {e}")

    async def game_state_update(self, event):
        try:
            await self.send(text_data=json.dumps({
                "game_state": event["game_state"]
            }))
        except Exception as e:
            logger.error(f"Error sending game state update: {e}")

    async def game_over(self, event):
        try:
            await self.send(text_data=json.dumps({
                "game_over": True,
                "player1_score": event["player1_score"],
                "player2_score": event["player2_score"],
            }))
        except Exception as e:
            logger.error(f"Error sending game over: {e}")

    # Database helpers
    @database_sync_to_async
    def check_match_exists(self, match_id):
        return UltimatumGameRound.objects.filter(game_match_uuid=match_id).exists()

    @database_sync_to_async
    def is_match_complete(self):
        try:
            completed_match = UltimatumGameRound.objects.filter(
                game_match_uuid=self.match_id,
                match_complete=True
            ).exists()

            if completed_match:
                return True

            first_round = UltimatumGameRound.objects.filter(
                game_match_uuid=self.match_id,
                round_number=1
            ).first()

            if not first_round:
                return False

            completed_rounds = UltimatumGameRound.objects.filter(
                game_match_uuid=self.match_id,
                player_1_coins_to_offer__isnull=False,
                player_2_coins_to_offer__isnull=False,
                player_1_response_to_p2_offer__isnull=False,
                player_2_response_to_p1_offer__isnull=False
            ).count()

            return completed_rounds >= first_round.total_rounds
        except Exception as e:
            logger.error(f"Error checking if match is complete: {e}")
            return False

    @database_sync_to_async
    def delete_match_completely(self):
        try:
            deleted_count, _ = UltimatumGameRound.objects.filter(
                game_match_uuid=self.match_id
            ).delete()
            logger.info(f"Deleted {deleted_count} rounds for match {self.match_id}")
            return deleted_count > 0
        except Exception as e:
            logger.error(f"Error deleting match {self.match_id}: {e}")
            return False

    @database_sync_to_async
    def handle_join_with_ip(self, fp, ip_address):
        try:
            first_round = UltimatumGameRound.objects.filter(
                game_match_uuid=self.match_id,
                round_number=1
            ).first()

            if not first_round or first_round.match_complete:
                logger.warning(f"Match {self.match_id} not found or complete")
                return False

            if not first_round.player_1_fingerprint:
                first_round.player_1_fingerprint = fp
                first_round.player_1_ip_address = ip_address
                first_round.save()
                logger.info(f"Set player 1 for match {self.match_id}: {fp} from IP {ip_address}")
                return True

            if first_round.player_1_fingerprint == fp:
                # Update IP if changed
                if first_round.player_1_ip_address != ip_address:
                    first_round.player_1_ip_address = ip_address
                    first_round.save()
                    logger.info(f"Updated IP for player 1 in match {self.match_id}: {ip_address}")
                logger.info(f"Player 1 reconnected to match {self.match_id}: {fp}")
                return True

            if first_round.game_mode == "online":
                if not first_round.player_2_fingerprint:
                    if fp == first_round.player_1_fingerprint:
                        logger.warning(f"Same player trying to join as both players: {fp}")
                        return False
                    first_round.player_2_fingerprint = fp
                    first_round.player_2_ip_address = ip_address
                    first_round.save()
                    logger.info(f"Set player 2 for match {self.match_id}: {fp} from IP {ip_address}")
                    return True
                elif first_round.player_2_fingerprint == fp:
                    # Update IP if changed
                    if first_round.player_2_ip_address != ip_address:
                        first_round.player_2_ip_address = ip_address
                        first_round.save()
                        logger.info(f"Updated IP for player 2 in match {self.match_id}: {ip_address}")
                    logger.info(f"Player 2 reconnected to match {self.match_id}: {fp}")
                    return True
                else:
                    logger.warning(f"Match {self.match_id} full")
                    return False
            else:  # bot mode
                if first_round.player_2_fingerprint != "bot":
                    first_round.player_2_fingerprint = "bot"
                    first_round.player_2_ip_address = None
                    first_round.save()
                    logger.info(f"Set bot as player 2 for match {self.match_id}")
                return True

            return False
        except Exception as e:
            logger.error(f"Error in handle_join_with_ip: {e}")
            return False

    @database_sync_to_async
    def handle_join(self, fp):
        # This method is kept for backwards compatibility but uses the new IP-aware method
        return self.handle_join_with_ip(fp, getattr(self, 'client_ip', 'unknown'))

    @database_sync_to_async
    def get_current_round(self):
        try:
            rounds = UltimatumGameRound.objects.filter(
                game_match_uuid=self.match_id
            ).order_by('-round_number')
            return rounds.first()
        except Exception as e:
            logger.error(f"Error getting current round: {e}")
            return None

    @database_sync_to_async
    def process_offer(self, fp, offer_data):
        """
        Process offer with new structure that includes coins_to_keep and coins_to_offer
        offer_data should be: {"coins_to_keep": 30, "coins_to_offer": 70}
        """
        try:
            current_round = UltimatumGameRound.objects.filter(
                game_match_uuid=self.match_id
            ).order_by('-round_number').first()

            if not current_round:
                logger.warning(f"No current round found for match {self.match_id}")
                return False

            first_round = UltimatumGameRound.objects.get(
                game_match_uuid=self.match_id,
                round_number=1
            )

            # Validate that coins_to_keep + coins_to_offer = 100
            # Validate that coins_to_keep + coins_to_offer = endowment
            coins_to_keep = offer_data.get("coins_to_keep")
            coins_to_offer = offer_data.get("coins_to_offer")

            if coins_to_keep is None or coins_to_offer is None:
                logger.warning(f"Missing coins_to_keep or coins_to_offer in offer")
                return False

            if coins_to_keep + coins_to_offer != first_round.endowment:
                logger.warning(f"Invalid offer: coins_to_keep ({coins_to_keep}) + coins_to_offer ({coins_to_offer}) != {first_round.endowment}")
                return False

            # Determine which player is making the offer
            if fp == first_round.player_1_fingerprint:
                if current_round.player_1_coins_to_offer is not None:
                    logger.warning(f"Player 1 already made offer in round {current_round.round_number}")
                    return False
                current_round.player_1_coins_to_keep = coins_to_keep
                current_round.player_1_coins_to_offer = coins_to_offer
            elif fp == first_round.player_2_fingerprint:
                if current_round.player_2_coins_to_offer is not None:
                    logger.warning(f"Player 2 already made offer in round {current_round.round_number}")
                    return False
                current_round.player_2_coins_to_keep = coins_to_keep
                current_round.player_2_coins_to_offer = coins_to_offer
            else:
                logger.warning(f"Unknown player {fp} trying to make offer")
                return False

            current_round.save()
            logger.info(f"Offer processed for player {fp}: keep={coins_to_keep}, offer={coins_to_offer}")
            return True
        except Exception as e:
            logger.error(f"Error processing offer: {e}")
            return False

    @database_sync_to_async
    def process_response(self, fp, target_player, response):
        try:
            current_round = UltimatumGameRound.objects.filter(
                game_match_uuid=self.match_id
            ).order_by('-round_number').first()

            if not current_round:
                logger.warning(f"No current round found for match {self.match_id}")
                return False

            first_round = UltimatumGameRound.objects.get(
                game_match_uuid=self.match_id,
                round_number=1
            )

            # Player 1 responding to Player 2's offer
            if fp == first_round.player_1_fingerprint and target_player == "player_2":
                if current_round.player_2_coins_to_offer is None:
                    logger.warning(f"Player 2 hasn't made offer yet")
                    return False
                if current_round.player_1_response_to_p2_offer is not None:
                    logger.warning(f"Player 1 already responded to Player 2's offer")
                    return False
                current_round.player_1_response_to_p2_offer = response

            # Player 2 responding to Player 1's offer
            elif fp == first_round.player_2_fingerprint and target_player == "player_1":
                if current_round.player_1_coins_to_offer is None:
                    logger.warning(f"Player 1 hasn't made offer yet")
                    return False
                if current_round.player_2_response_to_p1_offer is not None:
                    logger.warning(f"Player 2 already responded to Player 1's offer")
                    return False
                current_round.player_2_response_to_p1_offer = response
            else:
                logger.warning(f"Invalid response from {fp} to {target_player}")
                return False

            current_round.save()
            logger.info(f"Response {response} processed for player {fp} responding to {target_player}")
            return True
        except Exception as e:
            logger.error(f"Error processing response: {e}")
            return False

    @database_sync_to_async
    def check_round_complete(self):
        try:
            current_round = UltimatumGameRound.objects.filter(
                game_match_uuid=self.match_id
            ).order_by('-round_number').first()

            if not current_round:
                return False

            is_complete = current_round.is_round_complete()

            if is_complete:
                logger.info(f"Round {current_round.round_number} complete in match {self.match_id}")

            return is_complete
        except Exception as e:
            logger.error(f"Error checking round complete: {e}")
            return False

    @database_sync_to_async
    def calculate_round_results(self):
        try:
            current_round = UltimatumGameRound.objects.filter(
                game_match_uuid=self.match_id
            ).order_by('-round_number').first()

            if not current_round:
                return False

            # 1) write the numbers
            update_game_stats(self.match_id, current_round.round_number)

            # 🔥 2) pull the fresh values so p1_earned / p2_earned aren’t 0
            current_round.refresh_from_db()          #  ← add this line

            summary = {
                "round_number": current_round.round_number,
                "p1_offer":    current_round.player_1_coins_to_offer,
                "p2_offer":    current_round.player_2_coins_to_offer,
                "p1_response": current_round.player_2_response_to_p1_offer,
                "p2_response": current_round.player_1_response_to_p2_offer,
                "p1_earned":   current_round.player_1_coins_made_in_round,
                "p2_earned":   current_round.player_2_coins_made_in_round,
            }
            summary = {
                "round_number": current_round.round_number,
                "p1_offer":    current_round.player_1_coins_to_offer,
                "p2_offer":    current_round.player_2_coins_to_offer,
                "p1_response": current_round.player_1_response_to_p2_offer,  # what P1 said
                "p2_response": current_round.player_2_response_to_p1_offer,  # what P2 said
                "p1_earned":   current_round.player_1_coins_made_in_round,
                "p2_earned":   current_round.player_2_coins_made_in_round,
            }
            # send to **every** socket in the match
            async_to_sync(self.channel_layer.group_send)(
                self.room_group_name,
                {
                    "type": "round_results",   # custom handler ↓
                    "summary": summary,
                },
            )
            return True
        except Exception as e:
            logger.error(f"Error calculating round results: {e}")
            return False
    async def round_results(self, event):
        """Handle round results broadcast"""
        try:
            # Add a small delay to ensure the client is ready
            await asyncio.sleep(0.5)

            await self.send(text_data=json.dumps({
                "round_results": event["summary"]
            }))
            logger.info(f"Sent round results for round {event['summary']['round_number']} to player {self.player_fingerprint}")
        except Exception as e:
            logger.error(f"Error sending round results: {e}")
    # @database_sync_to_async
    # def calculate_round_results(self):
    #     try:
    #         current_round = UltimatumGameRound.objects.filter(
    #             game_match_uuid=self.match_id
    #         ).order_by('-round_number').first()

    #         if current_round:
    #             update_game_stats(self.match_id, current_round.round_number)

    #             logger.info(f"Round results calculated for round {current_round.round_number} in match {self.match_id}")
    #             return True
    #         return False
    #     except Exception as e:
    #         logger.error(f"Error calculating round results: {e}")
    #         return False

    @database_sync_to_async
    def create_next_round(self):
        try:
            current_round = UltimatumGameRound.objects.filter(
                game_match_uuid=self.match_id
            ).order_by('-round_number').first()

            if not current_round:
                logger.error(f"No current round found for match {self.match_id}")
                return False

            first_round = UltimatumGameRound.objects.get(
                game_match_uuid=self.match_id,
                round_number=1
            )

            if current_round.round_number >= first_round.total_rounds:
                logger.info(f"Match {self.match_id} complete - {first_round.total_rounds} rounds reached")
                return False

            next_round_num = current_round.round_number + 1
            existing_next_round = UltimatumGameRound.objects.filter(
                game_match_uuid=self.match_id,
                round_number=next_round_num
            ).first()

            if existing_next_round:
                logger.info(f"Round {next_round_num} already exists for match {self.match_id}")
                return True

            next_round = UltimatumGameRound.objects.create(
                game_match_uuid=self.match_id,
                round_number=next_round_num,
                game_mode=first_round.game_mode,
                player_1_fingerprint=first_round.player_1_fingerprint,
                player_2_fingerprint=first_round.player_2_fingerprint,
                player_1_country=first_round.player_1_country,
                player_1_city=first_round.player_1_city,
                player_2_country=first_round.player_2_country,
                player_2_city=first_round.player_2_city,
                player_1_ip_address=first_round.player_1_ip_address,  # Copy IP addresses
                player_2_ip_address=first_round.player_2_ip_address,
                experiment_id=first_round.experiment_id,
                condition_id=first_round.condition_id,
                endowment=first_round.endowment,
                total_rounds=first_round.total_rounds,
            )
            logger.info(f"Created round {next_round.round_number} for match {self.match_id}")
            return True

        except Exception as e:
            logger.error(f"Error creating next round: {e}")
            return False

    @database_sync_to_async
    def get_game_state(self):
        try:
            rounds = list(UltimatumGameRound.objects.filter(
                game_match_uuid=self.match_id
            ).order_by('round_number'))

            if not rounds:
                return {"error": "No rounds found"}

            first_round = rounds[0]
            current_round = rounds[-1]

            # Calculate totals from completed rounds
            completed_rounds = [r for r in rounds if r.is_round_complete()]

            total_p1_score = sum(r.player_1_coins_made_in_round for r in completed_rounds)
            total_p2_score = sum(r.player_2_coins_made_in_round for r in completed_rounds)

            # Build history with new fields
            history = []
            for r in completed_rounds:
                history.append({
                    "roundNumber": r.round_number,
                    "player1CoinsToKeep": r.player_1_coins_to_keep,
                    "player1CoinsToOffer": r.player_1_coins_to_offer,
                    "player2CoinsToKeep": r.player_2_coins_to_keep,
                    "player2CoinsToOffer": r.player_2_coins_to_offer,
                    "player1ResponseToP2": r.player_1_response_to_p2_offer,
                    "player2ResponseToP1": r.player_2_response_to_p1_offer,
                    "player1Earned": r.player_1_coins_made_in_round,
                    "player2Earned": r.player_2_coins_made_in_round,
                })

            next_round_num = len(completed_rounds) + 1
            game_over = current_round.match_complete or next_round_num > first_round.total_rounds
            waiting_for_opponent = (not bool(first_round.player_2_fingerprint) and
                                  first_round.game_mode == "online")

            return {
                "currentRound": min(next_round_num, first_round.total_rounds),
                "maxRounds": first_round.total_rounds,
                "endowment": first_round.endowment,
                "experimentId": str(first_round.experiment_id) if first_round.experiment_id else None,
                "player1Score": total_p1_score,
                "player2Score": total_p2_score,
                "roundHistory": history,
                "waitingForOpponent": waiting_for_opponent,
                "gameOver": game_over,
                "gameMode": first_round.game_mode,
                "player1Fingerprint": first_round.player_1_fingerprint,
                "player2Fingerprint": first_round.player_2_fingerprint,
                "currentRoundState": {
                    "roundNumber": current_round.round_number,
                    "player1OfferMade": current_round.player_1_coins_to_offer is not None,
                    "player2OfferMade": current_round.player_2_coins_to_offer is not None,
                    "player1ResponseMade": current_round.player_1_response_to_p2_offer is not None,
                    "player2ResponseMade": current_round.player_2_response_to_p1_offer is not None,
                    "player1CoinsToKeep": current_round.player_1_coins_to_keep,
                    "player1CoinsToOffer": current_round.player_1_coins_to_offer,
                    "player2CoinsToKeep": current_round.player_2_coins_to_keep,
                    "player2CoinsToOffer": current_round.player_2_coins_to_offer,
                    "player1Response": current_round.player_1_response_to_p2_offer,
                    "player2Response": current_round.player_2_response_to_p1_offer,
                }
            }
        except Exception as e:
            logger.error(f"Error getting game state: {e}")
            return {"error": f"Failed to get game state: {str(e)}"}

    # Bot helpers
    async def handle_bot_offer_if_needed(self):
        try:
            current_round = await self.get_current_round()
            if (current_round and current_round.game_mode == "bot" and
                current_round.player_2_fingerprint == "bot" and
                current_round.player_2_coins_to_offer is None):

                # await asyncio.sleep(1.0)  # Bot thinking time
                # coins_to_offer = random.randint(20, 50)
                # coins_to_keep = 100 - coins_to_offer
                #
                # offer_data = {
                #     "coins_to_keep": coins_to_keep,
                #     "coins_to_offer": coins_to_offer
                # }
                #
                # if await self.process_offer("bot", offer_data):
                #     await self.channel_layer.group_send(self.room_group_name, {
                #         "type": "game_action",
                #         "player_fingerprint": "bot",
                #         "action": "make_offer",
                #         "coins_to_keep": coins_to_keep,
                #         "coins_to_offer": coins_to_offer,
                #     })
                #     logger.info(f"Bot made offer: keep={coins_to_keep}, offer={coins_to_offer}")

                await asyncio.sleep(1.0)  # Bot thinking time

                # --- Mixed strategy with anchored offers, soft high-end, reciprocity clamp ---
                # --- The bot follows an anchored, mixed strategy with probabilistic, diminishing concessions.
                # It draws an anchor in 25–35 coins to the human, then after each completed round either
                # makes a modest concession after rejection (45% chance, +2/3/4 coins) or trims slightly
                # after acceptance (65% chance, −1/2 coins), otherwise holding its prior offer.
                # Offers include small noise (±2) and are subject to a reciprocity clamp so the bot
                # does not exceed the human’s recent average offer by more than ≈ 12 coins.
                # Very generous offers above 50 coins are allowed but rare (kept with ~20% probability) and capped at 60. ---

                # Seed a per-round RNG so behavior is reproducible within the match but varies by round
                current_round = await self.get_current_round()
                seed = int(hashlib.sha256(f"offer:{self.match_id}:{current_round.round_number}".encode()).hexdigest(), 16) & 0xffffffff
                rng = random.Random(seed)

                endowment = first_round.endowment
                HARD_MIN_OFFER = int(endowment * 0.15)   # absolute lower bound (to human)
                SOFT_UPPER     = int(endowment * 0.50)   # above this is allowed but rarer
                HARD_MAX_OFFER = int(endowment * 0.60)   # absolute upper bound (so >50% is possible but capped)

                # Fetch prior rounds to inspect behavior
                rounds = await database_sync_to_async(
                    lambda: list(UltimatumGameRound.objects
                                 .filter(game_match_uuid=self.match_id)
                                 .order_by('round_number'))
                )()

                # Human's recent behavior (last 5 proposed offers to the bot)
                human_offers = [r.player_1_coins_to_offer for r in rounds if r.player_1_coins_to_offer is not None]
                if human_offers:
                    last_k = human_offers[-5:]
                    human_avg = sum(last_k) / len(last_k)
                else:
                    human_avg = endowment * 0.30

                # Baseline target from last completed round (if any), otherwise draw an anchor 25–35
                last_completed = next((r for r in reversed(rounds)
                                       if r.is_round_complete() and r.player_2_coins_to_offer is not None),
                                      None)
                if last_completed is None:
                    target = rng.randint(int(endowment * 0.25), int(endowment * 0.35))
                else:
                    last_offer = last_completed.player_2_coins_to_offer
                    human_resp = last_completed.player_1_response_to_p2_offer  # human’s decision about bot’s offer

                    # Probabilistic, diminishing concessions:
                    # - After REJECT: 45% chance to increase modestly; otherwise hold
                    # - After ACCEPT: 65% chance to trim slightly; otherwise hold
                    if human_resp == "reject":
                        if rng.random() < 0.45:
                            step = rng.choice([2, 3, 4])
                            target = last_offer + step
                        else:
                            target = last_offer
                    elif human_resp == "accept":
                        if rng.random() < 0.65:
                            step = rng.choice([1, 2])
                            target = last_offer - step
                        else:
                            target = last_offer
                    else:
                        # No clear signal → mild mean reversion toward ~32%
                        base = rng.uniform(endowment * 0.31, endowment * 0.33)
                        target = last_offer + (1 if last_offer < base else -1 if last_offer > base else 0)

                # Reciprocity clamp: avoid “human selfish, bot generous”
                # Bot won't exceed human's recent average by more than ~12% of endowment
                upper_limit = min(HARD_MAX_OFFER, human_avg + (endowment * 0.12))
                # (Optional) don’t undercut human by more than ~15% (prevents extreme stinginess)
                lower_limit = max(HARD_MIN_OFFER, human_avg - (endowment * 0.15))
                target = max(lower_limit, min(upper_limit, target))

                # Add small noise to avoid looking mechanical (slightly more stochastic than before)
                noise_range = max(1, int(endowment * 0.02))
                noise = rng.randint(-noise_range, noise_range)
                proposal = target + noise

                # Soft high-end: allow >50 but make it rare
                if proposal > SOFT_UPPER:
                    # Keep high proposal only 20% of the time; otherwise pull back near 48–52
                    if rng.random() < 0.20:
                        proposal = min(proposal, HARD_MAX_OFFER)
                    else:
                        proposal = (endowment * 0.48) + rng.uniform(0, endowment * 0.04)

                # Final clip and cast
                coins_to_offer = int(max(HARD_MIN_OFFER, min(HARD_MAX_OFFER, round(proposal))))
                coins_to_keep  = first_round.endowment - coins_to_offer

                offer_data = {
                    "coins_to_keep": coins_to_keep,
                    "coins_to_offer": coins_to_offer
                }

                if await self.process_offer("bot", offer_data):
                    await self.channel_layer.group_send(self.room_group_name, {
                        "type": "game_action",
                        "player_fingerprint": "bot",
                        "action": "make_offer",
                        "coins_to_keep": coins_to_keep,
                        "coins_to_offer": coins_to_offer,
                    })
                    logger.info(
                        f"Bot offer: keep={coins_to_keep}, offer={coins_to_offer} "
                        f"(human_avg≈{human_avg:.1f}, target≈{target}, noise={noise})"
                    )

                    # Check if both offers are now made (human + bot)
                    updated_round = await self.get_current_round()
                    if (updated_round and
                        updated_round.player_1_coins_to_offer is not None and
                        updated_round.player_2_coins_to_offer is not None):
                        logger.info(f"Both offers made (including bot) in match {self.match_id}, starting response timeout")
                        await self.start_response_timeout()

        except Exception as e:
            logger.error(f"Error making bot offer: {e}")

    async def handle_bot_response_if_needed(self):
        try:
            current_round = await self.get_current_round()
            if (current_round and current_round.game_mode == "bot" and
                current_round.player_2_fingerprint == "bot"):

                # Bot responds to player 1's offer
                if (current_round.player_1_coins_to_offer is not None and
                    current_round.player_2_response_to_p1_offer is None):

                    # await asyncio.sleep(1.0)  # Bot thinking time
                    # response = "accept" if current_round.player_1_coins_to_offer >= 30 else "reject"
                    #
                    # if await self.process_response("bot", "player_1", response):
                    #     await self.cancel_response_timeout()
                    #     await self.channel_layer.group_send(self.room_group_name, {
                    #         "type": "game_action",
                    #         "player_fingerprint": "bot",
                    #         "action": "respond_to_offer",
                    #         "target_player": "player_1",
                    #         "response": response,
                    #     })
                    #     logger.info(f"Bot responded {response} to player 1's offer {current_round.player_1_coins_to_offer}")

                    await asyncio.sleep(1.0)  # Bot thinking time

                    # --- The bot accepts the human’s offer with a logistic probability centered near 30 coins,
                    # with mild per‑round jitter (±3) and a small acceptance floor/ceiling (5%–95%).
                    # The center shifts by up to ±6 coins based on the human’s recent average offers (more selfish behavior → higher threshold),
                    #  yielding a slightly reciprocal and stochastic acceptance pattern. ---

                    offer_to_bot = current_round.player_1_coins_to_offer

                    # Seed per (match, round) for stable behavior within the game
                    seed = int(hashlib.sha256(f"resp:{self.match_id}:{current_round.round_number}".encode()).hexdigest(), 16) & 0xffffffff
                    rng = random.Random(seed)

                    # Look at recent human offers (last 5) to shift acceptance threshold slightly
                    rounds = await database_sync_to_async(
                        lambda: list(UltimatumGameRound.objects
                                     .filter(game_match_uuid=self.match_id)
                                     .order_by('round_number'))
                    )()
                    human_offers = [r.player_1_coins_to_offer for r in rounds if r.player_1_coins_to_offer is not None]
                    if human_offers:
                        last_k = human_offers[-5:]
                        human_avg = sum(last_k) / len(last_k)
                    else:
                        human_avg = endowment * 0.30

                    # Base threshold ~30%, shifted by human generosity (selfish human → tougher threshold)
                    # Clamp the bias to ±6% of endowment so it never swings too far
                    base_threshold = endowment * 0.30
                    bias   = max(-(endowment * 0.06), min(endowment * 0.06, (base_threshold - human_avg) * 0.25))
                    center = base_threshold + bias + rng.uniform(-(endowment * 0.03), endowment * 0.03)  # add small jitter
                    sigma  = endowment * 0.07                                # slightly smoother S-curve than before
                    epsilon = 0.05                              # never purely 0/1 probability

                    # Logistic acceptance with floors/ceilings
                    logit   = (offer_to_bot - center) / sigma
                    p_raw   = 1.0 / (1.0 + math.exp(-logit))
                    p_accept = epsilon + (1.0 - 2.0*epsilon) * p_raw

                    response = "accept" if rng.random() < p_accept else "reject"

                    if await self.process_response("bot", "player_1", response):
                        await self.cancel_response_timeout()
                        await self.channel_layer.group_send(self.room_group_name, {
                            "type": "game_action",
                            "player_fingerprint": "bot",
                            "action": "respond_to_offer",
                            "target_player": "player_1",
                            "response": response,
                        })
                        logger.info(
                            f"Bot resp: offer_to_bot={offer_to_bot} center≈{center:.1f} p≈{p_accept:.2f} → {response}"
                        )


        except Exception as e:
            logger.error(f"Error making bot response: {e}")
