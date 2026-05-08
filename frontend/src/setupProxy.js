const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  // Proxy REST API calls to Django backend
  app.use(
    ['/api', '/account'],
    createProxyMiddleware({
      target: 'http://localhost:8001',
      changeOrigin: true,
    }),
  );

  // Explicit WebSocket Proxy with explicit headers
  app.use(
    '/ws',
    createProxyMiddleware({
      target: 'http://localhost:8001',
      changeOrigin: true,
      ws: true,
      headers: {
        Connection: 'upgrade',
      },
    }),
  );
};