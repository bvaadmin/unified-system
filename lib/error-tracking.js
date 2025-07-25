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
  
  // TODO: Integrate with error tracking service (Sentry, Rollbar, etc.)
}