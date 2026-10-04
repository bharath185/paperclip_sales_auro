import type { Request, Response, NextFunction } from "express";

interface ClientRecord {
  count: number;
  resetAt: number;
  lockedUntil?: number;
}

export interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  lockoutMs?: number;
  message?: string;
}

/**
 * In-memory sliding window rate limiter with temporary lockout for authentication & public endpoints.
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const clients = new Map<string, ClientRecord>();
  const windowMs = options.windowMs || 60000;
  const maxRequests = options.maxRequests || 10;
  const lockoutMs = options.lockoutMs || windowMs * 2;
  const message = options.message || "Too many requests. Please try again later.";

  return function rateLimiterMiddleware(req: Request, res: Response, next: NextFunction) {
    const ip = req.ip || req.socket.remoteAddress || "unknown-ip";
    const now = Date.now();
    let record = clients.get(ip);

    if (!record || now > record.resetAt) {
      record = {
        count: 1,
        resetAt: now + windowMs,
      };
      clients.set(ip, record);
      return next();
    }

    // Check if client is currently locked out
    if (record.lockedUntil && now < record.lockedUntil) {
      const retryAfterSeconds = Math.ceil((record.lockedUntil - now) / 1000);
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({
        error: "rate_limit_lockout",
        message: `Account temporarily locked due to excessive attempts. Retry in ${retryAfterSeconds}s`,
      });
    }

    record.count++;

    if (record.count > maxRequests) {
      record.lockedUntil = now + lockoutMs;
      const retryAfterSeconds = Math.ceil(lockoutMs / 1000);
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({
        error: "rate_limit_exceeded",
        message,
      });
    }

    next();
  };
}
