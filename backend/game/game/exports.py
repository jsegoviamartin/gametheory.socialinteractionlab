# backend/game/game/exports.py
from __future__ import annotations

import csv
import json
import os
import tempfile
import io
from pathlib import Path
from typing import Iterable, List, Tuple, Any

from django.conf import settings

# Import PD models
from the_game.models import GameMatch, GameRound

# Import ultimatum
from django.db.models import Case, Count, IntegerField, Min, When
from ultimatum.models import UltimatumGameRound

# Import Public Goods
from public_goods.models import PublicGoodsGameData

# Import Common Pool
from common_pool.models import CommonPoolGameData

# Import Custom Experiments
from custom_rooms.models import CustomExperiment, CustomPrisoner, CustomUltimatum, CustomPublicGoods, CustomCommonPool

# Where we write the four canonical files.
# BASE_DIR is backend/game  → parent() is backend/
# EXPORT_ROOT: Path = Path(settings.BASE_DIR).parent
EXPORT_ROOT: Path = Path(settings.BASE_DIR)


PRISONER_CSV = EXPORT_ROOT / "data_prisoner_clean.csv"
PRISONER_SQL = EXPORT_ROOT / "data_prisoners.sql"

ULTIMATUM_CSV = EXPORT_ROOT / "data_ultimatum_clean.csv"
ULTIMATUM_SQL = EXPORT_ROOT / "data_ultimatum.sql"

PUBLIC_GOODS_CSV = EXPORT_ROOT / "data_public_goods_clean.csv"
PUBLIC_GOODS_SQL = EXPORT_ROOT / "data_public_goods.sql"

COMMON_POOL_CSV = EXPORT_ROOT / "data_common_pool_clean.csv"
COMMON_POOL_SQL = EXPORT_ROOT / "data_common_pool.sql"

CUSTOM_PRISONER_CSV = EXPORT_ROOT / "data_custom_prisoner_clean.csv"
CUSTOM_PRISONER_SQL = EXPORT_ROOT / "data_custom_prisoners.sql"

CUSTOM_ULTIMATUM_CSV = EXPORT_ROOT / "data_custom_ultimatum_clean.csv"
CUSTOM_ULTIMATUM_SQL = EXPORT_ROOT / "data_custom_ultimatum.sql"

CUSTOM_PUBLIC_GOODS_CSV = EXPORT_ROOT / "data_custom_public_goods_clean.csv"
CUSTOM_PUBLIC_GOODS_SQL = EXPORT_ROOT / "data_custom_public_goods.sql"

CUSTOM_COMMON_POOL_CSV = EXPORT_ROOT / "data_custom_common_pool_clean.csv"
CUSTOM_COMMON_POOL_SQL = EXPORT_ROOT / "data_custom_common_pool.sql"



def _sql_literal(val: Any) -> str:
    """Render a Python value as an SQL literal."""
    if val is None or val == "":
        return "NULL"
    if isinstance(val, bool):
        return "TRUE" if val else "FALSE"
    if isinstance(val, (int, float)):
        return str(val)
    # Text
    s = str(val).replace("'", "''")
    return f"'{s}'"


def _atomic_write(path: Path, write_fn) -> None:
    """Write to a temp file and atomically replace target."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix=path.name + ".", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="") as f:
            write_fn(f)
        os.replace(tmp_name, path)
        # Ensure the file is readable by the host user (since it's created as root in Docker)
        os.chmod(path, 0o644)
    finally:
        # If anything went wrong and tmp still exists, try to remove it
        try:
            if os.path.exists(tmp_name):
                os.unlink(tmp_name)
        except Exception:
            pass


def _prisoner_rows() -> Tuple[List[str], Iterable[List[Any]]]:
    """
    Build rows for Prisoner's Dilemma export (completed matches only),
    mirroring the column order used in extract_all_game_data.sql.
    """
    headers = [
        "row_number",
        "game_match_uuid",
        "game_mode",
        "player_1_fingerprint",
        "player_1_action",
        "player_1_score",
        "player_2_fingerprint",
        "player_2_action",
        "player_2_score",
        "player_1_cooperation_percent",
        "player_2_cooperation_percent",
        "avg_cooperation_percent",
        "player_1_cumulative_score",
        "player_2_cumulative_score",
        "player_1_country",
        "player_1_city",
        "player_2_country",
        "player_2_city",
        "round_start",
        "round_end",
        "match_complete",
        "match_completed_at",
        # Survey (P1)
        "player_1_age",
        "player_1_gender",
        "player_1_nationality",
        "player_1_residence",
        "player_1_education",
        "player_1_religion",
        "player_1_meditation",
        "player_1_meditation_years",
        "player_1_punitive_God",
        "player_1_game_theory",
        "player_1_other",
        # Survey (P2)
        "player_2_age",
        "player_2_gender",
        "player_2_nationality",
        "player_2_residence",
        "player_2_education",
        "player_2_religion",
        "player_2_meditation",
        "player_2_meditation_years",
        "player_2_punitive_God",
        "player_2_game_theory",
        "player_2_other",
    ]
    # Only fully played rounds from completed matches
    qs = (
        GameRound.objects.select_related("match")
        .filter(
            match__is_complete=True,
            match__experiment_id__isnull=True,
            player_1_action__isnull=False,
            player_2_action__isnull=False,
        )
        .order_by("match__match_id", "round_number")
    )

    def row_iter():
        last_uuid = None
        rn = 0
        for gr in qs:
            gm = gr.match
            uuid = gm.match_id
            if uuid != last_uuid:
                rn = 1
                last_uuid = uuid
            else:
                rn += 1

            yield [
                rn,
                gm.match_id,
                gm.game_mode,
                gm.player_1_fingerprint,
                gr.player_1_action,
                gr.player_1_score,
                gm.player_2_fingerprint,
                gr.player_2_action,
                gr.player_2_score,
                gr.player_1_cooperation_percent,
                gr.player_2_cooperation_percent,
                gr.avg_cooperation_percent,
                gr.player_1_cumulative_score,
                gr.player_2_cumulative_score,
                gm.player_1_country,
                gm.player_1_city,
                gm.player_2_country,
                gm.player_2_city,
                gr.round_start_time,
                gr.round_end_time,
                gm.is_complete,
                gm.completed_at,
                # Survey P1
                gm.player_1_age,
                gm.player_1_gender,
                gm.player_1_nationality,
                gm.player_1_residence,
                gm.player_1_education,
                gm.player_1_religion,
                gm.player_1_meditation,
                gm.player_1_meditation_years,
                gm.player_1_punitive_God,
                gm.player_1_game_theory,
                gm.player_1_other,
                # Survey P2
                gm.player_2_age,
                gm.player_2_gender,
                gm.player_2_nationality,
                gm.player_2_residence,
                gm.player_2_education,
                gm.player_2_religion,
                gm.player_2_meditation,
                gm.player_2_meditation_years,
                gm.player_2_punitive_God,
                gm.player_2_game_theory,
                gm.player_2_other,
            ]

    return headers, row_iter()


def export_prisoner_all() -> None:
    """
    Export completed Prisoner's Dilemma matches into:
      - backend/data_prisoner_clean.csv
      - backend/data_prisoners.sql
    Called after last round and again after survey submit.
    """
    headers, rows = _prisoner_rows()

    # 1) CSV (comma-delimited, Excel-friendly)
    def write_csv(fh):
        writer = csv.writer(fh, delimiter=",", quoting=csv.QUOTE_MINIMAL)
        writer.writerow(headers)
        for r in rows:
            writer.writerow(["" if v is None else v for v in r])

    _atomic_write(PRISONER_CSV, write_csv)

    # Rebuild rows (generator consumed) for SQL writing
    _, rows2 = _prisoner_rows()

    # 2) SQL (DDL + INSERTs)
    ddl = f"""BEGIN;

CREATE TABLE IF NOT EXISTS data_prisoners (
    row_number INTEGER,
    game_match_uuid TEXT,
    game_mode TEXT,
    player_1_fingerprint TEXT,
    player_1_action TEXT,
    player_1_score INTEGER,
    player_2_fingerprint TEXT,
    player_2_action TEXT,
    player_2_score INTEGER,
    player_1_cooperation_percent REAL,
    player_2_cooperation_percent REAL,
    avg_cooperation_percent REAL,
    player_1_cumulative_score INTEGER,
    player_2_cumulative_score INTEGER,
    player_1_country TEXT,
    player_1_city TEXT,
    player_2_country TEXT,
    player_2_city TEXT,
    round_start TEXT,
    round_end TEXT,
    match_complete BOOLEAN,
    match_completed_at TEXT,
    player_1_age INTEGER,
    player_1_gender TEXT,
    player_1_nationality TEXT,
    player_1_residence TEXT,
    player_1_education TEXT,
    player_1_religion TEXT,
    player_1_meditation TEXT,
    player_1_meditation_years INTEGER,
    player_1_punitive_God TEXT,
    player_1_game_theory TEXT,
    player_1_other TEXT,
    player_2_age INTEGER,
    player_2_gender TEXT,
    player_2_nationality TEXT,
    player_2_residence TEXT,
    player_2_education TEXT,
    player_2_religion TEXT,
    player_2_meditation TEXT,
    player_2_meditation_years INTEGER,
    player_2_punitive_God TEXT,
    player_2_game_theory TEXT,
    player_2_other TEXT
);

