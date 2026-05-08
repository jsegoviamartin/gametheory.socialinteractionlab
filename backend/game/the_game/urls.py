from django.urls import path
from the_game import views
from django.views.generic import TemplateView

urlpatterns = [
    path('create_match/', views.create_match, name='create_match'),
    path('matchmake_custom/', views.matchmake_custom_the_game, name='matchmake_custom'),
    path('submit_survey/', views.submit_survey, name='submit_survey'),
]