#!/usr/bin/env node

/**
 * Bay View Notion Project Management Setup Script
 * 
 * This script provides the structure for creating the project management
 * databases in Notion. Since direct API creation requires proper page IDs,
 * this serves as a reference implementation.
 */

const DATABASE_SCHEMAS = {
  projects: {
    name: "Bay View Projects",
    properties: {
      "Project Name": { type: "title" },
      "Project Code": { type: "formula", formula: "BV-2025-{TYPE}-{NUMBER}" },
      "Status": { 
        type: "select", 
        options: ["Planning", "Active", "On Hold", "Completed", "Cancelled"] 
      },
      "Health": { 
        type: "select", 
        options: ["🟢 Green", "🟡 Yellow", "🔴 Red"] 
      },
      "Priority": { 
        type: "select", 
        options: ["P0-Critical", "P1-High", "P2-Medium", "P3-Low"] 
      },
      "Type": { 
        type: "multi_select", 
        options: ["Backend", "Database", "API", "Migration", "Infrastructure", "Integration", "Security"] 
      },
      "Phase": { 
        type: "select", 
        options: [
          "Phase 1-Foundation", 
          "Phase 2A-Property", 
          "Phase 2B-Events", 
          "Phase 2C-Comms", 
          "Phase 2D-Governance", 
          "Phase 3-Analytics", 
          "Phase 4-Portal"
        ] 
      },
      "Start Date": { type: "date" },
      "End Date": { type: "date" },
      "Duration": { type: "formula", formula: "dateBetween(End Date, Start Date, 'days')" },
      "Progress": { type: "rollup" },
      "Owner": { type: "people" },
      "Stakeholders": { type: "people" },
      "Budget": { type: "number", format: "dollar" },
      "Actual Spend": { type: "rollup" },
      "Description": { type: "rich_text" },
      "Success Criteria": { type: "rich_text" },
      "GitHub Repo": { type: "url" },
      "Documentation": { type: "files" },
      "Related Systems": { 
        type: "multi_select", 
        options: ["Chapel", "Memorial", "Property", "Finance", "Events", "Communications"] 
      }
    }
  },

  milestones: {
    name: "Bay View Milestones",
    properties: {
      "Milestone Name": { type: "title" },
      "Milestone Code": { type: "formula" },
      "Project": { type: "relation", database: "Bay View Projects" },
      "Due Date": { type: "date" },
      "Status": { 
        type: "select", 
        options: ["Not Started", "In Progress", "Complete", "At Risk", "Delayed"] 
      },
      "Dependencies": { type: "relation", self: true },
      "Owner": { type: "people" },
      "Completion Criteria": { type: "rich_text" },
      "Impact if Missed": { 
        type: "select", 
        options: ["Critical-System Down", "High-Feature Delay", "Medium-Performance", "Low-Polish"] 
      },
      "System Component": { 
        type: "multi_select", 
        options: ["Database", "API", "Frontend", "Integration", "Configuration"] 
      },
      "Progress": { type: "rollup" },
      "Notes": { type: "rich_text" }
    }
  },

  tasks: {
    name: "Bay View Development Tasks",
    properties: {
      "Task Name": { type: "title" },
      "Task ID": { type: "formula" },
      "Project": { type: "relation", database: "Bay View Projects" },
      "Milestone": { type: "relation", database: "Bay View Milestones" },
      "Sprint": { type: "relation", database: "Bay View Development Sprints" },
      "Status": { 
        type: "select", 
        options: ["Backlog", "To Do", "In Progress", "Code Review", "Testing", "Done", "Blocked"] 
      },
      "Priority": { 
        type: "select", 
        options: ["P0-Critical", "P1-High", "P2-Medium", "P3-Low"] 
      },
      "Story Points": { type: "number" },
      "Type": { 
        type: "select", 
        options: ["Feature", "Bug", "Technical Debt", "Migration", "Configuration", "Documentation"] 
      },
      "Component": { 
        type: "multi_select", 
        options: ["Chapel API", "Memorial API", "Core Database", "Config System", "Dual-Write", "Forms"] 
      },
      "Assignee": { type: "people" },
      "Reviewer": { type: "people" },
      "Start Date": { type: "date" },
      "Due Date": { type: "date" },
      "Estimated Hours": { type: "number" },
      "Actual Hours": { type: "number" },
      "Progress": { 
        type: "select", 
        options: ["0%", "25%", "50%", "75%", "100%"] 
      },
      "Dependencies": { type: "relation", self: true },
      "Blockers": { type: "relation", database: "Bay View Technical Blockers" },
      "GitHub Issue": { type: "url" },
      "PR Link": { type: "url" },
      "Test Coverage": { type: "checkbox" },
      "Migration Safe": { type: "checkbox" },
      "Tags": { 
        type: "multi_select", 
        options: ["urgent", "security", "performance", "data-integrity", "user-facing"] 
      },
      "Acceptance Criteria": { type: "rich_text" },
      "Technical Notes": { type: "rich_text" }
    }
  },

  blockers: {
    name: "Bay View Technical Blockers",
    properties: {
      "Blocker Title": { type: "title" },
      "Blocker ID": { type: "formula" },
      "Type": { 
        type: "select", 
        options: ["Technical", "Resource", "External", "Process", "Data", "Integration"] 
      },
      "Severity": { 
        type: "select", 
        options: [
          "🔴 Critical-System Down", 
          "🟠 High-Feature Blocked", 
          "🟡 Medium-Workaround Exists", 
          "🟢 Low-Minor Impact"
        ] 
      },
      "Status": { 
        type: "select", 
        options: ["Active", "Mitigating", "Monitoring", "Resolved", "Accepted"] 
      },
      "Component Affected": { 
        type: "multi_select", 
        options: ["Database", "API", "Notion Integration", "Vercel", "GitHub Pages", "Payment System"] 
      },
      "Blocked Items": { type: "relation", database: "Bay View Development Tasks" },
      "Projects Affected": { type: "relation", database: "Bay View Projects" },
      "Owner": { type: "people" },
      "Identified By": { type: "people" },
      "Identified Date": { type: "date" },
      "Target Resolution": { type: "date" },
      "Resolution Date": { type: "date" },
      "Mitigation Plan": { type: "rich_text" },
      "Impact Description": { type: "rich_text" },
      "Resolution Notes": { type: "rich_text" },
      "Lessons Learned": { type: "rich_text" },
      "Cost Impact": { type: "number", format: "dollar" },
      "Time Impact (days)": { type: "number" }
    }
  },

  resources: {
    name: "Bay View Development Resources",
    properties: {
      "Resource Name": { type: "title" },
      "Type": { 
        type: "select", 
        options: ["Developer", "DBA", "DevOps", "QA", "Director", "External"] 
      },
      "Skills": { 
        type: "multi_select", 
        options: ["PostgreSQL", "Node.js", "Vercel", "Notion API", "System Architecture", "Migration"] 
      },
      "Availability %": { type: "number" },
      "Current Projects": { type: "relation", database: "Bay View Projects" },
      "Current Tasks": { type: "relation", database: "Bay View Development Tasks" },
      "Capacity": { type: "formula", formula: "40 * (Availability % / 100)" },
      "Allocated Hours": { type: "rollup" },
      "Utilization": { type: "formula", formula: "(Allocated Hours / Capacity) * 100" },
      "Cost Rate": { type: "number", format: "dollar" },
      "Department": { 
        type: "select", 
        options: ["IT", "Operations", "Program", "External"] 
      },
      "Bay View Role": { type: "rich_text" },
      "Contact": { type: "email" },
      "Time Zone": { 
        type: "select", 
        options: ["EST", "CST", "MST", "PST"] 
      }
    }
  },

  sprints: {
    name: "Bay View Development Sprints",
    properties: {
      "Sprint Name": { type: "title" },
      "Sprint Number": { type: "formula", formula: "S2025-{NUMBER}" },
      "Project": { type: "relation", database: "Bay View Projects" },
      "Start Date": { type: "date" },
      "End Date": { type: "date" },
      "Sprint Goals": { type: "rich_text" },
      "Tasks": { type: "relation", database: "Bay View Development Tasks" },
      "Total Points": { type: "rollup" },
      "Completed Points": { type: "rollup" },
      "Velocity": { type: "formula" },
      "Focus Areas": { 
        type: "multi_select", 
        options: ["Database Migration", "API Development", "Testing", "Documentation", "Configuration"] 
      },
      "Retrospective Notes": { type: "rich_text" },
      "Demo Recording": { type: "files" },
      "Sprint Status": { 
        type: "select", 
        options: ["Planning", "Active", "Review", "Completed"] 
      },
      "Blockers Count": { type: "rollup" }
    }
  }
};

