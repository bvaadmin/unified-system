# QuickBooks Integration Architecture
**Bay View Association - T-BACKLOG-018**

## Overview

This document outlines the comprehensive QuickBooks integration architecture for Bay View Association, enabling seamless financial data synchronization between the Bay View unified system and QuickBooks Desktop/Online for the 150-year-old Chautauqua community.

## Business Requirements

### Integration Objectives
- **Bi-directional Sync**: Real-time synchronization of financial transactions
- **Chart of Accounts**: Maintain consistent account structure across systems
- **Customer Management**: Sync cottage owners and members as QB customers
- **Transaction Matching**: Automated reconciliation of payments and invoices
- **Reporting Consistency**: Ensure financial reports match between systems

### Bay View Specific Context
- **Cottage-based Customers**: Each cottage represents a QB customer
- **Assessment Invoicing**: Annual cottage assessments as QB invoices
- **Multiple Revenue Streams**: Chapel services, programs, memorial garden
- **Member vs Non-member Rates**: Different pricing structures
- **Seasonal Cash Flow**: Summer-heavy revenue patterns

## Technical Architecture

### Integration Approach

#### QuickBooks Desktop Integration
```javascript
// Using QB Web Connector and QBXML
const qbDesktopIntegration = {
  protocol: 'QBXML via Web Connector',
  authentication: 'Certificate-based',
  realTimeSync: false, // Batch processing
  syncFrequency: 'hourly',
  dataFormat: 'XML'
};
```

#### QuickBooks Online Integration
```javascript
// Using QB Online API v3
const qbOnlineIntegration = {
  protocol: 'REST API v3',
  authentication: 'OAuth 2.0',
  realTimeSync: true,
  syncFrequency: 'real-time',
  dataFormat: 'JSON'
};
```

### Database Schema for Integration

```sql
-- QuickBooks integration tracking
CREATE SCHEMA IF NOT EXISTS quickbooks;

-- QB connection and authentication
CREATE TABLE quickbooks.connections (
  id SERIAL PRIMARY KEY,
  connection_type VARCHAR(20) NOT NULL, -- 'desktop' or 'online'
  company_id VARCHAR(100), -- QB Company ID
  realm_id VARCHAR(50), -- QB Online Realm ID
  access_token TEXT, -- OAuth token (encrypted)
  refresh_token TEXT, -- OAuth refresh token (encrypted)
  token_expires_at TIMESTAMP WITH TIME ZONE,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  sync_status VARCHAR(20) DEFAULT 'active', -- active, inactive, error
  connection_config JSONB, -- Additional configuration
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Sync mapping between Bay View and QB entities
CREATE TABLE quickbooks.entity_mappings (
  id SERIAL PRIMARY KEY,
  connection_id INTEGER REFERENCES quickbooks.connections(id),
  bay_view_table VARCHAR(50) NOT NULL, -- e.g., 'core.persons', 'property.locations'
  bay_view_id INTEGER NOT NULL,
  quickbooks_type VARCHAR(30) NOT NULL, -- Customer, Item, Account, Invoice, etc.
  quickbooks_id VARCHAR(50) NOT NULL, -- QB internal ID
  quickbooks_name VARCHAR(255), -- Display name in QB
  sync_direction VARCHAR(20) DEFAULT 'bidirectional', -- to_qb, from_qb, bidirectional
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(connection_id, bay_view_table, bay_view_id, quickbooks_type)
);

-- Sync log for troubleshooting
CREATE TABLE quickbooks.sync_log (
  id SERIAL PRIMARY KEY,
  connection_id INTEGER REFERENCES quickbooks.connections(id),
  sync_type VARCHAR(30) NOT NULL, -- full_sync, incremental, manual
  entity_type VARCHAR(30), -- Customer, Item, Invoice, Payment, etc.
  operation VARCHAR(20) NOT NULL, -- create, update, delete, query
  bay_view_entity_id INTEGER,
  quickbooks_entity_id VARCHAR(50),
  status VARCHAR(20) NOT NULL, -- success, error, warning
  request_data JSONB, -- Data sent to QB
  response_data JSONB, -- Response from QB
  error_message TEXT,
  processing_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Conflict resolution for sync issues
CREATE TABLE quickbooks.sync_conflicts (
  id SERIAL PRIMARY KEY,
  connection_id INTEGER REFERENCES quickbooks.connections(id),
  entity_mapping_id INTEGER REFERENCES quickbooks.entity_mappings(id),
  conflict_type VARCHAR(30) NOT NULL, -- data_mismatch, duplicate_record, permission_denied
  bay_view_data JSONB, -- Current Bay View data
  quickbooks_data JSONB, -- Current QB data
  resolution_strategy VARCHAR(30), -- manual, bay_view_wins, quickbooks_wins, merge
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by INTEGER REFERENCES core.persons(id),
  resolution_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Core Integration Components

#### 1. Authentication & Connection Management

```javascript
// QuickBooks Online OAuth 2.0 Flow
class QBOAuthManager {
  async initiateConnection() {
    const authUrl = `https://appcenter.intuit.com/connect/oauth2?` +
      `client_id=${process.env.QB_CLIENT_ID}&` +
      `scope=com.intuit.quickbooks.accounting&` +
      `redirect_uri=${process.env.QB_REDIRECT_URI}&` +
      `response_type=code&access_type=offline`;
    
    return authUrl;
  }
  