DELETE FROM data_prisoners;
"""

    def write_sql(fh):
        fh.write(ddl)
        cols_sql = ", ".join(
            [
                "row_number",
                "game_match_uuid",
                "game_mode",
                "player_1_fingerprint",
                "player_1_action",
                "player_1_score",
                "player_2_fingerprint",
                "player_2_action",
                "player_2_score",
                "player_1_cooperation_percent",
                "player_2_cooperation_percent",
                "avg_cooperation_percent",
                "player_1_cumulative_score",
                "player_2_cumulative_score",
                "player_1_country",
                "player_1_city",
                "player_2_country",
                "player_2_city",
                "round_start",
                "round_end",
                "match_complete",
                "match_completed_at",
                "player_1_age",
                "player_1_gender",
                "player_1_nationality",
                "player_1_residence",
                "player_1_education",
                "player_1_religion",
                "player_1_meditation",
                "player_1_meditation_years",
                "player_1_punitive_God",
                "player_1_game_theory",
                "player_1_other",
                "player_2_age",
                "player_2_gender",
                "player_2_nationality",
                "player_2_residence",
                "player_2_education",
                "player_2_religion",
                "player_2_meditation",
                "player_2_meditation_years",
                "player_2_punitive_God",
                "player_2_game_theory",
                "player_2_other",
            ]
        )
        for r in rows2:
            values = ", ".join(_sql_literal(v) for v in r)
            fh.write(f"INSERT INTO data_prisoners ({cols_sql}) VALUES ({values});\n")
        fh.write("COMMIT;\n")

    _atomic_write(PRISONER_SQL, write_sql)

    # Also export custom experiment data
    export_custom_prisoner_all()



def _ultimatum_completed_match_ids():
    """
    Only include matches that are truly complete:
    - either any round has match_complete=True, OR
    - there are >= 25 fully-completed rounds (both offers + both responses present)
    """
    flagged = set(
        UltimatumGameRound.objects
        .filter(match_complete=True)
        .values_list("game_match_uuid", flat=True)
        .distinct()
    )

    completed_rounds_qs = UltimatumGameRound.objects.filter(
        player_1_coins_to_keep__isnull=False,
        player_1_coins_to_offer__isnull=False,
        player_2_coins_to_keep__isnull=False,
        player_2_coins_to_offer__isnull=False,
        player_1_response_to_p2_offer__isnull=False,
        player_2_response_to_p1_offer__isnull=False,
    )
    twentyfive = set(
        completed_rounds_qs
        .values("game_match_uuid")
        .annotate(n=Count("pk"))
        .filter(n__gte=25)
        .values_list("game_match_uuid", flat=True)
    )
    return flagged | twentyfive


def _ultimatum_rows():
    """
    Build rows for Ultimatum export (completed matches only),
    matching the column order in extract_all_game_data.sql.
    """
    headers = [
        "round_number",
        "game_match_uuid",
        "game_mode",
        "player_1_fingerprint",
        "player_1_ip_address",
        "player_1_coins_to_keep",
        "player_1_coins_to_offer",
        "player_1_response_to_p2_offer",
        "player_1_coins_made_in_round",
        "player_2_fingerprint",
        "player_2_ip_address",
        "player_2_coins_to_keep",
        "player_2_coins_to_offer",
        "player_2_response_to_p1_offer",
        "player_2_coins_made_in_round",
        "players_sum_coins_in_round",
        "players_sum_coins_total",
        "player_1_final_score",
        "player_2_final_score",
        "player_1_country",
        "player_1_city",
        "player_2_country",
        "player_2_city",
        "round_start",
        "round_end",
        "match_complete",
        "match_completed_at",
        # Survey P1
        "player_1_age",
        "player_1_gender",
        "player_1_nationality",
        "player_1_residence",
        "player_1_education",
        "player_1_religion",
        "player_1_meditation",
        "player_1_meditation_years",
        "player_1_punitive_God",
        "player_1_game_theory",
        "player_1_other",
        # Survey P2
        "player_2_age",
        "player_2_gender",
        "player_2_nationality",
        "player_2_residence",
        "player_2_education",
        "player_2_religion",
        "player_2_meditation",
        "player_2_meditation_years",
        "player_2_punitive_God",
        "player_2_game_theory",
        "player_2_other",
    ]

    completed_ids = _ultimatum_completed_match_ids()
    if not completed_ids:
        return headers, []

    qs = (
        UltimatumGameRound.objects
        .filter(
            game_match_uuid__in=completed_ids,
            player_1_coins_to_keep__isnull=False,
            experiment_id__isnull=True,
            player_1_coins_to_offer__isnull=False,
            player_2_coins_to_keep__isnull=False,
            player_2_coins_to_offer__isnull=False,
            player_1_response_to_p2_offer__isnull=False,
            player_2_response_to_p1_offer__isnull=False,
        )
        .order_by("game_match_uuid", "round_number")
    )

    def row_iter():
        last_uuid = None
        rn = 0
        for ugr in qs:
            uuid = ugr.game_match_uuid
            if uuid != last_uuid:
                rn = 1
                last_uuid = uuid
            else:
                rn += 1

            yield [
                rn,
                ugr.game_match_uuid,
                ugr.game_mode,
                ugr.player_1_fingerprint,
                ugr.player_1_ip_address,
                ugr.player_1_coins_to_keep,
                ugr.player_1_coins_to_offer,
                ugr.player_1_response_to_p2_offer,
                ugr.player_1_coins_made_in_round,
                ugr.player_2_fingerprint,
                ugr.player_2_ip_address,
                ugr.player_2_coins_to_keep,
                ugr.player_2_coins_to_offer,
                ugr.player_2_response_to_p1_offer,
                ugr.player_2_coins_made_in_round,
                ugr.players_sum_coins_in_round,
                ugr.players_sum_coins_total,
                ugr.player_1_final_score,
                ugr.player_2_final_score,
                ugr.player_1_country,
                ugr.player_1_city,
                ugr.player_2_country,
                ugr.player_2_city,
                ugr.round_start,
                ugr.round_end,
                ugr.match_complete,
                ugr.match_completed_at,
                # Survey P1
                ugr.player_1_age,
                ugr.player_1_gender,
                ugr.player_1_nationality,
                ugr.player_1_residence,
                ugr.player_1_education,
                ugr.player_1_religion,
                ugr.player_1_meditation,
                ugr.player_1_meditation_years,
                ugr.player_1_punitive_God,
                ugr.player_1_game_theory,
                ugr.player_1_other,
                # Survey P2
                ugr.player_2_age,
                ugr.player_2_gender,
                ugr.player_2_nationality,
                ugr.player_2_residence,
                ugr.player_2_education,
                ugr.player_2_religion,
                ugr.player_2_meditation,
                ugr.player_2_meditation_years,
                ugr.player_2_punitive_God,
                ugr.player_2_game_theory,
                ugr.player_2_other,
            ]

    return headers, row_iter()


def export_ultimatum_all() -> None:
    """
    Export completed Ultimatum matches into:
      - backend/game/data_ultimatum_clean.csv
      - backend/game/data_ultimatum.sql
    """
    headers, rows = _ultimatum_rows()

    # 1) CSV
    def write_csv(fh):
        writer = csv.writer(fh, delimiter=",", quoting=csv.QUOTE_MINIMAL)
        writer.writerow(headers)
        for r in rows:
            writer.writerow(["" if v is None else v for v in r])

    _atomic_write(ULTIMATUM_CSV, write_csv)

    # Rebuild rows (generator consumed) for SQL
    _, rows2 = _ultimatum_rows()

    # 2) SQL (DDL + INSERTs)
    ddl = """BEGIN;

CREATE TABLE IF NOT EXISTS data_ultimatum (
    round_number INTEGER,
    game_match_uuid TEXT,
    game_mode TEXT,
    player_1_fingerprint TEXT,
    player_1_ip_address TEXT,
    player_1_coins_to_keep INTEGER,
    player_1_coins_to_offer INTEGER,
    player_1_response_to_p2_offer TEXT,
    player_1_coins_made_in_round INTEGER,
    player_2_fingerprint TEXT,
    player_2_ip_address TEXT,
    player_2_coins_to_keep INTEGER,
    player_2_coins_to_offer INTEGER,
    player_2_response_to_p1_offer TEXT,
    player_2_coins_made_in_round INTEGER,
    players_sum_coins_in_round INTEGER,
    players_sum_coins_total INTEGER,
    player_1_final_score INTEGER,
    player_2_final_score INTEGER,
    player_1_country TEXT,
    player_1_city TEXT,
    player_2_country TEXT,
    player_2_city TEXT,
    round_start TEXT,
    round_end TEXT,
    match_complete BOOLEAN,
    match_completed_at TEXT,
    player_1_age INTEGER,
    player_1_gender TEXT,
    player_1_nationality TEXT,
    player_1_residence TEXT,
    player_1_education TEXT,
    player_1_religion TEXT,
    player_1_meditation TEXT,
    player_1_meditation_years INTEGER,
    player_1_punitive_God TEXT,
    player_1_game_theory TEXT,
    player_1_other TEXT,
    player_2_age INTEGER,
    player_2_gender TEXT,
    player_2_nationality TEXT,
    player_2_residence TEXT,
    player_2_education TEXT,
    player_2_religion TEXT,
    player_2_meditation TEXT,
    player_2_meditation_years INTEGER,
    player_2_punitive_God TEXT,
    player_2_game_theory TEXT,
    player_2_other TEXT
);

DELETE FROM data_ultimatum;
"""

    def write_sql(fh):
        fh.write(ddl)
        cols_sql = ", ".join([
            "round_number",
            "game_match_uuid",
            "game_mode",
            "player_1_fingerprint",
            "player_1_ip_address",
            "player_1_coins_to_keep",
            "player_1_coins_to_offer",
            "player_1_response_to_p2_offer",
            "player_1_coins_made_in_round",
            "player_2_fingerprint",
            "player_2_ip_address",
            "player_2_coins_to_keep",
            "player_2_coins_to_offer",
            "player_2_response_to_p1_offer",
            "player_2_coins_made_in_round",
            "players_sum_coins_in_round",
            "players_sum_coins_total",
            "player_1_final_score",
            "player_2_final_score",
            "player_1_country",
            "player_1_city",
            "player_2_country",
            "player_2_city",
            "round_start",
            "round_end",
            "match_complete",
            "match_completed_at",
            "player_1_age",
            "player_1_gender",
            "player_1_nationality",
            "player_1_residence",
            "player_1_education",
            "player_1_religion",
            "player_1_meditation",
            "player_1_meditation_years",
            "player_1_punitive_God",
            "player_1_game_theory",
            "player_1_other",
            "player_2_age",
            "player_2_gender",
            "player_2_nationality",
            "player_2_residence",
            "player_2_education",
            "player_2_religion",
            "player_2_meditation",
            "player_2_meditation_years",
            "player_2_punitive_God",
            "player_2_game_theory",
            "player_2_other",
        ])
        for r in rows2:
            values = ", ".join(_sql_literal(v) for v in r)
            fh.write(f"INSERT INTO data_ultimatum ({cols_sql}) VALUES ({values});\n")
        fh.write("COMMIT;\n")

    _atomic_write(ULTIMATUM_SQL, write_sql)

    # Also export custom experiment data
    export_custom_ultimatum_all()


def _public_goods_rows() -> Tuple[List[str], Iterable[List[Any]]]:
    """
    Build rows for Public Goods Game export (completed matches only).
    """
    headers = [
        "match_id",
        "round_number",
        "room_type",
        "game_mode",
        "player_1_fingerprint",
        "player_2_fingerprint",
        "player_3_fingerprint",
        "player_4_fingerprint",
        "player_1_ip",
        "player_2_ip",
        "player_3_ip",
        "player_4_ip",
        "player_1_contribution",
        "player_2_contribution",
        "player_3_contribution",
        "player_4_contribution",
        "player_1_payoff",
        "player_2_payoff",
        "player_3_payoff",
        "player_4_payoff",
        "total_contributions",
        "group_return",
        "player_1_cumulative_contribution",
        "player_2_cumulative_contribution",
        "player_3_cumulative_contribution",
        "player_4_cumulative_contribution",
        "player_1_cumulative_payoff",
        "player_2_cumulative_payoff",
        "player_3_cumulative_payoff",
        "player_4_cumulative_payoff",
        "round_actions",
        # Detailed social actions
        "player_1_punishes_whom", "player_1_rewards_whom", "player_1_punished_by", "player_1_rewarded_by",
        "player_2_punishes_whom", "player_2_rewards_whom", "player_2_punished_by", "player_2_rewarded_by",
        "player_3_punishes_whom", "player_3_rewards_whom", "player_3_punished_by", "player_3_rewarded_by",
        "player_4_punishes_whom", "player_4_rewards_whom", "player_4_punished_by", "player_4_rewarded_by",
        # Categorical actions
        "player_1_action", "player_2_action", "player_3_action", "player_4_action",
        # Round percentages
        "punishment_percentage_in_round", "reward_percentage_in_round",
        # Player 1 tracking
        "player_1_reward_list", "player_1_punish_list", "player_1_reward_counts", "player_1_punish_counts",
        # Player 2 tracking
        "player_2_reward_list", "player_2_punish_list", "player_2_reward_counts", "player_2_punish_counts",
        # Player 3 tracking
        "player_3_reward_list", "player_3_punish_list", "player_3_reward_counts", "player_3_punish_counts",
        # Player 4 tracking
        "player_4_reward_list", "player_4_punish_list", "player_4_reward_counts", "player_4_punish_counts",
        "created_at",
        "started_at",
        "completed_at",
        "round_started_at",
        "round_completed_at",
        # Survey P1
        "player_1_age", "player_1_gender", "player_1_nationality", "player_1_residence", "player_1_education",
        "player_1_religion", "player_1_meditation", "player_1_meditation_years", "player_1_punitive_God",
        "player_1_game_theory", "player_1_other",
        # Survey P2
        "player_2_age", "player_2_gender", "player_2_nationality", "player_2_residence", "player_2_education",
        "player_2_religion", "player_2_meditation", "player_2_meditation_years", "player_2_punitive_God",
        "player_2_game_theory", "player_2_other",
        # Survey P3
        "player_3_age", "player_3_gender", "player_3_nationality", "player_3_residence", "player_3_education",
        "player_3_religion", "player_3_meditation", "player_3_meditation_years", "player_3_punitive_God",
        "player_3_game_theory", "player_3_other",
        # Survey P4
        "player_4_age", "player_4_gender", "player_4_nationality", "player_4_residence", "player_4_education",
        "player_4_religion", "player_4_meditation", "player_4_meditation_years", "player_4_punitive_God",
        "player_4_game_theory", "player_4_other",
    ]

    # Identify completed match IDs (where completed_at is set, typically on round 1)
    completed_ids = PublicGoodsGameData.objects.filter(
        completed_at__isnull=False, experiment_id__isnull=True
    ).values_list("match_id", flat=True).distinct()

    # Fetch ALL rounds for those completed matches
    qs = PublicGoodsGameData.objects.filter(
        match_id__in=completed_ids
    ).order_by("match_id", "round_number")

    def row_iter():
        for pg in qs:
            row = [
                pg.match_id,
                pg.round_number,
                pg.room_type,
                pg.game_mode,
                pg.player_1_fingerprint,
                pg.player_2_fingerprint,
                pg.player_3_fingerprint,
                pg.player_4_fingerprint,
                pg.player_1_ip,
                pg.player_2_ip,
                pg.player_3_ip,
                pg.player_4_ip,
                pg.player_1_contribution,
                pg.player_2_contribution,
                pg.player_3_contribution,
                pg.player_4_contribution,
                pg.player_1_payoff,
                pg.player_2_payoff,
                pg.player_3_payoff,
                pg.player_4_payoff,
                pg.total_contributions,
                pg.group_return,
                pg.player_1_cumulative_contribution,
                pg.player_2_cumulative_contribution,
                pg.player_3_cumulative_contribution,
                pg.player_4_cumulative_contribution,
                pg.player_1_cumulative_payoff,
                pg.player_2_cumulative_payoff,
                pg.player_3_cumulative_payoff,
                pg.player_4_cumulative_payoff,
                json.dumps(pg.round_actions),
            ]
            
            # Add detailed action columns
            actions = pg.round_actions or []
            # Compute per-player action strings
            player_actions = []
            for i in range(1, 5):
                act = "none"
                for a in actions:
                    if a.get('actor') == i:
                        if a.get('type') == 'punish':
                            act = "punishment"
                            break
                        if a.get('type') == 'reward':
                            act = "reward"
                            break
                player_actions.append(act)
            # Compute percentages
            punish_count = sum(1 for a in actions if a.get('type') == 'punish')
            reward_count = sum(1 for a in actions if a.get('type') == 'reward')
            punish_perc = punish_count / 4.0
            reward_perc = reward_count / 4.0

            for i in range(1, 5):
                def get_a(actor=None, target=None, atype=None):
                    names = []
                    for a in actions:
                        if (actor is None or a.get('actor') == actor) and \
                           (target is None or a.get('target') == target) and \
                           (atype is None or a.get('type') == atype):
                            whom = a.get('target') if actor is not None else a.get('actor')
                            names.append(f"Player {whom}")
                    return ", ".join(names) if names else "none"

                row.extend([
                    get_a(actor=i, atype='punish'),
                    get_a(actor=i, atype='reward'),
                    get_a(target=i, atype='punish'),
                    get_a(target=i, atype='reward'),
                ])

            # Append per-player action columns
            row.extend(player_actions)
            # Append percentages
            row.append(punish_perc)
            row.append(reward_perc)

            row.extend([
                # P1 Tracking
                json.dumps(pg.player_1_reward_list), json.dumps(pg.player_1_punish_list),
                json.dumps(pg.player_1_reward_counts), json.dumps(pg.player_1_punish_counts),
                # P2 Tracking
                json.dumps(pg.player_2_reward_list), json.dumps(pg.player_2_punish_list),
                json.dumps(pg.player_2_reward_counts), json.dumps(pg.player_2_punish_counts),
                # P3 Tracking
                json.dumps(pg.player_3_reward_list), json.dumps(pg.player_3_punish_list),
                json.dumps(pg.player_3_reward_counts), json.dumps(pg.player_3_punish_counts),
                # P4 Tracking
                json.dumps(pg.player_4_reward_list), json.dumps(pg.player_4_punish_list),
                json.dumps(pg.player_4_reward_counts), json.dumps(pg.player_4_punish_counts),
                pg.created_at.strftime("%Y-%m-%d %H:%M:%S") if pg.created_at else None,
                pg.started_at.strftime("%Y-%m-%d %H:%M:%S") if pg.started_at else None,
                pg.completed_at.strftime("%Y-%m-%d %H:%M:%S") if pg.completed_at else None,
                pg.round_started_at.strftime("%Y-%m-%d %H:%M:%S") if pg.round_started_at else None,
                pg.round_completed_at.strftime("%Y-%m-%d %H:%M:%S") if pg.round_completed_at else None,
                # P1 Survey
                pg.player_1_age, pg.player_1_gender, pg.player_1_nationality, pg.player_1_residence, pg.player_1_education,
                pg.player_1_religion, pg.player_1_meditation, pg.player_1_meditation_years, pg.player_1_punitive_God,
                pg.player_1_game_theory, pg.player_1_other,
                # P2 Survey
                pg.player_2_age, pg.player_2_gender, pg.player_2_nationality, pg.player_2_residence, pg.player_2_education,
                pg.player_2_religion, pg.player_2_meditation, pg.player_2_meditation_years, pg.player_2_punitive_God,
                pg.player_2_game_theory, pg.player_2_other,
                # P3 Survey
                pg.player_3_age, pg.player_3_gender, pg.player_3_nationality, pg.player_3_residence, pg.player_3_education,
                pg.player_3_religion, pg.player_3_meditation, pg.player_3_meditation_years, pg.player_3_punitive_God,
                pg.player_3_game_theory, pg.player_3_other,
                # P4 Survey
                pg.player_4_age, pg.player_4_gender, pg.player_4_nationality, pg.player_4_residence, pg.player_4_education,
                pg.player_4_religion, pg.player_4_meditation, pg.player_4_meditation_years, pg.player_4_punitive_God,
                pg.player_4_game_theory, pg.player_4_other,
            ])
            yield row

    return headers, row_iter()


def export_public_goods_all() -> None:
    """
    Export completed Public Goods matches into:
      - data_public_goods_clean.csv
      - data_public_goods.sql
    """
    headers, rows = _public_goods_rows()

    # 1) CSV
    def write_csv(fh):
        writer = csv.writer(fh, delimiter=",", quoting=csv.QUOTE_MINIMAL)
        writer.writerow(headers)
        for r in rows:
            writer.writerow(["" if v is None else v for v in r])

    _atomic_write(PUBLIC_GOODS_CSV, write_csv)

    # Rebuild rows (generator consumed)
    _, rows2 = _public_goods_rows()

    # 2) SQL
    ddl = """BEGIN;

