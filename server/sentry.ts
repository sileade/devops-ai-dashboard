/**
 * Sentry Configuration for Server-Side Error Tracking
 * 
 * This module initializes Sentry for the Express/Node.js backend.
 * It captures unhandled exceptions, rejected promises, and custom errors.
 * 
 * Environment Variables:
 * - SENTRY_DSN: Sentry Data Source Name (required for production)
 * - SENTRY_ENVIRONMENT: Environment name (development, staging, production)
 * - SENTRY_RELEASE: Release version for source map association
 */

import * as Sentry from '@sentry/node';

// Check if Sentry is configured
const SENTRY_DSN = process.env.SENTRY_DSN;
const SENTRY_ENVIRONMENT = process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development';
const SENTRY_RELEASE = process.env.SENTRY_RELEASE || process.env.npm_package_version || '1.0.0';

/**
 * Initialize Sentry for server-side error tracking
 */
export function initSentry() {
  if (!SENTRY_DSN) {
    console.log('[Sentry] DSN not configured, error tracking disabled');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    release: `devops-ai-dashboard@${SENTRY_RELEASE}`,
    
    // Performance monitoring
    tracesSampleRate: SENTRY_ENVIRONMENT === 'production' ? 0.1 : 1.0,
    
    // Profile sampling (for performance profiling)
    profilesSampleRate: SENTRY_ENVIRONMENT === 'production' ? 0.1 : 1.0,
    
    // Integrations
    integrations: [
      // HTTP integration for tracking outgoing requests
      Sentry.httpIntegration(),
      // Express integration
      Sentry.expressIntegration(),
      // Console integration for capturing console.error
      Sentry.consoleIntegration(),
    ],
    
    // Filter sensitive data
    beforeSend(event, hint) {
      // Don't send events in development unless explicitly enabled
      if (SENTRY_ENVIRONMENT === 'development' && !process.env.SENTRY_DEBUG) {
        return null;
      }
      
      // Remove sensitive data from request
      if (event.request) {
        // Remove authorization headers
        if (event.request.headers) {
          delete event.request.headers['authorization'];
          delete event.request.headers['cookie'];
          delete event.request.headers['x-api-key'];
        }
      }
      
      return event;
    },
    
    // Ignore certain errors
    ignoreErrors: [
      // Network errors
      'Network request failed',
      'Failed to fetch',
      'NetworkError',
      // User-triggered errors
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      // Expected errors
      'UNAUTHORIZED',
      'FORBIDDEN',
    ],
    
    // Ignore transactions from health checks
    ignoreTransactions: [
      '/health',
      '/api/health',
      '/healthz',
      '/readyz',
    ],
  });

  console.log(`[Sentry] Initialized for ${SENTRY_ENVIRONMENT} environment`);
}

/**
 * Capture an exception with additional context
 */
export function captureException(error: Error, context?: Record<string, any>) {
  if (!SENTRY_DSN) {
    console.error('[Sentry] Error captured (not sent):', error.message);
    return;
  }

  Sentry.withScope((scope) => {
    if (context) {
      scope.setExtras(context);
    }
    Sentry.captureException(error);
  });
}

/**
 * Capture a message with severity level
 */
export function captureMessage(
  message: string, 
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info',
  context?: Record<string, any>
) {
  if (!SENTRY_DSN) {
    console.log(`[Sentry] Message captured (not sent): ${message}`);
    return;
  }

  Sentry.withScope((scope) => {
    if (context) {
      scope.setExtras(context);
    }
    Sentry.captureMessage(message, level);
  });
}

/**
 * Set user context for error tracking
 */
export function setUser(user: { id: string; email?: string; username?: string }) {
  Sentry.setUser(user);
}

/**
 * Clear user context
 */
export function clearUser() {
  Sentry.setUser(null);
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(breadcrumb: {
  category: string;
  message: string;
  level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
  data?: Record<string, any>;
}) {
  Sentry.addBreadcrumb({
    ...breadcrumb,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Start a transaction for performance monitoring
 */
export function startTransaction(name: string, op: string) {
  return Sentry.startSpan({ name, op }, () => {});
}

/**
 * Setup Sentry error handler for Express
 * Call this after all routes are defined
 */
export function setupExpressErrorHandler(app: any) {
  Sentry.setupExpressErrorHandler(app);
}

export default Sentry;
