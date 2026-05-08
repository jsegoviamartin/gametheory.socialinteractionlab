from django.urls import path
from . import views

urlpatterns = [
    path("create-match/", views.create_match_public_goods, name="pg_create_match"),
    path("matchmake-custom/", views.matchmake_custom_public_goods, name="pg_matchmake_custom"),
    path("match-stats/<str:match_id>/", views.match_stats_public_goods, name="pg_match_stats"),



    
    # path('cancel-match/', views.cancel_match, name='pg_cancel_match'),
    # path('match-history/<str:match_id>/', views.match_history, name='pg_match_history'),
    path('submit-survey/', views.submit_survey, name='pg_submit_survey'),
]