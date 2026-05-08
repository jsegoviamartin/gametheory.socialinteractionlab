
import os
import django
import sys
import json

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'game.settings')
django.setup()

from public_goods.models import PublicGoodsMatch
from django.utils import timezone

def inspect_matches():
    print("--- Inspecting Recent Matches ---")
    matches = PublicGoodsMatch.objects.all().order_by('-created_at')[:5]
    
    if not matches:
        print("No matches found.")
        return

    for m in matches:
        print(f"Match [{m.match_id}] Mode: {m.game_mode} | Room: {m.room_type} | Created: {m.created_at}")
        
        p1 = m.player_1_fingerprint or "None"
        p2 = m.player_2_fingerprint or "None"
        p3 = m.player_3_fingerprint or "None"
        p4 = m.player_4_fingerprint or "None"
        
        count = m.players_count()
        is_ready = m.is_ready
        
        print(f"   Players ({count}/4): {p1}, {p2}, {p3}, {p4}")
        print(f"   Is Ready: {is_ready}")
        print("-" * 30)

if __name__ == "__main__":
    inspect_matches()