// Sample data for initial setup
const SAMPLE_DATA = {
  projects: [
    {
      "Project Name": "Bay View Unified Database Migration",
      "Status": "Active",
      "Health": "🟢 Green",
      "Priority": "P0-Critical",
      "Type": ["Database", "Migration"],
      "Phase": "Phase 2D-Governance",
      "Start Date": "2025-01-01",
      "End Date": "2025-03-31",
      "Description": "Complete migration from legacy systems to unified PostgreSQL database with dual-write safety",
      "Success Criteria": "All data migrated without loss, dual-write active, zero downtime",
      "Related Systems": ["Chapel", "Memorial", "Property", "Finance"]
    },
    {
      "Project Name": "Chapel Service API v2",
      "Status": "Active",
      "Health": "🟡 Yellow",
      "Priority": "P1-High",
      "Type": ["API", "Backend"],
      "Phase": "Phase 2B-Events",
      "Start Date": "2025-01-15",
      "End Date": "2025-02-28",
      "Description": "Upgrade chapel service submission API to use new unified database",
      "Success Criteria": "New API handles all chapel bookings with improved performance",
      "Related Systems": ["Chapel", "Events"]
    },
    {
      "Project Name": "Runtime Configuration System",
      "Status": "Completed",
      "Health": "🟢 Green",
      "Priority": "P1-High",
      "Type": ["Backend", "Infrastructure"],
      "Phase": "Phase 2D-Governance",
      "Start Date": "2024-12-01",
      "End Date": "2025-01-10",
      "Description": "Implement runtime configuration for all fees, budgets, and settings",
      "Success Criteria": "All hardcoded values moved to config, full audit trail",
      "Related Systems": ["Finance", "Events", "Chapel", "Memorial"]
    }
  ],

  milestones: [
    {
      "Milestone Name": "Legacy Data Migration Complete",
      "Due Date": "2025-02-15",
      "Status": "In Progress",
      "Impact if Missed": "High-Feature Delay",
      "System Component": ["Database"],
      "Completion Criteria": "All legacy data successfully migrated and validated"
    },
    {
      "Milestone Name": "Dual-Write Verified",
      "Due Date": "2025-02-01",
      "Status": "Complete",
      "Impact if Missed": "Critical-System Down",
      "System Component": ["Database", "API"],
      "Completion Criteria": "Both legacy and modern systems receive all writes"
    },
    {
      "Milestone Name": "Chapel API v2 Launch",
      "Due Date": "2025-02-28",
      "Status": "Not Started",
      "Impact if Missed": "Medium-Performance",
      "System Component": ["API"],
      "Completion Criteria": "New API live and handling all chapel requests"
    }
  ],

  tasks: [
    {
      "Task Name": "Create migration script for memorial garden data",
      "Status": "Done",
      "Priority": "P0-Critical",
      "Type": "Migration",
      "Component": ["Core Database", "Memorial API"],
      "Story Points": 5,
      "Progress": "100%",
      "Test Coverage": true,
      "Migration Safe": true
    },
    {
      "Task Name": "Implement dual-write manager for chapel services",
      "Status": "In Progress",
      "Priority": "P0-Critical",
      "Type": "Feature",
      "Component": ["Chapel API", "Dual-Write"],
      "Story Points": 8,
      "Progress": "75%",
      "Test Coverage": true,
      "Migration Safe": true
    },
    {
      "Task Name": "Add payment provider configuration to config system",
      "Status": "To Do",
      "Priority": "P1-High",
      "Type": "Configuration",
      "Component": ["Config System"],
      "Story Points": 3,
      "Progress": "0%"
    }
  ],

  blockers: [
    {
      "Blocker Title": "Notion API rate limits during bulk migration",
      "Type": "External",
      "Severity": "🟡 Medium-Workaround Exists",
      "Status": "Mitigating",
      "Component Affected": ["Notion Integration"],
      "Identified Date": "2025-01-15",
      "Target Resolution": "2025-01-25",
      "Mitigation Plan": "Implement request queuing and retry logic with exponential backoff",
      "Impact Description": "Slows down bulk data operations but doesn't block development"
    },
    {
      "Blocker Title": "Legacy database column type mismatch",
      "Type": "Technical",
      "Severity": "🔴 Critical-System Down",
      "Status": "Resolved",
      "Component Affected": ["Database"],
      "Identified Date": "2025-01-10",
      "Resolution Date": "2025-01-12",
      "Resolution Notes": "Added type conversion in migration scripts",
      "Lessons Learned": "Always verify column types before migration"
    }
  ]
};

