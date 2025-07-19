# Phase 2: Family Memorial Scenario Design

## Enhanced Memorial Process for Complex Family Situations

### Scenario: Member with Deceased Parents (Pre-paid Fees)

The system should elegantly handle:
- Multiple family members with existing records
- Pre-paid financial obligations
- Property/cottage associations
- Historical member relationships

### Database Extensions Needed

#### 1. Enhanced Person-Member Linking
```sql
-- Extend core.members table
ALTER TABLE core.members ADD COLUMN family_group_id INTEGER;
ALTER TABLE core.members ADD COLUMN primary_contact_id INTEGER REFERENCES core.persons(id);
ALTER TABLE core.members ADD COLUMN cottage_association TEXT;

-- Create family groups table
CREATE TABLE core.family_groups (
    id SERIAL PRIMARY KEY,
    group_name VARCHAR(200),
    primary_cottage VARCHAR(100),
    established_year INTEGER,
    group_type VARCHAR(50) CHECK (group_type IN ('nuclear', 'extended', 'trustees')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

#### 2. Financial Integration
```sql
-- Financial accounts
CREATE TABLE finance.accounts (
    id SERIAL PRIMARY KEY,
    person_id INTEGER REFERENCES core.persons(id),
    account_type VARCHAR(50) CHECK (account_type IN ('memorial', 'dues', 'cottage', 'assessments')),
    balance DECIMAL(10,2) DEFAULT 0.00,
    pre_paid_amount DECIMAL(10,2) DEFAULT 0.00,
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Payment tracking
CREATE TABLE finance.transactions (
    id SERIAL PRIMARY KEY,
    account_id INTEGER REFERENCES finance.accounts(id),
    person_id INTEGER REFERENCES core.persons(id),
    amount DECIMAL(10,2) NOT NULL,
    transaction_type VARCHAR(50) CHECK (transaction_type IN ('payment', 'charge', 'refund', 'transfer')),
    category VARCHAR(50),
    description TEXT,
    payment_method VARCHAR(50),
    transaction_date DATE DEFAULT CURRENT_DATE,
    processed_by INTEGER REFERENCES core.persons(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

#### 3. Property Management
```sql
-- Property records
CREATE TABLE property.locations (
    id SERIAL PRIMARY KEY,
    property_type VARCHAR(50) CHECK (property_type IN ('cottage', 'lot', 'facility', 'common_area')),
    address_number VARCHAR(20),
    street_name VARCHAR(100),
    section VARCHAR(50),
    lot_size DECIMAL(8,2),
    assessed_value DECIMAL(12,2),
    year_built INTEGER,
    current_status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Property ownership/leases
CREATE TABLE property.ownership (
    id SERIAL PRIMARY KEY,
    property_id INTEGER REFERENCES property.locations(id),
    person_id INTEGER REFERENCES core.persons(id),
    ownership_type VARCHAR(50) CHECK (ownership_type IN ('leaseholder', 'heir', 'trustee', 'guest')),
    start_date DATE,
    end_date DATE,
    ownership_percentage DECIMAL(5,2) DEFAULT 100.00,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Enhanced API Functionality

#### 1. Smart Memorial Application
```javascript
// Enhanced memorial submission API
POST /api/memorial/submit-garden-v2-enhanced

{
  // Basic info
  "deceasedName": "Robert Smith",
  "submitterMemberNumber": "1234",
  
  // System performs smart lookups:
  // 1. Find submitter member record
  // 2. Search for deceased in member database
  // 3. Check family relationships
  // 4. Verify financial accounts
  // 5. Check property associations
  
  "autoDetectedInfo": {
    "existingMember": true,
    "memberSince": "1965",
    "familyRelationship": "parent",
    "sharedProperty": "45 Oak Bluff",
    "memorialFeesStatus": "paid_in_full",
    "remainingBalance": 0.00
  }
}
```

#### 2. Family Dashboard API
```javascript
// Get comprehensive family view
GET /api/family/dashboard/{memberNumber}

Response:
{
  "family": {
    "primaryMember": { /* member details */ },
    "familyMembers": [ /* all related persons */ ],
    "properties": [ /* cottage/lot associations */ ],
    "financialSummary": {
      "memorialAccounts": [ /* pre-paid amounts */ ],
      "propertyFees": [ /* dues, assessments */ ],
      "totalBalance": 0.00
    }
  },
  "pendingActions": [
    {
      "type": "memorial_placement",
      "deceasedMember": "Robert Smith",
      "status": "fees_paid_placement_needed",
      "nextSteps": ["Submit placement application"]
    }
  ]
}
```

### User Experience Flow

#### 1. Smart Recognition
When you start the memorial application:
- System recognizes your member number
- Automatically suggests family members who have passed
- Shows pre-payment status
- Pre-fills relationship information

#### 2. Streamlined Process
```javascript
// Simplified form with smart defaults
{
  deceasedMember: "Robert Smith" (auto-suggested),
  relationship: "Parent" (auto-detected),
  paymentStatus: "Paid in Full - $1,200 (2020-03-15)",
  cottage: "45 Oak Bluff" (shared property),
  contactInfo: "John Smith" (primary member contact),
  placementOptions: [ /* available locations */ ]
}
```

#### 3. Automated Processing
- Fees already verified as paid
- Family relationships confirmed
- Contact information inherited
- Faster approval workflow

### Technical Implementation

#### Database Adapter Extensions
```javascript
// Enhanced family management
class FamilyAdapter extends ModernAdapter {
  async getFamilyMemorialSummary(memberNumber) {
    return this.query(`
      WITH family_tree AS (
        SELECT DISTINCT p.* 
        FROM core.persons p
        JOIN core.members m ON p.id = m.person_id
        JOIN core.family_relationships fr ON (p.id = fr.person_id OR p.id = fr.related_person_id)
        JOIN core.persons primary_member ON (
          fr.person_id = primary_member.id OR fr.related_person_id = primary_member.id
        )
        JOIN core.members pm ON primary_member.id = pm.person_id
        WHERE pm.member_number = $1
      ),
      financial_summary AS (
        SELECT 
          p.id,
          COALESCE(SUM(fa.pre_paid_amount), 0) as memorial_prepaid,
          COALESCE(SUM(fa.balance), 0) as current_balance
        FROM family_tree p
        LEFT JOIN finance.accounts fa ON p.id = fa.person_id
        WHERE fa.account_type = 'memorial'
        GROUP BY p.id
      )
      SELECT 
        ft.*,
        fs.memorial_prepaid,
        fs.current_balance,
        po.property_address
      FROM family_tree ft
      LEFT JOIN financial_summary fs ON ft.id = fs.id
      LEFT JOIN property.ownership po ON ft.id = po.person_id
      WHERE po.is_primary = true OR po.id IS NULL
    `, [memberNumber]);
  }
}
```

### Benefits for Your Scenario

1. **Single Application** - Submit one application that automatically links all family data
2. **Financial Clarity** - Immediate visibility into pre-paid amounts and remaining balances  
3. **Relationship Tracking** - System knows family connections across generations
4. **Property Context** - Cottage/lot associations provide full family picture
5. **Streamlined Approval** - Pre-paid fees enable faster processing
6. **Historical Continuity** - Maintains complete family member legacy

This design ensures that complex family situations like yours are handled elegantly with minimal data entry while maintaining complete accuracy and relationship integrity.