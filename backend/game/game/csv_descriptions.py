"""Short explanations for the second row of each exported CSV."""

COLUMN_DESCRIPTIONS = {
    'game_match_uuid': 'Match ID.',
    'round_number': 'Round number in this match.',
    'experiment_name': 'Experiment name.',
    'condition_name': 'Condition name.',
    'secret_code': 'Experiment access code.',
    'game_mode': 'Game mode: online or bot.',
    'game_type': 'Ultimatum format: iterative or one_shot.',
    'game_type_label': 'Type of game.',
    'room_type': 'Room rules: basic, reward, punishment, or mixed.',
    'total_rounds': 'Number of rounds planned for this match.',
    'label_a': 'Name shown for action A (cooperate).',
    'label_b': 'Name shown for action B (defect).',
    'endowment': 'Amount available to each player each round.',
    'multiplier': 'Multiplier applied to the public pool.',
    'reward_cost': 'Cost to the player giving a reward.',
    'reward_value': 'Amount added to the rewarded player.',
    'punishment_cost': 'Cost to the player giving a punishment.',
    'punishment_value': 'Amount removed from the punished player.',
    'initial_fish_stock': 'Fish available at the start of the match.',
    'max_fish_stock': 'Maximum fish the pool can hold.',
    'max_extraction': 'Maximum fish a player may request each round.',
    'final_bonus_multiplier': 'Multiplier applied to remaining fish for the final bonus.',
    'fish_stock': 'Fish available at the start of this round.',
    'total_extractions': 'Total fish requested by all players this round.',
    'new_fish_born': 'New fish added after this round.',
    'next_fish_stock': 'Fish available for the next round.',
    'total_contributions': 'Total amount contributed by all players this round.',
    'group_return': 'Public pool return received by each player this round.',
    'players_sum_coins_in_round': 'Combined earnings of both players this round.',
    'players_sum_coins_total': 'Combined earnings of both players so far.',
    'avg_cooperation_percent': 'Average cooperation rate (0.25 means 25%).',
    'round_actions': 'Reward and punishment actions this round, with actor and target.',
    'punishment_percentage_in_round': 'Number of punishment actions this round divided by 4 players.',
    'reward_percentage_in_round': 'Number of reward actions this round divided by 4 players.',
    'round_start': 'Time this round started.',
    'round_end': 'Time this round ended.',
    'round_started_at': 'Time this round started.',
    'round_completed_at': 'Time this round ended.',
    'created_at': 'Time this round record was created.',
    'started_at': 'Time the match started.',
    'completed_at': 'Time the match ended.',
    'match_complete': 'Whether the match is complete.',
    'match_completed_at': 'Time the match ended.',
    'ID': 'Researcher ID.',
    'Username': 'Researcher username.',
    'Email': 'Researcher email address.',
    'Date Joined': 'Time the account was created.',
    'Last Login': 'Time of the most recent login.',
    'Total Experiments': 'Number of experiments owned by this researcher.',
    'Experiments Details': 'Experiment names, game types, and creation dates.',
}

PLAYER_DESCRIPTIONS = {
    'fingerprint': '{player} ID.',
    'ip': '{player} IP address.',
    'ip_address': '{player} IP address.',
    'country': '{player} connection country.',
    'city': '{player} connection city.',
    'action': '{player} action this round.',
    'score': '{player} payoff this round.',
    'payoff': '{player} payoff this round.',
    'final_score': '{player} final score.',
    'cumulative_score': '{player} total score so far.',
    'cumulative_payoff': '{player} total payoff so far.',
    'cooperation_percent': '{player} cooperation rate (0.25 means 25%).',
    'contribution': 'Amount {player_lower} contributed this round.',
    'cumulative_contribution': 'Total amount {player_lower} has contributed so far.',
    'extraction': 'Fish {player_lower} requested this round.',
    'actual_catch': 'Fish {player_lower} actually caught this round.',
    'cumulative_extraction': 'Total fish {player_lower} has requested so far.',
    'coins_to_keep': 'Coins {player_lower} proposed to keep.',
    'coins_to_offer': 'Coins {player_lower} offered to the other player.',
    'coins_made_in_round': 'Coins {player_lower} earned this round.',
    'punishes_whom': 'Players punished by {player_lower} this round.',
    'rewards_whom': 'Players rewarded by {player_lower} this round.',
    'punished_by': 'Players who punished {player_lower} this round.',
    'rewarded_by': 'Players who rewarded {player_lower} this round.',
    'reward_list': 'List of players rewarded by {player_lower}.',
    'punish_list': 'List of players punished by {player_lower}.',
    'reward_counts': 'Number of rewards {player_lower} gave each player.',
    'punish_counts': 'Number of punishments {player_lower} gave each player.',
    'age': '{player} age from the survey.',
    'gender': '{player} gender from the survey.',
    'nationality': '{player} nationality from the survey.',
    'residence': '{player} country of residence from the survey.',
    'education': '{player} education level from the survey.',
    'religion': '{player} religion from the survey.',
    'meditation': 'Whether {player_lower} practices meditation or mindfulness.',
    'meditation_years': 'Years {player_lower} has practiced meditation or mindfulness.',
    'punitive_God': 'Whether {player_lower} believes a higher power punishes immoral actions.',
    'game_theory': 'Whether {player_lower} is familiar with game theory experiments.',
    'other': '{player} additional survey comments.',
}

for player_number in range(1, 5):
    for suffix, template in PLAYER_DESCRIPTIONS.items():
        COLUMN_DESCRIPTIONS[f'player_{player_number}_{suffix}'] = template.format(
            player=f'Player {player_number}', player_lower=f'player {player_number}',
        )

for player_number, other_player in ((1, 2), (2, 1)):
    COLUMN_DESCRIPTIONS[f'player_{player_number}_response_to_p{other_player}_offer'] = (
        f'Whether player {player_number} accepted or rejected player {other_player}\'s offer.'
    )
    for actions, choices in {
        'cc': 'player 1 cooperates and player 2 cooperates',
        'cd': 'player 1 cooperates and player 2 defects',
        'dc': 'player 1 defects and player 2 cooperates',
        'dd': 'player 1 defects and player 2 defects',
    }.items():
        COLUMN_DESCRIPTIONS[f'p{player_number}_{actions}'] = f'Player {player_number} payoff when {choices}.'


def csv_column_descriptions(headers):
    # Require an explanation whenever a new column is added.
    return [COLUMN_DESCRIPTIONS[header] for header in headers]


def write_csv_headers(writer, headers):
    writer.writerow(headers)
    writer.writerow(csv_column_descriptions(headers))
