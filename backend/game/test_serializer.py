import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "game.settings")
django.setup()

from custom_rooms.serializers import ConsentFormSerializer

data = {
  "study_title": "Test",
  "purpose": "Test",
  "investigator": "Test",
  "institution": "Test",
  "contact_email": "test",
  "ethics_committee": "",
  "approval_number": "",
  "duration_minutes": 15,
  "participation_type": "voluntary",
  "eligibility_criteria": {
    "min_age": "",
    "countries": "",
    "language": "",
    "other": ""
  },
  "compensation_enabled": False,
  "compensation_type": "None",
  "compensation_description": "",
  "risks": "",
  "benefits": "",
  "data_collected": "Test",
  "data_access": "Test",
  "post_experiment_survey": True,
  "storage_duration": "1 year",
  "future_use": {
    "research": False,
    "collaborators": False,
    "public": False,
    "educational": False,
    "commercial": False
  }
}

serializer = ConsentFormSerializer(data=data)
if not serializer.is_valid():
    print("ERRORS:", serializer.errors)
else:
    print("VALID!")