CREATE TABLE IF NOT EXISTS data_public_goods (
    match_id TEXT,
    round_number INTEGER,
    room_type TEXT,
    game_mode TEXT,
    player_1_fingerprint TEXT,
    player_2_fingerprint TEXT,
    player_3_fingerprint TEXT,
    player_4_fingerprint TEXT,
    player_1_ip TEXT,
    player_2_ip TEXT,
    player_3_ip TEXT,
    player_4_ip TEXT,
    player_1_contribution REAL,
    player_2_contribution REAL,
    player_3_contribution REAL,
    player_4_contribution REAL,
    player_1_payoff REAL,
    player_2_payoff REAL,
    player_3_payoff REAL,
    player_4_payoff REAL,
    total_contributions REAL,
    group_return REAL,
    player_1_cumulative_contribution REAL,
    player_2_cumulative_contribution REAL,
    player_3_cumulative_contribution REAL,
    player_4_cumulative_contribution REAL,
    player_1_cumulative_payoff REAL,
    player_2_cumulative_payoff REAL,
    player_3_cumulative_payoff REAL,
    player_4_cumulative_payoff REAL,
    round_actions TEXT,
    player_1_punishes_whom TEXT, player_1_rewards_whom TEXT, player_1_punished_by TEXT, player_1_rewarded_by TEXT,
    player_2_punishes_whom TEXT, player_2_rewards_whom TEXT, player_2_punished_by TEXT, player_2_rewarded_by TEXT,
    player_3_punishes_whom TEXT, player_3_rewards_whom TEXT, player_3_punished_by TEXT, player_3_rewarded_by TEXT,
    player_4_punishes_whom TEXT, player_4_rewards_whom TEXT, player_4_punished_by TEXT, player_4_rewarded_by TEXT,
    -- New per-player action columns
    player_1_action TEXT, player_2_action TEXT, player_3_action TEXT, player_4_action TEXT,
    -- Round percentages
    punishment_percentage_in_round REAL, reward_percentage_in_round REAL,
    player_1_reward_list TEXT, player_1_punish_list TEXT, player_1_reward_counts TEXT, player_1_punish_counts TEXT,
    player_2_reward_list TEXT, player_2_punish_list TEXT, player_2_reward_counts TEXT, player_2_punish_counts TEXT,
    player_3_reward_list TEXT, player_3_punish_list TEXT, player_3_reward_counts TEXT, player_3_punish_counts TEXT,
    player_4_reward_list TEXT, player_4_punish_list TEXT, player_4_reward_counts TEXT, player_4_punish_counts TEXT,
    created_at TEXT,
    started_at TEXT,
    completed_at TEXT,
    round_started_at TEXT,
    round_completed_at TEXT,
    player_1_age INTEGER, player_1_gender TEXT, player_1_nationality TEXT, player_1_residence TEXT, player_1_education TEXT,
    player_1_religion TEXT, player_1_meditation TEXT, player_1_meditation_years INTEGER, player_1_punitive_God TEXT,
    player_1_game_theory TEXT, player_1_other TEXT,
    player_2_age INTEGER, player_2_gender TEXT, player_2_nationality TEXT, player_2_residence TEXT, player_2_education TEXT,
    player_2_religion TEXT, player_2_meditation TEXT, player_2_meditation_years INTEGER, player_2_punitive_God TEXT,
    player_2_game_theory TEXT, player_2_other TEXT,
                pg.round_number,
                pg.room_type,
                pg.game_mode,
                pg.player_1_fingerprint,
                pg.player_2_fingerprint,
                pg.player_3_fingerprint,
                pg.player_4_fingerprint,
                pg.player_1_ip,
                pg.player_2_ip,
                pg.player_3_ip,
                pg.player_4_ip,
                pg.player_1_contribution,
                pg.player_2_contribution,
                pg.player_3_contribution,
                pg.player_4_contribution,
                pg.player_1_payoff,
                pg.player_2_payoff,
                pg.player_3_payoff,
                pg.player_4_payoff,
                pg.total_contributions,
                pg.group_return,
                pg.player_1_cumulative_contribution,
                pg.player_2_cumulative_contribution,
                pg.player_3_cumulative_contribution,
                pg.player_4_cumulative_contribution,
                pg.player_1_cumulative_payoff,
                pg.player_2_cumulative_payoff,
                pg.player_3_cumulative_payoff,
                pg.player_4_cumulative_payoff,
                json.dumps(pg.round_actions),
            ]
            
            # Add detailed action columns
            actions = pg.round_actions or []
            # Compute per-player action strings
            player_actions = []
            for i in range(1, 5):
                act = "none"
                for a in actions:
                    if a.get('actor') == i:
                        if a.get('type') == 'punish':
                            act = "punishment"
                            break
                        if a.get('type') == 'reward':
                            act = "reward"
                            break
                player_actions.append(act)
            # Compute percentages
            punish_count = sum(1 for a in actions if a.get('type') == 'punish')
            reward_count = sum(1 for a in actions if a.get('type') == 'reward')
            punish_perc = punish_count / 4.0
            reward_perc = reward_count / 4.0

            for i in range(1, 5):
                def get_a(actor=None, target=None, atype=None):
                    names = []
                    for a in actions:
                        if (actor is None or a.get('actor') == actor) and \
                           (target is None or a.get('target') == target) and \
                           (atype is None or a.get('type') == atype):
                            whom = a.get('target') if actor is not None else a.get('actor')
                            names.append(f"Player {whom}")
                    return ", ".join(names) if names else "none"

                row.extend([
                    get_a(actor=i, atype='punish'),
                    get_a(actor=i, atype='reward'),
                    get_a(target=i, atype='punish'),
                    get_a(target=i, atype='reward'),
                ])

            # Append per-player action columns
            row.extend(player_actions)
            # Append percentages
            row.append(punish_perc)
            row.append(reward_perc)

            row.extend([
                # P1 Tracking
                json.dumps(pg.player_1_reward_list), json.dumps(pg.player_1_punish_list),
                json.dumps(pg.player_1_reward_counts), json.dumps(pg.player_1_punish_counts),
                # P2 Tracking
                json.dumps(pg.player_2_reward_list), json.dumps(pg.player_2_punish_list),
                json.dumps(pg.player_2_reward_counts), json.dumps(pg.player_2_punish_counts),
                # P3 Tracking
                json.dumps(pg.player_3_reward_list), json.dumps(pg.player_3_punish_list),
                json.dumps(pg.player_3_reward_counts), json.dumps(pg.player_3_punish_counts),
                # P4 Tracking
                json.dumps(pg.player_4_reward_list), json.dumps(pg.player_4_punish_list),
                json.dumps(pg.player_4_reward_counts), json.dumps(pg.player_4_punish_counts),
                pg.created_at.strftime("%Y-%m-%d %H:%M:%S") if pg.created_at else None,
                pg.started_at.strftime("%Y-%m-%d %H:%M:%S") if pg.started_at else None,
                pg.completed_at.strftime("%Y-%m-%d %H:%M:%S") if pg.completed_at else None,
                pg.round_started_at.strftime("%Y-%m-%d %H:%M:%S") if pg.round_started_at else None,
                pg.round_completed_at.strftime("%Y-%m-%d %H:%M:%S") if pg.round_completed_at else None,
                # P1 Survey
                pg.player_1_age, pg.player_1_gender, pg.player_1_nationality, pg.player_1_residence, pg.player_1_education,
                pg.player_1_religion, pg.player_1_meditation, pg.player_1_meditation_years, pg.player_1_punitive_God,
                pg.player_1_game_theory, pg.player_1_other,
                # P2 Survey
                pg.player_2_age, pg.player_2_gender, pg.player_2_nationality, pg.player_2_residence, pg.player_2_education,
                pg.player_2_religion, pg.player_2_meditation, pg.player_2_meditation_years, pg.player_2_punitive_God,
                pg.player_2_game_theory, pg.player_2_other,
                # P3 Survey
                pg.player_3_age, pg.player_3_gender, pg.player_3_nationality, pg.player_3_residence, pg.player_3_education,
                pg.player_3_religion, pg.player_3_meditation, pg.player_3_meditation_years, pg.player_3_punitive_God,
                pg.player_3_game_theory, pg.player_3_other,
                # P4 Survey
                pg.player_4_age, pg.player_4_gender, pg.player_4_nationality, pg.player_4_residence, pg.player_4_education,
                pg.player_4_religion, pg.player_4_meditation, pg.player_4_meditation_years, pg.player_4_punitive_God,
                pg.player_4_game_theory, pg.player_4_other,
            ])
            yield row

    return headers, row_iter()


    player_3_age INTEGER, player_3_gender TEXT, player_3_nationality TEXT, player_3_residence TEXT, player_3_education TEXT,
    player_3_religion TEXT, player_3_meditation TEXT, player_3_meditation_years INTEGER, player_3_punitive_God TEXT,
    player_3_game_theory TEXT, player_3_other TEXT,
    player_4_age INTEGER, player_4_gender TEXT, player_4_nationality TEXT, player_4_residence TEXT, player_4_education TEXT,
    player_4_religion TEXT, player_4_meditation TEXT, player_4_meditation_years INTEGER, player_4_punitive_God TEXT,
    player_4_game_theory TEXT, player_4_other TEXT
);

