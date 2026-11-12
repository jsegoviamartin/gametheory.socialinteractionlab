import json

from django.test import TestCase
from django.urls import reverse

from .models import GameMatch


class StandardRoomConfigurationTests(TestCase):
    def test_bot_matches_store_the_selected_standard_room_configuration(self):
        expected_rooms = {
            "prisoners-dilemma": {
                "payoffs": (20, 20, 0, 30, 30, 0, 10, 10),
                "labels": ("Cooperate", "Defect"),
            },
            "bach-stravinsky-1": {
                "payoffs": (30, 20, 0, 0, 0, 0, 20, 30),
                "labels": ("Prize Fight", "Ballet"),
            },
            "bach-stravinsky-2": {
                "payoffs": (30, 20, 10, 10, 0, 0, 20, 30),
                "labels": ("Prize Fight", "Ballet"),
            },
            "stag-hunt": {
                "payoffs": (10, 10, 1, 8, 8, 1, 5, 5),
                "labels": ("Stag", "Hare"),
            },
        }

        for game_type, expected in expected_rooms.items():
            with self.subTest(game_type=game_type):
                response = self.client.post(
                    reverse("create_match"),
                    data=json.dumps({
                        "game_mode": "bot",
                        "game_type": game_type,
                        "player_fingerprint": f"player-{game_type}",
                    }),
                    content_type="application/json",
                )

                self.assertEqual(response.status_code, 200)
                match = GameMatch.objects.get(match_id=response.json()["match_id"])
                self.assertEqual(
                    (
                        match.p1_cc, match.p2_cc, match.p1_cd, match.p2_cd,
                        match.p1_dc, match.p2_dc, match.p1_dd, match.p2_dd,
                    ),
                    expected["payoffs"],
                )
                self.assertEqual((match.label_a, match.label_b), expected["labels"])
