# Database Relationships in Bay View System

## Overview
This document explains how relationships work in the dual-storage architecture, comparing PostgreSQL's relational features with Notion's flat structure.

## PostgreSQL Relationships (True Relational Database)

### 1. One-to-Many Relationships

#### Service Applications → Wedding/Memorial/Baptism/General Use Details
```sql
-- Parent table
CREATE TABLE crouse_chapel.service_applications (
    id SERIAL PRIMARY KEY,
    application_type VARCHAR(50),
    service_date DATE,
    -- ... other fields
);

-- Child tables with foreign keys
CREATE TABLE crouse_chapel.wedding_details (
    id SERIAL PRIMARY KEY,
    application_id INTEGER NOT NULL REFERENCES service_applications(id) ON DELETE CASCADE,
    couple_names VARCHAR(200),
    guest_count INTEGER,
    -- ... other wedding-specific fields
);

CREATE TABLE crouse_chapel.memorial_details (
    id SERIAL PRIMARY KEY,
    application_id INTEGER NOT NULL REFERENCES service_applications(id) ON DELETE CASCADE,
    deceased_name VARCHAR(200),
    memorial_garden_placement BOOLEAN,
    -- ... other memorial-specific fields
);
```

**How it works:**
- Each service application can have ONE detail record (wedding OR memorial OR baptism OR general use)
- Foreign key ensures referential integrity
- CASCADE DELETE removes detail records when parent is deleted
- JOIN queries can combine data:

```sql
-- Get complete wedding application data
SELECT 
    sa.*,
    wd.couple_names,
    wd.guest_count,
    wd.wedding_fee
FROM crouse_chapel.service_applications sa
JOIN crouse_chapel.wedding_details wd ON sa.id = wd.application_id
WHERE sa.application_type = 'wedding';
```

### 2. Many-to-Many Relationships

#### Service Applications ↔ Clergy
```sql
-- Clergy registry
CREATE TABLE crouse_chapel.clergy (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    denomination VARCHAR(100),
    approved_status VARCHAR(50),
    -- ... other clergy fields
);

-- Junction table for many-to-many
CREATE TABLE crouse_chapel.service_clergy (
    id SERIAL PRIMARY KEY,
    application_id INTEGER NOT NULL REFERENCES service_applications(id) ON DELETE CASCADE,
    clergy_id INTEGER NOT NULL REFERENCES clergy(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT false,
    UNIQUE(application_id, clergy_id)
);
```

**How it works:**
- One service can have multiple clergy
- One clergy member can serve multiple services
- Junction table tracks relationships
- Can designate primary clergy with `is_primary` flag

```sql
-- Get all clergy for a service
SELECT 
    c.name,
    c.denomination,
    sc.is_primary
FROM crouse_chapel.clergy c
JOIN crouse_chapel.service_clergy sc ON c.id = sc.clergy_id
WHERE sc.application_id = 123
ORDER BY sc.is_primary DESC;
```

### 3. One-to-Many: Service → Musicians
```sql
CREATE TABLE crouse_chapel.service_musicians (
    id SERIAL PRIMARY KEY,
    application_id INTEGER NOT NULL REFERENCES service_applications(id) ON DELETE CASCADE,
    musician_name VARCHAR(200) NOT NULL
);
```

**How it works:**
- Each service can have multiple musicians
- Simple one-to-many without needing a separate musicians table
- All musicians deleted when service is deleted

### 4. Audit Trail Relationships
```sql
-- Polymorphic relationship using table_name + record_id
CREATE TABLE bayview.audit_log (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,
    record_id INTEGER,
    action VARCHAR(20),
    old_values JSONB,
    new_values JSONB,
    -- ... other audit fields
);

-- Can track changes to any table
INSERT INTO bayview.audit_log (table_name, record_id, action, new_values)
VALUES ('service_applications', 123, 'UPDATE', '{"status": "approved"}');
```

