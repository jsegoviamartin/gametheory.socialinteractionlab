import json
import traceback
import random
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Q

from .models import PublicGoodsGameData
from .utils import get_client_ip
from game.exports import export_public_goods_all
from custom_rooms.models import CustomExperiment, CustomPublicGoods

@csrf_exempt
def matchmake_custom_public_goods(request):
    """
    Matchmaking for custom experiments.
    Finds open match for this experiment_id or creates one with a random condition.
    """
    if request.method != "POST":
        return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)

    try:
        data = json.loads(request.body.decode("utf-8"))
        exp_id = data.get("experiment_id")
        player_fp = data.get("player_fingerprint")
        requested_cond_id = data.get("condition_id") # Match selection from UI
        ip_address = get_client_ip(request)

        if not exp_id or not player_fp:
            return JsonResponse({"status": "error", "message": "experiment_id and player_fingerprint required"}, status=400)

        # 1. Search for available match in THIS experiment
        match = (
            PublicGoodsGameData.objects
            .filter(
                round_number=1,
                experiment_id=exp_id,
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

        # Already joined?
        if match and player_fp in [match.player_1_fingerprint, match.player_2_fingerprint, match.player_3_fingerprint, match.player_4_fingerprint]:
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

        # 2. Create New Match with a random condition from the experiment
        experiment = CustomExperiment.objects.get(id=exp_id)
        conditions = list(CustomPublicGoods.objects.filter(experiment=experiment))
        
        if not conditions:
            return JsonResponse({"status": "error", "message": "No conditions found for this experiment"}, status=400)
            
        if requested_cond_id:
            try:
                chosen_cond = CustomPublicGoods.objects.get(id=requested_cond_id, experiment=experiment)
            except CustomPublicGoods.DoesNotExist:
                chosen_cond = random.choice(conditions)
        else:
            chosen_cond = random.choice(conditions)

        match = PublicGoodsGameData.objects.create(
            match_id=PublicGoodsGameData.generate_match_id(),
            round_number=1,
            game_mode="online",
            experiment_id=exp_id,
            condition_id=chosen_cond.id,
            room_type=chosen_cond.room_type,
            total_rounds=chosen_cond.rounds,
            endowment=float(chosen_cond.endowment),
            multiplier=float(chosen_cond.multiplier),
            punishment_cost=float(chosen_cond.punishment_cost),
            punishment_value=float(chosen_cond.punishment_value),
            reward_cost=float(chosen_cond.reward_cost),
            reward_value=float(chosen_cond.reward_value),
            player_1_fingerprint=player_fp,
            player_1_ip=ip_address,
        )

        return JsonResponse({
            "status": "created_new_match",
            "match_id": match.match_id,
            "players_count": 1,
            "is_ready": False,
            "room": match.room_type,
        })

    except Exception as e:
        traceback.print_exc()
        return JsonResponse({"status": "error", "message": str(e)}, status=500)


# ======================================================
# CREATE / JOIN MATCH
# ======================================================
@csrf_exempt
def create_match_public_goods(request):
    """
    Create or join a Public Goods Game match using the single table.
    Simplified: uses completed_at as completion flag.
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
            # Search for available match (Round 1, not complete based on timestamp)
            match = (
                PublicGoodsGameData.objects
                .filter(
                    round_number=1,
                    game_mode="online",
                    room_type=room_type,
                    completed_at__isnull=True,
                    experiment_id__isnull=True
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

            # Create new match (Round 1)
            match = PublicGoodsGameData.objects.create(
                match_id=PublicGoodsGameData.generate_match_id(),
                round_number=1,
                game_mode="online",
                room_type=room_type,
                player_1_fingerprint=player_fp,
                player_1_ip=ip_address,
                group_return=None,
                total_contributions=None
            )

            return JsonResponse({
                "status": "created_new_match",
                "match_id": match.match_id,
                "players_count": match.players_count(),
                "is_ready": match.is_ready,
                "room": match.room_type,
            })

        elif game_mode == "bot":
            match = PublicGoodsGameData.objects.create(
                match_id=PublicGoodsGameData.generate_match_id(),
                round_number=1,
                game_mode="bot",
                room_type=room_type,
                player_1_fingerprint=player_fp,
                player_1_ip=ip_address,
                player_2_fingerprint="bot_2",
                player_3_fingerprint="bot_3",
                player_4_fingerprint="bot_4",
                group_return=None,
                total_contributions=None
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
    """Submit survey responses for a completed Public Goods game"""
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

        # Find the match and which player is submitting
        first_round = PublicGoodsGameData.objects.filter(match_id=match_id, round_number=1).first()
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
        
        # Update all rounds for this match
        match_rounds = PublicGoodsGameData.objects.filter(match_id=match_id)
        
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
            
            # Refresh exports
            export_public_goods_all()

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


# ======================================================
# POLL MATCH STATS
# ======================================================
def match_stats_public_goods(request, match_id):
    """
    Returns match state from the consolidated table.
    """
    try:
        # We always poll Round 1 for matchmaking status
        match = PublicGoodsGameData.objects.filter(match_id=match_id, round_number=1).first()
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