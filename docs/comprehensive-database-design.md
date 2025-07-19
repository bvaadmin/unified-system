# Comprehensive Bay View Association Database Design

## Overview
This document presents a unified relational database design that could support all of Bay View Association's operations, from member management to cottage rentals, education programs, performing arts, and more.

## Core Entity Relationships

### 1. Member & Person Management (Hub of Everything)

```sql
-- Central person registry (members, guests, staff, artists, instructors)
CREATE TABLE core.persons (
    id SERIAL PRIMARY KEY,
    person_type VARCHAR(50) NOT NULL CHECK (person_type IN ('member', 'guest', 'staff', 'artist', 'instructor', 'vendor')),
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    maiden_name VARCHAR(100),
    date_of_birth DATE,
    gender VARCHAR(20),
    
    -- Contact information
    primary_email VARCHAR(200) UNIQUE,
    primary_phone VARCHAR(20),
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES persons(id),
    
    -- Search optimization
    full_name_search tsvector GENERATED ALWAYS AS (
        to_tsvector('english', coalesce(first_name, '') || ' ' || 
                              coalesce(middle_name, '') || ' ' || 
                              coalesce(last_name, '') || ' ' || 
                              coalesce(maiden_name, ''))
    ) STORED
);

-- Members specific information
CREATE TABLE core.members (
    id SERIAL PRIMARY KEY,
    person_id INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    member_number VARCHAR(50) UNIQUE NOT NULL,
    membership_type VARCHAR(50) NOT NULL CHECK (membership_type IN ('leaseholder', 'associate', 'life', 'honorary')),
    status VARCHAR(50) NOT NULL CHECK (status IN ('active', 'inactive', 'suspended', 'deceased')),
    
    -- Membership dates
    membership_start_date DATE NOT NULL,
    membership_end_date DATE,
    last_renewal_date DATE,
    next_renewal_date DATE,
    
    -- Voting rights
    voting_eligible BOOLEAN DEFAULT true,
    board_eligible BOOLEAN DEFAULT true,
    
    -- Legacy family connections
    legacy_family_id INTEGER,
    generation_number INTEGER,
    
    UNIQUE(person_id)
);

-- Contact methods (multiple per person)
CREATE TABLE core.contact_methods (
    id SERIAL PRIMARY KEY,
    person_id INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    contact_type VARCHAR(50) NOT NULL CHECK (contact_type IN ('email', 'phone', 'address')),
    contact_value TEXT NOT NULL,
    label VARCHAR(50), -- 'home', 'work', 'cottage', 'winter', 'summer'
    is_primary BOOLEAN DEFAULT false,
    seasonal_start_month INTEGER, -- 1-12
    seasonal_end_month INTEGER,
    
    -- Ensure only one primary per type per person
    UNIQUE(person_id, contact_type, is_primary) WHERE is_primary = true
);

-- Family relationships (many-to-many)
CREATE TABLE core.family_relationships (
    id SERIAL PRIMARY KEY,
    person_id INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    related_person_id INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    relationship_type VARCHAR(50) NOT NULL, -- 'spouse', 'child', 'parent', 'sibling'
    is_active BOOLEAN DEFAULT true,
    
    CHECK (person_id != related_person_id),
    UNIQUE(person_id, related_person_id, relationship_type)
);
```

### 2. Property Management System

