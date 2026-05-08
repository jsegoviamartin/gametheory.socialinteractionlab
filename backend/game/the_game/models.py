from django.db import models
from django.utils import timezone

class GameMatch(models.Model):
    GAME_MODES = [
        ('online', 'Online'),
        ('bot', 'Bot'),
    ]
    match_id = models.CharField(max_length=255, unique=True)
    game_mode = models.CharField(max_length=10, choices=GAME_MODES, default='online')
    game_type = models.CharField(max_length=50, default='prisoners-dilemma')
    
    # --------------------
    # Custom Experiment Parameters
    # --------------------
    experiment_id = models.UUIDField(null=True, blank=True, db_index=True)
    condition_id = models.IntegerField(null=True, blank=True)
    total_rounds = models.IntegerField(default=25)
    created_at = models.DateTimeField(default=timezone.now)
    
    # Payoff Matrix (Player 1 / Player 2)
    p1_cc = models.IntegerField(default=3)
    p2_cc = models.IntegerField(default=3)
    p1_cd = models.IntegerField(default=0)
    p2_cd = models.IntegerField(default=5)
    p1_dc = models.IntegerField(default=5)
    p2_dc = models.IntegerField(default=0)
    p1_dd = models.IntegerField(default=1)
    p2_dd = models.IntegerField(default=1)
    
    # Custom Labels
    label_a = models.CharField(max_length=50, default="Cooperate")
    label_b = models.CharField(max_length=50, default="Defect")
    room_name = models.CharField(max_length=100, default="Prisoner's Dilemma")
    player_1_fingerprint = models.CharField(max_length=255)
    player_2_fingerprint = models.CharField(max_length=255, blank=True, null=True)
    player_1_ip = models.GenericIPAddressField()
    player_2_ip = models.GenericIPAddressField(blank=True, null=True)
    player_1_country = models.CharField(max_length=100)
    player_1_city = models.CharField(max_length=100)
    player_2_country = models.CharField(max_length=100, blank=True, null=True)
    player_2_city = models.CharField(max_length=100, blank=True, null=True)
    avg_cooperation_percent = models.FloatField(default=0)
    player_1_cooperation_percent = models.FloatField(default=0)
    player_2_cooperation_percent = models.FloatField(default=0)
    player_1_final_score = models.IntegerField(default=0)
    player_2_final_score = models.IntegerField(default=0)
    is_complete = models.BooleanField(default=False)
    completed_at = models.CharField(max_length=50, blank=True, null=True)
    
    # Survey response fields for Player 1
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
    
    # Survey response fields for Player 2
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

    def get_completed_rounds_count(self):
        """Get the number of completed rounds for this match"""
        return self.rounds.filter(
            player_1_action__isnull=False,
            player_2_action__isnull=False
        ).count()

    def delete_if_incomplete(self):
        """Delete the match only if it truly ended before its configured round count."""
        if not self.is_complete and self.get_completed_rounds_count() < self.total_rounds:
            self.delete()
            return True
        return False

    def save(self, *args, **kwargs):
        if self.completed_at and isinstance(self.completed_at, str):
            pass
        elif self.completed_at:
            self.completed_at = timezone.now().strftime('%Y-%m-%d %H:%M')
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Match {self.match_id} - Player 1: {self.player_1_fingerprint} vs Player 2: {self.player_2_fingerprint or 'Bot'}"

class GameRound(models.Model):
    match = models.ForeignKey(GameMatch, related_name='rounds', on_delete=models.CASCADE)
    round_number = models.IntegerField()
    player_1_action = models.CharField(max_length=20, blank=True, null=True)
    player_2_action = models.CharField(max_length=20, blank=True, null=True)
    round_start_time = models.CharField(max_length=50, blank=True, null=True)  
    round_end_time = models.CharField(max_length=50, blank=True, null=True)  
    player_1_score = models.IntegerField(null=True, blank=True)
    player_2_score = models.IntegerField(null=True, blank=True)
    
    player_1_cooperation_percent = models.FloatField(default=0)  
    player_2_cooperation_percent = models.FloatField(default=0)  
    avg_cooperation_percent = models.FloatField(default=0)       
    player_1_cumulative_score = models.IntegerField(default=0)   # Running total
    player_2_cumulative_score = models.IntegerField(default=0)   # Running total

    def save(self, *args, **kwargs):
        if not self.round_start_time:
            self.round_start_time = timezone.now().strftime('%Y-%m-%d %H:%M')        
        if self.round_end_time and not isinstance(self.round_end_time, str):
            self.round_end_time = timezone.now().strftime('%Y-%m-%d %H:%M')
        
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Round {self.round_number} of Match {self.match.match_id}"
