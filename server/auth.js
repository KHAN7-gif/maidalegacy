// Minimal parity with the previous Firebase setup: the RTDB rules allowed
// anyone with the URL to read/write, so this is not an auth upgrade — just
// a shared-secret gate plus basic rate limiting, since a bare Express app
// (unlike Firebase's own infra) has no abuse protection of its own.
const rateLimit = require('express-rate-limit');

function apiKeyAuth(req, res, next) {
  if (!process.env.API_SHARED_KEY) {
    return res.status(500).json({ error: 'server misconfigured: API_SHARED_KEY not set' });
  }
  if (req.header('X-API-Key') !== process.env.API_SHARED_KEY) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

// Generous limit: several devices polling ~8 paths every ~3s can add up
// fast, and staff on the same office WiFi share one public IP.
const apiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 1200,
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { apiKeyAuth, apiRateLimit };
