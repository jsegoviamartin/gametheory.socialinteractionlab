from datetime import timedelta
from unittest import mock

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from .models import (
    ConsentForm,
    CustomCommonPool,
    CustomExperiment,
    CustomPrisoner,
    CustomPublicGoods,
    CustomUltimatum,
)


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
