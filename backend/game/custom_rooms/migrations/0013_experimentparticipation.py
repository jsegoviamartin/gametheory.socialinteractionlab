from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ('custom_rooms', '0012_customexperiment_game_mode'),
    ]

    operations = [
        migrations.CreateModel(
            name='ExperimentParticipation',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('player_fingerprint', models.CharField(max_length=255)),
                ('condition_id', models.PositiveIntegerField()),
                ('consent_accepted_at', models.DateTimeField(auto_now_add=True)),
                ('experiment', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='participations',
                    to='custom_rooms.customexperiment',
                )),
            ],
        ),
        migrations.AddConstraint(
            model_name='experimentparticipation',
            constraint=models.UniqueConstraint(
                fields=('experiment', 'player_fingerprint'),
                name='unique_experiment_participant',
            ),
        ),
    ]
