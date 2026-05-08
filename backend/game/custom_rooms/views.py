from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.http import HttpResponse
from game.exports import get_user_data_csv, get_combined_user_data_csv
from .models import CustomExperiment, CustomPrisoner, CustomUltimatum, CustomPublicGoods
from .serializers import (
    CustomExperimentSerializer,
    CustomPrisonerSerializer,
    CustomUltimatumSerializer,
    CustomPublicGoodsSerializer
)

class ExperimentViewSet(viewsets.ModelViewSet):
    serializer_class = CustomExperimentSerializer

    def get_permissions(self):
        if self.action in ['lobby', 'retrieve']:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        if self.action in ['lobby', 'retrieve']:
            return CustomExperiment.objects.all().order_by('-created_at')
        return CustomExperiment.objects.filter(creator=self.request.user).order_by('-created_at')

    @action(detail=False, methods=['get'])
    def lobby(self, request):
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
        else:
            return Response({"error": "Unknown game type"}, status=status.HTTP_400_BAD_REQUEST)

        if serializer.is_valid():
            # Data cleaning for Public Goods based on room_type
            if game_type == 'public_goods':
                room_type = request.data.get('room_type', 'basic')
                if room_type == 'basic':
                    serializer.validated_data['reward_cost'] = 0
                    serializer.validated_data['reward_value'] = 0
                    serializer.validated_data['punishment_cost'] = 0
                    serializer.validated_data['punishment_value'] = 0
                elif room_type == 'punishment':
                    serializer.validated_data['reward_cost'] = 0
                    serializer.validated_data['reward_value'] = 0
                elif room_type == 'reward':
                    serializer.validated_data['punishment_cost'] = 0
                    serializer.validated_data['punishment_value'] = 0

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
        else:
            return Response({"error": "Unknown game type"}, status=status.HTTP_400_BAD_REQUEST)

        if deleted:
            return Response(status=status.HTTP_204_NO_CONTENT)
        return Response({"error": "Condition not found"}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=False, methods=['get'])
    def download_data(self, request):
        game_type = request.query_params.get('game_type')
        if game_type not in ['prisoner', 'ultimatum', 'public_goods', 'all']:
            return Response({"error": "Invalid game_type. Use 'prisoner', 'ultimatum', 'public_goods', or 'all'."}, status=status.HTTP_400_BAD_REQUEST)
        
        if game_type == 'all':
            csv_data = get_combined_user_data_csv(request.user)
        else:
            csv_data = get_user_data_csv(request.user, game_type)

        if csv_data is None:
            return Response({"error": "No data found or failed to generate CSV"}, status=status.HTTP_200_OK)
        
        response = HttpResponse(csv_data, content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="my_{game_type}_data.csv"'
        return response
