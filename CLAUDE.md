# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the Bay View Association administrative system, managing chapel services and memorial garden applications for a National Historic Landmark in Petoskey, Michigan. The system uses PostgreSQL for data storage and Notion for workflow management, with APIs deployed on Vercel.

## Repository Structure (Unified)

- **api/** - All Vercel serverless functions
  - **chapel/** - Chapel service endpoints (check-availability, get-applications, submit-service, update-application, calendar)
  - **memorial/** - Memorial garden endpoints (submit-garden)
  - **admin/** - Administrative endpoints (db-init)
  - **test-db.js** - Database connectivity test
- **scripts/** - Database and utility scripts
  - **chapel/** - Chapel database initialization and testing
  - **forms/** - Forms database management
  - **memorial/** - Memorial garden database scripts
- **lib/** - Shared utility modules
  - **db.js** - Database connection helpers
  - **cors.js** - CORS configuration and middleware
  - **notion.js** - Notion API helpers
- **forms/** - Static HTML forms deployed via GitHub Pages
- **docs/** - Documentation files
- **data/** - Static data files

## API Endpoints & Implementation Details

### Memorial Garden Submission API
- **Endpoint**: `/api/memorial/submit-garden.js` (legacy: `/api/submit-memorial-garden`)
- **Method**: POST
- **CORS Origins**: `https://bvaadmin.github.io`, `https://vercel.com`, `http://localhost:3000`, `http://127.0.0.1:5500`
- **Dual Storage**: PostgreSQL (primary) + Notion (workflow management)
- **Response Format**:
  ```json
  {
    "success": true,
    "submissionId": "string",
    "notionId": "string", 
    "notionUrl": "string",
    "pgId": number,
    "message": "Successfully saved to both databases | Saved to Notion only",
    "syncStatus": "complete | partial"
  }
  ```
- **Error Responses**: 
  - 405: Method not allowed
  - 500: Missing configuration or internal server error

### Chapel Service Submission API
- **Endpoint**: `/api/chapel/submit-service.js` (legacy: `/api/submit-chapel-service`)
- **Method**: POST
- **Supported Forms**: `wedding`, `memorial-funeral-service`
- **Transaction-based**: All database operations wrapped in single transaction
- **Response Format**:
  ```json
  {
    "success": true,
    "applicationId": number,
    "submissionDate": "timestamp",
    "message": "Application submitted successfully",
    "nextSteps": [
      "Your application will be reviewed by the Director of Worship",
      "You will be contacted within 2-3 business days",
      "Full payment is required to secure your date",
      "Clergy must be approved before the service"
    ]
  }
  ```

### Additional Chapel Endpoints
1. **Check Chapel Availability**
   - Endpoint: `/api/chapel/check-availability` (legacy: `/api/check-chapel-availability`)
   - Method: GET
   - Query params: `date`, `time` (required)
   - Returns: availability status, existing bookings, suggested times

2. **Get Chapel Applications**
   - Endpoint: `/api/chapel/get-applications` (legacy: `/api/get-chapel-applications`)
   - Method: GET
   - Query params: `type`, `status`, `startDate`, `endDate`, `applicationId`
   - Returns: filtered list with full application details

3. **Update Chapel Application**
   - Endpoint: `/api/chapel/update-application` (legacy: `/api/update-chapel-application`)
   - Method: PUT
   - Query param: `applicationId` (required)
   - Body: status updates, approval info, payment details, altar guild notification

4. **Chapel Calendar View**
   - Endpoint: `/api/chapel/calendar` (legacy: `/api/chapel-calendar`)
   - Method: GET
   - Query params: `month`, `year`
   - Returns: events array and blackout dates

### Database Test Endpoint
- **Endpoint**: `/api/test-db.js`
- **Method**: GET
- **Purpose**: Verify database connectivity and configuration

### Admin Database Initialization
- **Endpoint**: `/api/admin/db-init` (legacy: `/api/db-init`)
- **Method**: POST
- **Auth Required**: `Authorization: Bearer ${ADMIN_TOKEN}`
- **Purpose**: Initialize database schema

## Database Schemas

### Memorial Garden Schema (`bayview.memorials`)
```sql
- id SERIAL PRIMARY KEY
- submission_id VARCHAR(50)
- first_name, last_name, middle_name, maiden_name VARCHAR(100)
- birth_date, death_date DATE
- birth_place, home_address, bayview_address TEXT
- mother_name, father_name VARCHAR(200)
- message, bayview_history TEXT
- application_type VARCHAR(50)
- is_member BOOLEAN
- member_name, member_relationship VARCHAR(200)
- contact_name, contact_email, contact_phone, contact_address
- service_date DATE, celebrant_requested VARCHAR(100)
- fee_amount DECIMAL(10,2)
- notion_id VARCHAR(100) -- for sync tracking
- created_at, updated_at TIMESTAMP WITH TIME ZONE
```

### Chapel Service Schema (`crouse_chapel.*`)
Core tables:
- **service_applications** - Main application data with unique constraint on service_date + service_time
- **wedding_details** - Wedding-specific (couple_names, guest_count, bride_arrival_time, wedding_fee)
- **memorial_details** - Memorial/funeral (deceased_name, memorial_garden_placement)
- **clergy** - Registry with approval workflow
- **service_clergy** - Links services to clergy (many-to-many)
- **service_music** - Music requirements and chair setup
- **service_musicians** - Individual musicians list
- **service_equipment** - Equipment needs (microphones, communion, roped seating)
- **policy_acknowledgments** - Tracks policy agreement by type
- **chapel_availability** - Calendar availability tracking
- **blackout_dates** - Chapel closed dates
- **notifications** - Notification log for tracking communications

### Form Registry Schema (`bayview_forms.forms`)
Tracks all 48 Bay View forms with metadata, categories, and GitHub URLs.

## Environment Variables
```bash
DATABASE_URL          # PostgreSQL connection with ?sslmode=require
DATABASE_URL_CLEAN    # PostgreSQL connection without SSL params
NOTION_API_KEY        # Notion integration key
CHAPEL_NOTION_DB_ID   # Chapel services Notion database ID
MEMORIAL_NOTION_DB_ID # Memorial garden Notion database ID (hardcoded: e438c3bd041a4977baacde59ea4cc1e7)
ADMIN_TOKEN           # Admin authentication token
```

## Security & Configuration

### CORS Configuration
All endpoints implement CORS with:
- Allowed origins whitelist (GitHub Pages, Vercel, localhost)
- Support for preflight OPTIONS requests
- Allowed headers: `Content-Type`
- Allowed methods: `POST, OPTIONS` (GET for read endpoints)

### Database Connection Pattern
```javascript
const pgClient = new Client({
  connectionString: DATABASE_URL.replace('?sslmode=require', ''),
  ssl: { rejectUnauthorized: false }
});
```

### Authentication
- Admin endpoints require: `Authorization: Bearer ${ADMIN_TOKEN}`
- Currently only `/api/db-init` uses authentication
- No user authentication implemented (forms are public)

### Rate Limiting & Timeouts
- Vercel function timeout: `maxDuration: 10` seconds (configured in vercel.json)
- No application-level rate limiting
- PostgreSQL connection pooling defaults apply

## Error Response Standards
```javascript
// Success
res.status(200).json({ success: true, ...data })

// Client errors
res.status(400).json({ error: 'Invalid form type' })
res.status(401).json({ error: 'Unauthorized' })
res.status(405).json({ error: 'Method not allowed' })

// Server errors
res.status(500).json({ 
  error: 'Internal server error',
  message: error.message,
  details: {} // optional additional context
})
```

## Data Validation & Business Rules

### Chapel Services
- Form types must be: `wedding` or `memorial-funeral-service`
- Service date/time uniqueness enforced by database constraint
- Availability checking includes blackout dates
- Wedding fees: $300 (members) / $750 (non-members)
- All services require Bay View member sponsorship

### Memorial Garden
- Personal history stored as JSON in single field
- Fee amount tracked for payment processing
- Policy agreement must be acknowledged
- Supports both member and non-member applications

### Clergy Management
- Approval status: `pending`, `approved`, `rejected`
- New clergy automatically created if not in registry
- Approval tracked with approver name and date

## Notion Integration Details
- API Version: `2022-06-28`
- Authentication: Bearer token in headers
- Database IDs stored in environment variables
- Field mapping:
  - title → Main identifier field
  - rich_text → Text fields
  - date → Date fields with start/end
  - select → Single choice fields
  - number → Numeric fields
  - checkbox → Boolean fields
  - email → Email fields
  - phone_number → Phone fields
- Bidirectional sync: PostgreSQL ID → Notion, Notion ID → PostgreSQL

## Special Implementation Features

### Transaction Management
Chapel submissions use database transactions to ensure data consistency:
```javascript
await pgClient.query('BEGIN');
// ... multiple operations ...
await pgClient.query('COMMIT');
// Error handling with ROLLBACK
```

### Availability Checking
- Function: `crouse_chapel.is_chapel_available(date, time)`
- Checks both blackout dates and existing bookings
- Suggests alternative times based on 2-hour buffer

### Notification System
- Database table tracks all notifications
- Prepared for email integration (not implemented)
- Altar Guild notification on approval

### Date/Time Handling
- All timestamps stored with timezone
- Service times stored as TIME type
- Automatic updated_at trigger on all tables

## Common Development Commands

### Database Operations
```bash
# Test database connection
npm run test-connection

# Initialize database schemas
npm run init-chapel-db    # Chapel service tables
npm run init-forms-db     # Forms registry tables
npm run init-memorial-db  # Memorial garden tables

# Test submissions
npm run test-chapel-submission
npm run test-memorial-submission
```

### API Development
```bash
# Start Vercel development server
npm run dev

# Deploy to Vercel
npm run deploy
```

### Forms Database Management
```bash
# Insert all forms data
npm run insert-forms

# List all forms
npm run list-forms

# Check for duplicates
npm run check-duplicates

# Generate forms summary
npm run forms-summary
```

## Architecture Patterns

### Shared Utilities
The `lib/` directory contains reusable modules:
- **db.js** - `createPgClient()`, `withDatabase()`, `withTransaction()` for database operations
- **cors.js** - `applyCors()`, `withCors()` for consistent CORS handling
- **notion.js** - `createNotionPage()`, `toNotionProperty()` for Notion API integration

### Dual Storage Pattern
All submissions are stored in both PostgreSQL (for queries/constraints) and Notion (for workflow management). When implementing new features, ensure data is saved to both systems.

### Database Schemas
- **bayview** schema - Memorial garden and forms management
- **crouse_chapel** schema - Chapel service applications

### API Structure
- Vercel serverless functions in `/api` directories
- CORS enabled for all endpoints
- Admin endpoints protected by token authentication
- Consistent error handling with detailed error messages

### Constraint Management
Chapel scheduling uses PostgreSQL constraints to prevent double-booking. The system checks for overlapping events considering setup/cleanup times.

## Key Implementation Details

1. **SSL/TLS Required**: All database connections must use SSL encryption
2. **Error Handling**: Always include try-catch blocks with detailed error logging
3. **Notion Integration**: Page creation in Notion includes all form fields as properties
4. **Date Handling**: Chapel events check for date/time conflicts including buffer periods
5. **Fee Calculation**: Automated based on membership status for chapel services

## Testing Approach

No formal test framework is used. Testing is done through:
- Custom test scripts (test-submission.js, test-connection.js)
- Direct database queries for verification
- Manual testing of API endpoints

## Deployment

- APIs deployed automatically via Vercel
- Forms deployed via GitHub Pages on push to main
- Database hosted on DigitalOcean with automated backups

## Important Considerations

1. This system manages real church operations - handle data carefully
2. Memorial garden records are permanent historical records
3. Chapel scheduling affects real events and people
4. All personal information must be handled securely
5. Dual storage ensures data redundancy and workflow integration

## Form HTML Structure
Forms are located in `/forms/` directory:
- `memorial-garden.html` - Memorial garden application
- `memorial-garden-test.html` - Test version
- Forms use standard HTML with JavaScript fetch() for API submission
- Styled with inline CSS for self-contained deployment

## SSH Shared Workspace Configuration
- **Remote Host**: sam@macbook.local
- **SSH Authentication**: Key-based (already configured)
- **Shared Directory**: ~/SharedWorkspace/ (on both machines)

## Available Scripts
1. **~/sync-workspace.sh** - Rsync-based file synchronization
   - `push` - Send local changes to macbook.local
   - `pull` - Get changes from macbook.local
   - `sync` - Bidirectional sync

2. **~/mount-workspace.sh** - SSHFS mounting (requires: brew install macfuse sshfs)
   - `mount` - Mount remote at ~/RemoteWorkspace
   - `unmount` - Unmount remote workspace
   - `status` - Check mount status

## Quick Commands
```bash
# Push files to remote
~/sync-workspace.sh push

# Pull files from remote
~/sync-workspace.sh pull

# Bidirectional sync
~/sync-workspace.sh sync
```