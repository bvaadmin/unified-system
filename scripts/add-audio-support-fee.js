/**
 * Add Audio Support Fee for Crouse Chapel Services
 * This script adds a $25 audio support fee for weddings and memorial services
 */
import dotenv from 'dotenv';
import { createDualWriteManager } from '../lib/database/dual-write-manager.js';

// Load environment variables
dotenv.config();

async function addAudioSupportFee() {
    const DATABASE_URL = process.env.DATABASE_URL;
    
    if (!DATABASE_URL) {
        console.error('DATABASE_URL not found in environment variables');
        process.exit(1);
    }

    const manager = createDualWriteManager(DATABASE_URL);

    try {
        await manager.connect();
        console.log('🎧 Adding Audio Support Fee for Crouse Chapel Services\n');

        // First, ensure FINANCE category exists
        const categoryCheck = await manager.pgClient.query(`
            SELECT * FROM config.categories WHERE category_code = 'FINANCE'
        `);

        let categoryId;
        if (categoryCheck.rows.length === 0) {
            // Create FINANCE category
            const categoryResult = await manager.pgClient.query(`
                INSERT INTO config.categories (category_code, category_name, description, sort_order)
                VALUES ('FINANCE', 'Finance', 'Financial settings and fee configurations', 1)
                RETURNING id
            `);
            categoryId = categoryResult.rows[0].id;
            console.log('✅ Created FINANCE category');
        } else {
            categoryId = categoryCheck.rows[0].id;
        }

        // Check if audio support fee already exists
        const existingFee = await manager.pgClient.query(`
            SELECT * FROM config.settings 
            WHERE setting_key = 'chapel_audio_support_fee' 
            AND category_id = $1
        `, [categoryId]);

        if (existingFee.rows.length > 0) {
            console.log(`⚠️  Audio support fee already exists: $${existingFee.rows[0].value_number}`);
            console.log('    Current value: $' + existingFee.rows[0].value_number);
            
            // Update the value if it's different
            if (parseFloat(existingFee.rows[0].value_number) !== 25.00) {
                await manager.pgClient.query(`
                    UPDATE config.settings 
                    SET value_number = 25.00,
                        value_text = '25.00',
                        updated_at = CURRENT_TIMESTAMP,
                        description = 'Audio technician support fee for Crouse Chapel services (weddings and memorial services)'
                    WHERE id = $1
                `, [existingFee.rows[0].id]);
                console.log('    ✅ Updated to $25.00');
            }
        } else {
            // Add the audio support fee
            const insertResult = await manager.pgClient.query(`
                INSERT INTO config.settings (
                    category_id, 
                    setting_key, 
                    setting_name,
                    description,
                    value_text,
                    value_number,
                    data_type,
                    unit,
                    is_required,
                    is_active,
                    created_by
                )
                VALUES (
                    $1,
                    'chapel_audio_support_fee',
                    'Chapel Audio Support Fee',
                    'Audio technician support fee for Crouse Chapel services (weddings and memorial services)',
                    '25.00',
                    25.00,
                    'number',
                    'USD',
                    true,
                    true,
                    1
                )
                RETURNING *;
            `, [categoryId]);

            console.log('✅ Audio support fee added successfully!');
            console.log(`   Key: ${insertResult.rows[0].setting_key}`);
            console.log(`   Value: $${insertResult.rows[0].value_number}`);
            console.log(`   Description: ${insertResult.rows[0].description}`);
        }

        // Also check/add the main wedding and memorial fees if they don't exist
        console.log('\n📋 Checking other chapel-related fees...\n');

        const feesToCheck = [
            {
                key: 'chapel_wedding_fee_member',
                name: 'Chapel Wedding Fee (Members)',
                value: 300.00,
                description: 'Wedding ceremony fee for Bay View members at Crouse Chapel'
            },
            {
                key: 'chapel_wedding_fee_nonmember',
                name: 'Chapel Wedding Fee (Non-Members)',
                value: 750.00,
                description: 'Wedding ceremony fee for non-members at Crouse Chapel'
            },
            {
                key: 'chapel_memorial_fee_member',
                name: 'Chapel Memorial Fee (Members)',
                value: 0.00,
                description: 'Memorial/funeral service fee for Bay View members at Crouse Chapel (typically no charge)'
            },
            {
                key: 'chapel_memorial_fee_nonmember',
                name: 'Chapel Memorial Fee (Non-Members)',
                value: 300.00,
                description: 'Memorial/funeral service fee for non-members at Crouse Chapel'
            }
        ];

        for (const fee of feesToCheck) {
            const exists = await manager.pgClient.query(`
                SELECT * FROM config.settings 
                WHERE setting_key = $1 AND category_id = $2
            `, [fee.key, categoryId]);

            if (exists.rows.length === 0) {
                await manager.pgClient.query(`
                    INSERT INTO config.settings (
                        category_id,
                        setting_key,
                        setting_name,
                        description,
                        value_text,
                        value_number,
                        data_type,
                        unit,
                        is_required,
                        is_active,
                        created_by
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, 'number', 'USD', true, true, 1)
                `, [categoryId, fee.key, fee.name, fee.description, fee.value.toFixed(2), fee.value]);
                console.log(`✅ Added ${fee.key}: $${fee.value.toFixed(2)}`);
            } else {
                console.log(`   ${fee.key}: $${exists.rows[0].value_number} (already exists)`);
            }
        }

        // Display all chapel-related fees
        console.log('\n💰 Current Chapel Service Fees:');
        console.log('=' .repeat(60));
        
        const allFees = await manager.pgClient.query(`
            SELECT setting_key, setting_name, value_number, description
            FROM config.settings
            WHERE category_id = $1 
            AND setting_key LIKE 'chapel_%'
            ORDER BY setting_key;
        `, [categoryId]);

        allFees.rows.forEach(fee => {
            console.log(`\n${fee.setting_name}:`);
            console.log(`  Key: ${fee.setting_key}`);
            console.log(`  Amount: $${parseFloat(fee.value_number).toFixed(2)}`);
            if (fee.description) {
                console.log(`  Description: ${fee.description}`);
            }
        });

        // Calculate total fees for different scenarios
        console.log('\n💡 Total Fee Calculations (including $25 audio support):');
        console.log('-' .repeat(60));

        // Get the current values from database
        const feeValues = {};
        for (const row of allFees.rows) {
            feeValues[row.setting_key] = parseFloat(row.value_number);
        }

        const audioFee = feeValues['chapel_audio_support_fee'] || 25.00;
        const memberWeddingFee = feeValues['chapel_wedding_fee_member'] || 300.00;
        const nonmemberWeddingFee = feeValues['chapel_wedding_fee_nonmember'] || 750.00;
        const memberMemorialFee = feeValues['chapel_memorial_fee_member'] || 0.00;
        const nonmemberMemorialFee = feeValues['chapel_memorial_fee_nonmember'] || 300.00;

        console.log(`\nMember Wedding:`);
        console.log(`  Base fee: $${memberWeddingFee.toFixed(2)}`);
        console.log(`  Audio support: $${audioFee.toFixed(2)}`);
        console.log(`  TOTAL: $${(memberWeddingFee + audioFee).toFixed(2)}`);

        console.log(`\nNon-member Wedding:`);
        console.log(`  Base fee: $${nonmemberWeddingFee.toFixed(2)}`);
        console.log(`  Audio support: $${audioFee.toFixed(2)}`);
        console.log(`  TOTAL: $${(nonmemberWeddingFee + audioFee).toFixed(2)}`);

        console.log(`\nMember Memorial Service:`);
        console.log(`  Base fee: $${memberMemorialFee.toFixed(2)}`);
        console.log(`  Audio support: $${audioFee.toFixed(2)}`);
        console.log(`  TOTAL: $${(memberMemorialFee + audioFee).toFixed(2)}`);

        console.log(`\nNon-member Memorial Service:`);
        console.log(`  Base fee: $${nonmemberMemorialFee.toFixed(2)}`);
        console.log(`  Audio support: $${audioFee.toFixed(2)}`);
        console.log(`  TOTAL: $${(nonmemberMemorialFee + audioFee).toFixed(2)}`);

        console.log('\n✅ Chapel fee configuration complete!');

    } catch (error) {
        console.error('❌ Error adding audio support fee:', error.message);
        if (error.detail) {
            console.error('   Details:', error.detail);
        }
        process.exit(1);
    } finally {
        await manager.disconnect();
    }
}

// Run the script
addAudioSupportFee();