DELETE FROM data_public_goods;
"""

    def write_sql(fh):
        fh.write(ddl)
        # Use headers defined in _public_goods_rows
        from .exports import _public_goods_rows
        current_headers, _ = _public_goods_rows()
        
        cols_sql = ", ".join(current_headers)
        for r in rows2:
            values = ", ".join(_sql_literal(v) for v in r)
            fh.write(f"INSERT INTO data_public_goods ({cols_sql}) VALUES ({values});\n")
        fh.write("COMMIT;\n")

    _atomic_write(PUBLIC_GOODS_SQL, write_sql)

    # Also export custom experiment data
    export_custom_public_goods_all()


def _common_pool_rows() -> Tuple[List[str], Iterable[List[Any]]]:
    """
    Build rows for Common Pool Resource Game export (completed matches only).
    """
    headers = [
        "match_id",
        "round_number",
        "room_type",
        "game_mode",
        "player_1_fingerprint",
        "player_2_fingerprint",
        "player_3_fingerprint",
        "player_4_fingerprint",
        "player_1_ip",
        "player_2_ip",
        "player_3_ip",
        "player_4_ip",
        "fish_stock",
        "player_1_extraction",
        "player_2_extraction",
        "player_3_extraction",
        "player_4_extraction",
        "player_1_actual_catch",
        "player_2_actual_catch",
        "player_3_actual_catch",
        "player_4_actual_catch",
        "player_1_payoff",
        "player_2_payoff",
        "player_3_payoff",
        "player_4_payoff",
        "total_extractions",
        "new_fish_born",
        "next_fish_stock",
        "player_1_cumulative_extraction",
        "player_2_cumulative_extraction",
        "player_3_cumulative_extraction",
        "player_4_cumulative_extraction",
        "player_1_cumulative_payoff",
        "player_2_cumulative_payoff",
        "player_3_cumulative_payoff",
        "player_4_cumulative_payoff",
        "round_actions",
        # Detailed social actions
        "player_1_punishes_whom", "player_1_rewards_whom", "player_1_punished_by", "player_1_rewarded_by",
        "player_2_punishes_whom", "player_2_rewards_whom", "player_2_punished_by", "player_2_rewarded_by",
        "player_3_punishes_whom", "player_3_rewards_whom", "player_3_punished_by", "player_3_rewarded_by",
        "player_4_punishes_whom", "player_4_rewards_whom", "player_4_punished_by", "player_4_rewarded_by",
        # Categorical actions
        "player_1_action", "player_2_action", "player_3_action", "player_4_action",
        # Round percentages
        "punishment_percentage_in_round", "reward_percentage_in_round",
        # Player 1 tracking
        "player_1_reward_list", "player_1_punish_list", "player_1_reward_counts", "player_1_punish_counts",
        # Player 2 tracking
        "player_2_reward_list", "player_2_punish_list", "player_2_reward_counts", "player_2_punish_counts",
        # Player 3 tracking
        "player_3_reward_list", "player_3_punish_list", "player_3_reward_counts", "player_3_punish_counts",
        # Player 4 tracking
        "player_4_reward_list", "player_4_punish_list", "player_4_reward_counts", "player_4_punish_counts",
        "created_at",
        "started_at",
        "completed_at",
        "round_started_at",
        "round_completed_at",
        # Survey P1
        "player_1_age", "player_1_gender", "player_1_nationality", "player_1_residence", "player_1_education",
        "player_1_religion", "player_1_meditation", "player_1_meditation_years", "player_1_punitive_God",
        "player_1_game_theory", "player_1_other",
        # Survey P2
        "player_2_age", "player_2_gender", "player_2_nationality", "player_2_residence", "player_2_education",
        "player_2_religion", "player_2_meditation", "player_2_meditation_years", "player_2_punitive_God",
        "player_2_game_theory", "player_2_other",
        # Survey P3
        "player_3_age", "player_3_gender", "player_3_nationality", "player_3_residence", "player_3_education",
        "player_3_religion", "player_3_meditation", "player_3_meditation_years", "player_3_punitive_God",
        "player_3_game_theory", "player_3_other",
        # Survey P4
        "player_4_age", "player_4_gender", "player_4_nationality", "player_4_residence", "player_4_education",
        "player_4_religion", "player_4_meditation", "player_4_meditation_years", "player_4_punitive_God",
        "player_4_game_theory", "player_4_other",
    ]

    completed_ids = list(CommonPoolGameData.objects.filter(
        completed_at__isnull=False
    ).values("match_id").annotate(
        match_created_at=Min("created_at")
    ).order_by("match_created_at", "match_id").values_list("match_id", flat=True))

    match_order = Case(
        *[When(match_id=match_id, then=position) for position, match_id in enumerate(completed_ids)],
        output_field=IntegerField(),
    )

    qs = CommonPoolGameData.objects.filter(
        match_id__in=completed_ids
    ).annotate(_match_order=match_order).order_by("_match_order", "round_number")

    def row_iter():
        for cp in qs:
            row = [
                cp.match_id,
                cp.round_number,
                cp.room_type,
                cp.game_mode,
                cp.player_1_fingerprint,
                cp.player_2_fingerprint,
                cp.player_3_fingerprint,
                cp.player_4_fingerprint,
                cp.player_1_ip,
                cp.player_2_ip,
                cp.player_3_ip,
                cp.player_4_ip,
                cp.fish_stock,
                cp.player_1_extraction,
                cp.player_2_extraction,
                cp.player_3_extraction,
                cp.player_4_extraction,
                cp.player_1_actual_catch,
                cp.player_2_actual_catch,
                cp.player_3_actual_catch,
                cp.player_4_actual_catch,
                cp.player_1_payoff,
                cp.player_2_payoff,
                cp.player_3_payoff,
                cp.player_4_payoff,
                cp.total_extractions,
                cp.new_fish_born,
                cp.next_fish_stock,
                cp.player_1_cumulative_extraction,
                cp.player_2_cumulative_extraction,
                cp.player_3_cumulative_extraction,
                cp.player_4_cumulative_extraction,
                cp.player_1_cumulative_payoff,
                cp.player_2_cumulative_payoff,
                cp.player_3_cumulative_payoff,
                cp.player_4_cumulative_payoff,
                json.dumps(cp.round_actions),
            ]
            
            actions = cp.round_actions or []
            player_actions = []
            for i in range(1, 5):
                act = "none"
                for a in actions:
                    if a.get('actor') == i:
                        if a.get('type') == 'punish':
                            act = "punishment"
                            break
                        if a.get('type') == 'reward':
                            act = "reward"
                            break
                player_actions.append(act)
                
            punish_count = sum(1 for a in actions if a.get('type') == 'punish')
            reward_count = sum(1 for a in actions if a.get('type') == 'reward')
            punish_perc = punish_count / 4.0
            reward_perc = reward_count / 4.0

            for i in range(1, 5):
                def get_a(actor=None, target=None, atype=None):
                    names = []
                    for a in actions:
                        if (actor is None or a.get('actor') == actor) and \
                           (target is None or a.get('target') == target) and \
                           (atype is None or a.get('type') == atype):
                            whom = a.get('target') if actor is not None else a.get('actor')
                            names.append(f"Player {whom}")
                    return ", ".join(names) if names else "none"

                row.extend([
                    get_a(actor=i, atype='punish'),
                    get_a(actor=i, atype='reward'),
                    get_a(target=i, atype='punish'),
                    get_a(target=i, atype='reward'),
                ])

            row.extend(player_actions)
            row.append(punish_perc)
            row.append(reward_perc)

            row.extend([
                # P1 Tracking
                json.dumps(cp.player_1_reward_list), json.dumps(cp.player_1_punish_list),
                json.dumps(cp.player_1_reward_counts), json.dumps(cp.player_1_punish_counts),
                # P2 Tracking
                json.dumps(cp.player_2_reward_list), json.dumps(cp.player_2_punish_list),
                json.dumps(cp.player_2_reward_counts), json.dumps(cp.player_2_punish_counts),
                # P3 Tracking
                json.dumps(cp.player_3_reward_list), json.dumps(cp.player_3_punish_list),
                json.dumps(cp.player_3_reward_counts), json.dumps(cp.player_3_punish_counts),
                # P4 Tracking
                json.dumps(cp.player_4_reward_list), json.dumps(cp.player_4_punish_list),
                json.dumps(cp.player_4_reward_counts), json.dumps(cp.player_4_punish_counts),
                cp.created_at.strftime("%Y-%m-%d %H:%M:%S") if cp.created_at else None,
                cp.started_at.strftime("%Y-%m-%d %H:%M:%S") if cp.started_at else None,
                cp.completed_at.strftime("%Y-%m-%d %H:%M:%S") if cp.completed_at else None,
                cp.round_started_at.strftime("%Y-%m-%d %H:%M:%S") if cp.round_started_at else None,
                cp.round_completed_at.strftime("%Y-%m-%d %H:%M:%S") if cp.round_completed_at else None,
                # P1 Survey
                cp.player_1_age, cp.player_1_gender, cp.player_1_nationality, cp.player_1_residence, cp.player_1_education,
                cp.player_1_religion, cp.player_1_meditation, cp.player_1_meditation_years, cp.player_1_punitive_God,
                cp.player_1_game_theory, cp.player_1_other,
                # P2 Survey
                cp.player_2_age, cp.player_2_gender, cp.player_2_nationality, cp.player_2_residence, cp.player_2_education,
                cp.player_2_religion, cp.player_2_meditation, cp.player_2_meditation_years, cp.player_2_punitive_God,
                cp.player_2_game_theory, cp.player_2_other,
                # P3 Survey
                cp.player_3_age, cp.player_3_gender, cp.player_3_nationality, cp.player_3_residence, cp.player_3_education,
                cp.player_3_religion, cp.player_3_meditation, cp.player_3_meditation_years, cp.player_3_punitive_God,
                cp.player_3_game_theory, cp.player_3_other,
                # P4 Survey
                cp.player_4_age, cp.player_4_gender, cp.player_4_nationality, cp.player_4_residence, cp.player_4_education,
                cp.player_4_religion, cp.player_4_meditation, cp.player_4_meditation_years, cp.player_4_punitive_God,
                cp.player_4_game_theory, cp.player_4_other,
            ])
            yield row

    return headers, row_iter()


def export_common_pool_all() -> None:
    """
    Export completed Common Pool Resource matches into:
      - data_common_pool_clean.csv
      - data_common_pool.sql
    """
    headers, rows = _common_pool_rows()

    # 1) CSV
    def write_csv(fh):
        writer = csv.writer(fh, delimiter=",", quoting=csv.QUOTE_MINIMAL)
        writer.writerow(headers)
        for r in rows:
            writer.writerow(["" if v is None else v for v in r])

    _atomic_write(COMMON_POOL_CSV, write_csv)

    # Rebuild rows for SQL
    _, rows2 = _common_pool_rows()

    # 2) SQL
    ddl = """BEGIN;