  async exchangeCodeForTokens(authCode, realmId) {
    const tokenResponse = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: authCode,
        redirect_uri: process.env.QB_REDIRECT_URI
      })
    });
    
    const tokens = await tokenResponse.json();
    await this.storeConnection(tokens, realmId);
    return tokens;
  }
  
  async refreshTokens(connectionId) {
    // Implement token refresh logic
    // Store updated tokens securely
  }
}
```

#### 2. Customer Synchronization

```javascript
// Sync cottage owners as QB customers
class CustomerSync {
  async syncCottageOwners() {
    const cottageOwners = await this.getBayViewCottageOwners();
    
    for (const owner of cottageOwners) {
      const qbCustomer = await this.mapToQBCustomer(owner);
      
      const existingMapping = await this.getEntityMapping(
        'core.persons', owner.person_id, 'Customer'
      );
      
      if (existingMapping) {
        await this.updateQBCustomer(existingMapping.quickbooks_id, qbCustomer);
      } else {
        const newCustomer = await this.createQBCustomer(qbCustomer);
        await this.createEntityMapping(
          'core.persons', owner.person_id, 'Customer',
          newCustomer.Id, newCustomer.Name
        );
      }
    }
  }
  
  mapToQBCustomer(owner) {
    return {
      Name: `${owner.cottage_id} - ${owner.first_name} ${owner.last_name}`,
      CompanyName: `Cottage ${owner.cottage_id}`,
      BillAddr: {
        Line1: owner.mailing_address?.street,
        Line2: owner.mailing_address?.street2,
        City: owner.mailing_address?.city,
        CountrySubDivisionCode: owner.mailing_address?.state,
        PostalCode: owner.mailing_address?.postal_code,
        Country: 'USA'
      },
      PrimaryEmailAddr: { Address: owner.email },
      PrimaryPhone: { FreeFormNumber: owner.phone },
      Notes: `Bay View Cottage ${owner.cottage_id} - Member: ${owner.is_member}`
    };
  }
}
```

#### 3. Chart of Accounts Synchronization

```javascript
// Maintain consistent account structure
class ChartOfAccountsSync {
  // Standard Bay View Chart of Accounts
  static STANDARD_ACCOUNTS = {
    // Assets
    '1000': { name: 'Checking Account', type: 'Bank' },
    '1200': { name: 'Accounts Receivable', type: 'Accounts Receivable' },
    '1500': { name: 'Cottage Assessments Receivable', type: 'Accounts Receivable' },
    
    // Revenue
    '4000': { name: 'Cottage Assessments', type: 'Income' },
    '4100': { name: 'Chapel Service Fees', type: 'Income' },
    '4200': { name: 'Program Registration Fees', type: 'Income' },
    '4300': { name: 'Memorial Garden Fees', type: 'Income' },
    '4900': { name: 'Other Income', type: 'Income' },
    
    // Expenses
    '6000': { name: 'Grounds Maintenance', type: 'Expense' },
    '6100': { name: 'Chapel Operations', type: 'Expense' },
    '6200': { name: 'Administrative Expenses', type: 'Expense' },
    '6300': { name: 'Insurance', type: 'Expense' },
    '6400': { name: 'Utilities', type: 'Expense' }
  };
  
  async syncChartOfAccounts() {
    for (const [number, account] of Object.entries(this.STANDARD_ACCOUNTS)) {
      await this.ensureAccountExists(number, account);
    }
  }
  