### 5. Payment Tracking
```sql
-- Payments linked to applications
CREATE TABLE crouse_chapel.payments (
    id SERIAL PRIMARY KEY,
    application_id INTEGER NOT NULL REFERENCES service_applications(id) ON DELETE CASCADE,
    amount DECIMAL(10,2),
    payment_date DATE,
    -- ... other payment fields
);

-- View combining application and payment data
CREATE VIEW crouse_chapel.application_payment_summary AS
SELECT 
    sa.id,
    sa.contact_name,
    COALESCE(SUM(p.amount), 0) AS total_paid,
    CASE 
        WHEN sa.application_type = 'wedding' THEN 
            CASE WHEN wd.is_member THEN 300 ELSE 750 END
        ELSE 0
    END AS total_due
FROM service_applications sa
LEFT JOIN payments p ON sa.id = p.application_id
LEFT JOIN wedding_details wd ON sa.id = wd.application_id
GROUP BY sa.id, wd.is_member;
```

## Notion "Relationships" (Flat Structure)

### How Notion Handles Relationships

Notion doesn't have true foreign keys or joins. Instead, it uses:

1. **Page Links (Relations)**
   - Can link to other database pages
   - No referential integrity
   - Can't enforce constraints
   - Limited querying capabilities

2. **Text References**
   - Store IDs as text fields
   - Manual synchronization required
   - No automatic cascading

### Current Implementation in Bay View

```javascript
// In chapel submit API
const notionProperties = {
    'Application ID': toNotionProperty(`CHAPEL-${applicationId}`, 'title'),
    'Database ID': toNotionProperty(applicationId, 'rich_text'), // PostgreSQL ID
    'Clergy Name': toNotionProperty(clergyNames.join(', '), 'rich_text'), // Flattened
    'Musicians List': toNotionProperty(musicians.join('\n'), 'rich_text'), // Flattened
    // ... other fields
};
```

**Limitations:**
- Clergy stored as comma-separated text (not relational)
- Musicians stored as line-separated text
- No way to query "all services by clergy member X"
- Can't enforce data integrity
- Updates must be synchronized manually

## Comparison Example: Finding All Services

### PostgreSQL (Efficient)
```sql
-- Find all services for a specific clergy member
SELECT 
    sa.service_date,
    sa.application_type,
    sa.contact_name
FROM crouse_chapel.service_applications sa
JOIN crouse_chapel.service_clergy sc ON sa.id = sc.application_id
JOIN crouse_chapel.clergy c ON sc.clergy_id = c.id
WHERE c.name = 'Rev. John Smith'
ORDER BY sa.service_date DESC;
```

### Notion (Limited)
- Must search through all records
- Text search in "Clergy Name" field
- No guarantee of finding all matches (typos, formatting)
- Can't join with clergy approval status

## Data Integrity Examples

### PostgreSQL Constraints
```sql
-- Prevent double-booking
ALTER TABLE crouse_chapel.service_applications
ADD CONSTRAINT unique_service_datetime 
UNIQUE (service_date, service_time);

-- Ensure valid payment amounts
ALTER TABLE crouse_chapel.payments
ADD CONSTRAINT positive_amount CHECK (amount > 0);

-- Automatic timestamp updates
CREATE TRIGGER update_service_applications_updated_at
BEFORE UPDATE ON service_applications
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Notion Limitations
- Can't prevent duplicate entries
- No validation rules
- No automatic calculations
- Manual timestamp updates

## Synchronization Challenges

### Current Dual-Storage Approach

```javascript
// Save to PostgreSQL first (with transactions)
await pgClient.query('BEGIN');
const appResult = await pgClient.query(insertApplicationQuery, values);
const applicationId = appResult.rows[0].id;

// Save related data
await pgClient.query(insertWeddingDetailsQuery, weddingValues);
await pgClient.query(insertClergyQuery, clergyValues);
await pgClient.query('COMMIT');