```sql
-- Cottages and properties
CREATE TABLE property.cottages (
    id SERIAL PRIMARY KEY,
    cottage_number VARCHAR(50) UNIQUE NOT NULL,
    cottage_name VARCHAR(200),
    street_address VARCHAR(200) NOT NULL,
    
    -- Physical characteristics
    year_built INTEGER,
    square_footage INTEGER,
    bedrooms INTEGER,
    bathrooms DECIMAL(3,1),
    max_occupancy INTEGER,
    
    -- Status
    status VARCHAR(50) CHECK (status IN ('active', 'condemned', 'under_renovation', 'demolished')),
    is_historic BOOLEAN DEFAULT false,
    historic_designation_date DATE,
    
    -- Location
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    district VARCHAR(50),
    
    -- Features
    has_parking BOOLEAN DEFAULT false,
    parking_spaces INTEGER,
    has_water_view BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Cottage ownership/leasing
CREATE TABLE property.cottage_leases (
    id SERIAL PRIMARY KEY,
    cottage_id INTEGER NOT NULL REFERENCES cottages(id),
    member_id INTEGER NOT NULL REFERENCES core.members(id),
    lease_type VARCHAR(50) CHECK (lease_type IN ('owner', 'leaseholder', 'sublease')),
    
    -- Lease period
    start_date DATE NOT NULL,
    end_date DATE,
    is_current BOOLEAN DEFAULT true,
    
    -- Financial
    annual_lease_amount DECIMAL(10,2),
    security_deposit DECIMAL(10,2),
    
    -- Documents
    lease_document_url TEXT,
    
    -- Ensure only one current lease per cottage
    UNIQUE(cottage_id, is_current) WHERE is_current = true
);

-- Cottage maintenance requests
CREATE TABLE property.maintenance_requests (
    id SERIAL PRIMARY KEY,
    cottage_id INTEGER NOT NULL REFERENCES cottages(id),
    requested_by INTEGER NOT NULL REFERENCES core.persons(id),
    
    -- Request details
    request_type VARCHAR(50) CHECK (request_type IN ('emergency', 'routine', 'inspection', 'improvement')),
    category VARCHAR(50), -- 'plumbing', 'electrical', 'structural', 'cosmetic'
    description TEXT NOT NULL,
    
    -- Status tracking
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'cancelled')),
    priority INTEGER CHECK (priority BETWEEN 1 AND 5),
    
    -- Assignment
    assigned_to INTEGER REFERENCES core.persons(id),
    assigned_date TIMESTAMP WITH TIME ZONE,
    
    -- Completion
    completed_date TIMESTAMP WITH TIME ZONE,
    completion_notes TEXT,
    total_cost DECIMAL(10,2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### 3. Education Programs

```sql
-- Courses and classes
CREATE TABLE education.programs (
    id SERIAL PRIMARY KEY,
    program_name VARCHAR(200) NOT NULL,
    program_type VARCHAR(50) CHECK (program_type IN ('youth', 'adult', 'family', 'professional')),
    department VARCHAR(100), -- 'music', 'art', 'literature', 'recreation'
    
    -- Schedule
    season INTEGER NOT NULL, -- Year
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    
    -- Capacity
    min_enrollment INTEGER,
    max_enrollment INTEGER,
    
    -- Age restrictions
    min_age INTEGER,
    max_age INTEGER,
    
    -- Pricing
    member_price DECIMAL(10,2),
    non_member_price DECIMAL(10,2),
    
    -- Requirements
    prerequisites TEXT,
    materials_list TEXT,
    
    status VARCHAR(50) DEFAULT 'planned' CHECK (status IN ('planned', 'open', 'full', 'cancelled', 'completed'))
);

-- Class sessions
CREATE TABLE education.class_sessions (
    id SERIAL PRIMARY KEY,
    program_id INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    session_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    
    -- Location
    facility_id INTEGER REFERENCES facilities.spaces(id),
    location_notes TEXT,
    
    -- Instructor
    instructor_id INTEGER REFERENCES core.persons(id),
    substitute_instructor_id INTEGER REFERENCES core.persons(id),
    
    -- Status
    is_cancelled BOOLEAN DEFAULT false,
    cancellation_reason TEXT,
    
    UNIQUE(program_id, session_date, start_time)
);

-- Student enrollments
CREATE TABLE education.enrollments (
    id SERIAL PRIMARY KEY,
    program_id INTEGER NOT NULL REFERENCES programs(id),
    student_id INTEGER NOT NULL REFERENCES core.persons(id),
    
    -- Enrollment details
    enrollment_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    enrollment_status VARCHAR(50) DEFAULT 'registered' CHECK (enrollment_status IN ('registered', 'waitlisted', 'dropped', 'completed')),
    
    -- Payment
    payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'paid', 'refunded')),
    amount_paid DECIMAL(10,2),
    scholarship_amount DECIMAL(10,2),
    
    -- Academic
    final_grade VARCHAR(10),
    completion_certificate_issued BOOLEAN DEFAULT false,
    
    -- Guardian info for minors
    guardian_id INTEGER REFERENCES core.persons(id),
    emergency_contact_info TEXT,
    medical_notes TEXT,
    
    UNIQUE(program_id, student_id)
);