  async ensureAccountExists(accountNumber, accountInfo) {
    const existingAccount = await this.findQBAccount(accountNumber);
    
    if (!existingAccount) {
      const newAccount = await this.createQBAccount({
        AcctNum: accountNumber,
        Name: accountInfo.name,
        AccountType: accountInfo.type,
        AccountSubType: this.getSubType(accountInfo.type)
      });
      
      await this.createEntityMapping(
        'config.settings', `account_${accountNumber}`, 'Account',
        newAccount.Id, newAccount.Name
      );
    }
  }
}
```

#### 4. Invoice and Payment Synchronization

```javascript
// Sync assessments and payments
class TransactionSync {
  async syncCottageAssessments(periodYear) {
    const assessments = await this.getCottageAssessments(periodYear);
    
    for (const assessment of assessments) {
      const customerMapping = await this.getCustomerMapping(assessment.property_id);
      
      if (!customerMapping) {
        console.warn(`No QB customer mapping for cottage ${assessment.cottage_id}`);
        continue;
      }
      
      const qbInvoice = {
        CustomerRef: { value: customerMapping.quickbooks_id },
        Line: [{
          Amount: assessment.assessment_amount,
          DetailType: 'SalesItemLineDetail',
          SalesItemLineDetail: {
            ItemRef: { value: await this.getAssessmentItemId() },
            Qty: 1,
            UnitPrice: assessment.assessment_amount
          }
        }],
        DueDate: assessment.due_date,
        DocNumber: `${periodYear}-${assessment.cottage_id}`,
        Memo: `${periodYear} Annual Cottage Assessment - ${assessment.cottage_id}`
      };
      
      await this.createOrUpdateQBInvoice(assessment.id, qbInvoice);
    }
  }
  
  async syncPayments() {
    const unSyncedPayments = await this.getUnSyncedPayments();
    
    for (const payment of unSyncedPayments) {
      const invoiceMapping = await this.getInvoiceMapping(payment.assessment_id);
      const customerMapping = await this.getCustomerMapping(payment.property_id);
      
      const qbPayment = {
        CustomerRef: { value: customerMapping.quickbooks_id },
        TotalAmt: payment.amount,
        PaymentMethodRef: { value: await this.getPaymentMethodId(payment.payment_method) },
        TxnDate: payment.payment_date,
        Line: [{
          Amount: payment.amount,
          LinkedTxn: [{
            TxnId: invoiceMapping.quickbooks_id,
            TxnType: 'Invoice'
          }]
        }]
      };
      
      await this.createQBPayment(payment.id, qbPayment);
    }
  }
}
```

### API Endpoints

#### Connection Management
```javascript
// POST /api/quickbooks/connect
// Initiate QB connection (OAuth flow start)

// GET /api/quickbooks/callback?code={auth_code}&realmId={realm_id}
// Handle OAuth callback and complete connection

// DELETE /api/quickbooks/disconnect
// Disconnect QB integration

// GET /api/quickbooks/status
// Get connection status and last sync times
```

#### Synchronization
```javascript
// POST /api/quickbooks/sync/full
// Trigger full synchronization (customers, accounts, transactions)

// POST /api/quickbooks/sync/incremental
// Sync only changed data since last sync

// POST /api/quickbooks/sync/customers
// Sync cottage owners as QB customers

// POST /api/quickbooks/sync/transactions
// Sync assessments, payments, and invoices

// GET /api/quickbooks/sync/status
// Get current sync status and progress
```

#### Conflict Resolution
```javascript
// GET /api/quickbooks/conflicts
// List unresolved sync conflicts

// PUT /api/quickbooks/conflicts/:id/resolve
// Resolve specific conflict with chosen strategy

// POST /api/quickbooks/conflicts/resolve-all
// Bulk resolve conflicts with default strategies
```

### Error Handling & Monitoring

#### Retry Logic
```javascript
class QBAPIClient {
  async makeRequest(endpoint, data, options = {}) {
    const maxRetries = options.retries || 3;
    const baseDelay = options.baseDelay || 1000;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.httpClient.request(endpoint, data);
        await this.logSyncAction('success', endpoint, data, response);
        return response;
      } catch (error) {
        if (this.isRetryableError(error) && attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1);
          await this.sleep(delay);
          continue;
        }
        
