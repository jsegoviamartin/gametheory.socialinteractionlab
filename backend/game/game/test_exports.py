import csv
import io
import sqlite3
import tempfile
from pathlib import Path
from unittest import mock
from uuid import uuid4

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from common_pool.models import CommonPoolGameData
from custom_rooms.models import CustomExperiment
from custom_rooms.participation import CONDITION_MODELS
from public_goods.models import PublicGoodsGameData
from the_game.models import GameMatch, GameRound
from ultimatum.models import UltimatumGameRound

from game import exports


class GameCSVTests(TestCase):
    metadata = ['game_match_uuid', 'round_number', 'experiment_name', 'condition_name', 'secret_code']

    def setUp(self):
        self.owner = User.objects.create_user(username='csv-researcher')
        self.client.force_login(self.owner)
        cleanup = mock.patch('custom_rooms.views.run_old_data_cleanup')
        cleanup.start()
        self.addCleanup(cleanup.stop)

    def create_data(self, game_type, custom=True):
        match_id = uuid4().hex[:8]
        experiment = condition = None
        if custom:
            experiment = CustomExperiment.objects.create(
                creator=self.owner, name='Study, "A"', secret_code='123456', game_type=game_type,
            )
            condition = CONDITION_MODELS[game_type].objects.create(
                experiment=experiment, condition_name='Treatment, "B"', rounds=5,
            )
        shared = {
            'experiment_id': experiment.id if experiment else None,
            'condition_id': condition.id if condition else None,
            'game_mode': 'bot', 'total_rounds': 5,
            'player_1_fingerprint': 'participant', 'player_2_fingerprint': 'bot',
            'player_1_age': 47,
        }
        if game_type == 'prisoner':
            match = GameMatch.objects.create(
                match_id=match_id, is_complete=True, player_1_ip='127.0.0.1',
                player_1_country='Morocco', player_1_city='Rabat', **shared,
            )
            for number in (2, 5):
                GameRound.objects.create(
                    match=match, round_number=number, player_1_action='cooperate', player_2_action='defect',
                    player_1_score=number + 10, player_2_score=number + 20,
                )
        elif game_type == 'ultimatum':
            for number in (2, 5):
                UltimatumGameRound.objects.create(
                    game_match_uuid=match_id, round_number=number, match_complete=True, endowment=75,
                    player_1_coins_to_keep=50, player_1_coins_to_offer=25,
                    player_2_coins_to_keep=40, player_2_coins_to_offer=35,
                    player_1_response_to_p2_offer='accept', player_2_response_to_p1_offer='reject',
                    **shared,
                )
        else:
            model = PublicGoodsGameData if game_type == 'public_goods' else CommonPoolGameData
            parameters = {'endowment': 42, 'multiplier': 2.5} if game_type == 'public_goods' else {'initial_fish_stock': 88}
            for number in (2, 5):
                model.objects.create(
                    match_id=match_id, round_number=number, completed_at=timezone.now(),
                    room_type='reward', **shared, **parameters,
                )
        return experiment, condition, match_id

    def test_custom_downloads_follow_public_goods_metadata_order_and_keep_actual_rounds(self):
        for game_type in CONDITION_MODELS:
            with self.subTest(game_type=game_type):
                experiment, condition, match_id = self.create_data(game_type)
                data = exports.get_user_data_csv(self.owner, game_type, experiment.id)
                reader = csv.DictReader(io.StringIO(data))
                self.assertEqual(reader.fieldnames[:5], self.metadata)
                self.assertNotIn('row_number', reader.fieldnames)
                descriptions = next(reader)
                self.assertEqual(descriptions['round_number'], 'Round number in this match.')
                self.assertTrue(all(descriptions.values()))
                rows = list(reader)
                self.assertEqual([row['round_number'] for row in rows], ['2', '5'])
                for row in rows:
                    self.assertEqual(row['game_match_uuid'], match_id)
                    self.assertEqual(row['experiment_name'], experiment.name)
                    self.assertEqual(row['condition_name'], condition.condition_name)
                    self.assertEqual(row['secret_code'], '123456')
                    self.assertEqual(row['game_mode'], 'bot')
                    self.assertEqual(row['total_rounds'], '5')
                    self.assertEqual(row['player_1_age'], '47')
                    self.assertNotIn(None, row)
                if game_type == 'prisoner':
                    self.assertEqual(rows[0]['player_1_score'], '12')
                elif game_type == 'ultimatum':
                    self.assertEqual(rows[0]['game_type'], 'iterative')
                    self.assertEqual(rows[0]['endowment'], '75')

    def test_combined_download_has_one_match_id_column_and_consistent_metadata(self):
        matches = {game_type: self.create_data(game_type)[2] for game_type in CONDITION_MODELS}
        reader = csv.DictReader(io.StringIO(exports.get_combined_user_data_csv(self.owner)))
        self.assertEqual(reader.fieldnames[:5], self.metadata)
        self.assertNotIn('row_number', reader.fieldnames)
        self.assertNotIn('match_id', reader.fieldnames)
        self.assertEqual(reader.fieldnames.count('game_match_uuid'), 1)
        descriptions = next(reader)
        self.assertTrue(all(descriptions.values()))
        self.assertEqual(descriptions['p1_cc'], 'Player 1 payoff when player 1 cooperates and player 2 cooperates.')
        self.assertEqual(descriptions['p2_dc'], 'Player 2 payoff when player 1 defects and player 2 cooperates.')
        rows = list(reader)
        self.assertEqual(len(rows), 8)
        labels = {'prisoner': '2x2', 'ultimatum': 'ultimatum', 'public_goods': 'public_goods', 'common_pool': 'common_pool'}
        for game_type, label in labels.items():
            game_rows = [row for row in rows if row['game_type_label'] == label]
            self.assertEqual([row['round_number'] for row in game_rows], ['2', '5'])
            self.assertTrue(all(row['game_match_uuid'] == matches[game_type] for row in game_rows))

    def test_download_filenames_match_game_names_for_type_and_experiment_downloads(self):
        expected = {
            'prisoner': '2x2 Economic Games.csv', 'ultimatum': 'Ultimatum.csv',
            'public_goods': 'Public Goods.csv', 'common_pool': 'Common-Pool Resource.csv',
        }
        url = reverse('custom-experiment-download-data')
        for game_type, filename in expected.items():
            experiment, _, _ = self.create_data(game_type)
            for query in ({'game_type': game_type}, {'experiment_id': str(experiment.id), 'game_type': 'all'}):
                with self.subTest(game_type=game_type, query=query):
                    response = self.client.get(url, query)
                    self.assertEqual(response.status_code, 200)
                    self.assertEqual(response['Content-Disposition'], f'attachment; filename="{filename}"')
                    self.assertEqual(next(csv.reader(io.StringIO(response.content.decode())))[:5], self.metadata)
        response = self.client.get(url, {'game_type': 'all'})
        self.assertEqual(response['Content-Disposition'], 'attachment; filename="All Games.csv"')

    def test_static_csv_and_sql_exports_keep_columns_and_values_aligned(self):
        for game_type in CONDITION_MODELS:
            self.create_data(game_type, custom=False)
            self.create_data(game_type, custom=True)
        prefixes = ('PRISONER', 'ULTIMATUM', 'PUBLIC_GOODS', 'COMMON_POOL',
                    'CUSTOM_PRISONER', 'CUSTOM_ULTIMATUM', 'CUSTOM_PUBLIC_GOODS', 'CUSTOM_COMMON_POOL')
        with tempfile.TemporaryDirectory() as directory:
            paths = {f'{prefix}_{kind}': Path(directory) / f'{prefix}.{kind.lower()}'
                     for prefix in prefixes for kind in ('CSV', 'SQL')}
            with mock.patch.multiple(exports, **paths):
                exports.export_prisoner_all()
                exports.export_ultimatum_all()
                exports.export_public_goods_all()
                exports.export_common_pool_all()
            for prefix in prefixes:
                with self.subTest(export=prefix):
                    reader = csv.DictReader(io.StringIO(paths[f'{prefix}_CSV'].read_text()))
                    self.assertEqual(reader.fieldnames[:2], self.metadata[:2])
                    descriptions = next(reader)
                    self.assertTrue(all(descriptions.values()))
                    for row in reader:
                        self.assertIn(row['round_number'], ('2', '5'))
                        self.assertEqual(row['player_1_age'], '47')
                        self.assertNotIn(None, row)
                    with sqlite3.connect(':memory:') as database:
                        database.executescript(paths[f'{prefix}_SQL'].read_text())

    def test_registered_users_csv_also_explains_every_column(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'users.csv'
            with mock.patch.object(exports, 'REGISTERED_USERS_CSV', path):
                exports.export_registered_users()
            reader = csv.DictReader(io.StringIO(path.read_text()))
            descriptions = next(reader)
            self.assertTrue(all(descriptions.values()))
            self.assertEqual(descriptions['Username'], 'Researcher username.')
            self.assertEqual(next(reader)['Username'], self.owner.username)