-- Attendance tracking
CREATE TABLE education.attendance (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES class_sessions(id),
    enrollment_id INTEGER NOT NULL REFERENCES enrollments(id),
    
    attendance_status VARCHAR(50) CHECK (attendance_status IN ('present', 'absent', 'excused', 'late')),
    check_in_time TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    
    UNIQUE(session_id, enrollment_id)
);
```

### 4. Performing Arts & Events

```sql
-- Venues
CREATE TABLE events.venues (
    id SERIAL PRIMARY KEY,
    venue_name VARCHAR(200) NOT NULL,
    venue_type VARCHAR(50) CHECK (venue_type IN ('theater', 'concert_hall', 'outdoor', 'chapel')),
    
    -- Capacity
    seating_capacity INTEGER,
    standing_capacity INTEGER,
    
    -- Features
    has_sound_system BOOLEAN DEFAULT false,
    has_lighting_system BOOLEAN DEFAULT false,
    has_backstage BOOLEAN DEFAULT false,
    is_climate_controlled BOOLEAN DEFAULT false,
    is_accessible BOOLEAN DEFAULT true,
    
    -- Technical specs
    stage_dimensions TEXT,
    technical_requirements TEXT
);

-- Productions and events
CREATE TABLE events.productions (
    id SERIAL PRIMARY KEY,
    production_name VARCHAR(200) NOT NULL,
    production_type VARCHAR(50) CHECK (production_type IN ('concert', 'play', 'musical', 'lecture', 'film', 'worship')),
    
    -- Organization
    presenting_organization VARCHAR(200),
    director_id INTEGER REFERENCES core.persons(id),
    
    -- Run dates
    opening_date DATE,
    closing_date DATE,
    
    -- Pricing tiers
    pricing_structure JSONB, -- {"orchestra": 50, "mezzanine": 40, "balcony": 30}
    
    -- Marketing
    description TEXT,
    marketing_image_url TEXT,
    age_recommendation VARCHAR(50)
);

-- Individual performances
CREATE TABLE events.performances (
    id SERIAL PRIMARY KEY,
    production_id INTEGER NOT NULL REFERENCES productions(id),
    venue_id INTEGER NOT NULL REFERENCES venues(id),
    
    -- Schedule
    performance_date DATE NOT NULL,
    performance_time TIME NOT NULL,
    doors_open_time TIME,
    
    -- Capacity
    total_seats_available INTEGER,
    
    -- Status
    status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'on_sale', 'sold_out', 'cancelled')),
    
    UNIQUE(production_id, performance_date, performance_time)
);

-- Cast and crew
CREATE TABLE events.production_participants (
    id SERIAL PRIMARY KEY,
    production_id INTEGER NOT NULL REFERENCES productions(id),
    person_id INTEGER NOT NULL REFERENCES core.persons(id),
    
    role_type VARCHAR(50) CHECK (role_type IN ('cast', 'crew', 'musician', 'staff')),
    role_name VARCHAR(200), -- 'Hamlet', 'Director', 'Stage Manager'
    
    -- Compensation
    is_paid BOOLEAN DEFAULT false,
    compensation_amount DECIMAL(10,2),
    
    -- Bio for program
    bio_text TEXT,
    headshot_url TEXT,
    
    UNIQUE(production_id, person_id, role_name)
);

