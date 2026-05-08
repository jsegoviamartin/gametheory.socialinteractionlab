#!/usr/bin/env python3
"""
Script to check survey data in the database
Run with: docker compose exec backend python /app/check_surveys.py
"""

import os
import sys
import django

# Add the project directory to Python path
sys.path.append('/app')

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'game.settings')
django.setup()

from the_game.models import GameMatch
from ultimatum.models import UltimatumGameRound

def check_prisoners_surveys():
    """Check Prisoner's Dilemma survey data"""
    print("🔍 PRISONER'S DILEMMA SURVEY DATA")
    print("=" * 50)
    
    # Get all matches with survey data (check for non-null values)
    matches_with_surveys = GameMatch.objects.filter(
        player_1_age__isnull=False
    ).exclude(player_1_age=0) | GameMatch.objects.filter(
        player_2_age__isnull=False
    ).exclude(player_2_age=0)
    
    print(f"Total matches with survey data: {matches_with_surveys.count()}")
    print()
    
    # Show recent matches with survey data
    recent_matches = matches_with_surveys.order_by('-created_at')[:5]
    
    for i, match in enumerate(recent_matches, 1):
        print(f"Match {i}: {match.match_id}")
        print(f"  Created: {match.created_at}")
        print(f"  Player 1:")
        print(f"    Age: {match.player_1_age}")
        print(f"    Gender: {match.player_1_gender}")
        print(f"    Nationality: {match.player_1_nationality}")
        print(f"    Education: {match.player_1_education}")
        print(f"    Religion: {match.player_1_religion}")
        print(f"    Meditation: {match.player_1_meditation}")
        print(f"    Game Theory: {match.player_1_game_theory}")
        print(f"  Player 2:")
        print(f"    Age: {match.player_2_age}")
        print(f"    Gender: {match.player_2_gender}")
        print(f"    Nationality: {match.player_2_nationality}")
        print(f"    Education: {match.player_2_education}")
        print(f"    Religion: {match.player_2_religion}")
        print(f"    Meditation: {match.player_2_meditation}")
        print(f"    Game Theory: {match.player_2_game_theory}")
        print()

def check_ultimatum_surveys():
    """Check Ultimatum survey data"""
    print("🔍 ULTIMATUM GAME SURVEY DATA")
    print("=" * 50)
    
    # Get rounds with survey data (check for non-null values)
    rounds_with_surveys = UltimatumGameRound.objects.filter(
        player_1_age__isnull=False
    ).exclude(player_1_age=0) | UltimatumGameRound.objects.filter(
        player_2_age__isnull=False
    ).exclude(player_2_age=0)
    
    # Group by match
    match_ids = rounds_with_surveys.values_list('game_match_uuid', flat=True).distinct()
    print(f"Total matches with survey data: {len(match_ids)}")
    print()
    
    # Show recent matches with survey data
    recent_matches = match_ids[:5]
    
    for i, match_id in enumerate(recent_matches, 1):
        print(f"Match {i}: {match_id}")
        
        # Get first round for this match
        first_round = UltimatumGameRound.objects.filter(
            game_match_uuid=match_id,
            round_number=1
        ).first()
        
        if first_round:
            print(f"  Created: {first_round.created_at}")
            print(f"  Player 1:")
            print(f"    Age: {first_round.player_1_age}")
            print(f"    Gender: {first_round.player_1_gender}")
            print(f"    Nationality: {first_round.player_1_nationality}")
            print(f"    Education: {first_round.player_1_education}")
            print(f"    Religion: {first_round.player_1_religion}")
            print(f"    Meditation: {first_round.player_1_meditation}")
            print(f"    Game Theory: {first_round.player_1_game_theory}")
            print(f"  Player 2:")
            print(f"    Age: {first_round.player_2_age}")
            print(f"    Gender: {first_round.player_2_gender}")
            print(f"    Nationality: {first_round.player_2_nationality}")
            print(f"    Education: {first_round.player_2_education}")
            print(f"    Religion: {first_round.player_2_religion}")
            print(f"    Meditation: {first_round.player_2_meditation}")
            print(f"    Game Theory: {first_round.player_2_game_theory}")
        print()

def check_latest_survey():
    """Check the most recent survey submission"""
    print("🔍 LATEST SURVEY SUBMISSIONS")
    print("=" * 50)
    
    # Check latest prisoner's dilemma
    latest_prisoners = GameMatch.objects.filter(
        player_1_age__isnull=False
    ).exclude(player_1_age=0).order_by('-created_at').first()
    
    if latest_prisoners:
        print("Latest Prisoner's Dilemma Survey:")
        print(f"  Match ID: {latest_prisoners.match_id}")
        print(f"  Submitted: {latest_prisoners.created_at}")
        print(f"  Player 1 Age: {latest_prisoners.player_1_age}")
        print(f"  Player 2 Age: {latest_prisoners.player_2_age}")
        print()
    
    # Check latest ultimatum
    latest_ultimatum = UltimatumGameRound.objects.filter(
        player_1_age__isnull=False
    ).exclude(player_1_age=0).order_by('-created_at').first()
    
    if latest_ultimatum:
        print("Latest Ultimatum Survey:")
        print(f"  Match ID: {latest_ultimatum.game_match_uuid}")
        print(f"  Submitted: {latest_ultimatum.created_at}")
        print(f"  Player 1 Age: {latest_ultimatum.player_1_age}")
        print(f"  Player 2 Age: {latest_ultimatum.player_2_age}")
        print()

if __name__ == "__main__":
    print("🎮 SURVEY DATA CHECKER")
    print("=" * 60)
    print()
    
    check_prisoners_surveys()
    check_ultimatum_surveys()
    check_latest_survey()
    
    print("✅ Survey data check complete!")
