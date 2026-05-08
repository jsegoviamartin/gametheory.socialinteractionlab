from django.utils import timezone
from django.db import transaction
import random

from .models import (
    PublicGoodsMatch,
    PublicGoodsRound,
    PublicGoodsAction,
)

# ============================================================
# Helpers
# ============================================================

def get_contributions(round_obj):
    return [
        round_obj.player_1_contribution,
        round_obj.player_2_contribution,
        round_obj.player_3_contribution,
        round_obj.player_4_contribution,
    ]


def set_player_field(obj, field_prefix, index, value):
    setattr(obj, f"{field_prefix}_{index}", value)


def get_player_field(obj, field_prefix, index):
    return getattr(obj, f"{field_prefix}_{index}")


# ============================================================
# Stage 1 — Contribution
# ============================================================

@transaction.atomic
def submit_contribution(round_obj, player_index, amount):
    """
    Player submits contribution for Stage 1.
    """
    if round_obj.current_stage != 'contribution':
        raise ValueError("Contributions are closed")

    match = round_obj.match

    if amount < 0 or amount > match.endowment:
        raise ValueError("Invalid contribution amount")

    field_name = f"player_{player_index}_contribution"

    if getattr(round_obj, field_name) is not None:
        raise ValueError("Contribution already submitted")

    setattr(round_obj, field_name, amount)
    round_obj.save()

    # Auto-advance if round complete
    if round_obj.contributions_complete():
        calculate_stage_1(round_obj)

    return round_obj


@transaction.atomic
def calculate_stage_1(round_obj):
    """
    Computes group return and base payoffs.
    """
    match = round_obj.match
    contributions = get_contributions(round_obj)

    if any(c is None for c in contributions):
        return

    total = sum(contributions)
    group_return = (total * match.multiplier) / 4

    round_obj.group_total_contribution = total
    round_obj.group_return = group_return

    for i in range(1, 5):
        contribution = getattr(round_obj, f"player_{i}_contribution")
        payoff = (match.endowment - contribution) + group_return
        setattr(round_obj, f"player_{i}_payoff", payoff)

    # Move to next stage
    if match.room_type == 'basic':
        round_obj.current_stage = 'results'
        round_obj.save()
    elif match.room_type in ['punishment', 'mixed']:
        round_obj.current_stage = 'punishment'
        round_obj.save()
    elif match.room_type == 'reward':
        round_obj.current_stage = 'reward'
        round_obj.save()


# ============================================================
# Stage 2 — Punishment / Reward
# ============================================================

@transaction.atomic
def submit_action(round_obj, actor_index, target_index, action_type, points=1):
    """
    Submit punishment or reward action.
    """
    if round_obj.current_stage not in ['punishment', 'reward']:
        raise ValueError("Stage 2 is not active")

    if actor_index == target_index:
        raise ValueError("Cannot target self")

    PublicGoodsAction.objects.create(
        round=round_obj,
        actor_index=actor_index,
        target_index=target_index,
        action_type=action_type,
        points=points
    )

    return round_obj


@transaction.atomic
def apply_stage_2(round_obj):
    """
    Apply punishment/reward effects to payoffs.
    """
    match = round_obj.match

    for action in round_obj.actions.all():
        if action.action_type == 'punish':
            cost = match.punishment_cost * action.points
            impact = match.punishment_impact * action.points * -1
        else:
            cost = match.reward_cost * action.points
            impact = match.reward_impact * action.points

        # Actor pays cost
        actor_payoff = getattr(round_obj, f"player_{action.actor_index}_payoff")
        setattr(
            round_obj,
            f"player_{action.actor_index}_payoff",
            actor_payoff - cost
        )

        # Target receives impact
        target_payoff = getattr(round_obj, f"player_{action.target_index}_payoff")
        setattr(
            round_obj,
            f"player_{action.target_index}_payoff",
            target_payoff + impact
        )

    finish_round(round_obj)


# ============================================================
# Round & Match Progression
# ============================================================

@transaction.atomic
def finish_round(round_obj):
    """
    Finalize round, update totals, and advance game.
    """
    round_obj.current_stage = 'finished'
    round_obj.round_completed_at = timezone.now()
    round_obj.save()

    update_match_totals(round_obj.match, round_obj)
    advance_game(round_obj.match)


def update_match_totals(match, round_obj):
    for i in range(1, 5):
        current_total = getattr(match, f"player_{i}_total_payoff")
        round_payoff = getattr(round_obj, f"player_{i}_payoff")

        setattr(
            match,
            f"player_{i}_total_payoff",
            current_total + round_payoff
        )

    match.save()


@transaction.atomic
def advance_game(match):
    """
    Starts next round or ends the match.
    """
    completed_rounds = match.rounds.filter(current_stage='finished').count()

    if completed_rounds >= match.number_of_rounds:
        match.is_complete = True
        match.completed_at = timezone.now()
        match.save()
        return

    next_round_number = completed_rounds + 1

    PublicGoodsRound.objects.create(
        match=match,
        round_number=next_round_number
    )


# ============================================================
# Bot Logic (Optional, Extend Later)
# ============================================================

def bot_contribution_strategy(round_obj):
    """
    Simple bot strategy (can be replaced later).
    """
    return random.randint(0, round_obj.match.endowment)