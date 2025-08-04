# Pipeline Monitoring Guide

## Quick Status Check Methods

### 1. **Status Dashboard** (Visual - Best for Quick Glance)
Open in browser: `https://bvaadmin.github.io/unified-system/forms/status-dashboard.html`

This dashboard shows:
- ✅ Green indicators = Component working
- 🟡 Yellow indicators = Checking status
- ❌ Red indicators = Component has issues

Features:
- Auto-refreshes every 5 minutes
- Test submission buttons for quick verification
- Shows last successful submission details

### 2. **Command Line Health Check**
```bash
# Quick health check
npm run health-check

# Or directly:
curl https://unified-system-api.vercel.app/api/health | jq
```

Response shows:
```json
{
  "status": "healthy",  // or "unhealthy" / "degraded"
  "checks": {
    "api": { "status": "ok" },
    "database": { "status": "ok" },
    "notion": { "status": "ok" },
    "environment": { "status": "ok" }
  }
}
```

### 3. **Check Recent Submissions**
```bash
# See submissions from last 24 hours
npm run check-submissions
```

This shows:
- Recent memorial garden submissions
- Recent chapel service applications  
- Sync status with Notion
- Total submission counts

### 4. **Quick Database Check**
```bash
# Test database connection
npm run test-connection
```

### 5. **Manual Test Submissions**

#### Test Memorial Garden:
```bash
curl -X POST https://unified-system-api.vercel.app/api/memorial/submit-garden \
  -H "Content-Type: application/json" \
  -d '{
    "applicationType": "future",
    "is_member": "Yes",
    "member_name": "Test Member",
    "first_name": "Test",
    "last_name": "User",
    "email": "test@example.com",
    "phone": "(555) 123-4567",
    "policy_agreement": true
  }'
```

#### Test Chapel Service:
```bash
curl -X POST https://unified-system-api.vercel.app/api/chapel/submit-service \
  -H "Content-Type: application/json" \
  -d '{
    "service_type": "wedding",
    "service_date": "2025-12-15",
    "service_time": "14:00",
    "primary_contact": {
      "name": "Test Contact",
      "email": "test@example.com",
      "phone": "(555) 123-4567"
    },
    "is_bay_view_member": true,
    "member_name": "Test Member"
  }'
```

## What to Look For

### ✅ **Healthy Pipeline**
- All dashboard indicators are green
- Test submissions return success with IDs
- Database shows recent submissions
- Notion IDs are present for synced records

### ⚠️ **Warning Signs**
- Yellow/orange indicators on dashboard
- Submissions succeed but no Notion ID
- Slow response times (>5 seconds)
- Missing environment variables warning

### ❌ **Pipeline Issues**
- Red indicators on dashboard
- Network errors on test submissions
- Database connection failures
- 500 errors from API endpoints

## Troubleshooting Common Issues

### 1. **"Network Error" on Dashboard**
- Check if APIs are deployed: `vercel ls`
- Verify domain is accessible
- Check CORS configuration

### 2. **Database Connection Failed**
- Verify DATABASE_URL in Vercel env
- Check DigitalOcean database status
- Test with: `npm run test-connection`

### 3. **Notion Sync Not Working**
- Check NOTION_API_KEY is set
- Verify database IDs are correct
- Look for notion_id in database records

### 4. **Form Submissions Failing**
- Open browser console for errors
- Check API endpoint URLs in forms
- Verify all required fields are sent

## Mobile Quick Check

From your phone, visit:
```
https://bvaadmin.github.io/unified-system/forms/status-dashboard.html
```

The dashboard is mobile-responsive and shows the same status indicators.

## Setting Up Alerts (Optional)

### Using Vercel Monitoring
1. Go to Vercel Dashboard
2. Select your project
3. Go to Settings > Monitoring
4. Enable alerts for:
   - Function errors
   - High response times
   - Failed deployments

### Custom Monitoring Script
Create a cron job to run:
```bash
# Check health every 5 minutes
*/5 * * * * /usr/bin/curl -s https://unified-system-api.vercel.app/api/health | grep -q '"status":"healthy"' || echo "Pipeline issue detected" | mail -s "BVA Pipeline Alert" your-email@example.com
```

## Quick Reference Card

```
🔍 STATUS CHECKS
├─ Visual Dashboard: /forms/status-dashboard.html
├─ CLI Health: npm run health-check  
├─ Recent Data: npm run check-submissions
└─ DB Test: npm run test-connection

🧪 TEST SUBMISSIONS
├─ Dashboard: Click test buttons
├─ Memorial: POST /api/memorial/submit-garden
└─ Chapel: POST /api/chapel/submit-service

⚡ QUICK FIXES
├─ Restart API: vercel --prod
├─ Check Logs: vercel logs
├─ Env Vars: vercel env pull
└─ DB Direct: psql $DATABASE_URL
```

## Summary

The fastest way to check pipeline status at a glance:

1. **Bookmark the status dashboard** on your phone/computer
2. **Green = Good, Red = Problem**
3. **Use test buttons** to verify end-to-end flow
4. **Run `npm run check-submissions`** for detailed recent activity

The dashboard auto-refreshes and provides immediate visual feedback on system health.