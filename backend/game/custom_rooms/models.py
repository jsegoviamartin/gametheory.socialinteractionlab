import uuid
from django.db import models
from django.contrib.auth.models import User

class CustomExperiment(models.Model):
    GAME_TYPES = [
        ('prisoner', '2x2 Game'),
        ('ultimatum', 'Ultimatum'),
        ('public_goods', 'Public Goods'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    creator_username = models.CharField(max_length=150, blank=True, null=True)
    creator = models.ForeignKey(User, on_delete=models.CASCADE, related_name='custom_experiments')
    name = models.CharField(max_length=255)
    secret_code = models.CharField(max_length=6, blank=True, null=True)
    game_type = models.CharField(max_length=50, choices=GAME_TYPES)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.game_type})"

class CustomPrisoner(models.Model):
    creator_username = models.CharField(max_length=150, blank=True, null=True)
    experiment_name = models.CharField(max_length=255, blank=True, null=True)
    secret_code = models.CharField(max_length=6, blank=True, null=True)
    experiment = models.ForeignKey(CustomExperiment, on_delete=models.CASCADE, related_name='prisoner_conditions')
    condition_name = models.CharField(max_length=255)
    room_name = models.CharField(max_length=255, default="Prisoner's Dilemma")
    label_a = models.CharField(max_length=100, default="Cooperate")
    label_b = models.CharField(max_length=100, default="Defect")
    
    # Payoff Matrix (Player 1 / Player 2)
    p1_cc = models.IntegerField(default=20)
    p2_cc = models.IntegerField(default=20)
    p1_cd = models.IntegerField(default=0)
    p2_cd = models.IntegerField(default=30)
    p1_dc = models.IntegerField(default=30)
    p2_dc = models.IntegerField(default=0)
    p1_dd = models.IntegerField(default=10)
    p2_dd = models.IntegerField(default=10)
    
    rounds = models.IntegerField(default=25)
    created_at = models.DateTimeField(auto_now_add=True)

class CustomUltimatum(models.Model):
    creator_username = models.CharField(max_length=150, blank=True, null=True)
    experiment_name = models.CharField(max_length=255, blank=True, null=True)
    secret_code = models.CharField(max_length=6, blank=True, null=True)
    experiment = models.ForeignKey(CustomExperiment, on_delete=models.CASCADE, related_name='ultimatum_conditions')
    condition_name = models.CharField(max_length=255)
    
    endowment = models.IntegerField(default=100)
    rounds = models.IntegerField(default=10)
    created_at = models.DateTimeField(auto_now_add=True)

class CustomPublicGoods(models.Model):
    creator_username = models.CharField(max_length=150, blank=True, null=True)
    experiment_name = models.CharField(max_length=255, blank=True, null=True)
    secret_code = models.CharField(max_length=6, blank=True, null=True)
    experiment = models.ForeignKey(CustomExperiment, on_delete=models.CASCADE, related_name='public_goods_conditions')
    condition_name = models.CharField(max_length=255)
    
    # Room parameters
    room_type = models.CharField(max_length=50, default="basic") # basic, punishment, reward, mixed
    endowment = models.IntegerField(default=20)
    multiplier = models.FloatField(default=1.6)
    rounds = models.IntegerField(default=10)
    
    # Punishment/Reward ratios
    reward_cost = models.IntegerField(default=4)
    reward_value = models.IntegerField(default=12)
    punishment_cost = models.IntegerField(default=4)
    punishment_value = models.IntegerField(default=12)
    
    created_at = models.DateTimeField(auto_now_add=True)
