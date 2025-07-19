/**
 * Create Members for Existing Persons
 * This script creates member records for persons who don't have them yet
 */
import dotenv from 'dotenv';
import { createDualWriteManager } from '../lib/database/dual-write-manager.js';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function createMembersForPersons() {
    const DATABASE_URL = process.env.DATABASE_URL;
    
    if (!DATABASE_URL) {
        console.error('DATABASE_URL not found in environment variables');
        process.exit(1);
    }

    const manager = createDualWriteManager(DATABASE_URL);

    try {
        await manager.connect();
        console.log('🔄 Creating Members for Existing Persons\n');

        // Check current state
        const personsCount = await manager.pgClient.query('SELECT COUNT(*) as count FROM core.persons');
        const membersCount = await manager.pgClient.query('SELECT COUNT(*) as count FROM core.members');
        
        console.log(`Current state:`);
        console.log(`  Persons: ${personsCount.rows[0].count}`);
        console.log(`  Members: ${membersCount.rows[0].count}\n`);

        // Get persons without member records (exclude deceased)
        const nonMembers = await manager.pgClient.query(`
            SELECT p.id, p.first_name, p.last_name, p.primary_email
            FROM core.persons p 
            LEFT JOIN core.members m ON p.id = m.person_id 
            WHERE m.id IS NULL 
            AND p.person_type != 'deceased'
            ORDER BY p.id
            LIMIT 15
        `);

        if (nonMembers.rows.length === 0) {
            console.log('No active persons without member records found.');
            return;
        }

        console.log(`Found ${nonMembers.rows.length} persons to make members.\n`);

        let created = 0;
        for (const person of nonMembers.rows) {
            try {
                // Generate member number (format: M2025XXXX)
                const memberNumber = `M2025${String(1000 + created).padStart(4, '0')}`;
                
                await manager.pgClient.query(`
                    INSERT INTO core.members (
                        person_id, 
                        member_number, 
                        membership_type, 
                        status,
                        membership_start_date, 
                        voting_eligible,
                        board_eligible
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7
                    )
                `, [
                    person.id,
                    memberNumber,
                    created < 5 ? 'leaseholder' : 'associate',
                    'active',
                    '2025-01-01',
                    created < 8, // First 8 are voting eligible
                    created < 5  // First 5 are board eligible
                ]);
                
                console.log(`✅ Created member ${memberNumber} for ${person.first_name} ${person.last_name}`);
                created++;
            } catch (error) {
                console.error(`❌ Failed to create member for ${person.first_name} ${person.last_name}:`, error.message);
            }
        }

        // Final count
        const finalMembersCount = await manager.pgClient.query('SELECT COUNT(*) as count FROM core.members');
        console.log(`\n✅ Created ${created} new members`);
        console.log(`Total members now: ${finalMembersCount.rows[0].count}`);

    } catch (error) {
        console.error('Failed to create members:', error.message);
        console.error(error.stack);
    } finally {
        await manager.disconnect();
    }
}

createMembersForPersons();