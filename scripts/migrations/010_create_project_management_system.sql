-- Migration 010: Create Project Management System
-- Standalone database for tracking Bay View digital transformation projects
-- Separate from operational BVA database for clean separation of concerns

-- Create project management schema
CREATE SCHEMA IF NOT EXISTS project_mgmt;

-- Enable UUID extension for unique identifiers
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- CORE TABLES
-- =====================================================

-- Projects: Master tracking for all initiatives
CREATE TABLE project_mgmt.projects (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    project_code VARCHAR(50) UNIQUE NOT NULL, -- BV-2025-TYPE-NUMBER format
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Planning',
    health VARCHAR(50) DEFAULT '🟢 Green',
    priority VARCHAR(20) NOT NULL DEFAULT 'P2-Medium',
    phase VARCHAR(50) NOT NULL,
    project_type TEXT[] DEFAULT '{}', -- Array for multiple types
    related_systems TEXT[] DEFAULT '{}', -- Chapel, Memorial, etc.
    
    -- Dates and duration
    start_date DATE,
    end_date DATE,
    actual_start DATE,
    actual_end DATE,
    
    -- People
    owner_id INTEGER,
    created_by INTEGER NOT NULL,
    
    -- Details
    description TEXT,
    success_criteria TEXT,
    budget DECIMAL(10,2),
    actual_spend DECIMAL(10,2) DEFAULT 0,
    
    -- External links
    github_repo VARCHAR(255),
    documentation_url VARCHAR(255),
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_archived BOOLEAN DEFAULT FALSE,
    
    CONSTRAINT valid_status CHECK (status IN ('Planning', 'Active', 'On Hold', 'Completed', 'Cancelled')),
    CONSTRAINT valid_health CHECK (health IN ('🟢 Green', '🟡 Yellow', '🔴 Red')),
    CONSTRAINT valid_priority CHECK (priority IN ('P0-Critical', 'P1-High', 'P2-Medium', 'P3-Low')),
    CONSTRAINT valid_dates CHECK (end_date >= start_date)
);

-- Milestones: Major checkpoints
CREATE TABLE project_mgmt.milestones (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    milestone_code VARCHAR(50) UNIQUE NOT NULL,
    project_id INTEGER NOT NULL REFERENCES project_mgmt.projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    due_date DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Not Started',
    impact_if_missed VARCHAR(50) NOT NULL,
    
    -- People
    owner_id INTEGER,
    
    -- Details
    completion_criteria TEXT,
    system_components TEXT[] DEFAULT '{}',
    deliverables TEXT[] DEFAULT '{}',
    notes TEXT,
    
    -- Actual completion
    completed_date DATE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_milestone_status CHECK (status IN ('Not Started', 'In Progress', 'Complete', 'At Risk', 'Delayed')),
    CONSTRAINT valid_impact CHECK (impact_if_missed IN ('Critical-System Down', 'High-Feature Delay', 'Medium-Performance', 'Low-Polish'))
);

