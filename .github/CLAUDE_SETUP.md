# Claude Code GitHub Actions Setup

This repository uses Claude Code for automated code reviews and AI assistance through GitHub Actions.

## Workflows Overview

### 1. Claude Code Review (`claude-code-review.yml`)
Automatically reviews pull requests using Claude AI.

**Triggers:**
- Pull request opened
- Pull request synchronized (new commits)

**File Filtering:**
Only runs on changes to:
- `api/**/*.js` - API endpoints
- `lib/**/*.js` - Shared utilities
- `scripts/**/*.js` - Database and utility scripts
- `forms/**/*.js` - Form JavaScript
- `forms/**/*.html` - Form HTML files

**Available Tools:**
- `npm run test-connection` - Database connectivity test
- `npm run lint` - Code linting
- `npm run test-chapel-submission` - Chapel service API test
- `npm run test-memorial-submission` - Memorial garden API test

### 2. Main Claude Workflow (`claude.yml`)
Provides Claude AI assistance on repository issues and discussions.

## Usage Examples

### Creating a Pull Request
```bash
# Create feature branch
git checkout -b feature/new-api-endpoint

# Make changes to API files
# Edit api/chapel/new-endpoint.js

# Commit and push
git add .
git commit -m "Add new chapel endpoint"
git push origin feature/new-api-endpoint

# Create PR on GitHub - Claude will automatically review
```

### Manual Workflow Trigger
1. Go to repository on GitHub
2. Click "Actions" tab
3. Select "Claude Code Review" or "Claude"
4. Click "Run workflow"

## Bay View Coding Standards (Enforced by Claude)

The Claude reviewer checks for:

### API Standards
- ✅ Proper CORS handling with whitelisted origins
- ✅ Database SSL connection security
- ✅ Admin endpoint authentication
- ✅ Dual-write pattern for legacy compatibility

### Database Standards
- ✅ PostgreSQL SSL connections
- ✅ Proper error handling with logging
- ✅ Transaction management for data consistency
- ✅ Connection cleanup and security

### Code Quality
- ✅ Best practices and patterns
- ✅ Performance considerations
- ✅ Security concerns
- ✅ Test coverage

## Configuration

### Required Secrets
- `CLAUDE_CODE_OAUTH_TOKEN` - OAuth token for Claude Code access

### Environment Variables
The workflows inherit environment variables from repository settings for database testing.

## Monitoring

### Workflow Status
- Green checkmark ✅ - Review completed successfully
- Red X ❌ - Workflow failed (check logs)
- Yellow circle 🟡 - Workflow running

### Notifications
- PR comments from Claude appear automatically
- Workflow failures send GitHub notifications
- Status checks prevent merging if reviews fail

## Customization

### Skipping Reviews
Add to PR title:
- `[skip-review]` - Skip Claude review
- `[WIP]` - Work in progress, skip review

### Review Focus
Claude automatically focuses on:
- TypeScript/JavaScript best practices
- API security and validation
- Database connection patterns
- Bay View Association requirements

## Troubleshooting

### Common Issues

**Review not triggering:**
- Check file paths match the filter
- Verify PR is targeting correct branch
- Check OAuth token permissions

**Test failures:**
- Ensure database environment variables are set
- Check network connectivity to PostgreSQL
- Verify npm scripts exist in package.json

**Permission errors:**
- Review repository permissions
- Check OAuth token scope
- Verify GitHub Actions are enabled

### Getting Help

1. Check workflow logs in Actions tab
2. Review PR comments for specific feedback
3. Ensure all required secrets are configured
4. Test locally with `npm run test-connection`

## Best Practices

### For Contributors
- Make focused, single-purpose PRs
- Include tests for new functionality
- Follow existing code patterns
- Update documentation when needed

### For Maintainers
- Review Claude suggestions carefully
- Use workflow failures as learning opportunities
- Keep secrets and environment variables updated
- Monitor workflow performance and costs

## Integration with Bay View Systems

The workflows are specifically configured for:
- **Chapel service management** - Reviews wedding/memorial endpoints
- **Memorial garden applications** - Reviews form submission logic
- **Database operations** - Validates PostgreSQL patterns
- **API security** - Enforces CORS and authentication
- **Dual-write compatibility** - Ensures legacy system support

This ensures all code changes maintain the high standards required for managing Bay View Association's historic chapel services and memorial garden operations.