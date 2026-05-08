
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'game.settings')
django.setup()

from public_goods.models import PublicGoodsMatch

try:
    match = PublicGoodsMatch.objects.create(
        match_id=PublicGoodsMatch.generate_match_id(),
        game_mode="online",
        room_type="basic",
        player_1_fingerprint="test_fp"
    )
    print(f"Successfully created match: {match.match_id}")
    match.delete()
except Exception as e:
    import traceback
    traceback.print_exc()
