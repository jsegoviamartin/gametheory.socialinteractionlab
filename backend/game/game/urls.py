from django.contrib import admin
from django.urls import path, include
from django.views.generic import TemplateView

from two_factor.urls import urlpatterns as tf_urls
from two_factor.views import SetupView
import sys

from django.shortcuts import redirect
from two_factor.utils import default_device

class DebugSetupView(SetupView):
    def get(self, request, *args, **kwargs):
        if request.user.is_authenticated and default_device(request.user):
            return redirect('/dashboard')
        return super().get(request, *args, **kwargs)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/prisoners/', include('the_game.urls')),
    path('api/ultimatum/', include('ultimatum.urls')), 
    path('api/public-goods/', include('public_goods.urls')),
    path('api/common-pool/', include('common_pool.urls')),
    path('api/accounts/', include('accounts.urls')),
    path('api/custom-rooms/', include('custom_rooms.urls')),
    path('api/auth/', include('dj_rest_auth.urls')),
    path('password-reset-confirm/<uidb64>/<token>/', TemplateView.as_view(template_name='index.html'), name='password_reset_confirm'),
    path('account/two_factor/setup/', DebugSetupView.as_view(), name='setup'),
    path('', include(tf_urls)),
    path('', TemplateView.as_view(template_name='index.html')),
    path('<path:path>', TemplateView.as_view(template_name='index.html')),
]