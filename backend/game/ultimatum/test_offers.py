import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from asgiref.sync import async_to_sync
from django.test import TestCase

from .consumers import UltimatumGameConsumer
from .models import UltimatumGameRound


class UltimatumOfferTests(TestCase):
    def make_consumer(self, endowment=200, game_type='iterative', game_mode='online'):
        row = UltimatumGameRound.objects.create(
            game_match_uuid=uuid4().hex[:8], round_number=1, total_rounds=3,
            game_type=game_type, game_mode=game_mode, endowment=endowment,
            player_1_fingerprint='participant',
            player_2_fingerprint='bot' if game_mode == 'bot' else 'other-participant',
        )
        consumer = UltimatumGameConsumer()
        consumer.match_id = row.game_match_uuid
        consumer.room_group_name = f'ultimatum_game_{row.game_match_uuid}'
        consumer.send = AsyncMock()
        consumer.channel_layer = SimpleNamespace(group_send=AsyncMock())
        consumer.cancel_offer_timeout = AsyncMock()
        consumer.start_response_timeout = AsyncMock()
        consumer.handle_bot_offer_if_needed = AsyncMock()
        consumer.handle_bot_response_if_needed = AsyncMock()
        return consumer, row

    def offer(self, consumer, keep, offer):
        async_to_sync(consumer.receive)(json.dumps({
            'action': 'make_offer', 'player_fingerprint': 'participant',
            'coins_to_keep': keep, 'coins_to_offer': offer,
        }))

    def test_offer_uses_configured_endowment_for_online_bot_and_one_shot_games(self):
        for endowment in (60, 100, 200):
            for game_mode in ('online', 'bot'):
                for game_type in ('iterative', 'one_shot'):
                    with self.subTest(endowment=endowment, mode=game_mode, game_type=game_type):
                        consumer, row = self.make_consumer(endowment, game_type, game_mode)
                        self.offer(consumer, endowment - 10, 10)
                        consumer.send.assert_not_awaited()
                        row.refresh_from_db()
                        self.assertEqual(row.player_1_coins_to_keep, endowment - 10)
                        self.assertEqual(row.player_1_coins_to_offer, 10)
                        consumer.channel_layer.group_send.assert_awaited()

    def test_wrong_total_is_rejected_without_saving_the_offer(self):
        consumer, row = self.make_consumer(endowment=200)
        self.offer(consumer, 100, 0)
        message = json.loads(consumer.send.await_args.kwargs['text_data'])
        self.assertEqual(message['error'], 'Coins to keep + coins to offer must equal 200')
        row.refresh_from_db()
        self.assertIsNone(row.player_1_coins_to_offer)

    def test_invalid_amounts_are_rejected_without_saving(self):
        for keep, offer in ((-10, 210), (220, -20), ('150', 50), (True, 199), (150.5, 49.5)):
            with self.subTest(keep=keep, offer=offer):
                consumer, row = self.make_consumer()
                self.offer(consumer, keep, offer)
                message = json.loads(consumer.send.await_args.kwargs['text_data'])
                self.assertEqual(message['error'], 'Invalid coin amounts')
                row.refresh_from_db()
                self.assertIsNone(row.player_1_coins_to_offer)

    def test_bot_offer_also_uses_the_configured_endowment(self):
        for endowment in (60, 200):
            with self.subTest(endowment=endowment):
                consumer, row = self.make_consumer(endowment=endowment, game_mode='bot')
                with patch('ultimatum.consumers.asyncio.sleep', new_callable=AsyncMock):
                    async_to_sync(UltimatumGameConsumer.handle_bot_offer_if_needed)(consumer)
                row.refresh_from_db()
                self.assertIsNotNone(row.player_2_coins_to_offer)
                self.assertGreaterEqual(row.player_2_coins_to_keep, 0)
                self.assertEqual(row.player_2_coins_to_offer + row.player_2_coins_to_keep, endowment)
