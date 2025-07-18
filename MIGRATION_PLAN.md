# Bay View Admin Repository Consolidation Plan

## New Unified Structure

```
bvaadmin/
├── api/                          # All Vercel serverless functions
│   ├── chapel/
│   │   ├── check-availability.js
│   │   ├── get-applications.js
│   │   ├── submit-service.js
│   │   ├── update-application.js
│   │   └── calendar.js
│   ├── memorial/
│   │   └── submit-garden.js
│   ├── admin/
│   │   └── db-init.js
│   └── test-db.js
├── scripts/                      # All database and utility scripts
│   ├── chapel/
│   │   ├── init-database.js
│   │   ├── test-submission.js
│   │   └── test-pg-direct.js
│   ├── forms/
│   │   ├── init-database.js
│   │   ├── insert-all-forms.js
│   │   ├── list-all-forms.js
│   │   ├── add-missing-forms.js
│   │   ├── check-duplicates.js
│   │   ├── forms-summary.js
│   │   └── test-connection.js
│   └── memorial/
│       ├── init-database.js
│       ├── test-submission.js
│       └── test-pg-direct.js
├── forms/                        # HTML forms (already consolidated)
│   ├── memorial-garden.html
│   ├── memorial-garden-test.html
│   └── _wip/
├── docs/                         # Documentation
│   ├── API.md
│   ├── DATABASE.md
│   └── DEPLOYMENT.md
├── lib/                          # Shared utilities
│   ├── db.js                     # Database connection helper
│   ├── notion.js                 # Notion integration
│   └── cors.js                   # CORS configuration
├── data/                         # Static data files
│   └── forms-data.json
├── .env.example
├── .gitignore
├── package.json
├── vercel.json
├── README.md
└── CLAUDE.md
```

## Migration Steps

1. **Create new directory structure**
2. **Consolidate package.json dependencies**
3. **Move and rename API endpoints**
4. **Consolidate database scripts**
5. **Create shared utility modules**
6. **Update import paths**
7. **Test all functionality**
8. **Update documentation**

## Dependency Consolidation

All projects use minimal dependencies:
- `pg`: ^8.11.3 (production)
- `node-fetch`: ^3.3.2 (dev only, for testing)

## Benefits of Consolidation

1. **Single deployment** - One Vercel project instead of multiple
2. **Shared utilities** - Reusable database and CORS code
3. **Unified configuration** - Single .env file
4. **Easier maintenance** - All code in one place
5. **Better organization** - Clear separation of concerns