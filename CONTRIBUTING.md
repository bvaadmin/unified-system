# Contributing to Bay View Administrative System

Thank you for contributing to the Bay View Association administrative system! Please follow these guidelines to ensure smooth collaboration.

## 🚨 Critical: API Development Rules

### NEVER Create Files in `/api` Directory

Due to Vercel's 12-function limit on the hobby plan, we use a **unified API pattern**. 

**Read [API-ARCHITECTURE.md](./API-ARCHITECTURE.md) before adding any API endpoints!**

## Development Workflow

### 1. Setting Up Your Environment

```bash
# Clone the repository
git clone https://github.com/bvaadmin/unified-system.git
cd unified-system

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
# Add your credentials to .env.local
```

### 2. Making Changes

#### Adding a New API Endpoint

1. Create handler in `/lib/api/your-feature/`
2. Import in `/api/index.js`
3. Add route mapping
4. Test locally with `npm run dev`
5. Verify only 1 function exists: `ls api/*.js | wc -l`

#### Modifying Forms

1. Forms are in `/forms/` directory
2. Test locally by opening HTML files
3. Update API URLs if needed
4. Forms auto-deploy via GitHub Pages

#### Database Changes

1. Create migration in `/scripts/migrations/`
2. Test on local database first
3. Document schema changes
4. Never modify production directly

### 3. Testing

```bash
# Test database connection
npm run test-connection

# Test specific features
npm run test-chapel-submission
npm run test-memorial-submission

# Check recent submissions
npm run check-submissions

# Verify API health
npm run health-check
```

### 4. Pre-Commit Checklist

- [ ] Only 1 file in `/api/` directory (index.js)
- [ ] All imports in unified router are correct
- [ ] No hardcoded API keys or secrets
- [ ] Database migrations tested
- [ ] Forms tested locally
- [ ] Documentation updated if needed

### 5. Deployment

Deployments happen automatically when pushing to main:
- APIs deploy to Vercel
- Forms deploy to GitHub Pages

Monitor deployment status:
- Dashboard: https://bvaadmin.github.io/unified-system/forms/status-dashboard.html
- Vercel: Check GitHub commit status

## Code Style Guidelines

### JavaScript
- Use ES6 modules (`import`/`export`)
- Async/await for promises
- Meaningful variable names
- Handle errors properly

### Database
- Use prepared statements
- Follow existing schema patterns
- Document all migrations
- Test with transactions

### Forms
- Keep forms accessible
- Validate on client and server
- Show clear error messages
- Test on mobile devices

## Common Issues

### "Function limit exceeded" on Vercel
You created a file in `/api/`. Move it to `/lib/api/` and update the router.

### Form submission failing
1. Check API URL in form
2. Verify CORS settings
3. Check database connection
4. Review error logs

### Database connection errors
1. Check DATABASE_URL in Vercel
2. Verify SSL settings
3. Test with `npm run test-connection`

## Getting Help

1. Check existing documentation
2. Review similar code patterns
3. Test thoroughly before asking
4. Include error messages when asking for help

## Bay View Specific Context

- **Leaseholder** not "owner" (Bay View uses perpetual leases)
- **Block & Lot** system for property identification
- **Member sponsorship** required for non-member events
- Preserve 150-year traditions while modernizing systems

Remember: This system manages real church operations and historical records. Handle with care!