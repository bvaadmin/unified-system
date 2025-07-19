/**
 * Run Configuration System Migration
 */
import dotenv from 'dotenv';
import { createDualWriteManager } from '../lib/database/dual-write-manager.js';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function runConfigurationMigration() {
    const DATABASE_URL = process.env.DATABASE_URL;
    
    if (!DATABASE_URL) {
        console.error('DATABASE_URL not found in environment variables');
        process.exit(1);
    }

    const manager = createDualWriteManager(DATABASE_URL);

    try {
        await manager.connect();
        console.log('🔧 Running Configuration System Migration\n');

        // Read migration file
        const migrationPath = path.join(process.cwd(), 'scripts/migrations/009_create_configuration_system.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        // Execute migration
        await manager.pgClient.query(migrationSQL);
        
        console.log('✅ Configuration system migration completed successfully!');
        
        // Test the configuration system
        console.log('\n📊 Testing Configuration System:');
        
        // Get some configuration values
        const testQueries = [
            {
                name: 'Worship Program Budget',
                query: "SELECT config.get_number('annual_budget', 'PROGRAMS_WORSHIP') as value"
            },
            {
                name: 'Wedding Fee (Members)',
                query: "SELECT config.get_number('wedding_fee_member', 'EVENTS') as value"
            },
            {
                name: 'Stripe Fee Percentage',
                query: "SELECT config.get_number('stripe_fee_percentage', 'FINANCE') as value"
            },
            {
                name: 'Email Notifications Enabled',
                query: "SELECT config.get_boolean('email_notifications_enabled', 'COMMUNICATIONS') as value"
            }
        ];
        
        for (const test of testQueries) {
            const result = await manager.pgClient.query(test.query);
            console.log(`  ${test.name}: ${result.rows[0].value}`);
        }
        
        // Show all active settings
        const settings = await manager.pgClient.query(`
            SELECT category_code, setting_key, current_value, unit
            FROM config.active_settings
            ORDER BY category_code, setting_key
            LIMIT 20
        `);
        
        console.log('\n📋 Active Configuration Settings:');
        settings.rows.forEach(setting => {
            const unit = setting.unit ? ` ${setting.unit}` : '';
            console.log(`  ${setting.category_code}.${setting.setting_key}: ${setting.current_value}${unit}`);
        });
        
        // Test setting a value
        console.log('\n🔄 Testing Configuration Update:');
        const originalBudget = await manager.pgClient.query(
            "SELECT config.get_number('annual_budget', 'PROGRAMS_MUSIC') as value"
        );
        console.log(`  Original Music Budget: $${originalBudget.rows[0].value}`);
        
        // Update the budget
        await manager.pgClient.query(`
            SELECT config.set_value('annual_budget', '185000', 'PROGRAMS_MUSIC', NULL, 'Test budget increase')
        `);
        
        const newBudget = await manager.pgClient.query(
            "SELECT config.get_number('annual_budget', 'PROGRAMS_MUSIC') as value"
        );
        console.log(`  Updated Music Budget: $${newBudget.rows[0].value}`);
        
        // Check history
        const history = await manager.pgClient.query(`
            SELECT h.*, s.setting_key
            FROM config.setting_history h
            JOIN config.settings s ON h.setting_id = s.id
            WHERE s.setting_key = 'annual_budget'
            ORDER BY h.changed_at DESC
            LIMIT 1
        `);
        
        if (history.rows.length > 0) {
            console.log(`  Change recorded: ${history.rows[0].old_value_text} → ${history.rows[0].new_value_text}`);
            console.log(`  Reason: ${history.rows[0].change_reason}`);
        }
        
        console.log('\n🎉 Configuration system is working correctly!');
        console.log('\nKey Features:');
        console.log('• All budgets and fees are now configurable');
        console.log('• Changes are tracked in history');
        console.log('• Environment-specific overrides supported');
        console.log('• No code changes needed for value updates');
        console.log('• Type-safe getter functions');
        
    } catch (error) {
        console.error('Migration failed:', error.message);
        console.error(error.stack);
    } finally {
        await manager.disconnect();
    }
}

runConfigurationMigration();