-- Tasks: Granular work items
CREATE TABLE project_mgmt.tasks (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    task_id VARCHAR(50) UNIQUE NOT NULL,
    project_id INTEGER REFERENCES project_mgmt.projects(id) ON DELETE CASCADE,
    milestone_id INTEGER REFERENCES project_mgmt.milestones(id) ON DELETE SET NULL,
    sprint_id INTEGER, -- Will reference sprints table
    
    -- Core fields
    name VARCHAR(500) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Backlog',
    priority VARCHAR(20) NOT NULL DEFAULT 'P2-Medium',
    task_type VARCHAR(50) NOT NULL DEFAULT 'Feature',
    story_points INTEGER,
    
    -- Components and tags
    components TEXT[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    
    -- People
    assignee_id INTEGER,
    reviewer_id INTEGER,
    created_by INTEGER NOT NULL,
    
    -- Dates
    start_date DATE,
    due_date DATE,
    completed_date DATE,
    
    -- Effort tracking
    estimated_hours DECIMAL(5,2),
    actual_hours DECIMAL(5,2),
    progress INTEGER DEFAULT 0,
    
    -- External links
    github_issue_url VARCHAR(255),
    pr_url VARCHAR(255),
    
    -- Quality gates
    test_coverage BOOLEAN DEFAULT FALSE,
    migration_safe BOOLEAN DEFAULT FALSE,
    code_reviewed BOOLEAN DEFAULT FALSE,
    
    -- Details
    acceptance_criteria TEXT,
    technical_notes TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_archived BOOLEAN DEFAULT FALSE,
    
    CONSTRAINT valid_task_status CHECK (status IN ('Backlog', 'To Do', 'In Progress', 'Code Review', 'Testing', 'Done', 'Blocked')),
    CONSTRAINT valid_task_priority CHECK (priority IN ('P0-Critical', 'P1-High', 'P2-Medium', 'P3-Low')),
    CONSTRAINT valid_task_type CHECK (task_type IN ('Feature', 'Bug', 'Technical Debt', 'Migration', 'Configuration', 'Documentation')),
    CONSTRAINT valid_progress CHECK (progress >= 0 AND progress <= 100)
);

-- Task Dependencies
CREATE TABLE project_mgmt.task_dependencies (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES project_mgmt.tasks(id) ON DELETE CASCADE,
    depends_on_task_id INTEGER NOT NULL REFERENCES project_mgmt.tasks(id) ON DELETE CASCADE,
    dependency_type VARCHAR(50) DEFAULT 'finish_to_start',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT no_self_dependency CHECK (task_id != depends_on_task_id),
    CONSTRAINT unique_dependency UNIQUE (task_id, depends_on_task_id),
    CONSTRAINT valid_dependency_type CHECK (dependency_type IN ('finish_to_start', 'start_to_start', 'finish_to_finish', 'start_to_finish'))
);

-- Blockers: Issues preventing progress
CREATE TABLE project_mgmt.blockers (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    blocker_id VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    blocker_type VARCHAR(50) NOT NULL,
    severity VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Active',
    
    -- What's affected
    components_affected TEXT[] DEFAULT '{}',
    
    -- People
    owner_id INTEGER,
    identified_by INTEGER NOT NULL,
    
    -- Dates
    identified_date DATE NOT NULL DEFAULT CURRENT_DATE,
    target_resolution DATE,
    resolution_date DATE,
    
    -- Impact
    cost_impact DECIMAL(10,2),
    time_impact_days INTEGER,
    
    -- Details
    impact_description TEXT,
    mitigation_plan TEXT,
    resolution_notes TEXT,
    lessons_learned TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_blocker_type CHECK (blocker_type IN ('Technical', 'Resource', 'External', 'Process', 'Data', 'Integration')),
    CONSTRAINT valid_severity CHECK (severity IN ('🔴 Critical-System Down', '🟠 High-Feature Blocked', '🟡 Medium-Workaround Exists', '🟢 Low-Minor Impact')),
    CONSTRAINT valid_blocker_status CHECK (status IN ('Active', 'Mitigating', 'Monitoring', 'Resolved', 'Accepted'))
);

-- Blocker relationships
CREATE TABLE project_mgmt.blocker_relationships (
    id SERIAL PRIMARY KEY,
    blocker_id INTEGER NOT NULL REFERENCES project_mgmt.blockers(id) ON DELETE CASCADE,
    blocked_task_id INTEGER REFERENCES project_mgmt.tasks(id) ON DELETE CASCADE,
    blocked_milestone_id INTEGER REFERENCES project_mgmt.milestones(id) ON DELETE CASCADE,
    blocked_project_id INTEGER REFERENCES project_mgmt.projects(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT at_least_one_blocked CHECK (
        blocked_task_id IS NOT NULL OR 
        blocked_milestone_id IS NOT NULL OR 
        blocked_project_id IS NOT NULL
    )
);

-- Resources: Team members and their allocation
CREATE TABLE project_mgmt.resources (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    resource_type VARCHAR(50) NOT NULL,
    department VARCHAR(50),
    
    -- Skills and capacity
    skills TEXT[] DEFAULT '{}',
    availability_percent INTEGER DEFAULT 100,
    cost_rate DECIMAL(10,2),
    
    -- Bay View specific
    bay_view_role VARCHAR(255),
    time_zone VARCHAR(50) DEFAULT 'America/Detroit',
    
    -- Metadata
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_resource_type CHECK (resource_type IN ('Developer', 'DBA', 'DevOps', 'QA', 'Director', 'External')),
    CONSTRAINT valid_department CHECK (department IN ('IT', 'Operations', 'Program', 'External', 'Board')),
    CONSTRAINT valid_availability CHECK (availability_percent >= 0 AND availability_percent <= 100)
);

-- Resource allocations to projects
CREATE TABLE project_mgmt.resource_allocations (
    id SERIAL PRIMARY KEY,
    resource_id INTEGER NOT NULL REFERENCES project_mgmt.resources(id) ON DELETE CASCADE,
    project_id INTEGER NOT NULL REFERENCES project_mgmt.projects(id) ON DELETE CASCADE,
    allocation_percent INTEGER NOT NULL DEFAULT 100,
    start_date DATE NOT NULL,
    end_date DATE,
    role_on_project VARCHAR(255),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_allocation CHECK (allocation_percent > 0 AND allocation_percent <= 100),
    CONSTRAINT valid_allocation_dates CHECK (end_date IS NULL OR end_date >= start_date)
);

-- Sprints: Time-boxed development periods
CREATE TABLE project_mgmt.sprints (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    sprint_number VARCHAR(50) UNIQUE NOT NULL, -- S2025-01 format
    name VARCHAR(255) NOT NULL,
    project_id INTEGER REFERENCES project_mgmt.projects(id) ON DELETE CASCADE,
    
    -- Dates
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    
    -- Details
    sprint_goals TEXT,
    focus_areas TEXT[] DEFAULT '{}',
    retrospective_notes TEXT,
    demo_recording_url VARCHAR(255),
    
    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'Planning',
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_sprint_status CHECK (status IN ('Planning', 'Active', 'Review', 'Completed')),
    CONSTRAINT valid_sprint_dates CHECK (end_date > start_date)
);

-- Add sprint reference to tasks
ALTER TABLE project_mgmt.tasks 
ADD CONSTRAINT fk_task_sprint 
FOREIGN KEY (sprint_id) REFERENCES project_mgmt.sprints(id) ON DELETE SET NULL;

-- Stakeholders for projects
CREATE TABLE project_mgmt.project_stakeholders (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES project_mgmt.projects(id) ON DELETE CASCADE,
    resource_id INTEGER NOT NULL REFERENCES project_mgmt.resources(id) ON DELETE CASCADE,
    role VARCHAR(100) NOT NULL DEFAULT 'Stakeholder',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_project_stakeholder UNIQUE (project_id, resource_id)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Projects indexes
CREATE INDEX idx_projects_status ON project_mgmt.projects(status) WHERE NOT is_archived;
CREATE INDEX idx_projects_owner ON project_mgmt.projects(owner_id);
CREATE INDEX idx_projects_dates ON project_mgmt.projects(start_date, end_date);
CREATE INDEX idx_projects_phase ON project_mgmt.projects(phase);

-- Milestones indexes
CREATE INDEX idx_milestones_project ON project_mgmt.milestones(project_id);
CREATE INDEX idx_milestones_due_date ON project_mgmt.milestones(due_date);
CREATE INDEX idx_milestones_status ON project_mgmt.milestones(status);

-- Tasks indexes
CREATE INDEX idx_tasks_project ON project_mgmt.tasks(project_id);
CREATE INDEX idx_tasks_milestone ON project_mgmt.tasks(milestone_id);
CREATE INDEX idx_tasks_sprint ON project_mgmt.tasks(sprint_id);
CREATE INDEX idx_tasks_assignee ON project_mgmt.tasks(assignee_id);
CREATE INDEX idx_tasks_status ON project_mgmt.tasks(status) WHERE NOT is_archived;
CREATE INDEX idx_tasks_priority ON project_mgmt.tasks(priority);

-- Blockers indexes
CREATE INDEX idx_blockers_status ON project_mgmt.blockers(status);
CREATE INDEX idx_blockers_severity ON project_mgmt.blockers(severity);

-- Sprint indexes
CREATE INDEX idx_sprints_project ON project_mgmt.sprints(project_id);
CREATE INDEX idx_sprints_dates ON project_mgmt.sprints(start_date, end_date);

-- =====================================================
-- VIEWS FOR COMMON QUERIES
-- =====================================================

-- Active projects overview
CREATE VIEW project_mgmt.v_active_projects AS
SELECT 
    p.*,
    COUNT(DISTINCT m.id) as milestone_count,
    COUNT(DISTINCT t.id) as task_count,
    COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'Done') as completed_tasks,
    COUNT(DISTINCT b.id) as active_blockers,
    ROUND(AVG(t.progress)::numeric, 0) as avg_progress,
    r.name as owner_name
FROM project_mgmt.projects p
LEFT JOIN project_mgmt.milestones m ON p.id = m.project_id
LEFT JOIN project_mgmt.tasks t ON p.id = t.project_id AND NOT t.is_archived
LEFT JOIN project_mgmt.blocker_relationships br ON p.id = br.blocked_project_id
LEFT JOIN project_mgmt.blockers b ON br.blocker_id = b.id AND b.status = 'Active'
LEFT JOIN project_mgmt.resources r ON p.owner_id = r.id
WHERE p.status = 'Active' AND NOT p.is_archived
GROUP BY p.id, r.name;

-- Sprint velocity tracking
CREATE VIEW project_mgmt.v_sprint_velocity AS
SELECT 
    s.*,
    COUNT(DISTINCT t.id) as total_tasks,
    SUM(t.story_points) as total_points,
    SUM(t.story_points) FILTER (WHERE t.status = 'Done') as completed_points,
    COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'Done') as completed_tasks,
    COUNT(DISTINCT br.blocker_id) as blocker_count
FROM project_mgmt.sprints s
LEFT JOIN project_mgmt.tasks t ON s.id = t.sprint_id
LEFT JOIN project_mgmt.blocker_relationships br ON t.id = br.blocked_task_id
GROUP BY s.id;

-- Resource utilization
CREATE VIEW project_mgmt.v_resource_utilization AS
SELECT 
    r.*,
    COUNT(DISTINCT ra.project_id) as active_projects,
    COUNT(DISTINCT t.id) as assigned_tasks,
    SUM(t.estimated_hours) as total_estimated_hours,
    SUM(t.actual_hours) as total_actual_hours,
    ROUND(SUM(ra.allocation_percent)::numeric, 0) as total_allocation_percent,
    r.availability_percent * 40 / 100.0 as weekly_capacity_hours
FROM project_mgmt.resources r
LEFT JOIN project_mgmt.resource_allocations ra ON r.id = ra.resource_id 
    AND (ra.end_date IS NULL OR ra.end_date >= CURRENT_DATE)
LEFT JOIN project_mgmt.tasks t ON r.id = t.assignee_id 
    AND t.status NOT IN ('Done', 'Backlog')
WHERE r.is_active
GROUP BY r.id;

-- Blocker impact analysis
CREATE VIEW project_mgmt.v_blocker_impact AS
SELECT 
    b.*,
    COUNT(DISTINCT br.blocked_task_id) as blocked_tasks,
    COUNT(DISTINCT br.blocked_milestone_id) as blocked_milestones,
    COUNT(DISTINCT br.blocked_project_id) as blocked_projects,
    r.name as owner_name,
    ri.name as identified_by_name
FROM project_mgmt.blockers b
LEFT JOIN project_mgmt.blocker_relationships br ON b.id = br.blocker_id
LEFT JOIN project_mgmt.resources r ON b.owner_id = r.id
LEFT JOIN project_mgmt.resources ri ON b.identified_by = ri.id
GROUP BY b.id, r.name, ri.name;

-- =====================================================
-- FUNCTIONS FOR BUSINESS LOGIC
-- =====================================================

-- Generate project code
CREATE OR REPLACE FUNCTION project_mgmt.generate_project_code(
    project_type TEXT
) RETURNS TEXT AS $$
DECLARE
    year_part TEXT;
    type_part TEXT;
    number_part INTEGER;
    new_code TEXT;
BEGIN
    year_part := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
    
    -- Map project type to code
    type_part := CASE 
        WHEN project_type = 'Backend' THEN 'BE'
        WHEN project_type = 'Database' THEN 'DB'
        WHEN project_type = 'API' THEN 'API'
        WHEN project_type = 'Migration' THEN 'MIG'
        WHEN project_type = 'Infrastructure' THEN 'INF'
        WHEN project_type = 'Integration' THEN 'INT'
        WHEN project_type = 'Security' THEN 'SEC'
        ELSE 'GEN'
    END;
    
    -- Get next number for this year and type
    SELECT COALESCE(MAX(
        CAST(SUBSTRING(project_code FROM '[0-9]+$') AS INTEGER)
    ), 0) + 1
    INTO number_part
    FROM project_mgmt.projects
    WHERE project_code LIKE 'BV-' || year_part || '-' || type_part || '-%';
    
    new_code := format('BV-%s-%s-%03d', year_part, type_part, number_part);
    
    RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Calculate project progress
CREATE OR REPLACE FUNCTION project_mgmt.calculate_project_progress(
    p_project_id INTEGER
) RETURNS INTEGER AS $$
DECLARE
    task_progress NUMERIC;
    milestone_progress NUMERIC;
    total_progress NUMERIC;
BEGIN
    -- Calculate based on task completion
    SELECT AVG(progress)
    INTO task_progress
    FROM project_mgmt.tasks
    WHERE project_id = p_project_id
    AND NOT is_archived;
    
    -- Calculate based on milestone completion
    SELECT AVG(CASE WHEN status = 'Complete' THEN 100 ELSE 0 END)
    INTO milestone_progress
    FROM project_mgmt.milestones
    WHERE project_id = p_project_id;
    
    -- Weight: 70% tasks, 30% milestones
    total_progress := COALESCE(task_progress * 0.7, 0) + COALESCE(milestone_progress * 0.3, 0);
    
    RETURN ROUND(total_progress);
END;
$$ LANGUAGE plpgsql;

-- Check for circular dependencies
CREATE OR REPLACE FUNCTION project_mgmt.check_circular_dependency(
    p_task_id INTEGER,
    p_depends_on_id INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    has_circular BOOLEAN := FALSE;
BEGIN
    -- Use recursive CTE to check for circular dependencies
    WITH RECURSIVE dependency_chain AS (
        SELECT depends_on_task_id, task_id
        FROM project_mgmt.task_dependencies
        WHERE task_id = p_depends_on_id
        
        UNION ALL
        
        SELECT td.depends_on_task_id, td.task_id
        FROM project_mgmt.task_dependencies td
        JOIN dependency_chain dc ON td.task_id = dc.depends_on_task_id
    )
    SELECT EXISTS (
        SELECT 1 FROM dependency_chain 
        WHERE depends_on_task_id = p_task_id
    ) INTO has_circular;
    
    RETURN has_circular;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION project_mgmt.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON project_mgmt.projects
FOR EACH ROW EXECUTE FUNCTION project_mgmt.update_updated_at();

CREATE TRIGGER update_milestones_updated_at BEFORE UPDATE ON project_mgmt.milestones
FOR EACH ROW EXECUTE FUNCTION project_mgmt.update_updated_at();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON project_mgmt.tasks
FOR EACH ROW EXECUTE FUNCTION project_mgmt.update_updated_at();

CREATE TRIGGER update_blockers_updated_at BEFORE UPDATE ON project_mgmt.blockers
FOR EACH ROW EXECUTE FUNCTION project_mgmt.update_updated_at();

CREATE TRIGGER update_resources_updated_at BEFORE UPDATE ON project_mgmt.resources
FOR EACH ROW EXECUTE FUNCTION project_mgmt.update_updated_at();

CREATE TRIGGER update_sprints_updated_at BEFORE UPDATE ON project_mgmt.sprints
FOR EACH ROW EXECUTE FUNCTION project_mgmt.update_updated_at();

-- Auto-generate codes
CREATE OR REPLACE FUNCTION project_mgmt.auto_generate_project_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.project_code IS NULL OR NEW.project_code = '' THEN
        NEW.project_code := project_mgmt.generate_project_code(NEW.project_type[1]);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_project_code BEFORE INSERT ON project_mgmt.projects
FOR EACH ROW EXECUTE FUNCTION project_mgmt.auto_generate_project_code();

-- Similar triggers for milestone and task codes
CREATE OR REPLACE FUNCTION project_mgmt.auto_generate_milestone_code()
RETURNS TRIGGER AS $$
DECLARE
    project_code TEXT;
    milestone_number INTEGER;
BEGIN
    IF NEW.milestone_code IS NULL OR NEW.milestone_code = '' THEN
        SELECT project_code INTO project_code 
        FROM project_mgmt.projects 
        WHERE id = NEW.project_id;
        
        SELECT COUNT(*) + 1 INTO milestone_number
        FROM project_mgmt.milestones
        WHERE project_id = NEW.project_id;
        
        NEW.milestone_code := format('M%03d-%s', milestone_number, project_code);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_milestone_code BEFORE INSERT ON project_mgmt.milestones
FOR EACH ROW EXECUTE FUNCTION project_mgmt.auto_generate_milestone_code();

-- =====================================================
-- INITIAL DATA
-- =====================================================

-- Insert Bay View team members
INSERT INTO project_mgmt.resources (name, email, resource_type, department, skills, bay_view_role) VALUES
('Sarah Mitchell', 'sarah@bayviewassociation.org', 'Director', 'Operations', ARRAY['Project Management', 'Communications'], 'Project Manager'),
('Marcus Chen', 'marcus@bayviewassociation.org', 'Developer', 'IT', ARRAY['PostgreSQL', 'Node.js', 'System Architecture'], 'Lead Developer'),
('Jessica Park', 'jessica@bayviewassociation.org', 'Developer', 'IT', ARRAY['Node.js', 'Vercel', 'API Development'], 'Frontend Developer'),
('Robert Torres', 'robert@bayviewassociation.org', 'DBA', 'IT', ARRAY['PostgreSQL', 'Migration', 'Performance'], 'Database Administrator'),
('Emma Wilson', 'emma@bayviewassociation.org', 'Developer', 'IT', ARRAY['Node.js', 'Testing'], 'Summer Intern'),
('David Thompson', 'david@bayviewassociation.org', 'Director', 'Program', ARRAY['Chapel Operations'], 'Director of Worship'),
('Lisa Anderson', 'lisa@bayviewassociation.org', 'Director', 'Operations', ARRAY['Finance', 'QuickBooks'], 'Treasurer'),
('You', 'assistant@ai.helper', 'Developer', 'External', ARRAY['PostgreSQL', 'Node.js', 'System Architecture', 'Migration'], 'AI Assistant'),
('Sam', 'sam@external.com', 'Director', 'External', ARRAY['Project Management', 'System Architecture'], 'System Architect');

-- Configuration for project types and phases
-- Check if config schema exists with expected structure
DO $$
BEGIN
    -- Check if categories table has name column
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'config' 
        AND table_name = 'categories' 
        AND column_name = 'name'
    ) THEN
        -- Use existing structure
        INSERT INTO config.categories (name, description) VALUES
        ('project_management', 'Project management system configuration')
        ON CONFLICT (name) DO NOTHING;

        INSERT INTO config.settings (category_id, key, value, data_type, description) VALUES
        ((SELECT id FROM config.categories WHERE name = 'project_management'), 'project_types', 
        '["Backend", "Database", "API", "Migration", "Infrastructure", "Integration", "Security"]', 
        'json', 'Available project types'),
        ((SELECT id FROM config.categories WHERE name = 'project_management'), 'project_phases', 
        '["Phase 1-Foundation", "Phase 2A-Property", "Phase 2B-Events", "Phase 2C-Comms", "Phase 2D-Governance", "Phase 3-Analytics", "Phase 4-Portal", "Phase 5-Financial", "Phase 6-Documents", "Phase 7-Operations", "Phase 8-Communications", "Phase 9-Historical", "Phase 10-Integrations", "Phase 11-Volunteer", "Phase 12-Governance"]', 
        'json', 'Project phases'),
        ((SELECT id FROM config.categories WHERE name = 'project_management'), 'task_components', 
        '["Chapel API", "Memorial API", "Core Database", "Config System", "Dual-Write", "Forms", "Analytics", "Portal", "QuickBooks", "Payment Processing"]', 
        'json', 'Task components')
        ON CONFLICT DO NOTHING;
    ELSE
        -- Different config structure, store in project_mgmt schema
        CREATE TABLE IF NOT EXISTS project_mgmt.configuration (
            id SERIAL PRIMARY KEY,
            key VARCHAR(100) UNIQUE NOT NULL,
            value JSONB NOT NULL,
            description TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        INSERT INTO project_mgmt.configuration (key, value, description) VALUES
        ('project_types', 
        '["Backend", "Database", "API", "Migration", "Infrastructure", "Integration", "Security"]', 
        'Available project types'),
        ('project_phases', 
        '["Phase 1-Foundation", "Phase 2A-Property", "Phase 2B-Events", "Phase 2C-Comms", "Phase 2D-Governance", "Phase 3-Analytics", "Phase 4-Portal", "Phase 5-Financial", "Phase 6-Documents", "Phase 7-Operations", "Phase 8-Communications", "Phase 9-Historical", "Phase 10-Integrations", "Phase 11-Volunteer", "Phase 12-Governance"]', 
        'Project phases'),
        ('task_components', 
        '["Chapel API", "Memorial API", "Core Database", "Config System", "Dual-Write", "Forms", "Analytics", "Portal", "QuickBooks", "Payment Processing"]', 
        'Task components')
        ON CONFLICT (key) DO NOTHING;
    END IF;
END $$;

-- =====================================================
-- ACCESS CONTROL (Optional - for API access)
-- =====================================================

-- Create PM-specific roles
CREATE ROLE pm_viewer;
CREATE ROLE pm_editor;
CREATE ROLE pm_admin;

-- Grant permissions
GRANT USAGE ON SCHEMA project_mgmt TO pm_viewer, pm_editor, pm_admin;

-- Viewer can read
GRANT SELECT ON ALL TABLES IN SCHEMA project_mgmt TO pm_viewer;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA project_mgmt TO pm_viewer;

-- Editor can read/write
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA project_mgmt TO pm_editor;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA project_mgmt TO pm_editor;

-- Admin has full control
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA project_mgmt TO pm_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA project_mgmt TO pm_admin;

-- =====================================================
-- SUMMARY
-- =====================================================
-- Created:
-- - 6 core tables (projects, milestones, tasks, blockers, resources, sprints)
-- - 5 relationship tables for many-to-many connections
-- - 4 comprehensive views for reporting
-- - 3 business logic functions
-- - Auto-generating codes for entities
-- - Full indexing for performance
-- - Role-based access control