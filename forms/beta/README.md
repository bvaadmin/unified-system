# Beta Testing Strategy for Memorial Garden Adaptive Forms

## Overview
This beta deployment allows us to test the new adaptive forms system alongside the existing production form without any disruption.

## Access Methods

### 1. Direct Beta URL
Users can access the beta directly at:
- `https://bvaadmin.github.io/unified-system/forms/beta/`

### 2. Beta Banner on Main Form
Add this script tag to `memorial-garden.html` to show a non-intrusive beta invitation:
```html
<script src="memorial-garden-beta-banner.js"></script>
```

### 3. Query Parameter Access
Users can access beta via URL parameter:
- `https://bvaadmin.github.io/unified-system/forms/memorial-garden.html?beta=true`

### 4. Staff Testing Link
Share this with staff/testers:
- `https://bvaadmin.github.io/unified-system/forms/beta/memorial-garden-adaptive/`

## Beta Features

1. **A/B Testing**: Track which version users prefer
2. **Feedback Collection**: Built-in feedback mechanisms
3. **Analytics**: Separate tracking for beta usage
4. **Easy Rollback**: Simply remove beta directory if needed
5. **Gradual Rollout**: Can enable for percentage of users

## Deployment Steps

1. **Current Setup** (Completed):
   ```bash
   forms/
   ├── memorial-garden.html          # Current production form
   ├── memorial-garden-beta-banner.js # Optional beta invitation
   └── beta/
       ├── index.html               # Beta landing page
       └── memorial-garden-adaptive/ # New adaptive system
   ```

2. **To Enable Beta Banner**:
   Add to memorial-garden.html before closing </body>:
   ```html
   <!-- Beta testing invitation - remove when beta ends -->
   <script src="memorial-garden-beta-banner.js"></script>
   ```

3. **To Track Beta Performance**:
   Monitor these metrics:
   - Completion rates (beta vs current)
   - Time to complete
   - Drop-off points
   - User feedback
   - Error rates

## Gradual Rollout Strategy

### Phase 1: Soft Launch (Current)
- Direct URLs only
- Staff and volunteer testing

### Phase 2: Banner Invitation (Next)
- Add banner to 10% of users
- Monitor feedback and metrics

### Phase 3: Expanded Beta
- Increase to 50% of users
- A/B test completion rates

### Phase 4: Default Switch
- Make adaptive form default
- Keep current form as "classic" option

### Phase 5: Full Migration
- Retire old form
- Redirect all traffic to new system

## URL Management

No changes needed to production URLs:
- Production: `/forms/memorial-garden.html`
- Beta: `/forms/beta/memorial-garden-adaptive/`

GitHub Pages will automatically serve both.

## Emergency Rollback

If issues arise:
1. Remove beta banner script tag from memorial-garden.html
2. Or delete entire `/forms/beta/` directory
3. No impact on production form

## Monitoring Beta Success

Track these KPIs:
1. **Completion Rate**: Beta vs Current
2. **Time to Complete**: Which is faster?
3. **Support Requests**: Which generates fewer questions?
4. **User Satisfaction**: Feedback scores
5. **Data Quality**: Which produces better data?

## Communication Plan

1. **Internal**: Email staff about beta availability
2. **Select Users**: Invite specific users to test
3. **Soft Public**: Add subtle banner after initial testing
4. **Full Public**: Announce new option in newsletter

This approach ensures zero disruption while allowing real-world testing of the new adaptive system.