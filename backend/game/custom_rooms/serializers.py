from rest_framework import serializers
from .models import CustomExperiment, CustomPrisoner, CustomUltimatum, CustomPublicGoods, CustomCommonPool, ConsentForm

class ConsentFormSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConsentForm
        fields = '__all__'
        read_only_fields = ('experiment',)

class CustomPrisonerSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomPrisoner
        fields = '__all__'
        read_only_fields = ('experiment',)

class CustomUltimatumSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUltimatum
        fields = '__all__'
        read_only_fields = ('experiment',)

class CustomPublicGoodsSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomPublicGoods
        fields = '__all__'
        read_only_fields = ('experiment',)

class CustomCommonPoolSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomCommonPool
        fields = '__all__'
        read_only_fields = ('experiment',)

class CustomExperimentSerializer(serializers.ModelSerializer):
    prisoner_conditions = CustomPrisonerSerializer(many=True, read_only=True)
    ultimatum_conditions = CustomUltimatumSerializer(many=True, read_only=True)
    public_goods_conditions = CustomPublicGoodsSerializer(many=True, read_only=True)
    common_pool_conditions = CustomCommonPoolSerializer(many=True, read_only=True)
    consent_form = ConsentFormSerializer(read_only=True)

    class Meta:
        model = CustomExperiment
        fields = '__all__'
        read_only_fields = ('creator',)


class ExperimentSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomExperiment
        fields = ('id', 'name', 'creator_username', 'game_type', 'game_mode', 'created_at', 'secret_code')


class ConsentAcceptanceSerializer(serializers.Serializer):
    player_fingerprint = serializers.CharField(max_length=255)
    accepted = serializers.BooleanField()

    def validate_accepted(self, value):
        if value is not True:
            raise serializers.ValidationError('Please accept the consent form to continue.')
        return value