        await this.logSyncAction('error', endpoint, data, null, error);
        throw error;
      }
    }
  }
  
  isRetryableError(error) {
    return error.status === 429 || // Rate limited
           error.status === 502 || // Bad gateway
           error.status === 503 || // Service unavailable
           error.status === 504;   // Gateway timeout
  }
}
```

#### Rate Limiting
```javascript
// QB Online has rate limits: 500 requests per minute per app
class RateLimiter {
  constructor(requestsPerMinute = 450) { // Leave buffer
    this.requestsPerMinute = requestsPerMinute;
    this.requests = [];
  }
  
  async acquirePermit() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Remove old requests outside the window
    this.requests = this.requests.filter(time => time > oneMinuteAgo);
    
    if (this.requests.length >= this.requestsPerMinute) {
      const oldestRequest = Math.min(...this.requests);
      const waitTime = (oldestRequest + 60000) - now;
      await this.sleep(waitTime);
      return this.acquirePermit();
    }
    
    this.requests.push(now);
  }
}
```

### Security & Compliance

#### Data Encryption
```javascript
// Encrypt sensitive QB tokens
const crypto = require('crypto');

class TokenManager {
  static encrypt(text) {
    const cipher = crypto.createCipher('aes-256-cbc', process.env.QB_ENCRYPTION_KEY);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }
  
  static decrypt(encryptedText) {
    const decipher = crypto.createDecipher('aes-256-cbc', process.env.QB_ENCRYPTION_KEY);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}
```

#### Audit Trail
```javascript
// Log all QB interactions for compliance
async function logQBInteraction(action, entityType, entityId, data) {
  await db.query(`
    INSERT INTO quickbooks.sync_log (
      connection_id, sync_type, entity_type, operation,
      bay_view_entity_id, request_data, status, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
  `, [connectionId, 'api_call', entityType, action, entityId, data, 'initiated']);
}
```

## Implementation Plan

### Phase 1: Foundation (Week 1-2)
- Database schema setup
- OAuth 2.0 authentication flow
- Basic connection management
- Rate limiting and error handling

### Phase 2: Core Sync (Week 3-4)
- Customer synchronization (cottage owners)
- Chart of accounts setup
- Basic invoice creation
- Payment recording

### Phase 3: Advanced Features (Week 5-6)
- Bi-directional sync
- Conflict resolution
- Incremental sync optimization
- Bulk operations

### Phase 4: Monitoring & Reporting (Week 7-8)
- Sync status dashboard
- Error monitoring and alerts
- Performance optimization
- Reporting consistency validation

## Testing Strategy

### Unit Tests
- API client functions
- Data transformation logic
- Error handling scenarios
- Rate limiting behavior

### Integration Tests
- Full OAuth flow
- End-to-end sync processes
- QB API error responses
- Database transaction integrity

### Load Testing
- High-volume sync operations
- Rate limit compliance
- Connection pooling under load
- Memory usage optimization

## Deployment & Monitoring

### Environment Configuration
```javascript
// Production environment variables
const config = {
  QB_CLIENT_ID: process.env.QB_CLIENT_ID,
  QB_CLIENT_SECRET: process.env.QB_CLIENT_SECRET,
  QB_REDIRECT_URI: process.env.QB_REDIRECT_URI,
  QB_ENCRYPTION_KEY: process.env.QB_ENCRYPTION_KEY,
  QB_RATE_LIMIT: parseInt(process.env.QB_RATE_LIMIT) || 450,
  QB_SYNC_FREQUENCY: process.env.QB_SYNC_FREQUENCY || '0 */4 * * *' // Every 4 hours
};
```

### Monitoring Metrics
- Sync success/failure rates
- API response times
- Token refresh success
- Data consistency checks
- Error frequency by type

### Alert Thresholds
- Sync failures > 5% in 1 hour
- API response time > 10 seconds
- Token refresh failures
- Data inconsistency detection

## Success Criteria

### Technical Metrics
- **Sync Reliability**: >99% success rate for routine syncs
- **Data Consistency**: <0.1% discrepancy between systems
- **Performance**: Full sync completes within 30 minutes
- **Uptime**: 99.9% integration availability

### Business Impact
- **Time Savings**: 80% reduction in manual data entry
- **Accuracy**: 95% reduction in reconciliation errors
- **Cash Flow**: Real-time visibility into receivables
- **Reporting**: Automated financial statement preparation

---

*This integration architecture ensures seamless financial data flow between Bay View's unified system and QuickBooks while maintaining the integrity and traditions of the 150-year-old Chautauqua community.*
