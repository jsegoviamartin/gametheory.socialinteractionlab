from django.urls import path
from . import views

urlpatterns = [
    path("create-match/", views.create_match_common_pool, name="create_match_common_pool"),
    path("matchmake-custom/", views.matchmake_custom_common_pool, name="matchmake_custom_common_pool"),
    path("match-stats/<str:match_id>/", views.match_stats_common_pool, name="match_stats_common_pool"),
    path("submit-survey/", views.submit_survey, name="submit_survey_common_pool"),
]
