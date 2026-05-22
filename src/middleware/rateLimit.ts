import rateLimit from 'express-rate-limit';

// Global IP‑based limiter: 10 requests per minute per IP
// Uses memory store (fine for development; use Redis in production)
export const ipLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  keyGenerator: (req) => req.ip || req.socket.remoteAddress || 'unknown',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({ error: 'Too many requests from this IP.' });
  },
});