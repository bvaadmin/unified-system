# Bay View Association Administrative System

A unified administrative system for managing chapel services, memorial garden applications, and forms for Bay View Association - a National Historic Landmark in Petoskey, Michigan.

## Features

- **Chapel Service Management**
  - Wedding and memorial/funeral service applications
  - Real-time availability checking with conflict prevention
  - Clergy approval workflow
  - Automated fee calculations based on membership
  - Calendar view of scheduled services

- **Memorial Garden Applications**
  - Online submission forms
  - Dual storage in PostgreSQL and Notion
  - Historical record preservation
  - Fee tracking and management

- **Forms Registry**
  - Management of 48 different Bay View forms
  - Organized across 8 categories
  - Metadata tracking and search capabilities

## Tech Stack

- **Backend**: Node.js with Vercel Serverless Functions
- **Database**: PostgreSQL (hosted on DigitalOcean)
- **Workflow**: Notion API integration
- **Frontend**: Static HTML forms deployed via GitHub Pages
- **Deployment**: Vercel

## 🚨 IMPORTANT: API Architecture

**Before adding ANY new API endpoints, you MUST read [API-ARCHITECTURE.md](./API-ARCHITECTURE.md)**

We use a unified API pattern due to Vercel's 12-function limit. All endpoints go through `/api/index.js`.

## Getting Started

### Prerequisites

- Node.js 18.0.0 or higher
- PostgreSQL database
- Notion account with API access
- Vercel account for deployment

### Installation

1. Clone the repository:
```bash
git clone https://github.com/bvaadmin/bvaadmin.git
cd bvaadmin
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your database and API credentials
```

### Environment Variables

- `DATABASE_URL` - PostgreSQL connection string with SSL
- `DATABASE_URL_CLEAN` - PostgreSQL connection without SSL params
- `NOTION_API_KEY` - Notion integration API key
- `CHAPEL_NOTION_DB_ID` - Chapel services Notion database ID
- `MEMORIAL_NOTION_DB_ID` - Memorial garden Notion database ID
- `ADMIN_TOKEN` - Admin authentication token

### Development

Start the Vercel development server:
```bash
npm run dev
```

### Database Setup

Initialize the database schemas:
```bash
npm run init-chapel-db    # Chapel service tables
npm run init-forms-db     # Forms registry tables
npm run init-memorial-db  # Memorial garden tables
```

Test database connection:
```bash
npm run test-connection
```

## API Endpoints

### Chapel Services
- `POST /api/chapel/submit-service` - Submit new chapel service application
- `GET /api/chapel/check-availability` - Check chapel availability
- `GET /api/chapel/get-applications` - Retrieve applications with filters
- `PUT /api/chapel/update-application` - Update application status
- `GET /api/chapel/calendar` - Get calendar view

### Memorial Garden
- `POST /api/memorial/submit-garden` - Submit memorial garden application

### Admin
- `POST /api/admin/db-init` - Initialize database (requires auth)
- `GET /api/test-db` - Test database connectivity

## Project Structure

```
bvaadmin/
├── api/              # Vercel serverless functions
│   ├── chapel/       # Chapel service endpoints
│   ├── memorial/     # Memorial garden endpoints
│   └── admin/        # Administrative endpoints
├── scripts/          # Database and utility scripts
│   ├── chapel/       # Chapel database scripts
│   ├── forms/        # Forms management scripts
│   └── memorial/     # Memorial garden scripts
├── lib/              # Shared utility modules
├── forms/            # Static HTML forms
├── docs/             # Documentation
└── data/             # Static data files
```

## Deployment

Deploy to Vercel:
```bash
npm run deploy
```

The system includes:
- Automatic API deployment to Vercel
- Static forms deployment to GitHub Pages
- PostgreSQL database with automated backups on DigitalOcean

## Security

- CORS enabled for specific origins
- Admin endpoints protected by Bearer token authentication
- SSL/TLS required for all database connections
- Environment variables for sensitive configuration

## Contributing

This is a private repository for Bay View Association. For questions or issues, please contact the Bay View administration.

## License

UNLICENSED - This is proprietary software for Bay View Association.# Trigger deployment
