from .models import GameMatch, GameRound
from django.utils import timezone

def calculate_payoff(player_1_action, player_2_action, match):
    """
    Calculate the payoff using researcher-defined values from the match row.
    """
    # Normalize actions based on researcher labels
    p1 = player_1_action.strip() if player_1_action else ''
    p2 = player_2_action.strip() if player_2_action else ''
    
    # Check if choice is Choice A based on current match labels
    a1 = 'a' if p1 == match.label_a else 'b'
    a2 = 'a' if p2 == match.label_a else 'b'
    
    if a1 == 'a' and a2 == 'a': return match.p1_cc or 0, match.p2_cc or 0
    if a1 == 'a' and a2 == 'b': return match.p1_cd or 0, match.p2_cd or 0
    if a1 == 'b' and a2 == 'a': return match.p1_dc or 0, match.p2_dc or 0
    if a1 == 'b' and a2 == 'b': return match.p1_dd or 0, match.p2_dd or 0
        
    return 0, 0

def format_cooperation_percentage(value):
    if value == int(value):
        return int(value)
    else:
        rounded = round(value, 2)
        if rounded == int(rounded):
            return int(rounded)
        return rounded

def update_game_stats(match_id):
    try:
        game_match = GameMatch.objects.get(match_id=match_id)
    except GameMatch.DoesNotExist:
        return
    
    rounds = game_match.rounds.all().order_by('round_number')
    if not rounds.exists():
        return
    
    current_round = rounds.last()
    if current_round.player_1_action and current_round.player_2_action and \
       (current_round.player_1_score is None or current_round.player_2_score is None):
        player_1_payoff, player_2_payoff = calculate_payoff(
            current_round.player_1_action, 
            current_round.player_2_action,
            game_match
        )
        current_round.player_1_score = player_1_payoff
        current_round.player_2_score = player_2_payoff
        current_round.round_end_time = timezone.now().strftime('%Y-%m-%d %H:%M')
        current_round.save()
    
    completed_rounds = rounds.filter(
        player_1_action__isnull=False,
        player_2_action__isnull=False
    ).order_by('round_number')
    
    # Choice A is always match.label_a
    label_a = game_match.label_a
    
    for i, round_obj in enumerate(completed_rounds, 1):
        rounds_up_to_current = completed_rounds[:i]
        
        player_1_cooperations = sum(1 for r in rounds_up_to_current if r.player_1_action == label_a)
        player_2_cooperations = sum(1 for r in rounds_up_to_current if r.player_2_action == label_a)
        
        rounds_count = len(rounds_up_to_current)
        player_1_cooperation_percent = player_1_cooperations / rounds_count if rounds_count > 0 else 0
        player_2_cooperation_percent = player_2_cooperations / rounds_count if rounds_count > 0 else 0
        avg_cooperation_percent = (player_1_cooperation_percent + player_2_cooperation_percent) / 2
        
        player_1_cumulative_score = sum(r.player_1_score for r in rounds_up_to_current if r.player_1_score is not None)
        player_2_cumulative_score = sum(r.player_2_score for r in rounds_up_to_current if r.player_2_score is not None)
        
        round_obj.player_1_cooperation_percent = format_cooperation_percentage(player_1_cooperation_percent)
        round_obj.player_2_cooperation_percent = format_cooperation_percentage(player_2_cooperation_percent)
        round_obj.avg_cooperation_percent = format_cooperation_percentage(avg_cooperation_percent)
        round_obj.player_1_cumulative_score = player_1_cumulative_score
        round_obj.player_2_cumulative_score = player_2_cumulative_score
        round_obj.save()
    
    if completed_rounds.exists():
        final_round = completed_rounds.last()
        game_match.player_1_cooperation_percent = final_round.player_1_cooperation_percent
        game_match.player_2_cooperation_percent = final_round.player_2_cooperation_percent
        game_match.avg_cooperation_percent = final_round.avg_cooperation_percent
    
    if completed_rounds.count() >= game_match.total_rounds:
        game_match.is_complete = True
        game_match.completed_at = timezone.now().strftime('%Y-%m-%d %H:%M')
        game_match.player_1_final_score = sum(r.player_1_score for r in completed_rounds if r.player_1_score is not None)
        game_match.player_2_final_score = sum(r.player_2_score for r in completed_rounds if r.player_2_score is not None)
    
    game_match.save()

def cleanup_incomplete_matches():
    incomplete_matches = GameMatch.objects.filter(is_complete=False)
    deleted_count = 0
    for match in incomplete_matches:
        if match.delete_if_incomplete():
            deleted_count += 1
    return deleted_count