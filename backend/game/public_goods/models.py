from django.db import models
from django.utils import timezone
import uuid

# ============================================================
# Public Goods Game - Consolidate Data Table
# ============================================================

class PublicGoodsGameData(models.Model):
    """
    The SINGLE table for Public Goods Game.
    Simplified to store only essential player and round data.
    One row per round.
    """
    # --------------------
    # Identification
    # --------------------
    match_id = models.CharField(max_length=8, db_index=True)
    round_number = models.PositiveIntegerField()
    
    room_type = models.CharField(max_length=20, default="basic") # basic, reward, punishment, mixed
    game_mode = models.CharField(max_length=20, default="online") # online, bot

    # --------------------
    # Custom Experiment Parameters
    # --------------------
    experiment_id = models.UUIDField(null=True, blank=True, db_index=True)
    condition_id = models.IntegerField(null=True, blank=True)
    total_rounds = models.IntegerField(default=25)
    endowment = models.FloatField(default=20.0)
    multiplier = models.FloatField(default=1.6)
    
    punishment_cost = models.FloatField(default=4.0)
    punishment_value = models.FloatField(default=12.0)
    reward_cost = models.FloatField(default=4.0)
    reward_value = models.FloatField(default=12.0)
    
    # --------------------
    # Player Fingerprints
    # --------------------
    player_1_fingerprint = models.CharField(max_length=255, null=True, blank=True)
    player_2_fingerprint = models.CharField(max_length=255, null=True, blank=True)
    player_3_fingerprint = models.CharField(max_length=255, null=True, blank=True)
    player_4_fingerprint = models.CharField(max_length=255, null=True, blank=True)

    # --------------------
    # Player Metadata (IP/Location)
    # --------------------
    # --------------------
    # Player Metadata (IP)
    # --------------------
    player_1_ip = models.GenericIPAddressField(null=True, blank=True)
    player_2_ip = models.GenericIPAddressField(null=True, blank=True)
    player_3_ip = models.GenericIPAddressField(null=True, blank=True)
    player_4_ip = models.GenericIPAddressField(null=True, blank=True)

    # --------------------
    # Round Data (Contributions & Payoffs)
    # --------------------
    # ... (rest of round data fields)
    player_1_contribution = models.FloatField(null=True, blank=True)
    player_2_contribution = models.FloatField(null=True, blank=True)
    player_3_contribution = models.FloatField(null=True, blank=True)
    player_4_contribution = models.FloatField(null=True, blank=True)

    player_1_payoff = models.FloatField(default=0)
    player_2_payoff = models.FloatField(default=0)
    player_3_payoff = models.FloatField(default=0)
    player_4_payoff = models.FloatField(default=0)

    # Intermediate payoffs from Stage 1 (Contribution)
    player_1_stage1_payoff = models.FloatField(null=True, blank=True)
    player_2_stage1_payoff = models.FloatField(null=True, blank=True)
    player_3_stage1_payoff = models.FloatField(null=True, blank=True)
    player_4_stage1_payoff = models.FloatField(null=True, blank=True)

    total_contributions = models.FloatField(null=True, blank=True)
    group_return = models.FloatField(null=True, blank=True)
    
    # Track which players have finished Stage 2 (actions)
    player_1_stage2_done = models.BooleanField(default=False)
    player_2_stage2_done = models.BooleanField(default=False)
    player_3_stage2_done = models.BooleanField(default=False)
    player_4_stage2_done = models.BooleanField(default=False)

    # --------------------
    # Cumulative Stats (Up to this round)
    # --------------------
    player_1_cumulative_contribution = models.FloatField(default=0)
    player_2_cumulative_contribution = models.FloatField(default=0)
    player_3_cumulative_contribution = models.FloatField(default=0)
    player_4_cumulative_contribution = models.FloatField(default=0)

    player_1_cumulative_payoff = models.FloatField(default=0)
    player_2_cumulative_payoff = models.FloatField(default=0)
    player_3_cumulative_payoff = models.FloatField(default=0)
    player_4_cumulative_payoff = models.FloatField(default=0)

    # --------------------
    # Action Tracking (Consolidated)
    # --------------------
    round_actions = models.JSONField(default=list) # List of actions in this round: [{"actor": 1, "target": 2, "type": "reward"}]

    # Cumulative Reward/Punish tracking for Player 1
    player_1_reward_list = models.JSONField(default=list) # [2, 3, 2]
    player_1_punish_list = models.JSONField(default=list) # [3, 4]
    player_1_reward_counts = models.JSONField(default=dict) # {"2": 4, "3": 7}
    player_1_punish_counts = models.JSONField(default=dict) # {"3": 2, "4": 1}

    # Cumulative Reward/Punish tracking for Player 2
    player_2_reward_list = models.JSONField(default=list)
    player_2_punish_list = models.JSONField(default=list)
    player_2_reward_counts = models.JSONField(default=dict)
    player_2_punish_counts = models.JSONField(default=dict)

    # Cumulative Reward/Punish tracking for Player 3
    player_3_reward_list = models.JSONField(default=list)
    player_3_punish_list = models.JSONField(default=list)
    player_3_reward_counts = models.JSONField(default=dict)
    player_3_punish_counts = models.JSONField(default=dict)

    # Cumulative Reward/Punish tracking for Player 4
    player_4_reward_list = models.JSONField(default=list)
    player_4_punish_list = models.JSONField(default=list)
    player_4_reward_counts = models.JSONField(default=dict)
    player_4_punish_counts = models.JSONField(default=dict)

    # --------------------
    # Timestamps
    # --------------------
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    round_started_at = models.DateTimeField(auto_now_add=True)
    round_completed_at = models.DateTimeField(null=True, blank=True)

    # --------------------
    # Survey response fields for Player 1
    # --------------------
    player_1_age = models.IntegerField(null=True, blank=True)
    player_1_gender = models.CharField(max_length=20, blank=True, null=True)
    player_1_nationality = models.CharField(max_length=100, blank=True, null=True)
    player_1_residence = models.CharField(max_length=100, blank=True, null=True)
    player_1_education = models.CharField(max_length=50, blank=True, null=True)
    player_1_religion = models.CharField(max_length=50, blank=True, null=True)
    player_1_meditation = models.CharField(max_length=10, blank=True, null=True)
    player_1_meditation_years = models.IntegerField(null=True, blank=True)
    player_1_punitive_God = models.CharField(max_length=10, blank=True, null=True)
    player_1_game_theory = models.CharField(max_length=10, blank=True, null=True)
    player_1_other = models.TextField(blank=True, null=True)

    # --------------------
    # Survey response fields for Player 2
    # --------------------
    player_2_age = models.IntegerField(null=True, blank=True)
    player_2_gender = models.CharField(max_length=20, blank=True, null=True)
    player_2_nationality = models.CharField(max_length=100, blank=True, null=True)
    player_2_residence = models.CharField(max_length=100, blank=True, null=True)
    player_2_education = models.CharField(max_length=50, blank=True, null=True)
    player_2_religion = models.CharField(max_length=50, blank=True, null=True)
    player_2_meditation = models.CharField(max_length=10, blank=True, null=True)
    player_2_meditation_years = models.IntegerField(null=True, blank=True)
    player_2_punitive_God = models.CharField(max_length=10, blank=True, null=True)
    player_2_game_theory = models.CharField(max_length=10, blank=True, null=True)
    player_2_other = models.TextField(blank=True, null=True)

    # --------------------
    # Survey response fields for Player 3
    # --------------------
    player_3_age = models.IntegerField(null=True, blank=True)
    player_3_gender = models.CharField(max_length=20, blank=True, null=True)
    player_3_nationality = models.CharField(max_length=100, blank=True, null=True)
    player_3_residence = models.CharField(max_length=100, blank=True, null=True)
    player_3_education = models.CharField(max_length=50, blank=True, null=True)
    player_3_religion = models.CharField(max_length=50, blank=True, null=True)
    player_3_meditation = models.CharField(max_length=10, blank=True, null=True)
    player_3_meditation_years = models.IntegerField(null=True, blank=True)
    player_3_punitive_God = models.CharField(max_length=10, blank=True, null=True)
    player_3_game_theory = models.CharField(max_length=10, blank=True, null=True)
    player_3_other = models.TextField(blank=True, null=True)

    # --------------------
    # Survey response fields for Player 4
    # --------------------
    player_4_age = models.IntegerField(null=True, blank=True)
    player_4_gender = models.CharField(max_length=20, blank=True, null=True)
    player_4_nationality = models.CharField(max_length=100, blank=True, null=True)
    player_4_residence = models.CharField(max_length=100, blank=True, null=True)
    player_4_education = models.CharField(max_length=50, blank=True, null=True)
    player_4_religion = models.CharField(max_length=50, blank=True, null=True)
    player_4_meditation = models.CharField(max_length=10, blank=True, null=True)
    player_4_meditation_years = models.IntegerField(null=True, blank=True)
    player_4_punitive_God = models.CharField(max_length=10, blank=True, null=True)
    player_4_game_theory = models.CharField(max_length=10, blank=True, null=True)
    player_4_other = models.TextField(blank=True, null=True)

    class Meta:
        verbose_name = "Public Goods Game Data"
        verbose_name_plural = "Public Goods Game Data Logs"
        ordering = ["match_id", "round_number"]
        unique_together = ("match_id", "round_number")

    def __str__(self):
        return f"Match {self.match_id} | Round {self.round_number}"

    @staticmethod
    def generate_match_id():
        return str(uuid.uuid4())[:8]

    def players_count(self):
        return len([
            p for p in [
                self.player_1_fingerprint,
                self.player_2_fingerprint,
                self.player_3_fingerprint,
                self.player_4_fingerprint,
            ] if p
        ])

    @property
    def is_ready(self):
        return self.players_count() == 4