-- Ticketing
CREATE TABLE events.tickets (
    id SERIAL PRIMARY KEY,
    performance_id INTEGER NOT NULL REFERENCES performances(id),
    
    -- Seat information
    section VARCHAR(50),
    row_number VARCHAR(10),
    seat_number VARCHAR(10),
    
    -- Pricing
    price_tier VARCHAR(50),
    base_price DECIMAL(10,2),
    
    -- Status
    status VARCHAR(50) DEFAULT 'available' CHECK (status IN ('available', 'held', 'sold', 'comp')),
    
    UNIQUE(performance_id, section, row_number, seat_number)
);

-- Ticket orders
CREATE TABLE events.ticket_orders (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    purchaser_id INTEGER NOT NULL REFERENCES core.persons(id),
    
    -- Order details
    order_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    total_amount DECIMAL(10,2) NOT NULL,
    
    -- Payment
    payment_method VARCHAR(50) CHECK (payment_method IN ('credit_card', 'check', 'cash', 'comp')),
    payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'refunded', 'partial_refund')),
    
    -- Delivery
    delivery_method VARCHAR(50) CHECK (delivery_method IN ('will_call', 'mail', 'email')),
    delivery_status VARCHAR(50) DEFAULT 'pending',
    
    -- Contact
    order_email VARCHAR(200),
    order_phone VARCHAR(20)
);

-- Order line items
CREATE TABLE events.order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES ticket_orders(id),
    ticket_id INTEGER NOT NULL REFERENCES tickets(id),
    
    -- Pricing
    sale_price DECIMAL(10,2) NOT NULL,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    discount_reason VARCHAR(100),
    
    -- Patron info
    attendee_name VARCHAR(200),
    is_member BOOLEAN DEFAULT false
);
```

### 5. Recreation & Facilities

```sql
-- Facilities and spaces
CREATE TABLE facilities.spaces (
    id SERIAL PRIMARY KEY,
    facility_name VARCHAR(200) NOT NULL,
    space_name VARCHAR(200),
    space_type VARCHAR(50) CHECK (space_type IN ('classroom', 'meeting_room', 'sports_court', 'beach', 'dock', 'field')),
    
    -- Capacity
    max_capacity INTEGER,
    
    -- Features
    has_av_equipment BOOLEAN DEFAULT false,
    has_kitchen BOOLEAN DEFAULT false,
    is_accessible BOOLEAN DEFAULT true,
    
    -- Availability
    available_start_date DATE,
    available_end_date DATE,
    daily_start_time TIME,
    daily_end_time TIME,
    
    -- Pricing
    hourly_rate_member DECIMAL(10,2),
    hourly_rate_non_member DECIMAL(10,2),
    cleaning_fee DECIMAL(10,2)
);

