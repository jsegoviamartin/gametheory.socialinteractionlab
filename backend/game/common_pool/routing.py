from django.urls import re_path
from .consumers import CommonPoolConsumer

websocket_urlpatterns = [
    re_path(r"ws/common-pool/(?P<match_id>\w+)/$", CommonPoolConsumer.as_asgi()),
]
