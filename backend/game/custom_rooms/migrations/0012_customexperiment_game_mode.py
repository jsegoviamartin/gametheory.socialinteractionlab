from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('custom_rooms', '0011_consentform'),
    ]

    operations = [
        migrations.AddField(
            model_name='customexperiment',
            name='game_mode',
            field=models.CharField(
                choices=[('online', 'Online'), ('bot', 'Bot')],
                default='online',
                max_length=20,
            ),
        ),
    ]
