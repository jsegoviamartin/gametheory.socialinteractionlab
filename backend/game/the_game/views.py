from game.exports import export_prisoner_all

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json
import uuid
from .models import GameMatch
from custom_rooms.models import CustomExperiment, CustomPrisoner
import random

ROOM_PAYOFFS = {
    "prisoners-dilemma": {
        "p1_cc": 20, "p2_cc": 20, "p1_cd": 0, "p2_cd": 30,
        "p1_dc": 30, "p2_dc": 0, "p1_dd": 10, "p2_dd": 10
    },
    "bach-stravinsky-1": {
        "p1_cc": 30, "p2_cc": 20, "p1_cd": 0, "p2_cd": 0,
        "p1_dc": 0, "p2_dc": 0, "p1_dd": 20, "p2_dd": 30
    },
    "bach-stravinsky-2": {
        "p1_cc": 30, "p2_cc": 20, "p1_cd": 10, "p2_cd": 10,
        "p1_dc": 0, "p2_dc": 0, "p1_dd": 20, "p2_dd": 30
    },
    "stag-hunt": {
        "p1_cc": 10, "p2_cc": 10, "p1_cd": 1, "p2_cd": 8,
        "p1_dc": 8, "p2_dc": 1, "p1_dd": 5, "p2_dd": 5
    }
}

