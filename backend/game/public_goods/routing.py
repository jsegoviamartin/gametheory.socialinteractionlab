from django.urls import re_path
from .consumers import PublicGoodsConsumer

websocket_urlpatterns = [
    re_path(
        r"^ws/public-goods/(?P<match_id>[^/]+)/$",
        PublicGoodsConsumer.as_asgi(),
    ),
]
