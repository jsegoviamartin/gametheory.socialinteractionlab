from rest_framework import serializers
from .models import CustomExperiment, CustomPrisoner, CustomUltimatum, CustomPublicGoods

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

class CustomExperimentSerializer(serializers.ModelSerializer):
    prisoner_conditions = CustomPrisonerSerializer(many=True, read_only=True)
    ultimatum_conditions = CustomUltimatumSerializer(many=True, read_only=True)
    public_goods_conditions = CustomPublicGoodsSerializer(many=True, read_only=True)

    class Meta:
        model = CustomExperiment
        fields = '__all__'
        read_only_fields = ('creator',)
