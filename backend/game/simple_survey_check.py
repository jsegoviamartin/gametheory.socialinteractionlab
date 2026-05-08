#!/usr/bin/env python3
"""
Simple script to check survey data in the database
Run with: docker compose exec backend python /app/simple_survey_check.py
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

def check_all_surveys():
    """Check all survey data in both games"""
    print("🎮 SURVEY DATA CHECKER")
    print("=" * 60)
    print()
    
    # Check Prisoner's Dilemma surveys
    print("🔍 PRISONER'S DILEMMA SURVEY DATA")
    print("=" * 50)
    
    prisoners_matches = GameMatch.objects.all()
    prisoners_with_surveys = 0
    
    for match in prisoners_matches:
        has_survey = False
        if match.player_1_age and match.player_1_age > 0:
            has_survey = True
        if match.player_2_age and match.player_2_age > 0:
            has_survey = True
            
        if has_survey:
            prisoners_with_surveys += 1
            print(f"Match: {match.match_id}")
            print(f"  Player 1: Age={match.player_1_age}, Gender={match.player_1_gender}, Nationality={match.player_1_nationality}")
            print(f"  Player 2: Age={match.player_2_age}, Gender={match.player_2_gender}, Nationality={match.player_2_nationality}")
            print()
    
    print(f"Total Prisoner's Dilemma matches with surveys: {prisoners_with_surveys}")
    print()
    
    # Check Ultimatum surveys
    print("🔍 ULTIMATUM GAME SURVEY DATA")
    print("=" * 50)
    
    ultimatum_rounds = UltimatumGameRound.objects.all()
    ultimatum_with_surveys = 0
    seen_matches = set()
    
    for round_obj in ultimatum_rounds:
        has_survey = False
        if round_obj.player_1_age and round_obj.player_1_age > 0:
            has_survey = True
        if round_obj.player_2_age and round_obj.player_2_age > 0:
            has_survey = True
            
        if has_survey and round_obj.game_match_uuid not in seen_matches:
            seen_matches.add(round_obj.game_match_uuid)
            ultimatum_with_surveys += 1
            print(f"Match: {round_obj.game_match_uuid}")
            print(f"  Player 1: Age={round_obj.player_1_age}, Gender={round_obj.player_1_gender}, Nationality={round_obj.player_1_nationality}")
            print(f"  Player 2: Age={round_obj.player_2_age}, Gender={round_obj.player_2_gender}, Nationality={round_obj.player_2_nationality}")
            print()
    
    print(f"Total Ultimatum matches with surveys: {ultimatum_with_surveys}")
    print()
    
    # Summary
    print("📊 SUMMARY")
    print("=" * 50)
    print(f"Prisoner's Dilemma surveys: {prisoners_with_surveys}")
    print(f"Ultimatum surveys: {ultimatum_with_surveys}")
    print(f"Total surveys: {prisoners_with_surveys + ultimatum_with_surveys}")
    print()
    
    if prisoners_with_surveys > 0 or ultimatum_with_surveys > 0:
        print("✅ Survey data is being saved successfully!")
    else:
        print("⚠️  No survey data found. Try submitting a survey first.")

if __name__ == "__main__":
    check_all_surveys()
