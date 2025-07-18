# GitHub Pages Deployment Guide

## Overview

The Bay View Association forms are deployed to GitHub Pages at:
- **URL**: https://bvaadmin.github.io/unified-system/forms/

This guide explains how the deployment works and how to manage it.

## Automatic Deployment

### GitHub Actions Workflow

The forms are automatically deployed when you push changes to the `main` branch. The deployment is handled by `.github/workflows/deploy-pages.yml`.

**Triggers:**
- Push to `main` branch (only when files in `forms/` directory change)
- Manual workflow dispatch from GitHub Actions tab

**What happens:**
1. GitHub Actions builds the site structure
2. Copies all forms to `_site/unified-system/forms/`
3. Creates redirect pages at root
4. Deploys to GitHub Pages

### Deployment Structure

```
https://bvaadmin.github.io/
├── index.html (redirects to /unified-system/forms/)
└── unified-system/
    ├── index.html (redirects to forms/)
    └── forms/
        ├── index.html (main forms portal)
        ├── chapel-wedding.html
        ├── chapel-memorial.html
        ├── chapel-baptism.html
        ├── chapel-general-use.html
        ├── memorial-garden.html
        └── ... (other forms and resources)
```

## Form Configuration

### API Endpoints

All forms are configured to submit to the Vercel-hosted API:
- **Base URL**: https://bvaadmin.vercel.app
- **Chapel Services**: `/api/chapel/submit-service`
- **Memorial Garden**: `/api/memorial/submit-garden`

### Updating Form URLs

Before deployment, ensure forms use production URLs:

```bash
# Update forms to use production API URLs
npm run update-form-urls

# For local development, revert to relative URLs
npm run revert-form-urls
```

## Manual Deployment

If automatic deployment fails or you need to trigger manually:

1. Go to the repository on GitHub
2. Click on "Actions" tab
3. Select "Deploy to GitHub Pages" workflow
4. Click "Run workflow"
5. Select `main` branch
6. Click "Run workflow" button

## Verifying Deployment

After deployment completes:

1. Visit https://bvaadmin.github.io/unified-system/forms/
2. Check that all forms load correctly
3. Test form submission (use test data)
4. Verify API responses in browser console

## Troubleshooting

### Forms Not Loading

1. Check GitHub Actions for deployment errors
2. Verify GitHub Pages is enabled in repository settings
3. Clear browser cache and try again

### API Connection Issues

1. Check browser console for CORS errors
2. Verify API is deployed and running on Vercel
3. Ensure forms are using correct production URLs
4. Check that `bvaadmin.github.io` is in CORS allowed origins

### 404 Errors

- GitHub Pages may take 5-10 minutes to update
- Try accessing with `/index.html` suffix
- Check that files exist in the repository

## Development Workflow

1. **Local Development**
   ```bash
   # Revert to local API URLs
   npm run revert-form-urls
   
   # Start local development server
   npm run dev
   ```

2. **Test Changes**
   - Test forms locally with local API
   - Verify all functionality works

3. **Prepare for Deployment**
   ```bash
   # Update to production URLs
   npm run update-form-urls
   
   # Run validation
   npm run validate
   ```

4. **Deploy**
   ```bash
   # Commit and push to main
   git add .
   git commit -m "Update forms"
   git push origin main
   ```

5. **Monitor Deployment**
   - Check GitHub Actions for build status
   - Verify deployment at production URL

## Security Considerations

- Never commit API keys or sensitive data
- Forms use HTTPS for all communications
- API implements CORS protection
- All submissions are validated server-side

## Maintenance

### Regular Tasks

- Monitor form submissions for errors
- Update API URLs if Vercel deployment changes
- Keep forms synchronized with database schema
- Test forms after major updates

### Updating the Workflow

To modify the deployment process, edit `.github/workflows/deploy-pages.yml`. Changes will take effect on the next deployment.

## Support

For issues with:
- **Forms**: Check browser console and API logs
- **Deployment**: Review GitHub Actions logs
- **API**: Check Vercel dashboard and logs
- **Database**: Verify PostgreSQL and Notion connectivity