import os
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "game.settings")
# Initialize Django ASGI application early to ensure AppRegistry is ready
django_asgi_app = get_asgi_application()

from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from the_game.routing import websocket_urlpatterns as pd_ws
from ultimatum.routing import websocket_urlpatterns as ult_ws
from public_goods.routing import websocket_urlpatterns as pg_ws 
from common_pool.routing import websocket_urlpatterns as cpr_ws

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AuthMiddlewareStack(
        URLRouter(
            pd_ws + ult_ws + pg_ws + cpr_ws
        )
    ),
})