-- Facility reservations
CREATE TABLE facilities.reservations (
    id SERIAL PRIMARY KEY,
    space_id INTEGER NOT NULL REFERENCES spaces(id),
    reserved_by INTEGER NOT NULL REFERENCES core.persons(id),
    
    -- Reservation details
    reservation_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    
    -- Purpose
    event_type VARCHAR(100),
    event_name VARCHAR(200),
    expected_attendance INTEGER,
    
    -- Status
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
    
    -- Requirements
    setup_requirements TEXT,
    special_requests TEXT,
    
    -- Financial
    total_cost DECIMAL(10,2),
    deposit_paid DECIMAL(10,2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Prevent double booking
    EXCLUDE USING gist (
        space_id WITH =,
        daterange(reservation_date, reservation_date, '[]') WITH &&,
        tsrange(reservation_date + start_time, reservation_date + end_time) WITH &&
    ) WHERE (status != 'cancelled')
);

-- Recreation programs (sailing, tennis, etc.)
CREATE TABLE recreation.activities (
    id SERIAL PRIMARY KEY,
    activity_name VARCHAR(200) NOT NULL,
    activity_type VARCHAR(50) CHECK (activity_type IN ('sailing', 'tennis', 'swimming', 'fitness', 'youth')),
    
    -- Schedule
    season INTEGER NOT NULL,
    start_date DATE,
    end_date DATE,
    
    -- Regular schedule
    days_of_week INTEGER[], -- 1=Monday, 7=Sunday
    daily_start_time TIME,
    daily_end_time TIME,
    
    -- Capacity
    min_participants INTEGER,
    max_participants INTEGER,
    
    -- Requirements
    min_age INTEGER,
    max_age INTEGER,
    skill_level VARCHAR(50) CHECK (skill_level IN ('beginner', 'intermediate', 'advanced', 'all')),
    equipment_provided BOOLEAN DEFAULT true,
    
    -- Pricing
    drop_in_fee DECIMAL(10,2),
    season_pass_member DECIMAL(10,2),
    season_pass_non_member DECIMAL(10,2)
);
```

### 6. Financial Integration

```sql
-- Unified financial transactions
CREATE TABLE finance.transactions (
    id SERIAL PRIMARY KEY,
    transaction_number VARCHAR(50) UNIQUE NOT NULL,
    
    -- Who
    person_id INTEGER NOT NULL REFERENCES core.persons(id),
    
    -- What
    transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN (
        'membership_dues', 'cottage_lease', 'cottage_fee', 
        'education_tuition', 'ticket_purchase', 'facility_rental',
        'recreation_fee', 'donation', 'merchandise', 'other'
    )),
    
    -- References to source records
    reference_type VARCHAR(50),
    reference_id INTEGER,
    
    -- Amount
    amount DECIMAL(10,2) NOT NULL,
    
    -- Payment details
    payment_method VARCHAR(50) CHECK (payment_method IN ('credit_card', 'ach', 'check', 'cash', 'wire')),
    payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
    
    -- Dates
    transaction_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    posted_date DATE,
    
    -- Accounting
    fiscal_year INTEGER,
    accounting_code VARCHAR(50),
    
    -- Notes
    description TEXT,
    internal_notes TEXT
);

-- Account balances
CREATE TABLE finance.account_balances (
    id SERIAL PRIMARY KEY,
    person_id INTEGER NOT NULL REFERENCES core.persons(id),
    
    -- Balances by type
    membership_balance DECIMAL(10,2) DEFAULT 0,
    cottage_balance DECIMAL(10,2) DEFAULT 0,
    education_balance DECIMAL(10,2) DEFAULT 0,
    other_balance DECIMAL(10,2) DEFAULT 0,
    
    -- Credit tracking
    account_credit DECIMAL(10,2) DEFAULT 0,
    
    -- Last update
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(person_id)
);

-- Invoices
CREATE TABLE finance.invoices (
    id SERIAL PRIMARY KEY,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    person_id INTEGER NOT NULL REFERENCES core.persons(id),
    
    -- Invoice details
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    
    -- Amounts
    subtotal DECIMAL(10,2) NOT NULL,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    
    -- Status
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled')),
    
    -- Delivery
    sent_date TIMESTAMP WITH TIME ZONE,
    sent_via VARCHAR(50) CHECK (sent_via IN ('email', 'mail', 'both'))
);

-- Invoice line items
CREATE TABLE finance.invoice_items (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    
    -- Item details
    description TEXT NOT NULL,
    quantity DECIMAL(10,2) DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    
    -- Reference
    reference_type VARCHAR(50),
    reference_id INTEGER
);
```

### 7. Communications & Marketing

```sql
-- Communication preferences
CREATE TABLE communications.preferences (
    id SERIAL PRIMARY KEY,
    person_id INTEGER NOT NULL REFERENCES core.persons(id),
    
    -- Channel preferences
    email_opted_in BOOLEAN DEFAULT true,
    sms_opted_in BOOLEAN DEFAULT false,
    mail_opted_in BOOLEAN DEFAULT true,
    
    -- Content preferences
    newsletter BOOLEAN DEFAULT true,
    event_announcements BOOLEAN DEFAULT true,
    education_updates BOOLEAN DEFAULT true,
    emergency_alerts BOOLEAN DEFAULT true,
    fundraising_appeals BOOLEAN DEFAULT true,
    
    -- Frequency
    email_frequency VARCHAR(50) DEFAULT 'weekly' CHECK (email_frequency IN ('daily', 'weekly', 'monthly', 'never')),
    
    UNIQUE(person_id)
);