// View configurations
const VIEWS = {
  projects: {
    "Portfolio Overview": {
      type: "gallery",
      groupBy: "Status",
      sortBy: "Priority",
      cards: ["Health", "Phase", "Progress", "Owner"]
    },
    "Project Timeline": {
      type: "timeline",
      dateProperty: ["Start Date", "End Date"],
      groupBy: "Phase"
    },
    "Active Projects": {
      type: "table",
      filter: { Status: "Active" },
      sort: [{ Priority: "ascending" }]
    }
  },

  tasks: {
    "Sprint Board": {
      type: "board",
      groupBy: "Status",
      cardProperties: ["Priority", "Assignee", "Story Points", "Component"]
    },
    "My Tasks": {
      type: "table",
      filter: { Assignee: "@me" },
      sort: [{ Priority: "ascending" }, { Due Date: "ascending" }]
    },
    "Blocked Items": {
      type: "table",
      filter: { Status: "Blocked" },
      properties: ["Blockers", "Priority", "Assignee"]
    }
  },

  blockers: {
    "Risk Matrix": {
      type: "board",
      groupBy: "Severity",
      cardProperties: ["Status", "Component Affected", "Owner", "Target Resolution"]
    },
    "Active Blockers": {
      type: "table",
      filter: { Status: ["Active", "Mitigating"] },
      sort: [{ Severity: "ascending" }]
    }
  }
};

console.log('Bay View Notion Project Management Structure');
console.log('==========================================\n');

console.log('Database Schemas:');
console.log(JSON.stringify(DATABASE_SCHEMAS, null, 2));

console.log('\n\nSample Data:');
console.log(JSON.stringify(SAMPLE_DATA, null, 2));

console.log('\n\nView Configurations:');
console.log(JSON.stringify(VIEWS, null, 2));

console.log('\n\nTo implement in Notion:');
console.log('1. Create each database manually in Notion');
console.log('2. Add properties according to the schemas above');
console.log('3. Set up relationships between databases');
console.log('4. Import sample data');
console.log('5. Create views as specified');
console.log('\nSee docs/notion-project-management-framework.md for full details');