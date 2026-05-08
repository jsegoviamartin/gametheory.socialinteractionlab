#!/usr/bin/env python3
"""
Script to verify and analyze game modes in both datasets
"""

import pandas as pd
from pathlib import Path

def analyze_game_modes():
    script_dir = Path(__file__).parent
    
    print("🔍 Game Mode Analysis")
    print("=" * 50)
    
    # Analyze Prisoner's Dilemma data
    prisoner_file = script_dir / 'data_prisoner_clean.csv'
    if prisoner_file.exists():
        print("\n📊 PRISONER'S DILEMMA DATA")
        print("-" * 30)
        
        df_prisoner = pd.read_csv(prisoner_file)
        
        # Check if game_mode column exists
        if 'game_mode' in df_prisoner.columns:
            print("✅ game_mode field: PRESENT")
            
            # Show unique game modes
            game_modes = df_prisoner['game_mode'].value_counts()
            print("📈 Game modes found:")
            for mode, count in game_modes.items():
                print(f"   • {mode}: {count} rounds")
            
            # Show unique matches
            unique_matches = df_prisoner.groupby(['game_match_uuid', 'game_mode']).size().reset_index()
            print(f"🎮 Total matches: {len(unique_matches)}")
            for _, match in unique_matches.iterrows():
                rounds_count = match[0]
                print(f"   • Match {match['game_match_uuid'][:8]}... ({match['game_mode']}): {rounds_count} rounds")
        else:
            print("❌ game_mode field: MISSING")
            print("Available columns:", list(df_prisoner.columns))
    else:
        print("⚠️  Prisoner's Dilemma data file not found")
    
    # Analyze Ultimatum Game data
    ultimatum_file = script_dir / 'ultimatum_output_data_clean.csv'
    if ultimatum_file.exists():
        print("\n🎲 ULTIMATUM GAME DATA")
        print("-" * 25)
        
        df_ultimatum = pd.read_csv(ultimatum_file)
        
        # Check if game_mode column exists
        if 'game_mode' in df_ultimatum.columns:
            print("✅ game_mode field: PRESENT")
            
            # Show unique game modes
            game_modes = df_ultimatum['game_mode'].value_counts()
            print("📈 Game modes found:")
            for mode, count in game_modes.items():
                print(f"   • {mode}: {count} rounds")
            
            # Show unique matches
            unique_matches = df_ultimatum.groupby(['game_match_uuid', 'game_mode']).size().reset_index()
            print(f"🎮 Total matches: {len(unique_matches)}")
            for _, match in unique_matches.iterrows():
                rounds_count = match[0]
                print(f"   • Match {match['game_match_uuid'][:8]}... ({match['game_mode']}): {rounds_count} rounds")
        else:
            print("❌ game_mode field: MISSING")
            print("Available columns:", list(df_ultimatum.columns))
    else:
        print("⚠️  Ultimatum Game data file not found")
    
    print("\n" + "=" * 50)
    print("🎯 Analysis complete!")

if __name__ == "__main__":
    try:
        analyze_game_modes()
    except ImportError:
        print("❌ pandas is required for this analysis")
        print("Install with: pip install pandas")
    except Exception as e:
        print(f"❌ Error during analysis: {e}")