-- Email campaigns
CREATE TABLE communications.campaigns (
    id SERIAL PRIMARY KEY,
    campaign_name VARCHAR(200) NOT NULL,
    campaign_type VARCHAR(50) CHECK (campaign_type IN ('newsletter', 'announcement', 'fundraising', 'emergency')),
    
    -- Content
    subject_line VARCHAR(200),
    preview_text VARCHAR(200),
    html_content TEXT,
    plain_text_content TEXT,
    
    -- Targeting
    target_segments TEXT[], -- ['members', 'cottagers', 'donors']
    
    -- Schedule
    scheduled_send_time TIMESTAMP WITH TIME ZONE,
    actual_send_time TIMESTAMP WITH TIME ZONE,
    
    -- Status
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'cancelled'))
);

-- Campaign recipients
CREATE TABLE communications.campaign_recipients (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id),
    person_id INTEGER NOT NULL REFERENCES core.persons(id),
    
    -- Delivery
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    opened_at TIMESTAMP WITH TIME ZONE,
    clicked_at TIMESTAMP WITH TIME ZONE,
    
    -- Bounce/unsub
    bounced BOOLEAN DEFAULT false,
    unsubscribed BOOLEAN DEFAULT false,
    
    UNIQUE(campaign_id, person_id)
);
```

### 8. Cross-Functional Views and Relationships

```sql
-- Comprehensive member activity view
CREATE VIEW analytics.member_360 AS
SELECT 
    p.id AS person_id,
    p.first_name,
    p.last_name,
    m.member_number,
    m.membership_type,
    
    -- Cottage ownership
    cl.cottage_id,
    c.cottage_number,
    
    -- Education participation
    COUNT(DISTINCT ee.program_id) AS education_programs_count,
    
    -- Event attendance
    COUNT(DISTINCT toi.id) AS tickets_purchased,
    
    -- Facility usage
    COUNT(DISTINCT fr.id) AS facility_reservations,
    
    -- Financial
    ab.membership_balance,
    ab.cottage_balance,
    ab.account_credit,
    
    -- Engagement score
    CASE 
        WHEN COUNT(DISTINCT ee.program_id) > 5 
         AND COUNT(DISTINCT toi.id) > 10 
        THEN 'highly_engaged'
        WHEN COUNT(DISTINCT ee.program_id) > 0 
          OR COUNT(DISTINCT toi.id) > 0 
        THEN 'engaged'
        ELSE 'inactive'
    END AS engagement_level

FROM core.persons p
JOIN core.members m ON p.id = m.person_id
LEFT JOIN property.cottage_leases cl ON m.id = cl.member_id AND cl.is_current = true
LEFT JOIN property.cottages c ON cl.cottage_id = c.id
LEFT JOIN education.enrollments ee ON p.id = ee.student_id
LEFT JOIN events.ticket_orders to ON p.id = to.purchaser_id
LEFT JOIN events.order_items toi ON to.id = toi.order_id
LEFT JOIN facilities.reservations fr ON p.id = fr.reserved_by
LEFT JOIN finance.account_balances ab ON p.id = ab.person_id
WHERE m.status = 'active'
GROUP BY p.id, p.first_name, p.last_name, m.member_number, 
         m.membership_type, cl.cottage_id, c.cottage_number,
         ab.membership_balance, ab.cottage_balance, ab.account_credit;

-- Family unit view (for household communications)
CREATE VIEW analytics.family_units AS
WITH family_groups AS (
    SELECT 
        LEAST(fr.person_id, fr.related_person_id) AS person_1,
        GREATEST(fr.person_id, fr.related_person_id) AS person_2,
        STRING_AGG(DISTINCT cm.contact_value, '; ') AS shared_addresses
    FROM core.family_relationships fr
    JOIN core.contact_methods cm ON cm.person_id IN (fr.person_id, fr.related_person_id)
    WHERE fr.relationship_type IN ('spouse', 'child')
      AND fr.is_active = true
      AND cm.contact_type = 'address'
    GROUP BY LEAST(fr.person_id, fr.related_person_id), 
             GREATEST(fr.person_id, fr.related_person_id)
)
SELECT 
    fg.person_1,
    fg.person_2,
    p1.first_name || ' ' || p1.last_name AS person_1_name,
    p2.first_name || ' ' || p2.last_name AS person_2_name,
    fg.shared_addresses,
    CASE 
        WHEN m1.id IS NOT NULL AND m2.id IS NOT NULL THEN 'both_members'
        WHEN m1.id IS NOT NULL OR m2.id IS NOT NULL THEN 'one_member'
        ELSE 'no_members'
    END AS membership_status
