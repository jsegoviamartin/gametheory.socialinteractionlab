from datetime import timedelta
from unittest import mock

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from .models import (
    ConsentForm,
    CustomCommonPool,
    CustomExperiment,
    CustomPrisoner,
    CustomPublicGoods,
    CustomUltimatum,
    ExperimentParticipation,
)
from .serializers import CustomExperimentSerializer


class CustomExperimentModeTests(TestCase):
    game_cases = (
        ('prisoner', CustomPrisoner, '/api/prisoners/matchmake_custom/'),
        ('ultimatum', CustomUltimatum, '/api/ultimatum/matchmake-custom/'),
        ('public_goods', CustomPublicGoods, '/api/public-goods/matchmake-custom/'),
        ('common_pool', CustomCommonPool, '/api/common-pool/matchmake-custom/'),
    )

    def setUp(self):
        self.user = User.objects.create_user(username='mode-researcher')

    @mock.patch('custom_rooms.views.run_old_data_cleanup')
    def test_create_and_append_conditions_preserve_experiment_mode(self, _cleanup):
        self.client.force_login(self.user)
        for game_type, _, _ in self.game_cases:
            for mode in ('online', 'bot'):
                with self.subTest(game_type=game_type, mode=mode):
                    response = self.client.post(
                        reverse('custom-experiment-list'),
                        {'name': f'{game_type} {mode}', 'game_type': game_type, 'game_mode': mode},
                        content_type='application/json',
                    )
                    self.assertEqual(response.status_code, 201)
                    experiment_id = response.json()['id']
                    for name in ('Condition 1', 'Condition 2'):
                        added = self.client.post(
                            reverse('custom-experiment-add-condition', args=[experiment_id]),
                            {'condition_name': name},
                            content_type='application/json',
                        )
                        self.assertEqual(added.status_code, 201)
                    detail = self.client.get(reverse('custom-experiment-detail', args=[experiment_id]))
                    self.assertEqual(detail.json()['game_mode'], mode)
                    self.assertEqual(CustomExperiment.objects.get(id=experiment_id).game_mode, mode)

    def test_default_and_invalid_modes(self):
        serializer = CustomExperimentSerializer(data={'name': 'Default', 'game_type': 'prisoner'})
        self.assertTrue(serializer.is_valid(), serializer.errors)
        experiment = serializer.save(creator=self.user)
        self.assertEqual(experiment.game_mode, 'online')

        serializer = CustomExperimentSerializer(data={
            'name': 'Invalid', 'game_type': 'prisoner', 'game_mode': 'both',
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn('game_mode', serializer.errors)

    def test_matchmaking_uses_saved_mode_for_every_game_and_condition(self):
        for game_type, condition_model, url in self.game_cases:
            for mode in ('online', 'bot'):
                experiment = CustomExperiment.objects.create(
                    creator=self.user, name=f'{game_type} {mode}', game_type=game_type, game_mode=mode,
                )
                conditions = [
                    condition_model.objects.create(experiment=experiment, condition_name=f'Condition {i}')
                    for i in (1, 2)
                ]
                for condition in conditions:
                    with self.subTest(game_type=game_type, mode=mode, condition=condition.id):
                        ExperimentParticipation.objects.create(
                            experiment=experiment,
                            player_fingerprint=f'participant-{condition.id}',
                            condition_id=condition.id,
                        )
                        payload = {
                            'experiment_id': str(experiment.id),
                            'condition_id': condition.id,
                            'player_fingerprint': f'participant-{condition.id}',
                        }
                        # Omitted mode must use the researcher's setting.
                        response = self.client.post(url, payload, content_type='application/json')
                        self.assertEqual(response.status_code, 200, response.content)
                        self.assertEqual(response.json()['game_mode'], mode)
                        if mode == 'bot':
                            self.assertEqual(response.json()['status'], 'created_bot_match')
                        else:
                            self.assertIn(response.json()['status'],
                                          ('created_new_match', 'joined_existing_match', 'already_joined'))

                        payload['game_mode'] = mode
                        response = self.client.post(url, payload, content_type='application/json')
                        self.assertEqual(response.status_code, 200, response.content)
                        self.assertEqual(response.json()['game_mode'], mode)

                        # Changing a URL or API payload cannot bypass the experiment setting.
                        payload['game_mode'] = 'online' if mode == 'bot' else 'bot'
                        response = self.client.post(url, payload, content_type='application/json')
                        self.assertEqual(response.status_code, 400, response.content)



class ExperimentAssignmentTests(TestCase):
    game_cases = CustomExperimentModeTests.game_cases

    def setUp(self):
        self.user = User.objects.create_user(username='assignment-researcher')
        cleanup = mock.patch('custom_rooms.views.run_old_data_cleanup')
        cleanup.start()
        self.addCleanup(cleanup.stop)

    def create_experiment(self, game_type, condition_model, mode='online'):
        experiment = CustomExperiment.objects.create(
            creator=self.user, name=f'{game_type} {mode}', game_type=game_type, game_mode=mode,
        )
        ConsentForm.objects.create(
            experiment=experiment, study_title='Study', purpose='Research', investigator='Researcher',
            institution='Lab', contact_email='researcher@example.com', data_collected='Choices',
            data_access='Researcher', storage_duration='14 days',
        )
        conditions = [condition_model.objects.create(
            experiment=experiment, condition_name=f'Condition {i}', rounds=i * 5,
        ) for i in (1, 2)]
        return experiment, conditions

    def accept(self, experiment, fingerprint, condition):
        with mock.patch('custom_rooms.participation.random.choice', return_value=condition.id):
            response = self.client.post(
                reverse('custom-experiment-participation', args=[experiment.id]),
                {'player_fingerprint': fingerprint, 'accepted': True}, content_type='application/json',
            )
        self.assertEqual(response.status_code, 200, response.content)
        return response

    def test_assignment_happens_only_on_acceptance_and_stays_on_repeat_and_refresh(self):
        for game_type, condition_model, _ in self.game_cases:
            with self.subTest(game_type=game_type):
                experiment, conditions = self.create_experiment(game_type, condition_model)
                url = reverse('custom-experiment-participation', args=[experiment.id])
                self.client.get(reverse('custom-experiment-consent', args=[experiment.id]))
                self.assertEqual(self.client.get(url, {'player_fingerprint': 'participant'}).status_code, 403)
                response = self.client.post(url, {'player_fingerprint': 'participant', 'accepted': False},
                                            content_type='application/json')
                self.assertEqual(response.status_code, 400)
                self.assertFalse(experiment.participations.exists())

                accepted = self.accept(experiment, 'participant', conditions[1])
                self.assertEqual(accepted.json()['condition']['id'], conditions[1].id)
                self.assertFalse(any(key.endswith('_conditions') for key in accepted.json()))
                with mock.patch('custom_rooms.participation.random.choice') as choose:
                    repeated = self.client.post(url, {'player_fingerprint': 'participant', 'accepted': True},
                                                content_type='application/json')
                    choose.assert_not_called()
                refreshed = self.client.get(url, {'player_fingerprint': 'participant'})
                self.assertEqual(repeated.json()['condition']['id'], conditions[1].id)
                self.assertEqual(refreshed.json()['condition']['id'], conditions[1].id)
                self.assertEqual(experiment.participations.count(), 1)

                detail = self.client.get(reverse('custom-experiment-detail', args=[experiment.id])).json()
                self.assertFalse(any(key.endswith('_conditions') for key in detail))
                lobby = self.client.get(reverse('custom-experiment-lobby')).json()
                self.assertFalse(any(key.endswith('_conditions') for item in lobby for key in item))
                self.client.force_login(self.user)
                owner_detail = self.client.get(reverse('custom-experiment-detail', args=[experiment.id])).json()
                self.assertEqual(len(owner_detail[f'{game_type}_conditions']), 2)
                self.client.logout()

    def test_consent_acceptance_works_with_and_without_a_researcher_session(self):
        experiment, conditions = self.create_experiment('prisoner', CustomPrisoner)
        url = reverse('custom-experiment-participation', args=[experiment.id])
        for signed_in in (False, True):
            with self.subTest(signed_in=signed_in):
                client = APIClient(enforce_csrf_checks=True)
                if signed_in:
                    client.force_login(self.user)
                fingerprint = f'participant-{signed_in}'
                payload = {'player_fingerprint': fingerprint, 'accepted': False}
                response = client.post(url, payload, format='json')
                self.assertEqual(response.status_code, 400, response.content)
                self.assertFalse(experiment.participations.filter(player_fingerprint=fingerprint).exists())
                payload['accepted'] = True
                with mock.patch('custom_rooms.participation.random.choice', return_value=conditions[1].id):
                    response = client.post(url, payload, format='json')
                self.assertEqual(response.status_code, 200, response.content)
                self.assertEqual(response.json()['condition']['id'], conditions[1].id)
                response = client.get(url, {'player_fingerprint': fingerprint})
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json()['condition']['id'], conditions[1].id)

    def test_researcher_mutations_still_require_session_csrf(self):
        experiment, conditions = self.create_experiment('prisoner', CustomPrisoner)
        client = APIClient(enforce_csrf_checks=True)
        client.force_login(self.user)
        url = reverse('custom-experiment-update-condition', args=[experiment.id])
        response = client.patch(url + f'?condition_id={conditions[0].id}', {'rounds': 8}, format='json')
        self.assertEqual(response.status_code, 403)
        self.assertIn('CSRF', response.json()['detail'])
        conditions[0].refresh_from_db()
        self.assertEqual(conditions[0].rounds, 5)

    def test_online_groups_only_join_participants_with_the_same_assignment(self):
        from the_game.models import GameMatch
        from ultimatum.models import UltimatumGameRound
        from public_goods.models import PublicGoodsGameData
        from common_pool.models import CommonPoolGameData

        match_models = {
            'prisoner': GameMatch, 'ultimatum': UltimatumGameRound,
            'public_goods': PublicGoodsGameData, 'common_pool': CommonPoolGameData,
        }
        for game_type, condition_model, url in self.game_cases:
            with self.subTest(game_type=game_type):
                experiment, conditions = self.create_experiment(game_type, condition_model)
                matches = []
                for fingerprint, condition in [('a1', conditions[0]), ('b1', conditions[1]), ('a2', conditions[0])]:
                    self.accept(experiment, fingerprint, condition)
                    response = self.client.post(url, {
                        'experiment_id': str(experiment.id), 'player_fingerprint': fingerprint,
                    }, content_type='application/json')
                    self.assertEqual(response.status_code, 200, response.content)
                    matches.append(response.json()['match_id'])
                self.assertNotEqual(matches[0], matches[1])
                self.assertEqual(matches[0], matches[2])
                self.assertEqual(match_models[game_type].objects.filter(experiment_id=experiment.id).count(), 2)
                for condition in conditions:
                    match = match_models[game_type].objects.get(experiment_id=experiment.id, condition_id=condition.id)
                    self.assertEqual(match.total_rounds, condition.rounds)

    def test_bot_games_use_assignment_and_both_modes_reject_condition_changes(self):
        from the_game.models import GameMatch
        from ultimatum.models import UltimatumGameRound
        from public_goods.models import PublicGoodsGameData
        from common_pool.models import CommonPoolGameData

        match_models = {
            'prisoner': GameMatch, 'ultimatum': UltimatumGameRound,
            'public_goods': PublicGoodsGameData, 'common_pool': CommonPoolGameData,
        }
        for game_type, condition_model, url in self.game_cases:
            for mode in ('online', 'bot'):
                with self.subTest(game_type=game_type, mode=mode):
                    experiment, conditions = self.create_experiment(game_type, condition_model, mode)
                    payload = {'experiment_id': str(experiment.id), 'player_fingerprint': 'participant'}
                    blocked = self.client.post(url, payload, content_type='application/json')
                    self.assertEqual(blocked.status_code, 403, blocked.content)
                    self.accept(experiment, 'participant', conditions[1])
                    for invalid_id in (conditions[0].id, 999999, 'invalid'):
                        payload['condition_id'] = invalid_id
                        response = self.client.post(url, payload, content_type='application/json')
                        self.assertEqual(response.status_code, 400, response.content)
                    payload.pop('condition_id')
                    response = self.client.post(url, payload, content_type='application/json')
                    self.assertEqual(response.status_code, 200, response.content)
                    match = match_models[game_type].objects.get(experiment_id=experiment.id)
                    self.assertEqual(match.condition_id, conditions[1].id)
                    self.assertEqual(match.total_rounds, conditions[1].rounds)
                    if mode == 'bot':
                        self.assertEqual(response.json()['status'], 'created_bot_match')
                    assigned_id = conditions[1].id
                    conditions[1].delete()
                    response = self.client.post(url, payload, content_type='application/json')
                    self.assertEqual(response.status_code, 400, response.content)
                    self.assertEqual(experiment.participations.get().condition_id, assigned_id)

    def test_missing_consent_or_conditions_cannot_create_assignment(self):
        experiment, _ = self.create_experiment('prisoner', CustomPrisoner)
        experiment.consent_form.delete()
        url = reverse('custom-experiment-participation', args=[experiment.id])
        payload = {'player_fingerprint': 'participant', 'accepted': True}
        self.assertEqual(self.client.post(url, payload, content_type='application/json').status_code, 400)
        self.assertFalse(experiment.participations.exists())
        experiment, _ = self.create_experiment('prisoner', CustomPrisoner)
        experiment.prisoner_conditions.all().delete()
        url = reverse('custom-experiment-participation', args=[experiment.id])
        self.assertEqual(self.client.post(url, payload, content_type='application/json').status_code, 400)
        self.assertFalse(experiment.participations.exists())


class ConditionEditingTests(TestCase):
    game_cases = CustomExperimentModeTests.game_cases

    def setUp(self):
        self.owner = User.objects.create_user(username='condition-owner')
        self.other = User.objects.create_user(username='other-researcher')
        self.client.force_login(self.owner)
        cleanup = mock.patch('custom_rooms.views.run_old_data_cleanup')
        cleanup.start()
        self.addCleanup(cleanup.stop)

    def test_updates_the_selected_condition_without_changing_assignments(self):
        settings = {
            'prisoner': {'p1_cc': 9, 'p2_cd': 0},
            'ultimatum': {'endowment': 60, 'game_type': 'one_shot'},
            'public_goods': {'endowment': 30, 'multiplier': 2.5},
            'common_pool': {'initial_fish_stock': 0, 'final_bonus_multiplier': 0},
        }
        for game_type, condition_model, _ in self.game_cases:
            with self.subTest(game_type=game_type):
                experiment = CustomExperiment.objects.create(
                    creator=self.owner, name=game_type, game_type=game_type, game_mode='bot',
                )
                first = condition_model.objects.create(experiment=experiment, condition_name='Baseline')
                selected = condition_model.objects.create(experiment=experiment, condition_name='Treatment')
                participation = ExperimentParticipation.objects.create(
                    experiment=experiment, player_fingerprint='participant', condition_id=selected.id,
                )
                response = self.client.patch(
                    reverse('custom-experiment-update-condition', args=[experiment.id]) + f'?condition_id={selected.id}',
                    {'condition_name': 'New treatment', 'rounds': 17, **settings[game_type]},
                    content_type='application/json',
                )
                self.assertEqual(response.status_code, 200, response.content)
                self.assertEqual(response.json()['id'], selected.id)
                selected.refresh_from_db()
                first.refresh_from_db()
                participation.refresh_from_db()
                experiment.refresh_from_db()
                self.assertEqual(selected.condition_name, 'New treatment')
                self.assertEqual(selected.rounds, 17)
                self.assertEqual(first.condition_name, 'Baseline')
                self.assertEqual(participation.condition_id, selected.id)
                self.assertEqual(condition_model.objects.filter(experiment=experiment).count(), 2)
                self.assertEqual(experiment.game_mode, 'bot')
                for field, value in settings[game_type].items():
                    self.assertEqual(getattr(selected, field), value)

    def test_requires_owner_and_a_condition_from_that_experiment(self):
        for game_type, condition_model, _ in self.game_cases:
            with self.subTest(game_type=game_type):
                experiment = CustomExperiment.objects.create(creator=self.owner, name=game_type, game_type=game_type)
                elsewhere = CustomExperiment.objects.create(creator=self.owner, name='Other', game_type=game_type)
                condition = condition_model.objects.create(experiment=experiment, condition_name='Treatment')
                foreign = condition_model.objects.create(experiment=elsewhere, condition_name='Other')
                url = reverse('custom-experiment-update-condition', args=[experiment.id])
                self.client.logout()
                response = self.client.patch(url + f'?condition_id={condition.id}', {'rounds': 8}, content_type='application/json')
                self.assertIn(response.status_code, (401, 403))
                self.client.force_login(self.other)
                response = self.client.patch(url + f'?condition_id={condition.id}', {'rounds': 8}, content_type='application/json')
                self.assertEqual(response.status_code, 404)
                self.client.force_login(self.owner)
                response = self.client.patch(url + f'?condition_id={foreign.id}', {'rounds': 8}, content_type='application/json')
                self.assertEqual(response.status_code, 404)
                for query in ('', '?condition_id=invalid', '?condition_id=0'):
                    response = self.client.patch(url + query, {'rounds': 8}, content_type='application/json')
                    self.assertEqual(response.status_code, 400)

    def test_validates_names_and_fields_and_allows_keeping_the_current_name(self):
        experiment = CustomExperiment.objects.create(creator=self.owner, name='Study', game_type='prisoner')
        CustomPrisoner.objects.create(experiment=experiment, condition_name='Baseline')
        condition = CustomPrisoner.objects.create(experiment=experiment, condition_name='Treatment')
        url = reverse('custom-experiment-update-condition', args=[experiment.id]) + f'?condition_id={condition.id}'
        for data in ({'condition_name': 'BASELINE'}, {'condition_name': ''}, {'rounds': 'invalid'}):
            self.assertEqual(self.client.patch(url, data, content_type='application/json').status_code, 400)
        response = self.client.patch(url, {'condition_name': 'Treatment', 'rounds': 8}, content_type='application/json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['rounds'], 8)

    def test_room_type_changes_clear_disabled_reward_and_punishment_values(self):
        for game_type, condition_model, _ in self.game_cases[2:]:
            experiment = CustomExperiment.objects.create(creator=self.owner, name=game_type, game_type=game_type)
            for room_type in ('basic', 'reward', 'punishment'):
                with self.subTest(game_type=game_type, room_type=room_type):
                    condition = condition_model.objects.create(experiment=experiment, condition_name=room_type, room_type='mixed')
                    url = reverse('custom-experiment-update-condition', args=[experiment.id]) + f'?condition_id={condition.id}'
                    response = self.client.patch(url, {'room_type': room_type}, content_type='application/json')
                    self.assertEqual(response.status_code, 200)
                    for prefix in ('reward', 'punishment'):
                        if room_type in ('basic', 'punishment' if prefix == 'reward' else 'reward'):
                            self.assertEqual(response.json()[f'{prefix}_cost'], 0)
                            self.assertEqual(response.json()[f'{prefix}_value'], 0)


class CustomExperimentCleanupTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="researcher", password="pass")

    @mock.patch("game.exports.export_registered_users")
    @mock.patch("game.exports.export_common_pool_all")
    @mock.patch("game.exports.export_public_goods_all")
    @mock.patch("game.exports.export_ultimatum_all")
    @mock.patch("game.exports.export_prisoner_all")
    def test_lobby_cleanup_deletes_all_custom_experiment_game_types_after_14_days(self, *_):
        old_date = timezone.now() - timedelta(days=15)
        recent_date = timezone.now() - timedelta(days=13)

        stale_experiments = []
        for game_type in ["prisoner", "ultimatum", "public_goods", "common_pool"]:
            stale_experiments.append(
                CustomExperiment.objects.create(
                    creator=self.user,
                    name=f"old {game_type}",
                    game_type=game_type,
                )
            )

        recent_experiment = CustomExperiment.objects.create(
            creator=self.user,
            name="recent prisoner",
            game_type="prisoner",
        )

        CustomExperiment.objects.filter(id__in=[exp.id for exp in stale_experiments]).update(created_at=old_date)
        CustomExperiment.objects.filter(id=recent_experiment.id).update(created_at=recent_date)

        CustomPrisoner.objects.create(experiment=stale_experiments[0], condition_name="old prisoner")
        CustomUltimatum.objects.create(experiment=stale_experiments[1], condition_name="old ultimatum")
        CustomPublicGoods.objects.create(experiment=stale_experiments[2], condition_name="old public goods")
        CustomCommonPool.objects.create(experiment=stale_experiments[3], condition_name="old common pool")
        ConsentForm.objects.create(
            experiment=stale_experiments[0],
            study_title="Old consent",
            purpose="Test",
            investigator="Researcher",
            institution="Lab",
            contact_email="researcher@example.com",
            data_collected="Game choices",
            data_access="Researchers",
            storage_duration="14 days",
        )

        response = self.client.get(reverse("custom-experiment-lobby"))

        self.assertEqual(response.status_code, 200)
        self.assertFalse(CustomExperiment.objects.filter(id__in=[exp.id for exp in stale_experiments]).exists())
        self.assertTrue(CustomExperiment.objects.filter(id=recent_experiment.id).exists())
        self.assertEqual(CustomPrisoner.objects.count(), 0)
        self.assertEqual(CustomUltimatum.objects.count(), 0)
        self.assertEqual(CustomPublicGoods.objects.count(), 0)
        self.assertEqual(CustomCommonPool.objects.count(), 0)
        self.assertEqual(ConsentForm.objects.count(), 0)
