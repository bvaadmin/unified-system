/**
 * Test Configuration Management APIs
 */
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const BASE_URL = 'http://localhost:3000/api/config';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

async function testConfigurationAPIs() {
    console.log('🧪 Testing Configuration Management APIs\n');

    try {
        // Test 1: Get all categories
        console.log('1. Getting all configuration categories:');
        const categoriesResponse = await fetch(`${BASE_URL}/get-settings`);
        const categories = await categoriesResponse.json();
        
        if (categories.success) {
            console.log('✅ Categories retrieved:');
            categories.categories.forEach(cat => {
                console.log(`   ${cat.category_code}: ${cat.category_name} (${cat.setting_count} settings)`);
            });
        } else {
            console.log('❌ Failed to get categories:', categories.error);
        }

        // Test 2: Get settings in FINANCE category
        console.log('\n2. Getting FINANCE category settings:');
        const financeResponse = await fetch(`${BASE_URL}/get-settings?category=FINANCE`);
        const financeSettings = await financeResponse.json();
        
        if (financeSettings.success) {
            console.log('✅ Finance settings:');
            financeSettings.settings.forEach(setting => {
                console.log(`   ${setting.setting_key}: ${setting.value} ${setting.unit || ''}`);
            });
        }

        // Test 3: Get specific setting
        console.log('\n3. Getting specific setting (annual_budget for PROGRAMS_MUSIC):');
        const budgetResponse = await fetch(`${BASE_URL}/get-settings?key=annual_budget&category=PROGRAMS_MUSIC`);
        const budget = await budgetResponse.json();
        
        if (budget.success) {
            console.log(`✅ Music Program Budget: $${budget.setting.value}`);
        }

        // Test 4: Update a setting (requires admin token)
        console.log('\n4. Updating Education Program budget:');
        const updateResponse = await fetch(`${BASE_URL}/update-setting`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ADMIN_TOKEN}`
            },
            body: JSON.stringify({
                key: 'annual_budget',
                category: 'PROGRAMS_EDUCATION',
                value: 90000,
                reason: 'Budget increase for new lecture series'
            })
        });
        const updateResult = await updateResponse.json();
        
        if (updateResult.success) {
            console.log(`✅ Budget updated: $${updateResult.oldValue} → $${updateResult.newValue}`);
            console.log(`   Reason: ${updateResult.reason}`);
        } else {
            console.log('❌ Update failed:', updateResult.error);
        }

        // Test 5: Get configuration history
        console.log('\n5. Getting configuration history:');
        const historyResponse = await fetch(`${BASE_URL}/get-history?key=annual_budget&limit=5`);
        const history = await historyResponse.json();
        
        if (history.success) {
            console.log(`✅ Found ${history.pagination.total} history entries:`);
            history.history.forEach(entry => {
                console.log(`   ${new Date(entry.changed_at).toLocaleString()}: ${entry.old_value_text} → ${entry.new_value_text}`);
                console.log(`     Reason: ${entry.change_reason}`);
            });
        }

        // Test 6: Environment-specific override
        console.log('\n6. Setting development environment override:');
        const overrideResponse = await fetch(`${BASE_URL}/update-setting`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ADMIN_TOKEN}`
            },
            body: JSON.stringify({
                key: 'stripe_fee_percentage',
                category: 'FINANCE',
                value: 0, // Free in development
                environment: 'development',
                reason: 'No fees in development environment'
            })
        });
        const overrideResult = await overrideResponse.json();
        
        if (overrideResult.success) {
            console.log(`✅ Development override created`);
            console.log(`   Production: 2.9% → Development: ${overrideResult.newValue}%`);
        }

        // Test 7: Get value with environment override
        console.log('\n7. Getting value with environment override:');
        const devValueResponse = await fetch(`${BASE_URL}/get-settings?key=stripe_fee_percentage&category=FINANCE&environment=development`);
        const devValue = await devValueResponse.json();
        
        if (devValue.success) {
            console.log(`✅ Stripe fee in development: ${devValue.setting.value}%`);
        }

        console.log('\n🎉 Configuration API tests completed!');
        
    } catch (error) {
        console.error('Test failed:', error.message);
    }
}

// Run tests if executed directly
if (process.argv[1].endsWith('test-configuration-api.js')) {
    testConfigurationAPIs();
}

export { testConfigurationAPIs };