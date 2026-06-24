# Test: Claude Code Review Workflow Verification

This file tests the improved Claude Code GitHub Actions workflows.

## Changes Being Tested

### 1. Path Filtering
- ✅ Workflow should only run on changes to `api/`, `lib/`, `scripts/`, and `forms/` files
- ✅ This file change should **NOT** trigger the workflow (it's a `.md` file)

### 2. Bay View Coding Standards
- Custom review prompts should check for:
  - CORS handling in API endpoints
  - Database connection security patterns
  - PostgreSQL SSL configuration
  - Dual-write pattern compatibility
  - Error handling with detailed logging
  - Authentication requirements for admin endpoints

### 3. Allowed Tools
- Workflow should have access to:
  - `npm run test-connection` - Database connectivity test
  - `npm run lint` - Code linting
  - `npm run test-chapel-submission` - Chapel service API test
  - `npm run test-memorial-submission` - Memorial garden API test

## Expected Behavior

Since this is a `.md` file change, the `claude-code-review.yml` workflow should **NOT** be triggered due to the path filtering we implemented.

To properly test the workflow, we would need to make changes to files matching the path filter patterns.

## Next Steps

After verifying path filtering works correctly, create a follow-up test that modifies a JavaScript file to trigger the actual review workflow.