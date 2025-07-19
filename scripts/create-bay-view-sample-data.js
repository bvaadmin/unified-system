/**
 * Create Bay View Association Sample Data
 * Demonstrates Block and Lot system with leaseholding structure
 */
import dotenv from 'dotenv';
import { createDualWriteManager } from '../lib/database/dual-write-manager.js';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function createBayViewSampleData() {
    const DATABASE_URL = process.env.DATABASE_URL;
    
    if (!DATABASE_URL) {
        console.error('DATABASE_URL not found in environment variables');
        process.exit(1);
    }

    const manager = createDualWriteManager(DATABASE_URL);

    try {
        await manager.connect();
        console.log('🏘️ Creating Bay View Association Sample Data\\n');

        // =====================================================
        // 1. CREATE SAMPLE COTTAGES (Block and Lot System)
        // =====================================================
        
        console.log('1. Creating Bay View Properties (Block and Lot System)');
        
        const cottages = [
            // Block 12 (from real sales checklist data)
            {
                block_number: 12,
                lot_number: 7,
                property_type: 'cottage',
                street_address: '1075 Reed Street',
                section: 'The Heights',
                cottage_square_footage: 1200,
                bedrooms: 3,
                bathrooms: 1.5,
                year_built: 1925,
                assessed_value: 125000.00,
                annual_lease_fee: 2500.00,
                utilities: { water: true, electric: true, sewer: true },
                features: { fireplace: true, deck: true, lake_view: false },
                architectural_style: 'Victorian Cottage',
                historical_significance: 'Original Bay View cottage design'
            },
            // Block 39 (from real sales data)
            {
                block_number: 39,
                lot_number: 17,
                property_type: 'cottage',
                street_address: '1230 Bayside Drive',
                section: 'Lakeshore',
                cottage_square_footage: 1800,
                bedrooms: 4,
                bathrooms: 2.0,
                year_built: 1935,
                assessed_value: 185000.00,
                annual_lease_fee: 3200.00,
                utilities: { water: true, electric: true, sewer: true, gas: true },
                features: { fireplace: true, deck: true, dock_access: true, lake_view: true },
                architectural_style: 'Arts and Crafts',
                historical_significance: 'Expanded cottage with original lake access'
            },
            // Block 2 (recent sales activity)
            {
                block_number: 2,
                lot_number: 16,
                property_type: 'cottage',
                street_address: '45 Oak Bluff Avenue',
                section: 'Central Campus',
                cottage_square_footage: 1000,
                bedrooms: 2,
                bathrooms: 1.0,
                year_built: 1920,
                assessed_value: 95000.00,
                annual_lease_fee: 2200.00,
                utilities: { water: true, electric: true, sewer: true },
                features: { screened_porch: true, garden: true },
                architectural_style: 'Classic Bay View',
                historical_significance: 'One of earliest Bay View cottages'
            },
            // Block 33 (another recent sale)
            {
                block_number: 33,
                lot_number: 10,
                property_type: 'cottage',
                street_address: '892 Terrace View',
                section: 'Upper Terrace',
                cottage_square_footage: 1400,
                bedrooms: 3,
                bathrooms: 2.0,
                year_built: 1940,
                assessed_value: 155000.00,
                annual_lease_fee: 2800.00,
                utilities: { water: true, electric: true, sewer: true },
                features: { fireplace: true, deck: true, wooded_lot: true },
                architectural_style: 'Mid-Century',
                lease_status: 'pending_transfer'
            },
            // Add a lot without cottage
            {
                block_number: 45,
                lot_number: 3,
                property_type: 'lot',
                street_address: '15 Woodland Path',
                section: 'Woodland',
                lot_size_square_feet: 8000,
                lot_size_acres: 0.18,
                assessed_value: 35000.00,
                annual_lease_fee: 800.00,
                utilities: { water: false, electric: true, sewer: false },
                features: { wooded: true, buildable: true },
                lease_status: 'available'
            }
        ];

        const createdProperties = [];
        for (const cottage of cottages) {
            const result = await manager.pgClient.query(`
                INSERT INTO property.locations (
                    block_number, lot_number, property_type, street_address, section,
                    lot_size_square_feet, lot_size_acres, cottage_square_footage, 
                    bedrooms, bathrooms, year_built, assessed_value, annual_lease_fee,
                    utilities, features, architectural_style, historical_significance, lease_status
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
                ) RETURNING *
            `, [
                cottage.block_number, cottage.lot_number, cottage.property_type, cottage.street_address,
                cottage.section, cottage.lot_size_square_feet, cottage.lot_size_acres, 
                cottage.cottage_square_footage, cottage.bedrooms, cottage.bathrooms, cottage.year_built,
                cottage.assessed_value, cottage.annual_lease_fee, JSON.stringify(cottage.utilities),
                JSON.stringify(cottage.features), cottage.architectural_style, 
                cottage.historical_significance, cottage.lease_status || 'active'
            ]);
            
            createdProperties.push(result.rows[0]);
            console.log(`   ✅ Created Block ${cottage.block_number} Lot ${cottage.lot_number}: ${cottage.street_address}`);
        }

        // =====================================================
        // 2. CREATE FAMILY GROUPS WITH COTTAGE ASSOCIATIONS
        // =====================================================
        
        console.log('\\n2. Creating Bay View Family Groups');
        
        // Taylor Family - Multi-cottage dynasty (from our sample families)
        const taylorFamilyGroup = await manager.pgClient.query(`
            INSERT INTO core.family_groups (
                group_name, group_type, established_year, primary_cottage_id
            ) VALUES (
                'Taylor Family Trust', 'trust', 1965, $1
            ) RETURNING *
        `, [createdProperties[1].id]); // Block 39 Lot 17
        
        console.log(`   ✅ Created Taylor Family Trust with Block 39 Lot 17`);

        // Williams Family - Legacy family (from our sample families)  
        const williamsFamilyGroup = await manager.pgClient.query(`
            INSERT INTO core.family_groups (
                group_name, group_type, established_year, primary_cottage_id
            ) VALUES (
                'Williams Legacy Family', 'extended', 1925, $1
            ) RETURNING *
        `, [createdProperties[0].id]); // Block 12 Lot 7
        
        console.log(`   ✅ Created Williams Legacy Family with Block 12 Lot 7`);

        // New cottage family
        const hartfordFamilyGroup = await manager.pgClient.query(`
            INSERT INTO core.family_groups (
                group_name, group_type, established_year, primary_cottage_id
            ) VALUES (
                'Hartford Nuclear Family', 'nuclear', 2010, $1
            ) RETURNING *
        `, [createdProperties[2].id]); // Block 2 Lot 16
        
        console.log(`   ✅ Created Hartford Nuclear Family with Block 2 Lot 16`);

        // =====================================================
        // 3. CREATE LEASEHOLDS FOR COTTAGES
        // =====================================================
        
        console.log('\\n3. Creating Bay View Leaseholds');
        
        // Get existing persons from our sample families
        const existingPersons = await manager.pgClient.query(`
            SELECT * FROM core.persons 
            WHERE last_name IN ('Taylor', 'Williams') 
            ORDER BY last_name, first_name
        `);

        if (existingPersons.rows.length === 0) {
            console.log('   ⚠️  No existing sample family persons found. Creating new leaseholders...');
            
            // Create new leaseholders if sample families don't exist
            const williamTaylor = await manager.modern.createPerson({
                person_type: 'member',
                first_name: 'William',
                last_name: 'Taylor',
                date_of_birth: '1945-12-10',
                primary_email: 'william.taylor@email.com',
                primary_phone: '231-555-0501',
                migration_source: 'bay_view_property_demo'
            });

            const margaretWilliams = await manager.modern.createPerson({
                person_type: 'member',
                first_name: 'Margaret',
                last_name: 'Williams',
                date_of_birth: '1930-09-08',
                primary_email: 'margaret.williams@email.com',
                primary_phone: '231-555-0201',
                migration_source: 'bay_view_property_demo'
            });

            const johnHartford = await manager.modern.createPerson({
                person_type: 'member',
                first_name: 'John',
                last_name: 'Hartford',
                date_of_birth: '1975-04-22',
                primary_email: 'john.hartford@email.com',
                primary_phone: '231-555-0601',
                migration_source: 'bay_view_property_demo'
            });

            // Create leaseholds
            const leaseholds = [
                {
                    property_id: createdProperties[1].id, // Block 39 Lot 17
                    person_id: williamTaylor.id,
                    lease_type: 'perpetual_leasehold',
                    is_primary_leaseholder: true,
                    lease_start_date: '1970-06-01',
                    annual_fee: 3200.00,
                    voting_rights: true,
                    board_approved: true
                },
                {
                    property_id: createdProperties[0].id, // Block 12 Lot 7
                    person_id: margaretWilliams.id,
                    lease_type: 'life_lease',
                    is_primary_leaseholder: true,
                    lease_start_date: '1955-05-15',
                    annual_fee: 2500.00,
                    voting_rights: true,
                    board_approved: true
                },
                {
                    property_id: createdProperties[2].id, // Block 2 Lot 16
                    person_id: johnHartford.id,
                    lease_type: 'perpetual_leasehold',
                    is_primary_leaseholder: true,
                    lease_start_date: '2010-08-01',
                    annual_fee: 2200.00,
                    voting_rights: true,
                    board_approved: true
                }
            ];

            for (const leasehold of leaseholds) {
                await manager.pgClient.query(`
                    INSERT INTO property.leaseholds (
                        property_id, person_id, lease_type, is_primary_leaseholder,
                        lease_start_date, annual_fee, voting_rights, board_approved,
                        approval_date, status
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active')
                `, [
                    leasehold.property_id, leasehold.person_id, leasehold.lease_type,
                    leasehold.is_primary_leaseholder, leasehold.lease_start_date,
                    leasehold.annual_fee, leasehold.voting_rights, leasehold.board_approved,
                    '2010-01-01'
                ]);
            }
            
            console.log(`   ✅ Created 3 leaseholds for Bay View cottages`);
        }

        // =====================================================
        // 4. CREATE FINANCIAL ACCOUNTS FOR PROPERTIES
        // =====================================================
        
        console.log('\\n4. Creating Financial Accounts for Cottage Leaseholders');
        
        // Create cottage lease fee accounts for each property
        for (const property of createdProperties.slice(0, 3)) { // First 3 cottages
            const leaseholder = await manager.pgClient.query(`
                SELECT p.* FROM core.persons p
                JOIN property.leaseholds lh ON p.id = lh.person_id
                WHERE lh.property_id = $1 AND lh.is_primary_leaseholder = true
            `, [property.id]);

            if (leaseholder.rows.length > 0) {
                const person = leaseholder.rows[0];
                
                // Create cottage lease account
                const accountNumber = `COT${String(property.block_number).padStart(2, '0')}${String(property.lot_number).padStart(2, '0')}`;
                
                await manager.pgClient.query(`
                    INSERT INTO finance.accounts (
                        person_id, account_type_id, account_number, property_id,
                        billing_cycle, status, opened_date, next_due_date
                    ) VALUES (
                        $1, 
                        (SELECT id FROM finance.account_types WHERE type_name = 'cottage_lease'),
                        $2, $3, 'annual', 'active', '2025-01-01', '2025-12-31'
                    )
                `, [person.id, accountNumber, property.id]);
                
                console.log(`   ✅ Created account ${accountNumber} for ${person.first_name} ${person.last_name} (Block ${property.block_number} Lot ${property.lot_number})`);
            }
        }

        // =====================================================
        // 5. CREATE 2025 ASSESSMENTS
        // =====================================================
        
        console.log('\\n5. Creating 2025 Property Assessments');
        
        for (const property of createdProperties.slice(0, 3)) {
            // Annual lease fee assessment
            await manager.pgClient.query(`
                INSERT INTO property.assessments (
                    property_id, assessment_year, assessment_type, base_amount,
                    due_date, status, approved_by, approval_date
                ) VALUES (
                    $1, 2025, 'annual_lease_fee', $2, '2025-12-31', 'approved', 1, '2024-12-01'
                )
            `, [property.id, property.annual_lease_fee]);
            
            console.log(`   ✅ Created 2025 lease assessment for Block ${property.block_number} Lot ${property.lot_number}: $${property.annual_lease_fee}`);
        }

        // Add special infrastructure assessment
        await manager.pgClient.query(`
            INSERT INTO property.assessments (
                property_id, assessment_year, assessment_type, base_amount,
                special_project_description, due_date, status, approved_by, approval_date
            ) VALUES (
                $1, 2025, 'infrastructure', 850.00, 
                'Sewer system upgrade - Phase 2', '2025-06-30', 'approved', 1, '2025-03-15'
            )
        `, [createdProperties[1].id]); // Block 39 Lot 17 (waterfront property)
        
        console.log(`   ✅ Created special infrastructure assessment for waterfront property`);

        // =====================================================
        // 6. CREATE SAMPLE PROPERTY TRANSFER
        // =====================================================
        
        console.log('\\n6. Creating Sample Property Transfer (Cottage Sale)');
        
        // Create a cottage sale scenario
        const newOwner = await manager.modern.createPerson({
            person_type: 'member',
            first_name: 'Jennifer',
            last_name: 'McKenzie',
            date_of_birth: '1985-09-15',
            primary_email: 'jennifer.mckenzie@email.com',
            primary_phone: '231-555-0701',
            migration_source: 'bay_view_property_demo'
        });

        // Record the cottage transfer for Block 33 Lot 10
        await manager.pgClient.query(`
            INSERT INTO property.transfer_history (
                property_id, to_person_id, transfer_type, transfer_date,
                sale_price, transfer_fee, cottage_sales_checklist_completed,
                electrical_inspection_passed, building_inspection_passed,
                board_approved, approval_date, transfer_notes
            ) VALUES (
                $1, $2, 'sale', '2025-07-15', 155000.00, 500.00, true, true, true,
                true, '2025-07-01', 'Cottage sale to new Bay View member - all inspections passed'
            )
        `, [createdProperties[3].id, newOwner.id]); // Block 33 Lot 10

        // Create new leasehold for the buyer
        await manager.pgClient.query(`
            INSERT INTO property.leaseholds (
                property_id, person_id, lease_type, is_primary_leaseholder,
                lease_start_date, annual_fee, voting_rights, board_approved,
                approval_date, status
            ) VALUES ($1, $2, 'perpetual_leasehold', true, '2025-07-15', 2800.00, true, true, '2025-07-01', 'active')
        `, [createdProperties[3].id, newOwner.id]);

        console.log(`   ✅ Created cottage sale transfer: Block 33 Lot 10 to Jennifer McKenzie ($155,000)`);

        // =====================================================
        // 7. GENERATE SUMMARY REPORT
        // =====================================================
        
        console.log('\\n📊 Bay View Association Property Summary:');
        
        const propertyStats = await manager.pgClient.query(`
            SELECT 
                COUNT(*) as total_properties,
                COUNT(CASE WHEN property_type = 'cottage' THEN 1 END) as cottages,
                COUNT(CASE WHEN property_type = 'lot' THEN 1 END) as lots,
                SUM(assessed_value) as total_assessed_value,
                AVG(annual_lease_fee) as avg_lease_fee
            FROM property.locations
        `);

        const leaseholderStats = await manager.pgClient.query(`
            SELECT 
                COUNT(*) as total_leaseholds,
                COUNT(CASE WHEN lease_type = 'perpetual_leasehold' THEN 1 END) as perpetual_leases,
                COUNT(CASE WHEN lease_type = 'life_lease' THEN 1 END) as life_leases,
                SUM(annual_fee) as total_annual_fees
            FROM property.leaseholds
            WHERE status = 'active'
        `);

        const assessmentStats = await manager.pgClient.query(`
            SELECT 
                COUNT(*) as total_assessments,
                SUM(base_amount) as total_assessment_amount,
                COUNT(CASE WHEN assessment_type = 'annual_lease_fee' THEN 1 END) as lease_assessments,
                COUNT(CASE WHEN assessment_type = 'infrastructure' THEN 1 END) as infrastructure_assessments
            FROM property.assessments
            WHERE assessment_year = 2025
        `);

        const stats = propertyStats.rows[0];
        const leaseStats = leaseholderStats.rows[0];
        const assessStats = assessmentStats.rows[0];

        console.log(`\\nProperty Overview:`);
        console.log(`  Total Properties: ${stats.total_properties}`);
        console.log(`  Cottages: ${stats.cottages}`);
        console.log(`  Available Lots: ${stats.lots}`);
        console.log(`  Total Assessed Value: $${parseFloat(stats.total_assessed_value).toLocaleString()}`);
        console.log(`  Average Annual Lease Fee: $${parseFloat(stats.avg_lease_fee).toLocaleString()}`);

        console.log(`\\nLeaseholder Overview:`);
        console.log(`  Active Leaseholds: ${leaseStats.total_leaseholds}`);
        console.log(`  Perpetual Leases: ${leaseStats.perpetual_leases}`);
        console.log(`  Life Leases: ${leaseStats.life_leases}`);
        console.log(`  Total Annual Fees: $${parseFloat(leaseStats.total_annual_fees).toLocaleString()}`);

        console.log(`\\n2025 Assessment Overview:`);
        console.log(`  Total Assessments: ${assessStats.total_assessments}`);
        console.log(`  Assessment Amount: $${parseFloat(assessStats.total_assessment_amount).toLocaleString()}`);
        console.log(`  Lease Fee Assessments: ${assessStats.lease_assessments}`);
        console.log(`  Infrastructure Assessments: ${assessStats.infrastructure_assessments}`);

        // Show active leaseholds view
        console.log('\\n🏠 Active Bay View Leaseholds:');
        const activeLeaseholds = await manager.pgClient.query(`
            SELECT * FROM property.active_leaseholds
            ORDER BY block_number, lot_number
        `);

        activeLeaseholds.rows.forEach(lease => {
            console.log(`  Block ${lease.block_number} Lot ${lease.lot_number}: ${lease.leaseholder_name}`);
            console.log(`    ${lease.street_address} | ${lease.lease_type} | $${lease.annual_fee}/year`);
        });

        console.log('\\n🎉 Bay View Association sample data created successfully!');
        console.log('\\nThis demonstrates:');
        console.log('• Block and Lot property identification system');
        console.log('• Perpetual and life leasehold structures');
        console.log('• Family group associations with cottages');
        console.log('• Annual and special assessments');
        console.log('• Cottage sales and transfer processes');
        console.log('• Integrated financial accounts');

    } catch (error) {
        console.error('Bay View sample data creation failed:', error.message);
        console.error(error.stack);
    } finally {
        await manager.disconnect();
    }
}

createBayViewSampleData();