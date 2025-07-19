# Configuration Management System

## Overview
The Bay View Association unified system now includes a comprehensive configuration management system that allows runtime modification of values like budgets, fees, and settings without requiring code changes. All configuration changes are tracked with a complete audit trail.

## Key Features

### 1. Runtime Configuration
- **No Code Changes**: Update budgets, fees, and settings through API or database
- **Type Safety**: Strong typing for numbers, booleans, dates, JSON, and text
- **Validation**: Min/max values, allowed values, regex patterns
- **Defaults**: Fallback values when not configured

### 2. Environment Overrides
- **Multi-Environment**: Different values for development, staging, production
- **Inheritance**: Falls back to base value if no override exists
- **Testing**: Zero-cost payment processing in development

### 3. Complete Audit Trail
- **History Tracking**: Every change is recorded with who, when, why
- **Approval Workflow**: Support for changes requiring approval
- **Rollback**: Can see previous values and restore if needed

### 4. API Management
- **RESTful APIs**: Get, update, and track configuration changes
- **Authentication**: Admin token required for updates
- **Public Read**: Configuration values can be read without auth

## Configuration Categories

### FINANCE
- Payment provider fees (Stripe, Square, etc.)
- Transaction processing settings
- Financial thresholds and limits

### PROGRAMS
- Annual budgets by program area
- Program-specific settings
- Director allocations

### EVENTS
- Event pricing tiers
- Member/non-member fees
- Discount percentages

### PROPERTY
- Annual lease fees
- Assessment amounts
- Property-related charges

### MEMBERSHIP
- Member categories
- Privileges and benefits
- Voting eligibility rules

### COMMUNICATIONS
- Notification settings
- Email/SMS enablement
- Message templates

### SYSTEM
- Season dates
- General settings
- Feature flags

## Usage Examples

### Getting Configuration Values

```sql
-- Get a specific value
SELECT config.get_value('annual_budget', 'PROGRAMS_WORSHIP');

-- Get typed values
SELECT config.get_number('wedding_fee_member', 'EVENTS');
SELECT config.get_boolean('email_notifications_enabled', 'COMMUNICATIONS');

-- Get with environment override
SELECT config.get_value('stripe_fee_percentage', 'FINANCE', 'development');
```

### Setting Configuration Values

```sql
-- Update a value with history
SELECT config.set_value('annual_budget', '130000', 'PROGRAMS_WORSHIP', 1, 'Board approved increase');

-- Values are immediately available
SELECT events.get_program_budget('WORSHIP'); -- Returns 130000
```

### Using in Application Code

```javascript
// Calculate fees using configuration
const fees = await pgClient.query(`
    SELECT * FROM finance.calculate_payment_fee($1, 'stripe')
`, [100.00]);

// Get event pricing from configuration
const memberFee = await pgClient.query(`
    SELECT events.get_event_fee('wedding', true) as fee
`);
```

## API Endpoints

### GET /api/config/get-settings
Retrieve configuration values

Query Parameters:
- `key` - Specific setting key
- `category` - Filter by category
- `environment` - Override environment (default: production)

### POST /api/config/update-setting
Update a configuration value (requires admin auth)

Body:
```json
{
    "key": "annual_budget",
    "value": "130000",
    "category": "PROGRAMS_WORSHIP",
    "reason": "Board approved increase",
    "environment": "production"
}
```

### GET /api/config/get-history
View configuration change history

Query Parameters:
- `key` - Filter by setting key
- `category` - Filter by category
- `limit` - Results per page
- `offset` - Pagination offset
- `startDate` - Filter by date range
- `endDate` - Filter by date range

## Database Functions

### Getter Functions
- `config.get_value(key, category, environment)` - Get any value as text
- `config.get_number(key, category, environment)` - Get numeric value
- `config.get_boolean(key, category, environment)` - Get boolean value

### Setter Functions
- `config.set_value(key, value, category, changed_by, reason)` - Update with history

### Application Functions
- `events.get_program_budget(area_code)` - Get program budget
- `events.get_event_fee(event_type, is_member)` - Get event pricing
- `finance.calculate_payment_fee(amount, provider)` - Calculate payment fees

## Security Considerations

1. **Read Access**: Configuration values are publicly readable (except sensitive ones)
2. **Write Access**: Only administrators can update values
3. **Sensitive Values**: Marked values show as '***' in queries
4. **Audit Trail**: All changes are permanently logged
5. **Validation**: Type checking and constraint validation

## Migration from Hardcoded Values

The system automatically migrated existing hardcoded values:
- Program budgets from `events.program_areas`
- Wedding fees from hardcoded constants
- Payment provider fees from `finance.payment_providers`
- Property assessment fees from hardcoded values

## Best Practices

1. **Use Configuration for**:
   - Fees and pricing
   - Budgets and allocations
   - Feature flags
   - System settings
   - Thresholds and limits

2. **Don't Use Configuration for**:
   - Security credentials (use env vars)
   - Database schema
   - Business logic
   - Code behavior

3. **Always Include**:
   - Meaningful change reasons
   - Appropriate data types
   - Sensible defaults
   - Clear descriptions

## Example: Adding a New Configuration

```sql
-- Add a new member discount percentage
INSERT INTO config.settings (
    category_id,
    setting_key,
    setting_name,
    description,
    value_number,
    data_type,
    unit,
    min_value,
    max_value,
    default_value
) VALUES (
    (SELECT id FROM config.categories WHERE category_code = 'EVENTS'),
    'member_discount_percentage',
    'Member Discount Percentage',
    'Discount percentage for Bay View members on events',
    40,
    'number',
    'percent',
    0,
    100,
    '40'
);

-- Now use it in the application
SELECT 
    50.00 as base_price,
    config.get_number('member_discount_percentage', 'EVENTS') as discount,
    50.00 * (1 - config.get_number('member_discount_percentage', 'EVENTS') / 100) as member_price;
```

## Monitoring and Maintenance

1. **Review History**: Regularly check configuration changes
2. **Validate Values**: Ensure configurations are within expected ranges
3. **Clean Up**: Remove obsolete configurations
4. **Document**: Keep descriptions updated

## Conclusion

The configuration management system provides Bay View Association with the flexibility to adjust operational parameters without code deployments. This reduces risk, improves agility, and maintains a complete audit trail of all changes. Combined with environment-specific overrides, it enables safe testing and gradual rollouts of configuration changes.