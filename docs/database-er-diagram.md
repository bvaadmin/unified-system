# Bay View Association Database Entity Relationship Diagram

## Overview
This document provides a visual representation of the comprehensive database design for Bay View Association, showing how all entities relate to each other in a unified system.

```mermaid
erDiagram
    %% Core Person Management
    PERSONS ||--o{ CONTACT_METHODS : has
    PERSONS ||--o| MEMBERS : "can be"
    PERSONS ||--o{ FAMILY_RELATIONSHIPS : "related to"
    PERSONS ||--o{ COMMUNICATION_PREFERENCES : has
    
    %% Member Relationships
    MEMBERS ||--o{ COTTAGE_LEASES : holds
    MEMBERS ||--o{ ACCOUNT_BALANCES : has
    
    %% Property Management
    COTTAGES ||--o{ COTTAGE_LEASES : "leased by"
    COTTAGES ||--o{ MAINTENANCE_REQUESTS : has
    COTTAGE_LEASES }o--|| MEMBERS : "held by"
    
    %% Education System
    PROGRAMS ||--o{ CLASS_SESSIONS : contains
    PROGRAMS ||--o{ ENROLLMENTS : has
    CLASS_SESSIONS ||--o{ ATTENDANCE : tracks
    CLASS_SESSIONS }o--|| SPACES : "held in"
    ENROLLMENTS }o--|| PERSONS : "student"
    ENROLLMENTS ||--o{ ATTENDANCE : records
    
    %% Events and Performances
    PRODUCTIONS ||--o{ PERFORMANCES : schedules
    PRODUCTIONS ||--o{ PRODUCTION_PARTICIPANTS : involves
    PERFORMANCES }o--|| VENUES : "held at"
    PERFORMANCES ||--o{ TICKETS : offers
    PRODUCTION_PARTICIPANTS }o--|| PERSONS : "cast/crew"
    
    %% Ticketing
    TICKETS }o--|| PERFORMANCES : "for"
    TICKET_ORDERS ||--o{ ORDER_ITEMS : contains
    TICKET_ORDERS }o--|| PERSONS : "purchased by"
    ORDER_ITEMS }o--|| TICKETS : "for"
    
    %% Facilities
    SPACES ||--o{ RESERVATIONS : "booked for"
    SPACES ||--o{ CLASS_SESSIONS : hosts
    RESERVATIONS }o--|| PERSONS : "reserved by"
    
    %% Recreation
    ACTIVITIES ||--o{ ACTIVITY_ENROLLMENTS : has
    ACTIVITY_ENROLLMENTS }o--|| PERSONS : participant
    
    %% Financial
    TRANSACTIONS }o--|| PERSONS : "paid by"
    INVOICES }o--|| PERSONS : "billed to"
    INVOICES ||--o{ INVOICE_ITEMS : contains
    ACCOUNT_BALANCES }o--|| PERSONS : tracks
    
    %% Chapel Services (Integration)
    SERVICE_APPLICATIONS ||--o{ WEDDING_DETAILS : "may have"
    SERVICE_APPLICATIONS ||--o{ MEMORIAL_DETAILS : "may have"
    SERVICE_APPLICATIONS ||--o{ SERVICE_CLERGY : involves
    SERVICE_APPLICATIONS }o--|| PERSONS : "requested by"
    SERVICE_CLERGY }o--|| CLERGY : "officiated by"
    CLERGY }o--|| PERSONS : "is"
    
    %% Memorial Garden
    MEMORIALS }o--|| PERSONS : "for deceased"
    MEMORIALS }o--|| PERSONS : "applied by"
    
    %% Communications
    CAMPAIGNS ||--o{ CAMPAIGN_RECIPIENTS : "sent to"
    CAMPAIGN_RECIPIENTS }o--|| PERSONS : receives
    COMMUNICATION_PREFERENCES }o--|| PERSONS : "set by"

    %% Entity Details
    PERSONS {
        int id PK
        string person_type
        string first_name
        string last_name
        date date_of_birth
        string primary_email UK
        timestamp created_at
    }
    
    MEMBERS {
        int id PK
        int person_id FK
        string member_number UK
        string membership_type
        string status
        date membership_start_date
    }
    
    COTTAGES {
        int id PK
        string cottage_number UK
        string cottage_name
        string street_address
        int year_built
        int bedrooms
        string status
    }
    
    COTTAGE_LEASES {
        int id PK
        int cottage_id FK
        int member_id FK
        string lease_type
        date start_date
        date end_date
        boolean is_current
    }
    
    PROGRAMS {
        int id PK
        string program_name
        string program_type
        date start_date
        date end_date
        int max_enrollment
        decimal member_price
    }
    
    ENROLLMENTS {
        int id PK
        int program_id FK
        int student_id FK
        string enrollment_status
        string payment_status
        decimal amount_paid
    }
    
    PRODUCTIONS {
        int id PK
        string production_name
        string production_type
        date opening_date
        date closing_date
        jsonb pricing_structure
    }
    
    PERFORMANCES {
        int id PK
        int production_id FK
        int venue_id FK
        date performance_date
        time performance_time
        int total_seats_available
    }
    
    TICKETS {
        int id PK
        int performance_id FK
        string section
        string row_number
        string seat_number
        decimal base_price
        string status
    }
    
    TRANSACTIONS {
        int id PK
        string transaction_number UK
        int person_id FK
        string transaction_type
        decimal amount
        string payment_status
        timestamp transaction_date
    }
```