CREATE TABLE IF NOT EXISTS data_common_pool (
    match_id TEXT,
    round_number INTEGER,
    room_type TEXT,
    game_mode TEXT,
    player_1_fingerprint TEXT,
    player_2_fingerprint TEXT,
    player_3_fingerprint TEXT,
    player_4_fingerprint TEXT,
    player_1_ip TEXT,
    player_2_ip TEXT,
    player_3_ip TEXT,
    player_4_ip TEXT,
    fish_stock INTEGER,
    player_1_extraction INTEGER,
    player_2_extraction INTEGER,
    player_3_extraction INTEGER,
    player_4_extraction INTEGER,
    player_1_actual_catch INTEGER,
    player_2_actual_catch INTEGER,
    player_3_actual_catch INTEGER,
    player_4_actual_catch INTEGER,
    player_1_payoff REAL,
    player_2_payoff REAL,
    player_3_payoff REAL,
    player_4_payoff REAL,
    total_extractions INTEGER,
    new_fish_born INTEGER,
    next_fish_stock INTEGER,
    player_1_cumulative_extraction INTEGER,
    player_2_cumulative_extraction INTEGER,
    player_3_cumulative_extraction INTEGER,
    player_4_cumulative_extraction INTEGER,
    player_1_cumulative_payoff REAL,
    player_2_cumulative_payoff REAL,
    player_3_cumulative_payoff REAL,
    player_4_cumulative_payoff REAL,
    round_actions TEXT,
    player_1_punishes_whom TEXT, player_1_rewards_whom TEXT, player_1_punished_by TEXT, player_1_rewarded_by TEXT,
    player_2_punishes_whom TEXT, player_2_rewards_whom TEXT, player_2_punished_by TEXT, player_2_rewarded_by TEXT,
    player_3_punishes_whom TEXT, player_3_rewards_whom TEXT, player_3_punished_by TEXT, player_3_rewarded_by TEXT,
    player_4_punishes_whom TEXT, player_4_rewards_whom TEXT, player_4_punished_by TEXT, player_4_rewarded_by TEXT,
    player_1_action TEXT, player_2_action TEXT, player_3_action TEXT, player_4_action TEXT,
    punishment_percentage_in_round REAL, reward_percentage_in_round REAL,
    player_1_reward_list TEXT, player_1_punish_list TEXT, player_1_reward_counts TEXT, player_1_punish_counts TEXT,
    player_2_reward_list TEXT, player_2_punish_list TEXT, player_2_reward_counts TEXT, player_2_punish_counts TEXT,
    player_3_reward_list TEXT, player_3_punish_list TEXT, player_3_reward_counts TEXT, player_3_punish_counts TEXT,
    player_4_reward_list TEXT, player_4_punish_list TEXT, player_4_reward_counts TEXT, player_4_punish_counts TEXT,
    created_at TEXT,
    started_at TEXT,
    completed_at TEXT,
    round_started_at TEXT,
    round_completed_at TEXT,
    player_1_age INTEGER, player_1_gender TEXT, player_1_nationality TEXT, player_1_residence TEXT, player_1_education TEXT,
    player_1_religion TEXT, player_1_meditation TEXT, player_1_meditation_years INTEGER, player_1_punitive_God TEXT,
    player_1_game_theory TEXT, player_1_other TEXT,
    player_2_age INTEGER, player_2_gender TEXT, player_2_nationality TEXT, player_2_residence TEXT, player_2_education TEXT,
    player_2_religion TEXT, player_2_meditation TEXT, player_2_meditation_years INTEGER, player_2_punitive_God TEXT,
    player_2_game_theory TEXT, player_2_other TEXT,
    player_3_age INTEGER, player_3_gender TEXT, player_3_nationality TEXT, player_3_residence TEXT, player_3_education TEXT,
    player_3_religion TEXT, player_3_meditation TEXT, player_3_meditation_years INTEGER, player_3_punitive_God TEXT,
    player_3_game_theory TEXT, player_3_other TEXT,
    player_4_age INTEGER, player_4_gender TEXT, player_4_nationality TEXT, player_4_residence TEXT, player_4_education TEXT,
    player_4_religion TEXT, player_4_meditation TEXT, player_4_meditation_years INTEGER, player_4_punitive_God TEXT,
    player_4_game_theory TEXT, player_4_other TEXT
);

DELETE FROM data_common_pool;
"""

    def write_sql(fh):
        fh.write(ddl)
        from .exports import _common_pool_rows
        current_headers, _ = _common_pool_rows()
        cols_sql = ", ".join(current_headers)
        for r in rows2:
            values = ", ".join(_sql_literal(v) for v in r)
            fh.write(f"INSERT INTO data_common_pool ({cols_sql}) VALUES ({values});\n")
        fh.write("COMMIT;\n")

    _atomic_write(COMMON_POOL_SQL, write_sql)

    # Also export custom experiment data
    export_custom_common_pool_all()


# ============================================================
# CUSTOM EXPERIMENTS EXPORTS
# ============================================================

def get_user_data_csv(user, game_type):
    """
    Generate an in-memory CSV string for a specific user's custom experiments.
    """
    if game_type == 'prisoner':
        headers, rows = _custom_prisoner_rows(user=user)
    elif game_type == 'ultimatum':
        headers, rows = _custom_ultimatum_rows(user=user)
    elif game_type == 'public_goods':
        headers, rows = _custom_public_goods_rows(user=user)
    else:
        return None

    output = io.StringIO()
    writer = csv.writer(output, delimiter=",", quoting=csv.QUOTE_MINIMAL)
    writer.writerow(headers)
    for r in rows:
        writer.writerow(["" if v is None else v for v in r])
    
    return output.getvalue()

def _custom_prisoner_rows(user=None) -> Tuple[List[str], Iterable[List[Any]]]:
    """Build rows for Custom Prisoner's Dilemma matches."""
    headers = [
        "row_number", "experiment_name", "condition_name", "secret_code",
        "game_match_uuid", "game_mode", "total_rounds",
        "p1_cc", "p2_cc", "p1_cd", "p2_cd", "p1_dc", "p2_dc", "p1_dd", "p2_dd",
        "label_a", "label_b",
        "player_1_fingerprint", "player_1_action", "player_1_score",
        "player_2_fingerprint", "player_2_action", "player_2_score",
        "player_1_cooperation_percent", "player_2_cooperation_percent", "avg_cooperation_percent",
        "player_1_cumulative_score", "player_2_cumulative_score",
        "player_1_country", "player_1_city", "player_2_country", "player_2_city",
        "round_start", "round_end", "match_complete", "match_completed_at",
        "player_1_age", "player_1_gender", "player_1_nationality", "player_1_residence", "player_1_education",
        "player_1_religion", "player_1_meditation", "player_1_meditation_years", "player_1_punitive_God",
        "player_1_game_theory", "player_1_other",
        "player_2_age", "player_2_gender", "player_2_nationality", "player_2_residence", "player_2_education",
        "player_2_religion", "player_2_meditation", "player_2_meditation_years", "player_2_punitive_God",
        "player_2_game_theory", "player_2_other",
    ]

    qs = (
        GameRound.objects.select_related("match")
        .filter(
            match__is_complete=True,
            match__experiment_id__isnull=False,
            player_1_action__isnull=False,
            player_2_action__isnull=False,
        )
    )

    if user:
        user_experiments = CustomExperiment.objects.filter(creator=user).values_list('id', flat=True)
        qs = qs.filter(match__experiment_id__in=user_experiments)

    qs = qs.order_by("match__match_id", "round_number")

    experiments = {str(e.id): e for e in CustomExperiment.objects.all()}
    conditions = {c.id: c for c in CustomPrisoner.objects.all()}

    def row_iter():
        last_uuid = None
        rn = 0
        for gr in qs:
            gm = gr.match
            uuid = gm.match_id
            if uuid != last_uuid:
                rn = 1
                last_uuid = uuid
            else:
                rn += 1

            exp = experiments.get(str(gm.experiment_id))
            cond = conditions.get(gm.condition_id)

            yield [
                rn,
                exp.name if exp else "N/A",
                cond.condition_name if cond else "N/A",
                exp.secret_code if exp else "N/A",
                gm.match_id, gm.game_mode, gm.total_rounds,
                gm.p1_cc, gm.p2_cc, gm.p1_cd, gm.p2_cd, gm.p1_dc, gm.p2_dc, gm.p1_dd, gm.p2_dd,
                gm.label_a, gm.label_b,
                gm.player_1_fingerprint, gr.player_1_action, gr.player_1_score,
                gm.player_2_fingerprint, gr.player_2_action, gr.player_2_score,
                gr.player_1_cooperation_percent, gr.player_2_cooperation_percent, gr.avg_cooperation_percent,
                gr.player_1_cumulative_score, gr.player_2_cumulative_score,
                gm.player_1_country, gm.player_1_city, gm.player_2_country, gm.player_2_city,
                gr.round_start_time, gr.round_end_time, gm.is_complete, gm.completed_at,
                gm.player_1_age, gm.player_1_gender, gm.player_1_nationality, gm.player_1_residence, gm.player_1_education,
                gm.player_1_religion, gm.player_1_meditation, gm.player_1_meditation_years, gm.player_1_punitive_God,
                gm.player_1_game_theory, gm.player_1_other,
                gm.player_2_age, gm.player_2_gender, gm.player_2_nationality, gm.player_2_residence, gm.player_2_education,
                gm.player_2_religion, gm.player_2_meditation, gm.player_2_meditation_years, gm.player_2_punitive_God,
                gm.player_2_game_theory, gm.player_2_other,
            ]
    return headers, row_iter()

def export_custom_prisoner_all() -> None:
    headers, rows = _custom_prisoner_rows()
    def write_csv(fh):
        writer = csv.writer(fh, delimiter=",", quoting=csv.QUOTE_MINIMAL)
        writer.writerow(headers)
        for r in rows:
            writer.writerow(["" if v is None else v for v in r])
    _atomic_write(CUSTOM_PRISONER_CSV, write_csv)

    _, rows2 = _custom_prisoner_rows()
    ddl = """BEGIN;
CREATE TABLE IF NOT EXISTS data_custom_prisoners (
    row_number INTEGER, experiment_name TEXT, condition_name TEXT, secret_code TEXT,
    game_match_uuid TEXT, game_mode TEXT, total_rounds INTEGER,
    p1_cc INTEGER, p2_cc INTEGER, p1_cd INTEGER, p2_cd INTEGER, p1_dc INTEGER, p2_dc INTEGER, p1_dd INTEGER, p2_dd INTEGER,
    label_a TEXT, label_b TEXT,
    player_1_fingerprint TEXT, player_1_action TEXT, player_1_score INTEGER,
    player_2_fingerprint TEXT, player_2_action TEXT, player_2_score INTEGER,
    player_1_cooperation_percent REAL, player_2_cooperation_percent REAL, avg_cooperation_percent REAL,
    player_1_cumulative_score INTEGER, player_2_cumulative_score INTEGER,
    player_1_country TEXT, player_1_city TEXT, player_2_country TEXT, player_2_city TEXT,
    round_start TEXT, round_end TEXT, match_complete BOOLEAN, match_completed_at TEXT,
    player_1_age INTEGER, player_1_gender TEXT, player_1_nationality TEXT, player_1_residence TEXT, player_1_education TEXT,
    player_1_religion TEXT, player_1_meditation TEXT, player_1_meditation_years INTEGER, player_1_punitive_God TEXT,
    player_1_game_theory TEXT, player_1_other TEXT,
    player_2_age INTEGER, player_2_gender TEXT, player_2_nationality TEXT, player_2_residence TEXT, player_2_education TEXT,
    player_2_religion TEXT, player_2_meditation TEXT, player_2_meditation_years INTEGER, player_2_punitive_God TEXT,
    player_2_game_theory TEXT, player_2_other TEXT
);
DELETE FROM data_custom_prisoners;
"""
    def write_sql(fh):
        fh.write(ddl)
        cols_sql = ", ".join(headers)
        for r in rows2:
            values = ", ".join(_sql_literal(v) for v in r)
            fh.write(f"INSERT INTO data_custom_prisoners ({cols_sql}) VALUES ({values});\n")
        fh.write("COMMIT;\n")
    _atomic_write(CUSTOM_PRISONER_SQL, write_sql)


