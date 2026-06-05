import json
import traceback
import random
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Q

from .models import CommonPoolGameData
from public_goods.utils import get_client_ip

@csrf_exempt
def create_match_common_pool(request):
    """
    Create or join a Common Pool Resource game match.
    """
    if request.method != "POST":
        return JsonResponse(
            {"status": "error", "message": "Invalid request method"},
            status=405
        )

    try:
        data = json.loads(request.body.decode("utf-8"))
    except Exception:
        return JsonResponse(
            {"status": "error", "message": "Invalid JSON"},
            status=400
        )

    game_mode = data.get("game_mode", "online")
    room_type = data.get("room", "basic")
    player_fp = data.get("player_fingerprint")
    ip_address = get_client_ip(request)

    if not player_fp:
        return JsonResponse(
            {"status": "error", "message": "Player fingerprint is required"},
            status=400
        )

    try:
        if game_mode == "online":
            # Search for available match
            match = (
                CommonPoolGameData.objects
                .filter(
                    round_number=1,
                    game_mode="online",
                    room_type=room_type,
                    completed_at__isnull=True
                )
                .filter(
                    Q(player_1_fingerprint__isnull=True) |
                    Q(player_2_fingerprint__isnull=True) |
                    Q(player_3_fingerprint__isnull=True) |
                    Q(player_4_fingerprint__isnull=True)
                )
                .order_by("created_at")
                .first()
            )

            # Check if player is already in a match
            if match and player_fp in [
                match.player_1_fingerprint,
                match.player_2_fingerprint,
                match.player_3_fingerprint,
                match.player_4_fingerprint,
            ]:
                return JsonResponse({
                    "status": "already_joined",
                    "match_id": match.match_id,
                    "players_count": match.players_count(),
                    "is_ready": match.is_ready,
                    "room": match.room_type,
                })

            # Join existing
            if match:
                for i in range(1, 5):
                    if getattr(match, f"player_{i}_fingerprint") is None:
                        setattr(match, f"player_{i}_fingerprint", player_fp)
                        setattr(match, f"player_{i}_ip", ip_address)
                        break
                match.save()

                return JsonResponse({
                    "status": "joined_existing_match",
                    "match_id": match.match_id,
                    "players_count": match.players_count(),
                    "is_ready": match.is_ready,
                    "room": match.room_type,
                })

            # Create new match
            match = CommonPoolGameData.objects.create(
                match_id=CommonPoolGameData.generate_match_id(),
                round_number=1,
                game_mode="online",
                room_type=room_type,
                player_1_fingerprint=player_fp,
                player_1_ip=ip_address,
                fish_stock=100
            )

            return JsonResponse({
                "status": "created_new_match",
                "match_id": match.match_id,
                "players_count": match.players_count(),
                "is_ready": match.is_ready,
                "room": match.room_type,
            })

        elif game_mode == "bot":
            match = CommonPoolGameData.objects.create(
                match_id=CommonPoolGameData.generate_match_id(),
                round_number=1,
                game_mode="bot",
                room_type=room_type,
                player_1_fingerprint=player_fp,
                player_1_ip=ip_address,
                player_2_fingerprint="bot_2",
                player_3_fingerprint="bot_3",
                player_4_fingerprint="bot_4",
                fish_stock=100
            )

            return JsonResponse({
                "status": "created_bot_match",
                "match_id": match.match_id,
                "players_count": 4,
                "is_ready": match.is_ready,
                "room": match.room_type,
            })

    except Exception as e:
        traceback.print_exc()
        return JsonResponse({"status": "error", "message": str(e)}, status=500)

