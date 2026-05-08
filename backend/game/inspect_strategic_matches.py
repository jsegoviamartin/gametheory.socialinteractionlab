
import os
import django
import sys

# Setup Django environment
sys.path.append('/home/zakaria/game_theory/game_project/backend/game')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'game.settings')
django.setup()

from the_game.models import GameMatch

print("=== Strategic Games (2x2) Matches ===")
matches = GameMatch.objects.all().order_by('-created_at')[:10]
for m in matches:
    print(f"ID: {m.match_id} | Exp: {m.experiment_id} | P1: {m.player_1_fingerprint[:8] if m.player_1_fingerprint else 'None'} | P2: {m.player_2_fingerprint[:8] if m.player_2_fingerprint else 'None'} | Complete: {m.is_complete}")
