const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
for (const extension of ['db', 'wasm']) {
  if (!config.resolver.assetExts.includes(extension)) config.resolver.assetExts.push(extension);
}
const enhanceMiddleware = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, server) => {
  const enhanced = enhanceMiddleware ? enhanceMiddleware(middleware, server) : middleware;
  return (req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    enhanced(req, res, next);
  };
};
module.exports = config;