def _custom_ultimatum_rows(user=None) -> Tuple[List[str], Iterable[List[Any]]]:
    """Build rows for Custom Ultimatum matches."""
    headers = [
        "round_number", "experiment_name", "condition_name", "secret_code",
        "game_match_uuid", "game_mode", "endowment", "total_rounds",
        "player_1_fingerprint", "player_1_ip_address", "player_1_coins_to_keep", "player_1_coins_to_offer",
        "player_1_response_to_p2_offer", "player_1_coins_made_in_round",
        "player_2_fingerprint", "player_2_ip_address", "player_2_coins_to_keep", "player_2_coins_to_offer",
        "player_2_response_to_p1_offer", "player_2_coins_made_in_round",
        "players_sum_coins_in_round", "players_sum_coins_total",
        "player_1_final_score", "player_2_final_score",
        "player_1_country", "player_1_city", "player_2_country", "player_2_city",
        "round_start", "round_end", "match_complete", "match_completed_at",
        "player_1_age", "player_1_gender", "player_1_nationality", "player_1_residence", "player_1_education",
        "player_1_religion", "player_1_meditation", "player_1_meditation_years", "player_1_punitive_God",
        "player_1_game_theory", "player_1_other",
        "player_2_age", "player_2_gender", "player_2_nationality", "player_2_residence", "player_2_education",
        "player_2_religion", "player_2_meditation", "player_2_meditation_years", "player_2_punitive_God",
        "player_2_game_theory", "player_2_other",
    ]

    completed_ids = _ultimatum_completed_match_ids()
    qs = (
        UltimatumGameRound.objects
        .filter(
            game_match_uuid__in=completed_ids,
            experiment_id__isnull=False,
            player_1_coins_to_keep__isnull=False,
            player_1_coins_to_offer__isnull=False,
            player_2_coins_to_keep__isnull=False,
            player_2_coins_to_offer__isnull=False,
            player_1_response_to_p2_offer__isnull=False,
            player_2_response_to_p1_offer__isnull=False,
        )
    )

    if user:
        user_experiments = CustomExperiment.objects.filter(creator=user).values_list('id', flat=True)
        qs = qs.filter(experiment_id__in=user_experiments)

    qs = qs.order_by("game_match_uuid", "round_number")

    experiments = {str(e.id): e for e in CustomExperiment.objects.all()}
    conditions = {c.id: c for c in CustomUltimatum.objects.all()}

    def row_iter():
        last_uuid = None
        rn = 0
        for ugr in qs:
            uuid = ugr.game_match_uuid
            if uuid != last_uuid:
                rn = 1
                last_uuid = uuid
            else:
                rn += 1

            exp = experiments.get(str(ugr.experiment_id))
            cond = conditions.get(ugr.condition_id)

            yield [
                rn,
                exp.name if exp else "N/A",
                cond.condition_name if cond else "N/A",
                exp.secret_code if exp else "N/A",
                ugr.game_match_uuid, ugr.game_mode, ugr.endowment, ugr.total_rounds,
                ugr.player_1_fingerprint, ugr.player_1_ip_address, ugr.player_1_coins_to_keep, ugr.player_1_coins_to_offer,
                ugr.player_1_response_to_p2_offer, ugr.player_1_coins_made_in_round,
                ugr.player_2_fingerprint, ugr.player_2_ip_address, ugr.player_2_coins_to_keep, ugr.player_2_coins_to_offer,
                ugr.player_2_response_to_p1_offer, ugr.player_2_coins_made_in_round,
                ugr.players_sum_coins_in_round, ugr.players_sum_coins_total,
                ugr.player_1_final_score, ugr.player_2_final_score,
                ugr.player_1_country, ugr.player_1_city, ugr.player_2_country, ugr.player_2_city,
                ugr.round_start, ugr.round_end, ugr.match_complete, ugr.match_completed_at,
                ugr.player_1_age, ugr.player_1_gender, ugr.player_1_nationality, ugr.player_1_residence, ugr.player_1_education,
                ugr.player_1_religion, ugr.player_1_meditation, ugr.player_1_meditation_years, ugr.player_1_punitive_God,
                ugr.player_1_game_theory, ugr.player_1_other,
                ugr.player_2_age, ugr.player_2_gender, ugr.player_2_nationality, ugr.player_2_residence, ugr.player_2_education,
                ugr.player_2_religion, ugr.player_2_meditation, ugr.player_2_meditation_years, ugr.player_2_punitive_God,
                ugr.player_2_game_theory, ugr.player_2_other,
            ]
    return headers, row_iter()

def export_custom_ultimatum_all() -> None:
    headers, rows = _custom_ultimatum_rows()
    def write_csv(fh):
        writer = csv.writer(fh, delimiter=",", quoting=csv.QUOTE_MINIMAL)
        writer.writerow(headers)
        for r in rows:
            writer.writerow(["" if v is None else v for v in r])
    _atomic_write(CUSTOM_ULTIMATUM_CSV, write_csv)

    _, rows2 = _custom_ultimatum_rows()
    ddl = """BEGIN;
CREATE TABLE IF NOT EXISTS data_custom_ultimatum (
    round_number INTEGER, experiment_name TEXT, condition_name TEXT, secret_code TEXT,
    game_match_uuid TEXT, game_mode TEXT, endowment INTEGER, total_rounds INTEGER,
    player_1_fingerprint TEXT, player_1_ip_address TEXT, player_1_coins_to_keep INTEGER, player_1_coins_to_offer INTEGER,
    player_1_response_to_p2_offer TEXT, player_1_coins_made_in_round INTEGER,
    player_2_fingerprint TEXT, player_2_ip_address TEXT, player_2_coins_to_keep INTEGER, player_2_coins_to_offer INTEGER,
    player_2_response_to_p1_offer TEXT, player_2_coins_made_in_round INTEGER,
    players_sum_coins_in_round INTEGER, players_sum_coins_total INTEGER,
    player_1_final_score INTEGER, player_2_final_score INTEGER,
    player_1_country TEXT, player_1_city TEXT, player_2_country TEXT, player_2_city TEXT,
    round_start TEXT, round_end TEXT, match_complete BOOLEAN, match_completed_at TEXT,
    player_1_age INTEGER, player_1_gender TEXT, player_1_nationality TEXT, player_1_residence TEXT, player_1_education TEXT,
    player_1_religion TEXT, player_1_meditation TEXT, player_1_meditation_years INTEGER, player_1_punitive_God TEXT,
    player_1_game_theory TEXT, player_1_other TEXT,
    player_2_age INTEGER, player_2_gender TEXT, player_2_nationality TEXT, player_2_residence TEXT, player_2_education TEXT,
    player_2_religion TEXT, player_2_meditation TEXT, player_2_meditation_years INTEGER, player_2_punitive_God TEXT,
    player_2_game_theory TEXT, player_2_other TEXT
);
DELETE FROM data_custom_ultimatum;
"""
    def write_sql(fh):
        fh.write(ddl)
        cols_sql = ", ".join(headers)
        for r in rows2:
            values = ", ".join(_sql_literal(v) for v in r)
            fh.write(f"INSERT INTO data_custom_ultimatum ({cols_sql}) VALUES ({values});\n")
        fh.write("COMMIT;\n")
    _atomic_write(CUSTOM_ULTIMATUM_SQL, write_sql)


def _custom_public_goods_rows(user=None) -> Tuple[List[str], Iterable[List[Any]]]:
    """Build rows for Custom Public Goods matches."""
    headers = [
        "game_match_uuid", "round_number", "experiment_name", "condition_name", "secret_code",
        "room_type", "game_mode", "total_rounds", "endowment", "multiplier",
        "punishment_cost", "punishment_value", "reward_cost", "reward_value",
        "player_1_fingerprint", "player_2_fingerprint", "player_3_fingerprint", "player_4_fingerprint",
        "player_1_ip", "player_2_ip", "player_3_ip", "player_4_ip",
        "player_1_contribution", "player_2_contribution", "player_3_contribution", "player_4_contribution",
        "player_1_payoff", "player_2_payoff", "player_3_payoff", "player_4_payoff",
        "total_contributions", "group_return",
        "player_1_cumulative_contribution", "player_2_cumulative_contribution", "player_3_cumulative_contribution", "player_4_cumulative_contribution",
        "player_1_cumulative_payoff", "player_2_cumulative_payoff", "player_3_cumulative_payoff", "player_4_cumulative_payoff",
        "round_actions",
        "player_1_punishes_whom", "player_1_rewards_whom", "player_1_punished_by", "player_1_rewarded_by",
        "player_2_punishes_whom", "player_2_rewards_whom", "player_2_punished_by", "player_2_rewarded_by",
        "player_3_punishes_whom", "player_3_rewards_whom", "player_3_punished_by", "player_3_rewarded_by",
        "player_4_punishes_whom", "player_4_rewards_whom", "player_4_punished_by", "player_4_rewarded_by",
        "player_1_action", "player_2_action", "player_3_action", "player_4_action",
        "punishment_percentage_in_round", "reward_percentage_in_round",
        "player_1_reward_list", "player_1_punish_list", "player_1_reward_counts", "player_1_punish_counts",
        "player_2_reward_list", "player_2_punish_list", "player_2_reward_counts", "player_2_punish_counts",
        "player_3_reward_list", "player_3_punish_list", "player_3_reward_counts", "player_3_punish_counts",
        "player_4_reward_list", "player_4_punish_list", "player_4_reward_counts", "player_4_punish_counts",
        "created_at", "started_at", "completed_at", "round_started_at", "round_completed_at",
        "player_1_age", "player_1_gender", "player_1_nationality", "player_1_residence", "player_1_education",
        "player_1_religion", "player_1_meditation", "player_1_meditation_years", "player_1_punitive_God",
        "player_1_game_theory", "player_1_other",
        "player_2_age", "player_2_gender", "player_2_nationality", "player_2_residence", "player_2_education",
        "player_2_religion", "player_2_meditation", "player_2_meditation_years", "player_2_punitive_God",
        "player_2_game_theory", "player_2_other",
        "player_3_age", "player_3_gender", "player_3_nationality", "player_3_residence", "player_3_education",
        "player_3_religion", "player_3_meditation", "player_3_meditation_years", "player_3_punitive_God",
        "player_3_game_theory", "player_3_other",
        "player_4_age", "player_4_gender", "player_4_nationality", "player_4_residence", "player_4_education",
        "player_4_religion", "player_4_meditation", "player_4_meditation_years", "player_4_punitive_God",
        "player_4_game_theory", "player_4_other",
    ]

    completed_ids_qs = PublicGoodsGameData.objects.filter(
        completed_at__isnull=False,
        experiment_id__isnull=False
    )

    if user:
        user_experiments = CustomExperiment.objects.filter(creator=user).values_list('id', flat=True)
        completed_ids_qs = completed_ids_qs.filter(experiment_id__in=user_experiments)

    completed_ids = completed_ids_qs.values_list("match_id", flat=True).distinct()

    qs = PublicGoodsGameData.objects.filter(
        match_id__in=completed_ids
    ).order_by("match_id", "round_number")

    experiments = {str(e.id): e for e in CustomExperiment.objects.all()}
    conditions = {c.id: c for c in CustomPublicGoods.objects.all()}

    def row_iter():
        for pg in qs:
            exp = experiments.get(str(pg.experiment_id))
            cond = conditions.get(pg.condition_id)

            row = [
                pg.match_id, pg.round_number,
                exp.name if exp else "N/A", cond.condition_name if cond else "N/A", exp.secret_code if exp else "N/A",
                pg.room_type, pg.game_mode, pg.total_rounds, pg.endowment, pg.multiplier,
                pg.punishment_cost, pg.punishment_value, pg.reward_cost, pg.reward_value,
                pg.player_1_fingerprint, pg.player_2_fingerprint, pg.player_3_fingerprint, pg.player_4_fingerprint,
                pg.player_1_ip, pg.player_2_ip, pg.player_3_ip, pg.player_4_ip,
                pg.player_1_contribution, pg.player_2_contribution, pg.player_3_contribution, pg.player_4_contribution,
                pg.player_1_payoff, pg.player_2_payoff, pg.player_3_payoff, pg.player_4_payoff,
                pg.total_contributions, pg.group_return,
                pg.player_1_cumulative_contribution, pg.player_2_cumulative_contribution, pg.player_3_cumulative_contribution, pg.player_4_cumulative_contribution,
                pg.player_1_cumulative_payoff, pg.player_2_cumulative_payoff, pg.player_3_cumulative_payoff, pg.player_4_cumulative_payoff,
                json.dumps(pg.round_actions),
            ]

            actions = pg.round_actions or []
            player_actions = []
            for i in range(1, 5):
                act = "none"
                for a in actions:
                    if a.get('actor') == i:
                        if a.get('type') == 'punish': act = "punishment"; break
                        if a.get('type') == 'reward': act = "reward"; break
                player_actions.append(act)
            punish_count = sum(1 for a in actions if a.get('type') == 'punish')
            reward_count = sum(1 for a in actions if a.get('type') == 'reward')
            punish_perc = punish_count / 4.0
            reward_perc = reward_count / 4.0

            for i in range(1, 5):
                def get_a(actor=None, target=None, atype=None):
                    names = []
                    for a in actions:
                        if (actor is None or a.get('actor') == actor) and                            (target is None or a.get('target') == target) and                            (atype is None or a.get('type') == atype):
                            whom = a.get('target') if actor is not None else a.get('actor')
                            names.append(f"Player {whom}")
                    return ", ".join(names) if names else "none"
                row.extend([get_a(actor=i, atype='punish'), get_a(actor=i, atype='reward'), get_a(target=i, atype='punish'), get_a(target=i, atype='reward')])

            row.extend(player_actions)
            row.append(punish_perc)
            row.append(reward_perc)
            row.extend([
                json.dumps(pg.player_1_reward_list), json.dumps(pg.player_1_punish_list), json.dumps(pg.player_1_reward_counts), json.dumps(pg.player_1_punish_counts),
                json.dumps(pg.player_2_reward_list), json.dumps(pg.player_2_punish_list), json.dumps(pg.player_2_reward_counts), json.dumps(pg.player_2_punish_counts),
                json.dumps(pg.player_3_reward_list), json.dumps(pg.player_3_punish_list), json.dumps(pg.player_3_reward_counts), json.dumps(pg.player_3_punish_counts),
                json.dumps(pg.player_4_reward_list), json.dumps(pg.player_4_punish_list), json.dumps(pg.player_4_reward_counts), json.dumps(pg.player_4_punish_counts),
                pg.created_at.strftime("%Y-%m-%d %H:%M:%S") if pg.created_at else None,
                pg.started_at.strftime("%Y-%m-%d %H:%M:%S") if pg.started_at else None,
                pg.completed_at.strftime("%Y-%m-%d %H:%M:%S") if pg.completed_at else None,
                pg.round_started_at.strftime("%Y-%m-%d %H:%M:%S") if pg.round_started_at else None,
                pg.round_completed_at.strftime("%Y-%m-%d %H:%M:%S") if pg.round_completed_at else None,
                pg.player_1_age, pg.player_1_gender, pg.player_1_nationality, pg.player_1_residence, pg.player_1_education,
                pg.player_1_religion, pg.player_1_meditation, pg.player_1_meditation_years, pg.player_1_punitive_God, pg.player_1_game_theory, pg.player_1_other,
                pg.player_2_age, pg.player_2_gender, pg.player_2_nationality, pg.player_2_residence, pg.player_2_education,
                pg.player_2_religion, pg.player_2_meditation, pg.player_2_meditation_years, pg.player_2_punitive_God, pg.player_2_game_theory, pg.player_2_other,
                pg.player_3_age, pg.player_3_gender, pg.player_3_nationality, pg.player_3_residence, pg.player_3_education,
                pg.player_3_religion, pg.player_3_meditation, pg.player_3_meditation_years, pg.player_3_punitive_God, pg.player_3_game_theory, pg.player_3_other,
                pg.player_4_age, pg.player_4_gender, pg.player_4_nationality, pg.player_4_residence, pg.player_4_education,
                pg.player_4_religion, pg.player_4_meditation, pg.player_4_meditation_years, pg.player_4_punitive_God, pg.player_4_game_theory, pg.player_4_other,
            ])
            yield row
    return headers, row_iter()