FROM family_groups fg
JOIN core.persons p1 ON fg.person_1 = p1.id
JOIN core.persons p2 ON fg.person_2 = p2.id
LEFT JOIN core.members m1 ON p1.id = m1.person_id AND m1.status = 'active'
LEFT JOIN core.members m2 ON p2.id = m2.person_id AND m2.status = 'active';

-- Revenue analysis by person
CREATE VIEW finance.person_lifetime_value AS
SELECT 
    p.id AS person_id,
    p.first_name || ' ' || p.last_name AS full_name,
    m.member_number,
    
    -- Revenue by category
    SUM(CASE WHEN t.transaction_type = 'membership_dues' THEN t.amount ELSE 0 END) AS membership_revenue,
    SUM(CASE WHEN t.transaction_type IN ('cottage_lease', 'cottage_fee') THEN t.amount ELSE 0 END) AS cottage_revenue,
    SUM(CASE WHEN t.transaction_type = 'education_tuition' THEN t.amount ELSE 0 END) AS education_revenue,
    SUM(CASE WHEN t.transaction_type = 'ticket_purchase' THEN t.amount ELSE 0 END) AS ticket_revenue,
    SUM(CASE WHEN t.transaction_type = 'donation' THEN t.amount ELSE 0 END) AS donation_revenue,
    SUM(t.amount) AS total_lifetime_value,
    
    -- Engagement metrics
    COUNT(DISTINCT t.fiscal_year) AS active_years,
    MIN(t.transaction_date) AS first_transaction,
    MAX(t.transaction_date) AS last_transaction,
    
    -- Current year activity
    SUM(CASE WHEN t.fiscal_year = EXTRACT(YEAR FROM CURRENT_DATE) THEN t.amount ELSE 0 END) AS current_year_revenue

FROM core.persons p
LEFT JOIN core.members m ON p.id = m.person_id
LEFT JOIN finance.transactions t ON p.id = t.person_id AND t.payment_status = 'completed'
GROUP BY p.id, p.first_name, p.last_name, m.member_number;
```

## Key Relationship Examples

### 1. Member Journey Tracking
```sql
-- Track a member's complete journey through Bay View
SELECT 
    -- Basic info
    p.first_name || ' ' || p.last_name AS name,
    m.membership_type,
    m.membership_start_date,
    
    -- Property
    c.cottage_number,
    cl.lease_type,
    
    -- Education participation
    array_agg(DISTINCT ep.program_name) AS education_programs,
    
    -- Events attended
    array_agg(DISTINCT prod.production_name) AS events_attended,
    
    -- Volunteer/staff roles
    array_agg(DISTINCT pp.role_name) AS production_roles

FROM core.persons p
JOIN core.members m ON p.id = m.person_id
LEFT JOIN property.cottage_leases cl ON m.id = cl.member_id AND cl.is_current = true
LEFT JOIN property.cottages c ON cl.cottage_id = c.id
LEFT JOIN education.enrollments ee ON p.id = ee.student_id
LEFT JOIN education.programs ep ON ee.program_id = ep.id
LEFT JOIN events.ticket_orders to ON p.id = to.purchaser_id
LEFT JOIN events.order_items oi ON to.id = oi.order_id
LEFT JOIN events.tickets t ON oi.ticket_id = t.id
LEFT JOIN events.performances perf ON t.performance_id = perf.id
LEFT JOIN events.productions prod ON perf.production_id = prod.id
LEFT JOIN events.production_participants pp ON p.id = pp.person_id
WHERE p.id = 123
GROUP BY p.id, p.first_name, p.last_name, m.membership_type, 
         m.membership_start_date, c.cottage_number, cl.lease_type;
