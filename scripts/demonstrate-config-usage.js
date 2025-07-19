/**
 * Demonstrate Configuration Usage in Application Code
 */
import dotenv from 'dotenv';
import { createDualWriteManager } from '../lib/database/dual-write-manager.js';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function demonstrateConfigUsage() {
    const DATABASE_URL = process.env.DATABASE_URL;
    
    if (!DATABASE_URL) {
        console.error('DATABASE_URL not found in environment variables');
        process.exit(1);
    }

    const manager = createDualWriteManager(DATABASE_URL);

    try {
        await manager.connect();
        console.log('🔧 Demonstrating Configuration Usage in Application\n');

        // Example 1: Calculate wedding fees using configuration
        console.log('1. Wedding Fee Calculation:');
        const memberWedding = await manager.pgClient.query(`
            SELECT events.get_event_fee('wedding', true) as fee
        `);
        const nonMemberWedding = await manager.pgClient.query(`
            SELECT events.get_event_fee('wedding', false) as fee
        `);
        console.log(`   Member Wedding: $${memberWedding.rows[0].fee}`);
        console.log(`   Non-Member Wedding: $${nonMemberWedding.rows[0].fee}`);

        // Example 2: Get program budgets from configuration
        console.log('\n2. Program Budgets from Configuration:');
        const programBudgets = await manager.pgClient.query(`
            SELECT 
                area_code,
                area_name,
                events.get_program_budget(area_code) as configured_budget,
                annual_budget as old_hardcoded_budget
            FROM events.program_areas
            WHERE current_director_id IS NOT NULL
            ORDER BY area_name
        `);
        
        programBudgets.rows.forEach(program => {
            console.log(`   ${program.area_name}: $${program.configured_budget} (was: $${program.old_hardcoded_budget || 'not set'})`);
        });

        // Example 3: Calculate payment processing fees
        console.log('\n3. Payment Processing Fee Calculation:');
        const testAmounts = [100, 500, 1000];
        
        for (const amount of testAmounts) {
            const fees = await manager.pgClient.query(`
                SELECT * FROM finance.calculate_payment_fee($1, 'stripe')
            `, [amount]);
            
            const fee = fees.rows[0];
            console.log(`   $${amount} payment: $${fee.provider_fee} fee, $${fee.net_amount} net`);
        }

        // Example 4: Check system settings
        console.log('\n4. System Settings:');
        const systemSettings = await manager.pgClient.query(`
            SELECT 
                config.get_value('season_start_date', 'SYSTEM') as start_date,
                config.get_value('season_end_date', 'SYSTEM') as end_date,
                config.get_boolean('email_notifications_enabled', 'COMMUNICATIONS') as email_enabled,
                config.get_boolean('sms_notifications_enabled', 'COMMUNICATIONS') as sms_enabled
        `);
        
        const settings = systemSettings.rows[0];
        console.log(`   Season: ${settings.start_date} to ${settings.end_date}`);
        console.log(`   Email Notifications: ${settings.email_enabled ? 'Enabled' : 'Disabled'}`);
        console.log(`   SMS Notifications: ${settings.sms_enabled ? 'Enabled' : 'Disabled'}`);

        // Example 5: Property assessments from configuration
        console.log('\n5. Property Assessment Fees:');
        const assessmentFees = await manager.pgClient.query(`
            SELECT 
                config.get_number('annual_lease_fee_cottage', 'PROPERTY') as cottage_fee,
                config.get_number('annual_lease_fee_lot', 'PROPERTY') as lot_fee
        `);
        
        console.log(`   Cottage Annual Lease: $${assessmentFees.rows[0].cottage_fee}`);
        console.log(`   Lot Annual Lease: $${assessmentFees.rows[0].lot_fee}`);

        // Example 6: Dynamic configuration in a real scenario
        console.log('\n6. Real Scenario - Creating a New Event with Configured Pricing:');
        
        // Get configured member discount percentage (if exists)
        const memberDiscount = await manager.pgClient.query(`
            SELECT config.get_number('member_discount_percentage', 'EVENTS') as discount
        `);
        
        const basePrice = 50.00;
        const discount = memberDiscount.rows[0].discount || 40; // Default 40% if not configured
        const memberPrice = basePrice * (1 - discount / 100);
        
        console.log(`   Base Event Price: $${basePrice}`);
        console.log(`   Member Discount: ${discount}%`);
        console.log(`   Member Price: $${memberPrice.toFixed(2)}`);

        // Example 7: Environment-specific configuration
        console.log('\n7. Environment-Specific Configuration:');
        const environments = ['development', 'staging', 'production'];
        
        for (const env of environments) {
            const stripeFee = await manager.pgClient.query(`
                SELECT config.get_number('stripe_fee_percentage', 'FINANCE', $1) as fee
            `, [env]);
            
            console.log(`   Stripe fee in ${env}: ${stripeFee.rows[0].fee}%`);
        }

        console.log('\n✅ Configuration system is fully integrated!');
        console.log('\nKey Benefits:');
        console.log('• No code changes needed to update fees, budgets, or settings');
        console.log('• All changes are tracked in history');
        console.log('• Environment-specific overrides for dev/staging');
        console.log('• Type-safe getter functions');
        console.log('• Can be managed through API or direct database updates');

    } catch (error) {
        console.error('Demonstration failed:', error.message);
        console.error(error.stack);
    } finally {
        await manager.disconnect();
    }
}

demonstrateConfigUsage();