## Key Relationship Patterns

### 1. Hub-and-Spoke: Person-Centric Design
The `PERSONS` table is the central hub, with all other entities ultimately connecting back to a person:
- Members, staff, guests, artists, instructors all exist in PERSONS
- Every transaction, enrollment, ticket purchase, etc. links to a person
- Enables 360-degree view of any individual's relationship with Bay View

### 2. Polymorphic Relationships
Several tables use polymorphic patterns to link to multiple entity types:
- `TRANSACTIONS` uses `reference_type` and `reference_id` to link to various sources
- `AUDIT_LOG` can track changes to any table
- Provides flexibility while maintaining referential integrity where possible

### 3. Many-to-Many Relationships
Junction tables handle complex relationships:
- `FAMILY_RELATIONSHIPS` - bidirectional family connections
- `SERVICE_CLERGY` - multiple clergy per service
- `PRODUCTION_PARTICIPANTS` - many people in many roles per production

### 4. Temporal Relationships
Time-based data with validity periods:
- `COTTAGE_LEASES` - historical and current leases
- `ENROLLMENTS` - status changes over time
- `MEMBERSHIP` - active periods and renewals

### 5. Hierarchical Relationships
- Family generations tracked through `generation_number`
- Nested cottage ownership (owner → leaseholder → sublease)
- Organization hierarchy (board → committees → volunteers)

## Data Flow Examples

### Member Lifecycle
```
PERSON created → MEMBER record added → COTTAGE_LEASE assigned → 
ENROLLMENTS in programs → TICKET_ORDERS for events → 
TRANSACTIONS for all payments → ACCOUNT_BALANCES updated
```

### Event Flow
```
PRODUCTION created → PERFORMANCES scheduled → TICKETS generated →
TICKET_ORDERS placed → ORDER_ITEMS created → TRANSACTIONS recorded →
ATTENDANCE tracked → REVIEWS collected
```

### Education Journey
```
PROGRAM announced → ENROLLMENTS open → STUDENTS register →
CLASS_SESSIONS scheduled → ATTENDANCE tracked → GRADES assigned →
CERTIFICATES issued → ALUMNI status
```

## Referential Integrity Rules

1. **CASCADE DELETE**: 
   - Deleting a PERSON cascades to contact methods, preferences
   - Deleting a PRODUCTION cascades to performances, participants

2. **RESTRICT DELETE**:
   - Cannot delete a PERSON with financial transactions
   - Cannot delete a COTTAGE with active leases

3. **SET NULL**:
   - Deleting an instructor sets class session instructor_id to NULL
   - Allows historical records to remain valid

4. **UNIQUE CONSTRAINTS**:
   - One active lease per cottage
   - One primary contact method per type per person
   - No double-booking of facilities

## Performance Optimization

### Indexing Strategy
```sql
-- Frequently joined columns
CREATE INDEX idx_fk_indexes ON all_tables(foreign_key_columns);

-- Search optimization
CREATE INDEX idx_fulltext_search ON persons USING GIN(full_name_search);

-- Date range queries
CREATE INDEX idx_date_ranges ON events(start_date, end_date);

-- Status filtering
CREATE INDEX idx_status_filters ON members(status) WHERE status = 'active';
```

### Materialized Views for Analytics
```sql
-- Pre-calculate complex joins
CREATE MATERIALIZED VIEW member_engagement_summary AS
SELECT /* complex aggregation query */
WITH DATA;

-- Refresh periodically
REFRESH MATERIALIZED VIEW CONCURRENTLY member_engagement_summary;
```

### Partitioning Large Tables
```sql
-- Partition transactions by year
CREATE TABLE transactions_2024 PARTITION OF transactions
FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

-- Partition audit logs by month
CREATE TABLE audit_log_2024_01 PARTITION OF audit_log
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

## Scalability Considerations

1. **Horizontal Scaling**:
   - Read replicas for reporting
   - Separate OLAP database for analytics
   - Caching layer for frequently accessed data

2. **Vertical Scaling**:
   - Partitioning strategy for large tables
   - Archive historical data to cold storage
   - Compress audit logs and old transactions

3. **Microservices Ready**:
   - Each major domain (education, events, property) could become separate service
   - Shared person service as central authority
   - Event sourcing for cross-service synchronization

This design demonstrates the power of a properly normalized relational database with well-defined relationships, constraints, and optimization strategies - capabilities that cannot be replicated in a flat system like Notion.