def export_custom_public_goods_all() -> None:
    headers, rows = _custom_public_goods_rows()
    def write_csv(fh):
        writer = csv.writer(fh, delimiter=",", quoting=csv.QUOTE_MINIMAL)
        writer.writerow(headers)
        for r in rows:
            writer.writerow(["" if v is None else v for v in r])
    _atomic_write(CUSTOM_PUBLIC_GOODS_CSV, write_csv)

    _, rows2 = _custom_public_goods_rows()
    ddl = """BEGIN;
CREATE TABLE IF NOT EXISTS data_custom_public_goods (
    game_match_uuid TEXT, round_number INTEGER, experiment_name TEXT, condition_name TEXT, secret_code TEXT,
    room_type TEXT, game_mode TEXT, total_rounds INTEGER, endowment REAL, multiplier REAL,
    punishment_cost REAL, punishment_value REAL, reward_cost REAL, reward_value REAL,
    player_1_fingerprint TEXT, player_2_fingerprint TEXT, player_3_fingerprint TEXT, player_4_fingerprint TEXT,
    player_1_ip TEXT, player_2_ip TEXT, player_3_ip TEXT, player_4_ip TEXT,
    player_1_contribution REAL, player_2_contribution REAL, player_3_contribution REAL, player_4_contribution REAL,
    player_1_payoff REAL, player_2_payoff REAL, player_3_payoff REAL, player_4_payoff REAL,
    total_contributions REAL, group_return REAL,
    player_1_cumulative_contribution REAL, player_2_cumulative_contribution REAL, player_3_cumulative_contribution REAL, player_4_cumulative_contribution REAL,
    player_1_cumulative_payoff REAL, player_2_cumulative_payoff REAL, player_3_cumulative_payoff REAL, player_4_cumulative_payoff REAL,
    round_actions TEXT,
    player_1_punishes_whom TEXT, player_1_rewards_whom TEXT, player_1_punished_by TEXT, player_1_rewarded_by TEXT,
    player_2_punishes_whom TEXT, player_2_rewards_whom TEXT, player_2_punished_by TEXT, player_2_rewarded_by TEXT,
    player_3_punishes_whom TEXT, player_3_rewards_whom TEXT, player_3_punished_by TEXT, player_3_rewarded_by TEXT,
    player_4_punishes_whom TEXT, player_4_rewards_whom TEXT, player_4_punished_by TEXT, player_4_rewarded_by TEXT,
    player_1_action TEXT, player_2_action TEXT, player_3_action TEXT, player_4_action TEXT,
    punishment_percentage_in_round REAL, reward_percentage_in_round REAL,
    player_1_reward_list TEXT, player_1_punish_list TEXT, player_1_reward_counts TEXT, player_1_punish_counts TEXT,
    player_2_reward_list TEXT, player_2_punish_list TEXT, player_2_reward_counts TEXT, player_2_punish_counts TEXT,
    player_3_reward_list TEXT, player_3_punish_list TEXT, player_3_reward_counts TEXT, player_3_punish_counts TEXT,
    player_4_reward_list TEXT, player_4_punish_list TEXT, player_4_reward_counts TEXT, player_4_punish_counts TEXT,
    created_at TEXT, started_at TEXT, completed_at TEXT, round_started_at TEXT, round_completed_at TEXT,
    player_1_age INTEGER, player_1_gender TEXT, player_1_nationality TEXT, player_1_residence TEXT, player_1_education TEXT,
    player_1_religion TEXT, player_1_meditation TEXT, player_1_meditation_years INTEGER, player_1_punitive_God TEXT,
    player_1_game_theory TEXT, player_1_other TEXT,
    player_2_age INTEGER, player_2_gender TEXT, player_2_nationality TEXT, player_2_residence TEXT, player_2_education TEXT,
    player_2_religion TEXT, player_2_meditation TEXT, player_2_meditation_years INTEGER, player_2_punitive_God TEXT,
    player_2_game_theory TEXT, player_2_other TEXT,
    player_3_age INTEGER, player_3_gender TEXT, player_3_nationality TEXT, player_3_residence TEXT, player_3_education TEXT,
    player_3_religion TEXT, player_3_meditation TEXT, player_3_meditation_years INTEGER, player_3_punitive_God TEXT,
    player_3_game_theory TEXT, player_3_other TEXT,
    player_4_age INTEGER, player_4_gender TEXT, player_4_nationality TEXT, player_4_residence TEXT, player_4_education TEXT,
    player_4_religion TEXT, player_4_meditation TEXT, player_4_meditation_years INTEGER, player_4_punitive_God TEXT,
    player_4_game_theory TEXT, player_4_other TEXT
);
DELETE FROM data_custom_public_goods;
"""
    def write_sql(fh):
        fh.write(ddl)
        cols_sql = ", ".join(headers)
        for r in rows2:
            values = ", ".join(_sql_literal(v) for v in r)
            fh.write(f"INSERT INTO data_custom_public_goods ({cols_sql}) VALUES ({values});\n")
        fh.write("COMMIT;\n")
    _atomic_write(CUSTOM_PUBLIC_GOODS_SQL, write_sql)