// Then sync to Notion (no transactions)
try {
    const notionPage = await createNotionPage(NOTION_DATABASE_ID, notionProperties);
    // Update PostgreSQL with Notion ID
    await pgClient.query(
        'UPDATE service_applications SET notion_id = $1 WHERE id = $2',
        [notionPage.id, applicationId]
    );
} catch (notionError) {
    // PostgreSQL data remains, but Notion sync failed
    console.error('Notion sync failed:', notionError);
}
```

### Sync Issues
1. **No Transactions**: Notion operations can't be rolled back
2. **Partial Failures**: PostgreSQL succeeds, Notion fails = inconsistent state
3. **Update Propagation**: Changes in one system don't auto-update the other
4. **Relationship Updates**: Changing clergy requires updates in multiple places

## Best Practices for Dual Storage

### 1. Use PostgreSQL for Relationships
```sql
-- Complex queries stay in PostgreSQL
SELECT 
    c.name AS clergy_name,
    COUNT(DISTINCT sa.id) AS total_services,
    COUNT(DISTINCT CASE WHEN sa.application_type = 'wedding' THEN sa.id END) AS weddings,
    COUNT(DISTINCT CASE WHEN sa.application_type = 'memorial' THEN sa.id END) AS memorials
FROM crouse_chapel.clergy c
JOIN crouse_chapel.service_clergy sc ON c.id = sc.clergy_id
JOIN crouse_chapel.service_applications sa ON sc.application_id = sa.id
WHERE c.approved_status = 'approved'
GROUP BY c.id, c.name
ORDER BY total_services DESC;
```

### 2. Use Notion for Workflow
- Status tracking and approvals
- Comments and collaboration
- Visual kanban boards
- Simple filtering and sorting

### 3. Maintain Reference Integrity
```javascript
// Always store cross-references
const postgresId = 123;
const notionId = 'abc-def-ghi';

// In PostgreSQL
UPDATE service_applications SET notion_id = 'abc-def-ghi' WHERE id = 123;

// In Notion
'Database ID': toNotionProperty('123', 'rich_text')
```

### 4. Handle Relationships Carefully
```javascript
// When updating clergy assignment
async function updateServiceClergy(applicationId, newClergyIds) {
    await pgClient.query('BEGIN');
    
    try {
        // PostgreSQL: Delete old, insert new (maintains referential integrity)
        await pgClient.query(
            'DELETE FROM service_clergy WHERE application_id = $1',
            [applicationId]
        );
        
        for (const clergyId of newClergyIds) {
            await pgClient.query(
                'INSERT INTO service_clergy (application_id, clergy_id) VALUES ($1, $2)',
                [applicationId, clergyId]
            );
        }
        
        // Notion: Update as flat text
        const clergyNames = await getClergyNames(newClergyIds);
        await updateNotionPage(notionPageId, {
            'Clergy Name': toNotionProperty(clergyNames.join(', '), 'rich_text')
        });
        
        await pgClient.query('COMMIT');
    } catch (error) {
        await pgClient.query('ROLLBACK');
        throw error;
    }
}
```

## Summary

### PostgreSQL Strengths
- ✅ True relationships with foreign keys
- ✅ Referential integrity (CASCADE, RESTRICT)
- ✅ Complex JOIN queries
- ✅ Transactions for atomic operations
- ✅ Constraints and validations
- ✅ Triggers for automation
- ✅ Views for simplified querying

### Notion Limitations
- ❌ No true foreign keys
- ❌ No referential integrity
- ❌ Limited querying (no JOINs)
- ❌ No transactions
- ❌ No constraints
- ❌ Manual updates only
- ❌ Flat data structure

### Recommendation
Use PostgreSQL as the source of truth for all relational data and complex queries. Use Notion for workflow management and collaboration, accepting its limitations as a flat database. Always maintain bidirectional references for data consistency.