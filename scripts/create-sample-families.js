/**
 * Create Sample Bay View Association Families
 * Demonstrates the relational capabilities of the unified system
 */
import dotenv from 'dotenv';
import { createDualWriteManager } from '../lib/database/dual-write-manager.js';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function createSampleFamilies() {
    const DATABASE_URL = process.env.DATABASE_URL;
    
    if (!DATABASE_URL) {
        console.error('DATABASE_URL not found in environment variables');
        process.exit(1);
    }

    const manager = createDualWriteManager(DATABASE_URL);

    try {
        console.log('🏡 Creating Sample Bay View Association Families\n');

        // Family 1: The Johnson Family (Nuclear Family)
        console.log('1. Creating the Johnson Family (Nuclear Family)');
        console.log('   Scenario: Current members with young children');
        
        const johnsonFamily = {
            parents: [],
            children: []
        };

        // Initialize connection
        await manager.connect();
        
        // Create parents
        const davidJohnson = await manager.modern.createPerson({
            person_type: 'member',
            first_name: 'David',
            last_name: 'Johnson',
            date_of_birth: '1978-05-15',
            primary_email: 'david.johnson@email.com',
            primary_phone: '231-555-0101',
            migration_source: 'sample_family_creation'
        });
        johnsonFamily.parents.push(davidJohnson);

        const sarahJohnson = await manager.modern.createPerson({
            person_type: 'member', 
            first_name: 'Sarah',
            last_name: 'Johnson',
            maiden_name: 'Thompson',
            date_of_birth: '1980-08-22',
            primary_email: 'sarah.johnson@email.com',
            primary_phone: '231-555-0102',
            migration_source: 'sample_family_creation'
        });
        johnsonFamily.parents.push(sarahJohnson);

        // Create children
        const emilyJohnson = await manager.modern.createPerson({
            person_type: 'member',
            first_name: 'Emily',
            last_name: 'Johnson',
            date_of_birth: '2008-03-10',
            migration_source: 'sample_family_creation'
        });
        johnsonFamily.children.push(emilyJohnson);

        const michaelJohnson = await manager.modern.createPerson({
            person_type: 'member',
            first_name: 'Michael',
            last_name: 'Johnson', 
            date_of_birth: '2010-11-05',
            migration_source: 'sample_family_creation'
        });
        johnsonFamily.children.push(michaelJohnson);

        // Create relationships
        await manager.modern.createFamilyRelationship(davidJohnson.id, sarahJohnson.id, 'spouse');
        await manager.modern.createFamilyRelationship(davidJohnson.id, emilyJohnson.id, 'child');
        await manager.modern.createFamilyRelationship(davidJohnson.id, michaelJohnson.id, 'child');
        await manager.modern.createFamilyRelationship(sarahJohnson.id, emilyJohnson.id, 'child');
        await manager.modern.createFamilyRelationship(sarahJohnson.id, michaelJohnson.id, 'child');
        await manager.modern.createFamilyRelationship(emilyJohnson.id, michaelJohnson.id, 'sibling');

        // Add contact methods
        await manager.modern.upsertContactMethod(davidJohnson.id, 'address', '123 Lakeshore Drive, Bay View, MI 49770', 'summer_cottage');
        await manager.modern.upsertContactMethod(davidJohnson.id, 'address', '456 Oak Street, Chicago, IL 60614', 'winter_home');

        console.log(`   ✅ Created Johnson Family: David, Sarah, Emily, Michael`);

        // Family 2: The Williams Family (Multi-Generational)
        console.log('\n2. Creating the Williams Family (Multi-Generational Legacy)');
        console.log('   Scenario: 3 generations, founding family member deceased');

        const williamsFamily = {
            grandparents: [],
            parents: [], 
            children: [],
            deceased: []
        };

        // Create deceased founder (via memorial)
        const foundingMember = await manager.createMemorial({
            first_name: 'Robert',
            last_name: 'Williams',
            birth_date: '1925-04-12',
            death_date: '2020-12-15',
            message: 'Founding member of Bay View Association, devoted family man and community leader.'
        });
        williamsFamily.deceased.push(foundingMember.modern);

        // Create living grandmother
        const margaretWilliams = await manager.modern.createPerson({
            person_type: 'member',
            first_name: 'Margaret',
            last_name: 'Williams',
            maiden_name: 'Henderson',
            date_of_birth: '1930-09-08',
            primary_email: 'margaret.williams@email.com',
            primary_phone: '231-555-0201',
            migration_source: 'sample_family_creation'
        });
        williamsFamily.grandparents.push(margaretWilliams);

        // Create parent generation
        const thomasWilliams = await manager.modern.createPerson({
            person_type: 'member',
            first_name: 'Thomas',
            last_name: 'Williams',
            date_of_birth: '1955-06-18',
            primary_email: 'thomas.williams@email.com',
            primary_phone: '231-555-0202',
            migration_source: 'sample_family_creation'
        });
        williamsFamily.parents.push(thomasWilliams);

        const lindaWilliams = await manager.modern.createPerson({
            person_type: 'member',
            first_name: 'Linda',
            last_name: 'Williams', 
            maiden_name: 'Davis',
            date_of_birth: '1957-12-03',
            primary_email: 'linda.williams@email.com',
            primary_phone: '231-555-0203',
            migration_source: 'sample_family_creation'
        });
        williamsFamily.parents.push(lindaWilliams);

        // Create grandchildren
        const jessicaWilliams = await manager.modern.createPerson({
            person_type: 'member',
            first_name: 'Jessica',
            last_name: 'Miller',
            maiden_name: 'Williams',
            date_of_birth: '1985-02-14',
            primary_email: 'jessica.miller@email.com',
            primary_phone: '231-555-0204',
            migration_source: 'sample_family_creation'
        });
        williamsFamily.children.push(jessicaWilliams);

        const danielWilliams = await manager.modern.createPerson({
            person_type: 'member',
            first_name: 'Daniel',
            last_name: 'Williams',
            date_of_birth: '1987-07-20',
            primary_email: 'daniel.williams@email.com',
            primary_phone: '231-555-0205',
            migration_source: 'sample_family_creation'
        });
        williamsFamily.children.push(danielWilliams);

        // Create complex family relationships
        // Grandparent relationships
        await manager.modern.createFamilyRelationship(foundingMember.modern.id, margaretWilliams.id, 'spouse');
        await manager.modern.createFamilyRelationship(foundingMember.modern.id, thomasWilliams.id, 'child');
        await manager.modern.createFamilyRelationship(margaretWilliams.id, thomasWilliams.id, 'child');

        // Parent relationships 
        await manager.modern.createFamilyRelationship(thomasWilliams.id, lindaWilliams.id, 'spouse');
        await manager.modern.createFamilyRelationship(thomasWilliams.id, jessicaWilliams.id, 'child');
        await manager.modern.createFamilyRelationship(thomasWilliams.id, danielWilliams.id, 'child');
        await manager.modern.createFamilyRelationship(lindaWilliams.id, jessicaWilliams.id, 'child');
        await manager.modern.createFamilyRelationship(lindaWilliams.id, danielWilliams.id, 'child');

        // Grandparent-grandchild relationships
        await manager.modern.createFamilyRelationship(margaretWilliams.id, jessicaWilliams.id, 'grandchild');
        await manager.modern.createFamilyRelationship(margaretWilliams.id, danielWilliams.id, 'grandchild');
        await manager.modern.createFamilyRelationship(foundingMember.modern.id, jessicaWilliams.id, 'grandchild');
        await manager.modern.createFamilyRelationship(foundingMember.modern.id, danielWilliams.id, 'grandchild');

        // Sibling relationships
        await manager.modern.createFamilyRelationship(jessicaWilliams.id, danielWilliams.id, 'sibling');

        console.log(`   ✅ Created Williams Family: 3 generations, 1 memorial`);

        // Family 3: The Smith Family (Complex Blended Family)
        console.log('\n3. Creating the Smith Family (Blended Family)');
        console.log('   Scenario: Second marriages, step-relationships, half-siblings');

        const smithFamily = {
            parents: [],
            children: [],
            stepFamily: [],
            exSpouses: []
        };

        // Create main parents (second marriage)
        const richardSmith = await manager.modern.createPerson({
            person_type: 'member',
            first_name: 'Richard',
            last_name: 'Smith',
            date_of_birth: '1965-03-25',
            primary_email: 'richard.smith@email.com',
            primary_phone: '231-555-0301',
            migration_source: 'sample_family_creation'
        });
        smithFamily.parents.push(richardSmith);

        const caroleSmith = await manager.modern.createPerson({
            person_type: 'member',
            first_name: 'Carole',
            last_name: 'Smith',
            maiden_name: 'Johnson',
            date_of_birth: '1968-11-12',
            primary_email: 'carole.smith@email.com',
            primary_phone: '231-555-0302',
            migration_source: 'sample_family_creation'
        });
        smithFamily.parents.push(caroleSmith);

        // Richard's children from first marriage
        const alexSmith = await manager.modern.createPerson({
            person_type: 'member',
            first_name: 'Alex',
            last_name: 'Smith',
            date_of_birth: '1995-01-08',
            primary_email: 'alex.smith@email.com',
            migration_source: 'sample_family_creation'
        });
        smithFamily.children.push(alexSmith);

        const oliviaSmith = await manager.modern.createPerson({
            person_type: 'member',
            first_name: 'Olivia',
            last_name: 'Smith',
            date_of_birth: '1997-08-15',
            primary_email: 'olivia.smith@email.com', 
            migration_source: 'sample_family_creation'
        });
        smithFamily.children.push(oliviaSmith);

        // Carole's children from first marriage
        const jasonJohnson = await manager.modern.createPerson({
            person_type: 'member',
            first_name: 'Jason',
            last_name: 'Johnson',
            date_of_birth: '1993-05-22',
            primary_email: 'jason.johnson@email.com',
            migration_source: 'sample_family_creation'
        });
        smithFamily.stepFamily.push(jasonJohnson);

        // Their child together
        const miaSmith = await manager.modern.createPerson({
            person_type: 'member',
            first_name: 'Mia',
            last_name: 'Smith',
            date_of_birth: '2005-12-01',
            migration_source: 'sample_family_creation'
        });
        smithFamily.children.push(miaSmith);

        // Create complex blended family relationships
        await manager.modern.createFamilyRelationship(richardSmith.id, caroleSmith.id, 'spouse');
        
        // Richard's biological children
        await manager.modern.createFamilyRelationship(richardSmith.id, alexSmith.id, 'child');
        await manager.modern.createFamilyRelationship(richardSmith.id, oliviaSmith.id, 'child');
        
        // Carole as step-parent
        await manager.modern.createFamilyRelationship(caroleSmith.id, alexSmith.id, 'other'); // Step-relationship
        await manager.modern.createFamilyRelationship(caroleSmith.id, oliviaSmith.id, 'other');
        
        // Carole's biological child (Richard as step-parent)
        await manager.modern.createFamilyRelationship(caroleSmith.id, jasonJohnson.id, 'child');
        await manager.modern.createFamilyRelationship(richardSmith.id, jasonJohnson.id, 'other');
        
        // Their child together
        await manager.modern.createFamilyRelationship(richardSmith.id, miaSmith.id, 'child');
        await manager.modern.createFamilyRelationship(caroleSmith.id, miaSmith.id, 'child');
        
        // Half-sibling and step-sibling relationships
        await manager.modern.createFamilyRelationship(alexSmith.id, oliviaSmith.id, 'sibling'); // Full siblings
        await manager.modern.createFamilyRelationship(alexSmith.id, miaSmith.id, 'sibling'); // Half-siblings
        await manager.modern.createFamilyRelationship(oliviaSmith.id, miaSmith.id, 'sibling'); // Half-siblings
        await manager.modern.createFamilyRelationship(jasonJohnson.id, miaSmith.id, 'sibling'); // Half-siblings

        console.log(`   ✅ Created Smith Blended Family: Complex step/half relationships`);

        // Family 4: The Anderson Family (Tragedy & Memorial Scenario)
        console.log('\n4. Creating the Anderson Family (Memorial Scenario)');
        console.log('   Scenario: Recent loss, surviving spouse, pre-paid arrangements');

        const andersonFamily = {
            surviving: [],
            deceased: [],
            children: []
        };

        // Create recently deceased husband (via memorial)
        const deceasedHusband = await manager.createMemorial({
            first_name: 'James',
            last_name: 'Anderson', 
            birth_date: '1955-07-04',
            death_date: '2024-03-15',
            message: 'Beloved husband, father, and long-time Bay View member. Devoted to his family and community service.',
            contact_name: 'Patricia Anderson',
            contact_email: 'patricia.anderson@email.com',
            contact_phone: '231-555-0401',
            contact_address: '789 Woodland Ave, Bay View, MI 49770'
        });
        andersonFamily.deceased.push(deceasedHusband.modern);

        // Surviving spouse already created as contact person in memorial
        const patriciaAnderson = await manager.modern.findOne('core.persons', { 
            first_name: 'Patricia', 
            last_name: 'Anderson' 
        });
        if (patriciaAnderson) {
            andersonFamily.surviving.push(patriciaAnderson);
        }

        // Create adult children
        const kevinAnderson = await manager.modern.createPerson({
            person_type: 'member',
            first_name: 'Kevin',
            last_name: 'Anderson',
            date_of_birth: '1982-04-18',
            primary_email: 'kevin.anderson@email.com',
            primary_phone: '231-555-0402',
            migration_source: 'sample_family_creation'
        });
        andersonFamily.children.push(kevinAnderson);

        const lisaAnderson = await manager.modern.createPerson({
            person_type: 'member',
            first_name: 'Lisa',
            last_name: 'Carter',
            maiden_name: 'Anderson',
            date_of_birth: '1984-09-30',
            primary_email: 'lisa.carter@email.com',
            primary_phone: '231-555-0403',
            migration_source: 'sample_family_creation'
        });
        andersonFamily.children.push(lisaAnderson);

        // Create relationships
        if (patriciaAnderson) {
            await manager.modern.createFamilyRelationship(deceasedHusband.modern.id, patriciaAnderson.id, 'spouse');
            await manager.modern.createFamilyRelationship(patriciaAnderson.id, kevinAnderson.id, 'child');
            await manager.modern.createFamilyRelationship(patriciaAnderson.id, lisaAnderson.id, 'child');
        }
        
        await manager.modern.createFamilyRelationship(deceasedHusband.modern.id, kevinAnderson.id, 'child');
        await manager.modern.createFamilyRelationship(deceasedHusband.modern.id, lisaAnderson.id, 'child');
        await manager.modern.createFamilyRelationship(kevinAnderson.id, lisaAnderson.id, 'sibling');

        console.log(`   ✅ Created Anderson Memorial Family: Recent loss scenario`);

        // Family 5: The Taylor Family (Multi-Cottage Dynasty)
        console.log('\n5. Creating the Taylor Family (Multi-Property Dynasty)');
        console.log('   Scenario: Multiple cottages, trustees, extended family network');

        const taylorFamily = {
            patriarch: null,
            matriarch: null,
            trustees: [],
            cousins: [],
            nextGeneration: []
        };

        // Create family patriarch/matriarch
        const williamTaylor = await manager.modern.createPerson({
            person_type: 'member',
            first_name: 'William',
            last_name: 'Taylor',
            date_of_birth: '1945-12-10',
            primary_email: 'william.taylor@email.com',
            primary_phone: '231-555-0501',
            migration_source: 'sample_family_creation'
        });
        taylorFamily.patriarch = williamTaylor;

        const elizabethTaylor = await manager.modern.createPerson({
            person_type: 'member', 
            first_name: 'Elizabeth',
            last_name: 'Taylor',
            maiden_name: 'Morrison',
            date_of_birth: '1948-05-28',
            primary_email: 'elizabeth.taylor@email.com',
            primary_phone: '231-555-0502',
            migration_source: 'sample_family_creation'
        });
        taylorFamily.matriarch = elizabethTaylor;

        // Create children (trustees of different cottages)
        const robertTaylor = await manager.modern.createPerson({
            person_type: 'member',
            first_name: 'Robert',
            last_name: 'Taylor',
            date_of_birth: '1972-08-15',
            primary_email: 'robert.taylor@email.com',
            primary_phone: '231-555-0503',
            migration_source: 'sample_family_creation'
        });
        taylorFamily.trustees.push(robertTaylor);

        const susanTaylor = await manager.modern.createPerson({
            person_type: 'member',
            first_name: 'Susan',
            last_name: 'Reed',
            maiden_name: 'Taylor',
            date_of_birth: '1974-03-22',
            primary_email: 'susan.reed@email.com',
            primary_phone: '231-555-0504',
            migration_source: 'sample_family_creation'
        });
        taylorFamily.trustees.push(susanTaylor);

        const davidTaylor = await manager.modern.createPerson({
            person_type: 'member',
            first_name: 'David',
            last_name: 'Taylor',
            date_of_birth: '1976-11-08',
            primary_email: 'david.taylor@email.com',
            primary_phone: '231-555-0505',
            migration_source: 'sample_family_creation'
        });
        taylorFamily.trustees.push(davidTaylor);

        // Create grandchildren
        const sophiaTaylor = await manager.modern.createPerson({
            person_type: 'member',
            first_name: 'Sophia',
            last_name: 'Taylor',
            date_of_birth: '2002-06-12',
            primary_email: 'sophia.taylor@email.com',
            migration_source: 'sample_family_creation'
        });
        taylorFamily.nextGeneration.push(sophiaTaylor);

        const ethanReed = await manager.modern.createPerson({
            person_type: 'member',
            first_name: 'Ethan', 
            last_name: 'Reed',
            date_of_birth: '2004-09-25',
            migration_source: 'sample_family_creation'
        });
        taylorFamily.nextGeneration.push(ethanReed);

        // Create family relationships
        await manager.modern.createFamilyRelationship(williamTaylor.id, elizabethTaylor.id, 'spouse');
        
        // Parent-child relationships
        await manager.modern.createFamilyRelationship(williamTaylor.id, robertTaylor.id, 'child');
        await manager.modern.createFamilyRelationship(williamTaylor.id, susanTaylor.id, 'child');
        await manager.modern.createFamilyRelationship(williamTaylor.id, davidTaylor.id, 'child');
        await manager.modern.createFamilyRelationship(elizabethTaylor.id, robertTaylor.id, 'child');
        await manager.modern.createFamilyRelationship(elizabethTaylor.id, susanTaylor.id, 'child');
        await manager.modern.createFamilyRelationship(elizabethTaylor.id, davidTaylor.id, 'child');
        
        // Sibling relationships
        await manager.modern.createFamilyRelationship(robertTaylor.id, susanTaylor.id, 'sibling');
        await manager.modern.createFamilyRelationship(robertTaylor.id, davidTaylor.id, 'sibling');
        await manager.modern.createFamilyRelationship(susanTaylor.id, davidTaylor.id, 'sibling');
        
        // Grandparent-grandchild relationships
        await manager.modern.createFamilyRelationship(williamTaylor.id, sophiaTaylor.id, 'grandchild');
        await manager.modern.createFamilyRelationship(elizabethTaylor.id, sophiaTaylor.id, 'grandchild');
        await manager.modern.createFamilyRelationship(williamTaylor.id, ethanReed.id, 'grandchild');
        await manager.modern.createFamilyRelationship(elizabethTaylor.id, ethanReed.id, 'grandchild');
        
        // Parent-child second generation
        await manager.modern.createFamilyRelationship(robertTaylor.id, sophiaTaylor.id, 'child');
        await manager.modern.createFamilyRelationship(susanTaylor.id, ethanReed.id, 'child');

        // Add multiple addresses for different properties
        await manager.modern.upsertContactMethod(williamTaylor.id, 'address', '100 Bay View Terrace, Bay View, MI 49770', 'main_cottage');
        await manager.modern.upsertContactMethod(williamTaylor.id, 'address', '102 Bay View Terrace, Bay View, MI 49770', 'guest_cottage');
        await manager.modern.upsertContactMethod(williamTaylor.id, 'address', '200 Elm Street, Bloomfield Hills, MI 48304', 'winter_home');

        console.log(`   ✅ Created Taylor Dynasty: Multi-property family network`);

        // Generate summary report
        console.log('\n📊 Family Creation Summary:');
        
        const finalStats = await manager.getMigrationProgress();
        console.log(`Total Persons Created: ${finalStats.overall.migrated} records`);
        
        const relationshipStats = await manager.pgClient.query(`
            SELECT COUNT(*) as total_relationships
            FROM core.family_relationships 
            WHERE is_active = true;
        `);
        console.log(`Total Family Relationships: ${relationshipStats.rows[0].total_relationships}`);

        const contactStats = await manager.pgClient.query(`
            SELECT COUNT(*) as total_contacts
            FROM core.contact_methods;
        `);
        console.log(`Total Contact Methods: ${contactStats.rows[0].total_contacts}`);

        console.log('\n🎉 Sample Bay View Association families created successfully!');
        console.log('\nFamilies created:');
        console.log('1. Johnson Family - Nuclear family with children');
        console.log('2. Williams Family - 3-generation legacy with memorial');
        console.log('3. Smith Family - Complex blended family');
        console.log('4. Anderson Family - Recent loss and memorial scenario');
        console.log('5. Taylor Family - Multi-property dynasty');

    } catch (error) {
        console.error('Family creation failed:', error.message);
        console.error(error.stack);
    } finally {
        await manager.disconnect();
    }
}

createSampleFamilies();