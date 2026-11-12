from django.db import migrations


STANDARD_ROOM_CONFIGS = {
    "prisoners-dilemma": {
        "p1_cc": 20, "p2_cc": 20, "p1_cd": 0, "p2_cd": 30,
        "p1_dc": 30, "p2_dc": 0, "p1_dd": 10, "p2_dd": 10,
        "label_a": "Cooperate", "label_b": "Defect",
        "room_name": "Prisoner's Dilemma",
    },
    "bach-stravinsky-1": {
        "p1_cc": 30, "p2_cc": 20, "p1_cd": 0, "p2_cd": 0,
        "p1_dc": 0, "p2_dc": 0, "p1_dd": 20, "p2_dd": 30,
        "label_a": "Prize Fight", "label_b": "Ballet",
        "room_name": "Battle of the Sexes (1)",
    },
    "bach-stravinsky-2": {
        "p1_cc": 30, "p2_cc": 20, "p1_cd": 10, "p2_cd": 10,
        "p1_dc": 0, "p2_dc": 0, "p1_dd": 20, "p2_dd": 30,
        "label_a": "Prize Fight", "label_b": "Ballet",
        "room_name": "Battle of the Sexes (2)",
    },
    "stag-hunt": {
        "p1_cc": 10, "p2_cc": 10, "p1_cd": 1, "p2_cd": 8,
        "p1_dc": 8, "p2_dc": 1, "p1_dd": 5, "p2_dd": 5,
        "label_a": "Stag", "label_b": "Hare",
        "room_name": "Stag Hunt",
    },
}


def repair_incomplete_standard_matches(apps, schema_editor):
    GameMatch = apps.get_model("the_game", "GameMatch")

    for game_type, config in STANDARD_ROOM_CONFIGS.items():
        GameMatch.objects.filter(
            experiment_id__isnull=True,
            is_complete=False,
            game_type=game_type,
        ).update(**config)


class Migration(migrations.Migration):
    dependencies = [
        ("the_game", "0006_gamematch_created_at"),
    ]

    operations = [
        migrations.RunPython(repair_incomplete_standard_matches, migrations.RunPython.noop),
    ]