```

### 2. Multi-Generation Family Trees
```sql
-- Recursive query to show family trees
WITH RECURSIVE family_tree AS (
    -- Base case: start with a specific person
    SELECT 
        p.id,
        p.first_name || ' ' || p.last_name AS full_name,
        m.generation_number,
        0 AS level,
        ARRAY[p.id] AS path
    FROM core.persons p
    JOIN core.members m ON p.id = m.person_id
    WHERE p.id = 123
    
    UNION ALL
    
    -- Recursive case: find all relatives
    SELECT 
        p2.id,
        p2.first_name || ' ' || p2.last_name AS full_name,
        m2.generation_number,
        ft.level + 1,
        ft.path || p2.id
    FROM family_tree ft
    JOIN core.family_relationships fr ON ft.id = fr.person_id
    JOIN core.persons p2 ON fr.related_person_id = p2.id
    LEFT JOIN core.members m2 ON p2.id = m2.person_id
    WHERE NOT p2.id = ANY(ft.path) -- Prevent cycles
)
SELECT * FROM family_tree ORDER BY generation_number, level;
```

### 3. Integrated Chapel Services
```sql
-- Link chapel services to the comprehensive system
CREATE TABLE worship.chapel_services (
    id SERIAL PRIMARY KEY,
    
    -- Link to existing chapel tables
    chapel_application_id INTEGER REFERENCES crouse_chapel.service_applications(id),
    
    -- Link to events system for public services
    performance_id INTEGER REFERENCES events.performances(id),
    
    -- Participants
    officiant_id INTEGER REFERENCES core.persons(id),
    
    -- Attendee tracking
    estimated_attendance INTEGER,
    
    -- Integration with facilities
    facility_reservation_id INTEGER REFERENCES facilities.reservations(id)
);

-- Link memorial garden to persons
ALTER TABLE bayview.memorials 
ADD COLUMN deceased_person_id INTEGER REFERENCES core.persons(id),
ADD COLUMN applicant_person_id INTEGER REFERENCES core.persons(id);
```

## Benefits of This Unified Design

1. **Single Source of Truth**: Each person exists once in the database, eliminating duplicates

2. **Complete Member View**: Can see everything about a member - their cottage, education, events, donations, etc.

3. **Family Relationships**: Track multi-generational families and household units

4. **Financial Integration**: All transactions flow through a single system for comprehensive reporting

5. **Marketing Segmentation**: Can target communications based on any combination of activities

6. **Operational Efficiency**: 
   - No double-booking of facilities
   - Automatic capacity management
   - Integrated scheduling across all departments

7. **Historical Tracking**: Complete audit trails and historical records for properties and memberships

8. **Scalability**: Designed to handle growth with proper indexing and partitioning strategies

## Migration Strategy

1. **Phase 1**: Implement core person/member management
2. **Phase 2**: Migrate cottage/property data
3. **Phase 3**: Integrate financial systems
4. **Phase 4**: Add education programs
5. **Phase 5**: Implement events/ticketing
6. **Phase 6**: Add remaining modules

## Performance Considerations

```sql
-- Key indexes for performance
CREATE INDEX idx_persons_full_name_search ON core.persons USING GIN(full_name_search);
CREATE INDEX idx_members_status_type ON core.members(status, membership_type);
CREATE INDEX idx_contact_methods_person_type ON core.contact_methods(person_id, contact_type);
CREATE INDEX idx_transactions_person_date ON finance.transactions(person_id, transaction_date);
CREATE INDEX idx_enrollments_program_status ON education.enrollments(program_id, enrollment_status);

-- Partitioning for large tables
CREATE TABLE finance.transactions_2024 PARTITION OF finance.transactions
FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
```

This comprehensive design demonstrates how PostgreSQL's relational features can create a powerful, integrated system that Notion could never achieve with its flat structure. The foreign keys, constraints, views, and complex queries enable Bay View to run all operations from a single, unified database.