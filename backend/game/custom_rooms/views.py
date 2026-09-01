from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.http import HttpResponse
from game.exports import get_user_data_csv, get_combined_user_data_csv
from .models import CustomExperiment, CustomPrisoner, CustomUltimatum, CustomPublicGoods, CustomCommonPool
from .serializers import (
    CustomExperimentSerializer,
    CustomPrisonerSerializer,
    CustomUltimatumSerializer,
    CustomPublicGoodsSerializer,
    CustomCommonPoolSerializer
)


def run_old_data_cleanup():
    try:
        from game.exports import cleanup_old_data
        cleanup_old_data()
    except Exception as e:
        import logging
        logging.getLogger("django").error(f"Auto-cleanup error: {e}")


class ExperimentViewSet(viewsets.ModelViewSet):
    serializer_class = CustomExperimentSerializer

    def get_permissions(self):
        if self.action in ['lobby', 'retrieve', 'consent']:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        run_old_data_cleanup()

        if self.action in ['lobby', 'retrieve']:
            return CustomExperiment.objects.all().order_by('-created_at')
        return CustomExperiment.objects.filter(creator=self.request.user).order_by('-created_at')

    @action(detail=False, methods=['get'])
    def lobby(self, request):
        run_old_data_cleanup()
        experiments = CustomExperiment.objects.all().order_by('-created_at')
        serializer = self.get_serializer(experiments, many=True)
        return Response(serializer.data)

    def perform_create(self, serializer):
        name = serializer.validated_data.get('name')
        if CustomExperiment.objects.filter(creator=self.request.user, name=name).exists():
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"name": "You already have an experiment with this name."})
        
        # Generate random 6-digit secret code
        import random
        secret_code = str(random.randint(100000, 999999))
        
        serializer.save(
            creator=self.request.user, 
            creator_username=self.request.user.username,
            secret_code=secret_code
        )

    @action(detail=True, methods=['post'])
    def add_condition(self, request, pk=None):
        experiment = self.get_object()
        game_type = experiment.game_type
        
        # Depending on game type, use different serializers/models
        if game_type == 'prisoner':
            serializer = CustomPrisonerSerializer(data=request.data)
        elif game_type == 'ultimatum':
            serializer = CustomUltimatumSerializer(data=request.data)
        elif game_type == 'public_goods':
            serializer = CustomPublicGoodsSerializer(data=request.data)
        elif game_type == 'common_pool':
            serializer = CustomCommonPoolSerializer(data=request.data)
        else:
            return Response({"error": "Unknown game type"}, status=status.HTTP_400_BAD_REQUEST)

        if serializer.is_valid():
            # Data cleaning for Public Goods based on room_type
            if game_type == 'public_goods' or game_type == 'common_pool':
                room_type = request.data.get('room_type', 'basic')
                if room_type == 'basic':
                    serializer.validated_data['reward_cost'] = 0.0
                    serializer.validated_data['reward_value'] = 0.0
                    serializer.validated_data['punishment_cost'] = 0.0
                    serializer.validated_data['punishment_value'] = 0.0
                elif room_type == 'punishment':
                    serializer.validated_data['reward_cost'] = 0.0
                    serializer.validated_data['reward_value'] = 0.0
                elif room_type == 'reward':
                    serializer.validated_data['punishment_cost'] = 0.0
                    serializer.validated_data['punishment_value'] = 0.0

            serializer.save(
                experiment=experiment, 
                experiment_name=experiment.name,
                creator_username=self.request.user.username,
                secret_code=experiment.secret_code
            )
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['delete'])
    def delete_condition(self, request, pk=None):
        experiment = self.get_object()
        condition_id = request.query_params.get('condition_id')
        if not condition_id:
            return Response({"error": "Missing condition_id"}, status=status.HTTP_400_BAD_REQUEST)

        # Attempt to delete based on experiment type
        if experiment.game_type == 'prisoner':
            deleted, _ = CustomPrisoner.objects.filter(experiment=experiment, id=condition_id).delete()
        elif experiment.game_type == 'ultimatum':
            deleted, _ = CustomUltimatum.objects.filter(experiment=experiment, id=condition_id).delete()
        elif experiment.game_type == 'public_goods':
            deleted, _ = CustomPublicGoods.objects.filter(experiment=experiment, id=condition_id).delete()
        elif experiment.game_type == 'common_pool':
            deleted, _ = CustomCommonPool.objects.filter(experiment=experiment, id=condition_id).delete()
        else:
            return Response({"error": "Unknown game type"}, status=status.HTTP_400_BAD_REQUEST)

        if deleted:
            return Response(status=status.HTTP_204_NO_CONTENT)
        return Response({"error": "Condition not found"}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=False, methods=['get'])
    def download_data(self, request):
        experiment_id = request.query_params.get('experiment_id')
        game_type = request.query_params.get('game_type')
        
        if experiment_id:
            try:
                experiment = CustomExperiment.objects.get(id=experiment_id, creator=request.user)
                game_type = experiment.game_type
            except Exception:
                return Response({"error": "Experiment not found or invalid ID"}, status=status.HTTP_404_NOT_FOUND)
        
        if game_type not in ['prisoner', 'ultimatum', 'public_goods', 'common_pool', 'all']:
            return Response({"error": "Invalid game_type. Use 'prisoner', 'ultimatum', 'public_goods', 'common_pool', or 'all'."}, status=status.HTTP_400_BAD_REQUEST)
        
        if game_type == 'all':
            csv_data = get_combined_user_data_csv(request.user)
        else:
            csv_data = get_user_data_csv(request.user, game_type, experiment_id=experiment_id)

        if csv_data is None:
            return Response({"error": "No data found or failed to generate CSV"}, status=status.HTTP_200_OK)
        
        response = HttpResponse(csv_data, content_type='text/csv')
        if experiment_id:
            filename = f"experiment_{experiment.name.replace(' ', '_')}_data.csv"
        else:
            filename = f"my_{game_type}_data.csv"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response

    @action(detail=True, methods=['get'])
    def consent(self, request, pk=None):
        experiment = self.get_object()
        if hasattr(experiment, 'consent_form'):
            from .serializers import ConsentFormSerializer
            serializer = ConsentFormSerializer(experiment.consent_form)
            return Response(serializer.data)
        return Response({"error": "Consent form not found"}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['post', 'patch'])
    def save_consent(self, request, pk=None):
        experiment = self.get_object()
        from .serializers import ConsentFormSerializer
        if hasattr(experiment, 'consent_form'):
            serializer = ConsentFormSerializer(experiment.consent_form, data=request.data, partial=True)
        else:
            serializer = ConsentFormSerializer(data=request.data)
        
        if serializer.is_valid():
            serializer.save(experiment=experiment)
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