@csrf_exempt
def matchmake_custom_the_game(request):
    """
    Matchmaking for custom 2x2 experiments.
    Finds open match for this experiment_id or creates one with a random condition.
    """
    if request.method != "POST":
        return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)

    try:
        data = json.loads(request.body.decode("utf-8"))
        exp_id = data.get("experiment_id")
        player_fp = data.get("player_fingerprint")
        ip_address = request.META.get('REMOTE_ADDR', '127.0.0.1')

        if not exp_id or not player_fp:
            return JsonResponse({"status": "error", "message": "experiment_id and player_fingerprint required"}, status=400)

        # 1. Search for available match in THIS experiment
        match = (
            GameMatch.objects
            .filter(
                game_mode='online',
                experiment_id=exp_id,
                is_complete=False,
                player_2_fingerprint__isnull=True
            )
            .order_by("created_at")
            .first()
        )

        # Already joined?
        if match and player_fp == match.player_1_fingerprint:
            return JsonResponse({
                "status": "already_joined",
                "match_id": match.match_id,
                "game_mode": match.game_mode,
            })

        # Join existing
        if match:
            match.player_2_fingerprint = player_fp
            match.player_2_ip = ip_address
            match.player_2_country = 'Unknown'
            match.player_2_city = 'Unknown'
            match.save()
            return JsonResponse({
                "status": "joined_existing_match",
                "match_id": match.match_id,
                "game_mode": match.game_mode,
            })

        # 2. Create New Match with a random condition from the experiment
        experiment = CustomExperiment.objects.get(id=exp_id)
        conditions = list(CustomPrisoner.objects.filter(experiment=experiment))
        
        if not conditions:
            return JsonResponse({"status": "error", "message": "No conditions found for this experiment"}, status=400)
            
        requested_cond_id = data.get("condition_id")
        if requested_cond_id:
            try:
                chosen_cond = CustomPrisoner.objects.get(id=requested_cond_id, experiment=experiment)
            except CustomPrisoner.DoesNotExist:
                chosen_cond = random.choice(conditions)
        else:
            chosen_cond = random.choice(conditions)

        match = GameMatch.objects.create(
            match_id=str(uuid.uuid4())[:8],
            game_mode='online',
            game_type='custom',
            experiment_id=exp_id,
            condition_id=chosen_cond.id,
            total_rounds=chosen_cond.rounds,
            p1_cc=chosen_cond.p1_cc, p2_cc=chosen_cond.p2_cc,
            p1_cd=chosen_cond.p1_cd, p2_cd=chosen_cond.p2_cd,
            p1_dc=chosen_cond.p1_dc, p2_dc=chosen_cond.p2_dc,
            p1_dd=chosen_cond.p1_dd, p2_dd=chosen_cond.p2_dd,
            label_a=chosen_cond.label_a,
            label_b=chosen_cond.label_b,
            room_name=chosen_cond.room_name,
            player_1_fingerprint=player_fp,
            player_1_ip=ip_address,
            player_1_country='Unknown',
            player_1_city='Unknown',
        )

        return JsonResponse({
            "status": "created_new_match",
            "match_id": match.match_id,
            "game_mode": match.game_mode,
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({"status": "error", "message": str(e)}, status=500)


@csrf_exempt
def create_match(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        game_mode = data.get('game_mode', 'online')
        game_type = data.get('game_type', 'prisoners-dilemma')
        # IMPORTANT: player_fingerprint should be sent from the frontend
        player_fingerprint = data.get('player_fingerprint')

        if not player_fingerprint:
            return JsonResponse({'status': 'error', 'message': 'Player fingerprint is required'}, status=400)

        ip_address = request.META.get('REMOTE_ADDR', '127.0.0.1')

        game_match = None

        if game_mode == 'online':
            try:
                # Search for available match with NO experiment_id (standard game)
                game_match = GameMatch.objects.get(
                    game_mode='online',
                    game_type=game_type,
                    player_2_fingerprint__isnull=True,
                    is_complete=False,
                    experiment_id__isnull=True
                )
                
                if game_match.player_1_fingerprint == player_fingerprint:
                    # Player is already P1, return already_joined
                    return JsonResponse({
                        'status': 'already_joined',
                        'match_id': game_match.match_id,
                        'game_mode': game_match.game_mode,
                        'player_1_fingerprint': game_match.player_1_fingerprint,
                        'player_2_fingerprint': game_match.player_2_fingerprint,
                    })

                game_match.player_2_fingerprint = player_fingerprint
                game_match.player_2_ip = ip_address
                game_match.player_2_country = 'Unknown'
                game_match.player_2_city = 'Unknown'
                game_match.save()
                status_message = 'joined_existing_match'
                print(f"Player {player_fingerprint} joined existing match {game_match.match_id}")

            except GameMatch.DoesNotExist:
                match_id = str(uuid.uuid4())[:8]
                payoffs = ROOM_PAYOFFS.get(game_type, ROOM_PAYOFFS["prisoners-dilemma"])
                
                game_match = GameMatch.objects.create(
                    match_id=match_id,
                    game_mode=game_mode,
                    game_type=game_type,
                    player_1_fingerprint=player_fingerprint,
                    player_1_ip=ip_address,
                    player_1_country='Unknown',
                    player_1_city='Unknown',
                    **payoffs
                )
                status_message = 'created_new_match'
                print(f"Player {player_fingerprint} created new match {game_match.match_id}")


        elif (game_match and
                  (game_match.player_1_fingerprint == player_fingerprint or
                   game_match.player_2_fingerprint == player_fingerprint)):
                status_message = 'rejoined_match'
                print(f"Player {player_fingerprint} rejoined match {game_match.match_id}")

        elif game_mode == 'bot':
            match_id = str(uuid.uuid4())[:8]
            game_match = GameMatch.objects.create(
                match_id=match_id,
                game_mode=game_mode,
                game_type=game_type,
                player_1_fingerprint=player_fingerprint,
                player_1_ip=ip_address,
                player_1_country='Unknown',
                player_1_city='Unknown',
                player_2_fingerprint='bot'
            )
            status_message = 'created_bot_match'
            print(f"Player {player_fingerprint} created bot match {game_match.match_id}")


        return JsonResponse({
            'status': status_message,
            'match_id': game_match.match_id,
            'game_mode': game_match.game_mode,
            'player_1_fingerprint': game_match.player_1_fingerprint,
            'player_2_fingerprint': game_match.player_2_fingerprint,
        })

    return JsonResponse({'status': 'error', 'message': 'Invalid request method'}, status=400)


@csrf_exempt
def submit_survey(request):
    """Submit survey responses for a completed Prisoner's Dilemma game"""
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

        try:
            game_match = GameMatch.objects.get(match_id=match_id)
        except GameMatch.DoesNotExist:
            return JsonResponse({'status': 'error', 'message': 'Match not found'}, status=404)

        # Determine which player is submitting the survey
        is_player_1 = game_match.player_1_fingerprint == player_fingerprint
        is_player_2 = game_match.player_2_fingerprint == player_fingerprint

        if not (is_player_1 or is_player_2):
            return JsonResponse({'status': 'error', 'message': 'Player not found in this match'}, status=403)

        # Validate and update survey data
        player_prefix = 'player_1' if is_player_1 else 'player_2'

        # Update survey fields with proper type conversion
        try:
            if 'age' in survey_data and survey_data['age']:
                game_match.__setattr__(f'{player_prefix}_age', int(survey_data['age']))
            if 'gender' in survey_data and survey_data['gender']:
                game_match.__setattr__(f'{player_prefix}_gender', survey_data['gender'])
            if 'nationality' in survey_data and survey_data['nationality']:
                game_match.__setattr__(f'{player_prefix}_nationality', survey_data['nationality'])
            if 'residence' in survey_data and survey_data['residence']:
                game_match.__setattr__(f'{player_prefix}_residence', survey_data['residence'])
            if 'education' in survey_data and survey_data['education']:
                game_match.__setattr__(f'{player_prefix}_education', survey_data['education'])
            if 'religion' in survey_data and survey_data['religion']:
                game_match.__setattr__(f'{player_prefix}_religion', survey_data['religion'])
            if 'meditation' in survey_data and survey_data['meditation']:
                game_match.__setattr__(f'{player_prefix}_meditation', survey_data['meditation'])
            if 'meditation_years' in survey_data and survey_data['meditation_years']:
                game_match.__setattr__(f'{player_prefix}_meditation_years', int(survey_data['meditation_years']))
            if 'punitive_God' in survey_data and survey_data['punitive_God']:
                game_match.__setattr__(f'{player_prefix}_punitive_God', survey_data['punitive_God'])
            if 'game_theory' in survey_data and survey_data['game_theory']:
                game_match.__setattr__(f'{player_prefix}_game_theory', survey_data['game_theory'])
            if 'other' in survey_data:
                game_match.__setattr__(f'{player_prefix}_other', survey_data['other'])
        except (ValueError, TypeError) as e:
            return JsonResponse({'status': 'error', 'message': f'Invalid data format: {str(e)}'}, status=400)

        game_match.save()
        # write/refresh exports so survey answers appear in files immediately
        export_prisoner_all()


        print(f"[submit_survey] Survey data saved for match {match_id}, player: {'player_1' if is_player_1 else 'player_2'}")
        print(f"[submit_survey] Survey data: {survey_data}")

        return JsonResponse({
            'status': 'success',
            'message': 'Survey submitted successfully',
            'player': 'player_1' if is_player_1 else 'player_2'
        })
    except Exception as e:
        print(f"Error in submit_survey: {str(e)}")
        return JsonResponse({'status': 'error', 'message': f'Internal server error: {str(e)}'}, status=500)
