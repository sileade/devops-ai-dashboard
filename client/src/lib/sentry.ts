/**
 * Sentry Configuration for Client-Side Error Tracking
 * 
 * This module initializes Sentry for the React frontend.
 * It captures JavaScript errors, unhandled promise rejections,
 * and provides performance monitoring.
 * 
 * Environment Variables:
 * - VITE_SENTRY_DSN: Sentry Data Source Name
 * - VITE_SENTRY_ENVIRONMENT: Environment name
 */

import * as Sentry from '@sentry/react';

// Get configuration from environment
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
const SENTRY_ENVIRONMENT = import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE || 'development';
const SENTRY_RELEASE = import.meta.env.VITE_SENTRY_RELEASE || '1.0.0';

/**
 * Initialize Sentry for client-side error tracking
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
    
    // Integrations
    integrations: [
      // Browser tracing for performance monitoring
      Sentry.browserTracingIntegration(),
      // Replay for session recording (only on errors)
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    
    // Performance monitoring
    tracesSampleRate: SENTRY_ENVIRONMENT === 'production' ? 0.1 : 1.0,
    
    // Session replay
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: SENTRY_ENVIRONMENT === 'production' ? 1.0 : 0,
    
    // Filter sensitive data
    beforeSend(event, hint) {
      // Don't send events in development unless explicitly enabled
      if (SENTRY_ENVIRONMENT === 'development' && !import.meta.env.VITE_SENTRY_DEBUG) {
        return null;
      }
      
      // Filter out user data from breadcrumbs
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map(breadcrumb => {
          if (breadcrumb.data) {
            // Remove sensitive data
            const { password, token, apiKey, ...safeData } = breadcrumb.data as Record<string, any>;
            breadcrumb.data = safeData;
          }
          return breadcrumb;
        });
      }
      
      return event;
    },
    
    // Ignore certain errors
    ignoreErrors: [
      // Network errors
      'Network request failed',
      'Failed to fetch',
      'NetworkError when attempting to fetch resource',
      'Load failed',
      // Browser extensions
      'chrome-extension://',
      'moz-extension://',
      // User-triggered errors
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      // Navigation errors
      'Navigation cancelled',
      'Abort route',
      // Expected errors
      'UNAUTHORIZED',
      'FORBIDDEN',
    ],
    
    // Deny URLs (don't capture errors from these)
    denyUrls: [
      // Chrome extensions
      /extensions\//i,
      /^chrome:\/\//i,
      /^chrome-extension:\/\//i,
      // Firefox extensions
      /^moz-extension:\/\//i,
      // Safari extensions
      /^safari-extension:\/\//i,
      // Third-party scripts
      /analytics/i,
      /gtag/i,
      /google-analytics/i,
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
 * React Error Boundary component
 * Wrap your app or specific components to catch and report errors
 */
export const SentryErrorBoundary = Sentry.ErrorBoundary;

/**
 * HOC to wrap components with error boundary
 */
export const withErrorBoundary = Sentry.withErrorBoundary;

/**
 * Hook to capture errors in functional components
 */
export function useSentryError() {
  return {
    captureException,
    captureMessage,
    addBreadcrumb,
  };
}

export default Sentry;
