import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'game.settings')
django.setup()

from django.contrib.auth.models import User
from django_otp import devices_for_user
from two_factor.utils import default_device

def list_unconfirmed_2fa():
    users = User.objects.all()
    for user in users:
        devices = list(devices_for_user(user))
        unconfirmed = [d for d in devices if not getattr(d, 'confirmed', True)]
        if unconfirmed:
            print(f"User: {user.username}")
            for d in unconfirmed:
                print(f"    - Unconfirmed Device: {d}")
            print("-" * 20)

if __name__ == "__main__":
    list_unconfirmed_2fa()
