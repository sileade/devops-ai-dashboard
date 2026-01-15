import rateLimit from "express-rate-limit";
import type { Request, Response } from "express";

/**
 * Rate limiting configuration for different endpoint types
 * Protects against DDoS attacks and API abuse
 */

// Standard message for rate limit exceeded
const rateLimitMessage = {
  error: "Too many requests",
  message: "You have exceeded the rate limit. Please try again later.",
  retryAfter: "See Retry-After header for wait time in seconds",
};

// Skip rate limiting for certain conditions
const skip = (req: Request): boolean => {
  // Skip for health check endpoints
  if (req.path === "/health" || req.path === "/api/health") {
    return true;
  }
  return false;
};

// Common options for all rate limiters
const commonOptions = {
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  // Use default keyGenerator which properly handles IPv6
  // keyGenerator is intentionally omitted to use express-rate-limit's default
  validate: { xForwardedForHeader: false }, // Disable validation warning
};

/**
 * General API rate limiter
 * 100 requests per 15 minutes per IP/user
 */
export const generalLimiter = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: rateLimitMessage,
  skip,
  handler: (req: Request, res: Response) => {
    console.warn(`[RateLimit] General limit exceeded for ${req.ip}`);
    res.status(429).json(rateLimitMessage);
  },
});

/**
 * Strict rate limiter for authentication endpoints
 * 10 requests per 15 minutes per IP
 */
export const authLimiter = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: {
    ...rateLimitMessage,
    message: "Too many authentication attempts. Please try again later.",
  },
  handler: (req: Request, res: Response) => {
    console.warn(`[RateLimit] Auth limit exceeded for ${req.ip}`);
    res.status(429).json({
      ...rateLimitMessage,
      message: "Too many authentication attempts. Please try again later.",
    });
  },
});

/**
 * Rate limiter for mutation operations (create, update, delete)
 * 50 requests per 15 minutes per IP/user
 */
export const mutationLimiter = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 requests per window
  message: {
    ...rateLimitMessage,
    message: "Too many write operations. Please slow down.",
  },
  skip,
  handler: (req: Request, res: Response) => {
    console.warn(`[RateLimit] Mutation limit exceeded for ${req.ip}`);
    res.status(429).json({
      ...rateLimitMessage,
      message: "Too many write operations. Please slow down.",
    });
  },
});

/**
 * Rate limiter for AI chat operations
 * 30 requests per 15 minutes per IP/user (AI calls are expensive)
 */
export const aiLimiter = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 requests per window
  message: {
    ...rateLimitMessage,
    message: "Too many AI requests. Please wait before sending more messages.",
  },
  handler: (req: Request, res: Response) => {
    console.warn(`[RateLimit] AI limit exceeded for ${req.ip}`);
    res.status(429).json({
      ...rateLimitMessage,
      message: "Too many AI requests. Please wait before sending more messages.",
    });
  },
});

/**
 * Rate limiter for infrastructure operations (Docker, K8s commands)
 * 20 requests per 15 minutes per IP/user (sensitive operations)
 */
export const infrastructureLimiter = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per window
  message: {
    ...rateLimitMessage,
    message: "Too many infrastructure operations. Please wait before executing more commands.",
  },
  handler: (req: Request, res: Response) => {
    console.warn(`[RateLimit] Infrastructure limit exceeded for ${req.ip}`);
    res.status(429).json({
      ...rateLimitMessage,
      message: "Too many infrastructure operations. Please wait before executing more commands.",
    });
  },
});

/**
 * Burst rate limiter for preventing rapid-fire requests
 * 10 requests per second per IP
 */
export const burstLimiter = rateLimit({
  ...commonOptions,
  windowMs: 1000, // 1 second
  max: 10, // 10 requests per second
  message: {
    ...rateLimitMessage,
    message: "Request rate too high. Please slow down.",
  },
  skip,
  handler: (req: Request, res: Response) => {
    console.warn(`[RateLimit] Burst limit exceeded for ${req.ip}`);
    res.status(429).json({
      ...rateLimitMessage,
      message: "Request rate too high. Please slow down.",
    });
  },
});

// Export all limiters
export default {
  general: generalLimiter,
  auth: authLimiter,
  mutation: mutationLimiter,
  ai: aiLimiter,
  infrastructure: infrastructureLimiter,
  burst: burstLimiter,
};
