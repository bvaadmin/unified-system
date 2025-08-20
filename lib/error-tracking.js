// Error tracking module for Bay View Association
// Provides error categorization and tracking functionality

export const ErrorCategory = {
  API: 'API',
  DATABASE: 'DATABASE',
  VALIDATION: 'VALIDATION',
  AUTHENTICATION: 'AUTHENTICATION',
  INTEGRATION: 'INTEGRATION'
};

export const ErrorSeverity = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
};

/**
 * Track an error with context
 * @param {Object} errorData - Error data to track
 * @param {string} errorData.message - Error message
 * @param {string} errorData.category - Error category
 * @param {string} errorData.severity - Error severity
 * @param {Error} errorData.error - Original error object
 * @param {string} errorData.endpoint - API endpoint where error occurred
 * @param {Object} errorData.context - Additional context
 */
export async function trackError(errorData) {
  const { message, category, severity, error, endpoint, context } = errorData;
  
  // Log to console with structured format
  console.error('[ERROR TRACKING]', {
    timestamp: new Date().toISOString(),
    message,
    category,
    severity,
    endpoint,
    context,
    stack: error?.stack,
    originalMessage: error?.message
  });
  
  // In production, this would send to an error tracking service
  // For now, we just log to console
  
  // Integrate with error tracking service if configured
  try {
    await sendToErrorTrackingService(errorData);
  } catch (serviceError) {
    console.warn('[ERROR TRACKING] Failed to send to external service:', serviceError.message);
  }
}

/**
 * Send error to external tracking service
 * @param {Object} errorData - Error data to send
 */
async function sendToErrorTrackingService(errorData) {
  const { message, category, severity, error, endpoint, context } = errorData;
  
  // Check for Sentry configuration
  if (typeof window !== 'undefined' && window.Sentry) {
    window.Sentry.captureException(error || new Error(message), {
      tags: {
        category,
        severity,
        endpoint
      },
      extra: context
    });
    return;
  }
  
  // Check for server-side Sentry in Node.js environment
  if (typeof global !== 'undefined' && global.Sentry) {
    global.Sentry.captureException(error || new Error(message), {
      tags: {
        category,
        severity,
        endpoint
      },
      extra: context
    });
    return;
  }
  
  // Check for environment variable configuration for external service
  const errorTrackingUrl = process.env.ERROR_TRACKING_URL;
  if (errorTrackingUrl) {
    const payload = {
      timestamp: new Date().toISOString(),
      message,
      category,
      severity,
      endpoint,
      context,
      stack: error?.stack,
      originalMessage: error?.message,
      environment: process.env.NODE_ENV || 'development'
    };
    
    const response = await fetch(errorTrackingUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.ERROR_TRACKING_API_KEY && {
          'Authorization': `Bearer ${process.env.ERROR_TRACKING_API_KEY}`
        })
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  }
}