@csrf_exempt
def submit_survey(request):
    """
    Submit survey responses for Common Pool Resource game.
    """
    try:
        if request.method != 'POST':
            return JsonResponse({'status': 'error', 'message': 'Invalid request method'}, status=405)

        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({'status': 'error', 'message': 'Invalid JSON'}, status=400)

        match_id = data.get('match_id')
        player_fingerprint = data.get('player_fingerprint')
        survey_data = data.get('survey_data', {})

        if not match_id or not player_fingerprint:
            return JsonResponse({'status': 'error', 'message': 'Match ID and player fingerprint are required'}, status=400)

        first_round = CommonPoolGameData.objects.filter(match_id=match_id, round_number=1).first()
        if not first_round:
            return JsonResponse({'status': 'error', 'message': 'Match not found'}, status=404)

        player_index = None
        if first_round.player_1_fingerprint == player_fingerprint: player_index = 1
        elif first_round.player_2_fingerprint == player_fingerprint: player_index = 2
        elif first_round.player_3_fingerprint == player_fingerprint: player_index = 3
        elif first_round.player_4_fingerprint == player_fingerprint: player_index = 4

        if not player_index:
            return JsonResponse({'status': 'error', 'message': 'Player not found in this match'}, status=403)

        player_prefix = f'player_{player_index}'
        match_rounds = CommonPoolGameData.objects.filter(match_id=match_id)
        
        try:
            for round_obj in match_rounds:
                if 'age' in survey_data and survey_data['age']:
                    setattr(round_obj, f'{player_prefix}_age', int(survey_data['age']))
                if 'gender' in survey_data and survey_data['gender']:
                    setattr(round_obj, f'{player_prefix}_gender', survey_data['gender'])
                if 'nationality' in survey_data and survey_data['nationality']:
                    setattr(round_obj, f'{player_prefix}_nationality', survey_data['nationality'])
                if 'residence' in survey_data and survey_data['residence']:
                    setattr(round_obj, f'{player_prefix}_residence', survey_data['residence'])
                if 'education' in survey_data and survey_data['education']:
                    setattr(round_obj, f'{player_prefix}_education', survey_data['education'])
                if 'religion' in survey_data and survey_data['religion']:
                    setattr(round_obj, f'{player_prefix}_religion', survey_data['religion'])
                if 'meditation' in survey_data and survey_data['meditation']:
                    setattr(round_obj, f'{player_prefix}_meditation', survey_data['meditation'])
                if 'meditation_years' in survey_data and survey_data['meditation_years']:
                    setattr(round_obj, f'{player_prefix}_meditation_years', int(survey_data['meditation_years']))
                if 'punitive_God' in survey_data and survey_data['punitive_God']:
                    setattr(round_obj, f'{player_prefix}_punitive_God', survey_data['punitive_God'])
                if 'game_theory' in survey_data and survey_data['game_theory']:
                    setattr(round_obj, f'{player_prefix}_game_theory', survey_data['game_theory'])
                if 'other' in survey_data:
                    setattr(round_obj, f'{player_prefix}_other', survey_data['other'])
                
                round_obj.save()

        except (ValueError, TypeError) as e:
            return JsonResponse({'status': 'error', 'message': f'Invalid data format: {str(e)}'}, status=400)

        return JsonResponse({
            'status': 'success',
            'message': 'Survey submitted successfully',
            'player': player_prefix
        })
    except Exception as e:
        traceback.print_exc()
        return JsonResponse({'status': 'error', 'message': f'Internal server error: {str(e)}'}, status=500)

def match_stats_common_pool(request, match_id):
    """
    Returns match state.
    """
    try:
        match = CommonPoolGameData.objects.filter(match_id=match_id, round_number=1).first()
        if not match:
            return JsonResponse({"status": "error", "message": "Match not found"}, status=404)

        return JsonResponse({
            "status": "success",
            "match_id": match.match_id,
            "game_mode": match.game_mode,
            "room": match.room_type,
            "players_count": match.players_count(),
            "is_ready": match.is_ready,
            "players": {
                "player_1": match.player_1_fingerprint,
                "player_2": match.player_2_fingerprint,
                "player_3": match.player_3_fingerprint,
                "player_4": match.player_4_fingerprint,
            },
        })

    except Exception as e:
        traceback.print_exc()
        return JsonResponse({"status": "error", "message": str(e)}, status=500)