def _custom_common_pool_rows(user=None) -> Tuple[List[str], Iterable[List[Any]]]:
    """Build rows for Custom Common Pool Resource matches."""
    headers = [
        "match_id", "round_number", "experiment_name", "condition_name", "secret_code",
        "room_type", "game_mode", "total_rounds", "initial_fish_stock", "max_fish_stock",
        "max_extraction", "final_bonus_multiplier", "reward_cost", "reward_value",
        "punishment_cost", "punishment_value",
        "player_1_fingerprint", "player_2_fingerprint", "player_3_fingerprint", "player_4_fingerprint",
        "player_1_ip", "player_2_ip", "player_3_ip", "player_4_ip",
        "fish_stock",
        "player_1_extraction", "player_2_extraction", "player_3_extraction", "player_4_extraction",
        "player_1_actual_catch", "player_2_actual_catch", "player_3_actual_catch", "player_4_actual_catch",
        "player_1_payoff", "player_2_payoff", "player_3_payoff", "player_4_payoff",
        "total_extractions", "new_fish_born", "next_fish_stock",
        "player_1_cumulative_extraction", "player_2_cumulative_extraction", "player_3_cumulative_extraction", "player_4_cumulative_extraction",
        "player_1_cumulative_payoff", "player_2_cumulative_payoff", "player_3_cumulative_payoff", "player_4_cumulative_payoff",
        "round_actions",
        "player_1_punishes_whom", "player_1_rewards_whom", "player_1_punished_by", "player_1_rewarded_by",
        "player_2_punishes_whom", "player_2_rewards_whom", "player_2_punished_by", "player_2_rewarded_by",
        "player_3_punishes_whom", "player_3_rewards_whom", "player_3_punished_by", "player_3_rewarded_by",
        "player_4_punishes_whom", "player_4_rewards_whom", "player_4_punished_by", "player_4_rewarded_by",
        "player_1_action", "player_2_action", "player_3_action", "player_4_action",
        "punishment_percentage_in_round", "reward_percentage_in_round",
        "player_1_reward_list", "player_1_punish_list", "player_1_reward_counts", "player_1_punish_counts",
        "player_2_reward_list", "player_2_punish_list", "player_2_reward_counts", "player_2_punish_counts",
        "player_3_reward_list", "player_3_punish_list", "player_3_reward_counts", "player_3_punish_counts",
        "player_4_reward_list", "player_4_punish_list", "player_4_reward_counts", "player_4_punish_counts",
        "created_at", "started_at", "completed_at", "round_started_at", "round_completed_at",
        "player_1_age", "player_1_gender", "player_1_nationality", "player_1_residence", "player_1_education",
        "player_1_religion", "player_1_meditation", "player_1_meditation_years", "player_1_punitive_God",
        "player_1_game_theory", "player_1_other",
        "player_2_age", "player_2_gender", "player_2_nationality", "player_2_residence", "player_2_education",
        "player_2_religion", "player_2_meditation", "player_2_meditation_years", "player_2_punitive_God",
        "player_2_game_theory", "player_2_other",
        "player_3_age", "player_3_gender", "player_3_nationality", "player_3_residence", "player_3_education",
        "player_3_religion", "player_3_meditation", "player_3_meditation_years", "player_3_punitive_God",
        "player_3_game_theory", "player_3_other",
        "player_4_age", "player_4_gender", "player_4_nationality", "player_4_residence", "player_4_education",
        "player_4_religion", "player_4_meditation", "player_4_meditation_years", "player_4_punitive_God",
        "player_4_game_theory", "player_4_other",
    ]

    completed_ids_qs = CommonPoolGameData.objects.filter(
        completed_at__isnull=False,
        experiment_id__isnull=False
    )

    if user:
        user_experiments = CustomExperiment.objects.filter(creator=user).values_list('id', flat=True)
        completed_ids_qs = completed_ids_qs.filter(experiment_id__in=user_experiments)

    completed_ids = list(completed_ids_qs.values("match_id").annotate(
        match_created_at=Min("created_at")
    ).order_by("match_created_at", "match_id").values_list("match_id", flat=True))

    match_order = Case(
        *[When(match_id=match_id, then=position) for position, match_id in enumerate(completed_ids)],
        output_field=IntegerField(),
    )

    qs = CommonPoolGameData.objects.filter(
        match_id__in=completed_ids
    ).annotate(_match_order=match_order).order_by("_match_order", "round_number")

    experiments = {str(e.id): e for e in CustomExperiment.objects.all()}
    conditions = {c.id: c for c in CustomCommonPool.objects.all()}

    def row_iter():
        for cp in qs:
            exp = experiments.get(str(cp.experiment_id))
            cond = conditions.get(cp.condition_id)

            row = [
                cp.match_id, cp.round_number,
                exp.name if exp else "N/A", cond.condition_name if cond else "N/A", exp.secret_code if exp else "N/A",
                cp.room_type, cp.game_mode, cp.total_rounds, cp.initial_fish_stock, cp.max_fish_stock,
                cp.max_extraction, cp.final_bonus_multiplier, cp.reward_cost, cp.reward_value,
                cp.punishment_cost, cp.punishment_value,
                cp.player_1_fingerprint, cp.player_2_fingerprint, cp.player_3_fingerprint, cp.player_4_fingerprint,
                cp.player_1_ip, cp.player_2_ip, cp.player_3_ip, cp.player_4_ip,
                cp.fish_stock,
                cp.player_1_extraction, cp.player_2_extraction, cp.player_3_extraction, cp.player_4_extraction,
                cp.player_1_actual_catch, cp.player_2_actual_catch, cp.player_3_actual_catch, cp.player_4_actual_catch,
                cp.player_1_payoff, cp.player_2_payoff, cp.player_3_payoff, cp.player_4_payoff,
                cp.total_extractions, cp.new_fish_born, cp.next_fish_stock,
                cp.player_1_cumulative_extraction, cp.player_2_cumulative_extraction, cp.player_3_cumulative_extraction, cp.player_4_cumulative_extraction,
                cp.player_1_cumulative_payoff, cp.player_2_cumulative_payoff, cp.player_3_cumulative_payoff, cp.player_4_cumulative_payoff,
                json.dumps(cp.round_actions),
            ]

            actions = cp.round_actions or []
            player_actions = []
            for i in range(1, 5):
                act = "none"
                for a in actions:
                    if a.get('actor') == i:
                        if a.get('type') == 'punish': act = "punishment"; break
                        if a.get('type') == 'reward': act = "reward"; break
                player_actions.append(act)
            punish_count = sum(1 for a in actions if a.get('type') == 'punish')
            reward_count = sum(1 for a in actions if a.get('type') == 'reward')
            punish_perc = punish_count / 4.0
            reward_perc = reward_count / 4.0

            for i in range(1, 5):
                def get_a(actor=None, target=None, atype=None):
                    names = []
                    for a in actions:
                        if (actor is None or a.get('actor') == actor) and \
                           (target is None or a.get('target') == target) and \
                           (atype is None or a.get('type') == atype):
                            whom = a.get('target') if actor is not None else a.get('actor')
                            names.append(f"Player {whom}")
                    return ", ".join(names) if names else "none"
                row.extend([get_a(actor=i, atype='punish'), get_a(actor=i, atype='reward'), get_a(target=i, atype='punish'), get_a(target=i, atype='reward')])

            row.extend(player_actions)
            row.append(punish_perc)
            row.append(reward_perc)
            row.extend([
                json.dumps(cp.player_1_reward_list), json.dumps(cp.player_1_punish_list), json.dumps(cp.player_1_reward_counts), json.dumps(cp.player_1_punish_counts),
                json.dumps(cp.player_2_reward_list), json.dumps(cp.player_2_punish_list), json.dumps(cp.player_2_reward_counts), json.dumps(cp.player_2_punish_counts),
                json.dumps(cp.player_3_reward_list), json.dumps(cp.player_3_punish_list), json.dumps(cp.player_3_reward_counts), json.dumps(cp.player_3_punish_counts),
                json.dumps(cp.player_4_reward_list), json.dumps(cp.player_4_punish_list), json.dumps(cp.player_4_reward_counts), json.dumps(cp.player_4_punish_counts),
                cp.created_at.strftime("%Y-%m-%d %H:%M:%S") if cp.created_at else None,
                cp.started_at.strftime("%Y-%m-%d %H:%M:%S") if cp.started_at else None,
                cp.completed_at.strftime("%Y-%m-%d %H:%M:%S") if cp.completed_at else None,
                cp.round_started_at.strftime("%Y-%m-%d %H:%M:%S") if cp.round_started_at else None,
                cp.round_completed_at.strftime("%Y-%m-%d %H:%M:%S") if cp.round_completed_at else None,
                cp.player_1_age, cp.player_1_gender, cp.player_1_nationality, cp.player_1_residence, cp.player_1_education,
                cp.player_1_religion, cp.player_1_meditation, cp.player_1_meditation_years, cp.player_1_punitive_God, cp.player_1_game_theory, cp.player_1_other,
                cp.player_2_age, cp.player_2_gender, cp.player_2_nationality, cp.player_2_residence, cp.player_2_education,
                cp.player_2_religion, cp.player_2_meditation, cp.player_2_meditation_years, cp.player_2_punitive_God, cp.player_2_game_theory, cp.player_2_other,
                cp.player_3_age, cp.player_3_gender, cp.player_3_nationality, cp.player_3_residence, cp.player_3_education,
                cp.player_3_religion, cp.player_3_meditation, cp.player_3_meditation_years, cp.player_3_punitive_God, cp.player_3_game_theory, cp.player_3_other,
                cp.player_4_age, cp.player_4_gender, cp.player_4_nationality, cp.player_4_residence, cp.player_4_education,
                cp.player_4_religion, cp.player_4_meditation, cp.player_4_meditation_years, cp.player_4_punitive_God, cp.player_4_game_theory, cp.player_4_other,
            ])
            yield row
    return headers, row_iter()


def export_custom_common_pool_all() -> None:
    headers, rows = _custom_common_pool_rows()
    def write_csv(fh):
        writer = csv.writer(fh, delimiter=",", quoting=csv.QUOTE_MINIMAL)
        writer.writerow(headers)
        for r in rows:
            writer.writerow(["" if v is None else v for v in r])
    _atomic_write(CUSTOM_COMMON_POOL_CSV, write_csv)

    _, rows2 = _custom_common_pool_rows()
    ddl = """BEGIN;
CREATE TABLE IF NOT EXISTS data_custom_common_pool (
    match_id TEXT, round_number INTEGER, experiment_name TEXT, condition_name TEXT, secret_code TEXT,
    room_type TEXT, game_mode TEXT, total_rounds INTEGER, initial_fish_stock INTEGER, max_fish_stock INTEGER,
    max_extraction INTEGER, final_bonus_multiplier REAL, reward_cost REAL, reward_value REAL,
    punishment_cost REAL, punishment_value REAL,
    player_1_fingerprint TEXT, player_2_fingerprint TEXT, player_3_fingerprint TEXT, player_4_fingerprint TEXT,
    player_1_ip TEXT, player_2_ip TEXT, player_3_ip TEXT, player_4_ip TEXT,
    fish_stock INTEGER,
    player_1_extraction INTEGER, player_2_extraction INTEGER, player_3_extraction INTEGER, player_4_extraction INTEGER,
    player_1_actual_catch INTEGER, player_2_actual_catch INTEGER, player_3_actual_catch INTEGER, player_4_actual_catch INTEGER,
    player_1_payoff REAL, player_2_payoff REAL, player_3_payoff REAL, player_4_payoff REAL,
    total_extractions INTEGER, new_fish_born INTEGER, next_fish_stock INTEGER,
    player_1_cumulative_extraction INTEGER, player_2_cumulative_extraction INTEGER, player_3_cumulative_extraction INTEGER, player_4_cumulative_extraction INTEGER,
    player_1_cumulative_payoff REAL, player_2_cumulative_payoff REAL, player_3_cumulative_payoff REAL, player_4_cumulative_payoff REAL,
    round_actions TEXT,
    player_1_punishes_whom TEXT, player_1_rewards_whom TEXT, player_1_punished_by TEXT, player_1_rewarded_by TEXT,
    player_2_punishes_whom TEXT, player_2_rewards_whom TEXT, player_2_punished_by TEXT, player_2_rewarded_by TEXT,
    player_3_punishes_whom TEXT, player_3_rewards_whom TEXT, player_3_punished_by TEXT, player_3_rewarded_by TEXT,
    player_4_punishes_whom TEXT, player_4_rewards_whom TEXT, player_4_punished_by TEXT, player_4_rewarded_by TEXT,
    player_1_action TEXT, player_2_action TEXT, player_3_action TEXT, player_4_action TEXT,
    punishment_percentage_in_round REAL, reward_percentage_in_round REAL,
    player_1_reward_list TEXT, player_1_punish_list TEXT, player_1_reward_counts TEXT, player_1_punish_counts TEXT,
    player_2_reward_list TEXT, player_2_punish_list TEXT, player_2_reward_counts TEXT, player_2_punish_counts TEXT,
    player_3_reward_list TEXT, player_3_punish_list TEXT, player_3_reward_counts TEXT, player_3_punish_counts TEXT,
    player_4_reward_list TEXT, player_4_punish_list TEXT, player_4_reward_counts TEXT, player_4_punish_counts TEXT,
    created_at TEXT, started_at TEXT, completed_at TEXT, round_started_at TEXT, round_completed_at TEXT,
    player_1_age INTEGER, player_1_gender TEXT, player_1_nationality TEXT, player_1_residence TEXT, player_1_education TEXT,
    player_1_religion TEXT, player_1_meditation TEXT, player_1_meditation_years INTEGER, player_1_punitive_God TEXT,
    player_1_game_theory TEXT, player_1_other TEXT,
    player_2_age INTEGER, player_2_gender TEXT, player_2_nationality TEXT, player_2_residence TEXT, player_2_education TEXT,
    player_2_religion TEXT, player_2_meditation TEXT, player_2_meditation_years INTEGER, player_2_punitive_God TEXT,
    player_2_game_theory TEXT, player_2_other TEXT,
    player_3_age INTEGER, player_3_gender TEXT, player_3_nationality TEXT, player_3_residence TEXT, player_3_education TEXT,
    player_3_religion TEXT, player_3_meditation TEXT, player_3_meditation_years INTEGER, player_3_punitive_God TEXT,
    player_3_game_theory TEXT, player_3_other TEXT,
    player_4_age INTEGER, player_4_gender TEXT, player_4_nationality TEXT, player_4_residence TEXT, player_4_education TEXT,
    player_4_religion TEXT, player_4_meditation TEXT, player_4_meditation_years INTEGER, player_4_punitive_God TEXT,
    player_4_game_theory TEXT, player_4_other TEXT
);
DELETE FROM data_custom_common_pool;
"""
    def write_sql(fh):
        fh.write(ddl)
        cols_sql = ", ".join(headers)
        for r in rows2:
            values = ", ".join(_sql_literal(v) for v in r)
            fh.write(f"INSERT INTO data_custom_common_pool ({cols_sql}) VALUES ({values});\n")
        fh.write("COMMIT;\n")
    _atomic_write(CUSTOM_COMMON_POOL_SQL, write_sql)


def get_user_data_csv(user, game_type):
    """
    Generate an in-memory CSV string for a specific user's custom experiments.
    """
    if game_type == 'prisoner':
        headers, rows = _custom_prisoner_rows(user=user)
    elif game_type == 'ultimatum':
        headers, rows = _custom_ultimatum_rows(user=user)
    elif game_type == 'public_goods':
        headers, rows = _custom_public_goods_rows(user=user)
    elif game_type == 'common_pool':
        headers, rows = _custom_common_pool_rows(user=user)
    else:
        return None

    output = io.StringIO()
    writer = csv.writer(output, delimiter=",", quoting=csv.QUOTE_MINIMAL)
    writer.writerow(headers)
    for r in rows:
        writer.writerow(["" if v is None else v for v in r])
    
    return output.getvalue()


def get_combined_user_data_csv(user):
    """
    Merge all custom experiment data for a user into a single CSV.
    Headers are unioned, and missing values for specific game types are left empty.
    """
    p_headers, p_rows = _custom_prisoner_rows(user=user)
    u_headers, u_rows = _custom_ultimatum_rows(user=user)
    pg_headers, pg_rows = _custom_public_goods_rows(user=user)
    cp_headers, cp_rows = _custom_common_pool_rows(user=user)

    # Union of all headers
    all_headers = ["game_type_label"] + list(dict.fromkeys(p_headers + u_headers + pg_headers + cp_headers))

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=all_headers, extrasaction='ignore')
    writer.writeheader()

    # Prisoner
    for r in p_rows:
        row_dict = {h: ("" if v is None else v) for h, v in zip(p_headers, r)}
        row_dict["game_type_label"] = "2x2"
        writer.writerow(row_dict)

    # Ultimatum
    for r in u_rows:
        row_dict = {h: ("" if v is None else v) for h, v in zip(u_headers, r)}
        row_dict["game_type_label"] = "ultimatum"
        writer.writerow(row_dict)

    # Public Goods
    for r in pg_rows:
        row_dict = {h: ("" if v is None else v) for h, v in zip(pg_headers, r)}
        row_dict["game_type_label"] = "public_goods"
        writer.writerow(row_dict)

    # Common Pool
    for r in cp_rows:
        row_dict = {h: ("" if v is None else v) for h, v in zip(cp_headers, r)}
        row_dict["game_type_label"] = "common_pool"
        writer.writerow(row_dict)

    return output.getvalue()
