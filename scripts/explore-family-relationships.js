/**
 * Explore Family Relationships in the Bay View Association System
 * Demonstrates complex relationship queries and family connections
 */
import dotenv from 'dotenv';
import { createDualWriteManager } from '../lib/database/dual-write-manager.js';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function exploreFamilyRelationships() {
    const DATABASE_URL = process.env.DATABASE_URL;
    
    if (!DATABASE_URL) {
        console.error('DATABASE_URL not found in environment variables');
        process.exit(1);
    }

    const manager = createDualWriteManager(DATABASE_URL);

    try {
        await manager.connect();
        console.log('👨‍👩‍👧‍👦 Exploring Bay View Association Family Relationships\n');

        // 1. Family Tree Visualization
        console.log('1. Family Tree Examples:');
        
        // Williams Multi-Generational Family
        console.log('\n🌳 Williams Family Tree (Multi-Generational):');
        const williamsTree = await manager.pgClient.query(`
            WITH RECURSIVE family_tree AS (
                -- Start with the patriarch
                SELECT 
                    p.id,
                    p.first_name,
                    p.last_name,
                    p.person_type,
                    p.date_of_birth,
                    p.date_of_death,
                    0 as generation,
                    ARRAY[p.first_name || ' ' || p.last_name] as path
                FROM core.persons p
                WHERE p.first_name = 'Robert' AND p.last_name = 'Williams'
                
                UNION ALL
                
                -- Recursively find descendants
                SELECT 
                    child.id,
                    child.first_name,
                    child.last_name,
                    child.person_type,
                    child.date_of_birth,
                    child.date_of_death,
                    ft.generation + 1,
                    ft.path || (child.first_name || ' ' || child.last_name)
                FROM family_tree ft
                JOIN core.family_relationships fr ON ft.id = fr.person_id
                JOIN core.persons child ON fr.related_person_id = child.id
                WHERE fr.relationship_type IN ('child', 'grandchild')
                  AND fr.is_active = true
                  AND ft.generation < 3
            )
            SELECT 
                generation,
                first_name || ' ' || last_name as name,
                person_type,
                CASE 
                    WHEN date_of_death IS NOT NULL THEN 'Deceased (' || date_of_death || ')'
                    ELSE 'Living'
                END as status,
                path
            FROM family_tree
            ORDER BY generation, name;
        `);

        williamsTree.rows.forEach(row => {
            const indent = '  '.repeat(row.generation);
            console.log(`${indent}Gen ${row.generation}: ${row.name} (${row.status})`);
        });

        // 2. Complex Relationship Queries
        console.log('\n2. Complex Relationship Queries:');

        // Find all spouses
        console.log('\n💑 All Married Couples:');
        const couples = await manager.pgClient.query(`
            SELECT 
                p1.first_name || ' ' || p1.last_name as person1,
                p2.first_name || ' ' || p2.last_name as person2,
                p1.date_of_birth as person1_birth,
                p2.date_of_birth as person2_birth
            FROM core.family_relationships fr
            JOIN core.persons p1 ON fr.person_id = p1.id
            JOIN core.persons p2 ON fr.related_person_id = p2.id
            WHERE fr.relationship_type = 'spouse' 
              AND fr.is_active = true
            ORDER BY p1.last_name, p1.first_name;
        `);

        couples.rows.forEach(row => {
            console.log(`   ${row.person1} ⚭ ${row.person2}`);
        });

        // Find all parent-child relationships
        console.log('\n👨‍👧‍👦 Parent-Child Relationships:');
        const parentChild = await manager.pgClient.query(`
            SELECT 
                parent.first_name || ' ' || parent.last_name as parent_name,
                child.first_name || ' ' || child.last_name as child_name,
                EXTRACT(YEAR FROM child.date_of_birth) as birth_year,
                child.person_type
            FROM core.family_relationships fr
            JOIN core.persons parent ON fr.person_id = parent.id
            JOIN core.persons child ON fr.related_person_id = child.id
            WHERE fr.relationship_type = 'child' 
              AND fr.is_active = true
            ORDER BY parent.last_name, parent.first_name, child.date_of_birth;
        `);

        parentChild.rows.forEach(row => {
            console.log(`   ${row.parent_name} → ${row.child_name} (${row.birth_year || 'Unknown'})`);
        });

        // 3. Blended Family Analysis (Smith Family)
        console.log('\n3. Blended Family Analysis (Smith Family):');
        
        const blendedFamily = await manager.pgClient.query(`
            SELECT 
                p.first_name || ' ' || p.last_name as person_name,
                p.date_of_birth,
                COUNT(CASE WHEN fr.relationship_type = 'child' THEN 1 END) as children_count,
                COUNT(CASE WHEN fr.relationship_type = 'spouse' THEN 1 END) as spouse_count,
                COUNT(CASE WHEN fr.relationship_type = 'sibling' THEN 1 END) as sibling_count,
                COUNT(CASE WHEN fr.relationship_type = 'other' THEN 1 END) as step_relationships
            FROM core.persons p
            LEFT JOIN core.family_relationships fr ON p.id = fr.person_id AND fr.is_active = true
            WHERE p.last_name IN ('Smith', 'Johnson') 
              AND p.first_name IN ('Richard', 'Carole', 'Alex', 'Olivia', 'Jason', 'Mia')
            GROUP BY p.id, p.first_name, p.last_name, p.date_of_birth
            ORDER BY p.date_of_birth NULLS LAST;
        `);

        console.log('\n🏠 Smith Blended Family Structure:');
        blendedFamily.rows.forEach(row => {
            console.log(`   ${row.person_name}:`);
            console.log(`     Children: ${row.children_count}, Spouse: ${row.spouse_count}`);
            console.log(`     Siblings: ${row.sibling_count}, Step-relationships: ${row.step_relationships}`);
        });

        // 4. Memorial Family Scenario (Anderson Family)
        console.log('\n4. Memorial Family Scenario (Anderson Family):');
        
        const memorialScenario = await manager.pgClient.query(`
            SELECT 
                p.first_name || ' ' || p.last_name as name,
                p.person_type,
                p.date_of_death,
                p.legacy_memorial_id,
                CASE 
                    WHEN fr_spouse.id IS NOT NULL THEN 'Has spouse'
                    ELSE 'No spouse recorded'
                END as spouse_status,
                COUNT(fr_child.id) as children_count
            FROM core.persons p
            LEFT JOIN core.family_relationships fr_spouse ON p.id = fr_spouse.person_id 
                AND fr_spouse.relationship_type = 'spouse' AND fr_spouse.is_active = true
            LEFT JOIN core.family_relationships fr_child ON p.id = fr_child.person_id 
                AND fr_child.relationship_type = 'child' AND fr_child.is_active = true
            WHERE p.last_name = 'Anderson' OR p.last_name = 'Carter'
            GROUP BY p.id, p.first_name, p.last_name, p.person_type, p.date_of_death, p.legacy_memorial_id, fr_spouse.id
            ORDER BY p.date_of_death NULLS LAST, p.first_name;
        `);

        console.log('\n⚱️ Anderson Memorial Family:');
        memorialScenario.rows.forEach(row => {
            const status = row.date_of_death ? `Deceased (${row.date_of_death})` : 'Living';
            const memorial = row.legacy_memorial_id ? ` [Memorial ID: ${row.legacy_memorial_id}]` : '';
            console.log(`   ${row.name} - ${status}${memorial}`);
            console.log(`     ${row.spouse_status}, ${row.children_count} children`);
        });

        // 5. Multi-Property Dynasty (Taylor Family)
        console.log('\n5. Multi-Property Dynasty (Taylor Family):');
        
        const dynasty = await manager.pgClient.query(`
            SELECT 
                p.first_name || ' ' || p.last_name as name,
                EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM p.date_of_birth) as age,
                COUNT(DISTINCT cm.id) FILTER (WHERE cm.contact_type = 'address') as properties,
                COUNT(DISTINCT fr.id) as total_relationships,
                STRING_AGG(DISTINCT cm.contact_value, '; ') FILTER (WHERE cm.contact_type = 'address') as addresses
            FROM core.persons p
            LEFT JOIN core.contact_methods cm ON p.id = cm.person_id
            LEFT JOIN core.family_relationships fr ON p.id = fr.person_id AND fr.is_active = true
            WHERE p.last_name IN ('Taylor', 'Reed')
            GROUP BY p.id, p.first_name, p.last_name, p.date_of_birth
            ORDER BY age DESC NULLS LAST;
        `);

        console.log('\n🏘️ Taylor Dynasty Property Holdings:');
        dynasty.rows.forEach(row => {
            console.log(`   ${row.name} (Age: ${row.age || 'Unknown'})`);
            console.log(`     Properties: ${row.properties}, Relationships: ${row.total_relationships}`);
            if (row.addresses) {
                console.log(`     Addresses: ${row.addresses}`);
            }
        });

        // 6. Relationship Statistics
        console.log('\n6. Bay View Association Relationship Statistics:');
        
        const stats = await manager.pgClient.query(`
            SELECT 
                relationship_type,
                COUNT(*) as count,
                ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM core.family_relationships WHERE is_active = true), 2) as percentage
            FROM core.family_relationships
            WHERE is_active = true
            GROUP BY relationship_type
            ORDER BY count DESC;
        `);

        stats.rows.forEach(row => {
            console.log(`   ${row.relationship_type}: ${row.count} (${row.percentage}%)`);
        });

        // 7. Cross-Generational Connections
        console.log('\n7. Cross-Generational Connections:');
        
        const generations = await manager.pgClient.query(`
            SELECT 
                grandparent.first_name || ' ' || grandparent.last_name as grandparent,
                grandchild.first_name || ' ' || grandchild.last_name as grandchild,
                EXTRACT(YEAR FROM grandparent.date_of_birth) as grandparent_birth_year,
                EXTRACT(YEAR FROM grandchild.date_of_birth) as grandchild_birth_year,
                EXTRACT(YEAR FROM grandchild.date_of_birth) - EXTRACT(YEAR FROM grandparent.date_of_birth) as age_gap
            FROM core.family_relationships fr
            JOIN core.persons grandparent ON fr.person_id = grandparent.id
            JOIN core.persons grandchild ON fr.related_person_id = grandchild.id
            WHERE fr.relationship_type = 'grandchild' 
              AND fr.is_active = true
              AND grandparent.date_of_birth IS NOT NULL
              AND grandchild.date_of_birth IS NOT NULL
            ORDER BY age_gap DESC;
        `);

        console.log('\n👴👶 Grandparent-Grandchild Connections:');
        generations.rows.forEach(row => {
            console.log(`   ${row.grandparent} (${row.grandparent_birth_year}) → ${row.grandchild} (${row.grandchild_birth_year}) [${row.age_gap} year gap]`);
        });

        // 8. Family Search Capabilities
        console.log('\n8. Advanced Family Search Example:');
        
        // Search for all Smiths and their relationships
        const smithSearch = await manager.search('Smith', { limit: 20 });
        
        console.log('\n🔍 Search Results for "Smith":');
        console.log(`   Modern system: ${smithSearch.modern.length} persons`);
        console.log(`   Legacy memorials: ${smithSearch.legacy.memorials.length} records`);
        
        if (smithSearch.modern.length > 0) {
            console.log('\n   Smith Family Members Found:');
            smithSearch.modern.forEach(person => {
                console.log(`     ${person.first_name} ${person.last_name} (${person.person_type})`);
            });
        }

        // 9. Contact Information by Family
        console.log('\n9. Family Contact Information:');
        
        const familyContacts = await manager.pgClient.query(`
            SELECT 
                p.last_name as family_name,
                COUNT(DISTINCT p.id) as family_members,
                COUNT(DISTINCT cm.id) FILTER (WHERE cm.contact_type = 'email') as email_contacts,
                COUNT(DISTINCT cm.id) FILTER (WHERE cm.contact_type = 'phone') as phone_contacts,
                COUNT(DISTINCT cm.id) FILTER (WHERE cm.contact_type = 'address') as addresses
            FROM core.persons p
            LEFT JOIN core.contact_methods cm ON p.id = cm.person_id
            WHERE p.last_name IN ('Johnson', 'Williams', 'Smith', 'Anderson', 'Carter', 'Taylor', 'Reed')
            GROUP BY p.last_name
            ORDER BY family_members DESC;
        `);

        console.log('\n📞 Contact Information by Family:');
        familyContacts.rows.forEach(row => {
            console.log(`   ${row.family_name} Family: ${row.family_members} members`);
            console.log(`     Emails: ${row.email_contacts}, Phones: ${row.phone_contacts}, Addresses: ${row.addresses}`);
        });

        // 10. Memorial Integration
        console.log('\n10. Memorial Garden Integration:');
        
        const memorialIntegration = await manager.pgClient.query(`
            SELECT 
                p.first_name || ' ' || p.last_name as deceased_name,
                p.date_of_death,
                m.message as memorial_message,
                contact_person.first_name || ' ' || contact_person.last_name as contact_name,
                COUNT(fr.id) as family_connections
            FROM core.persons p
            LEFT JOIN bayview.memorials m ON p.legacy_memorial_id = m.id
            LEFT JOIN core.family_relationships fr ON p.id = fr.person_id AND fr.is_active = true
            LEFT JOIN core.persons contact_person ON contact_person.primary_email = (
                SELECT cm.contact_value 
                FROM core.contact_methods cm 
                WHERE cm.person_id = p.id AND cm.contact_type = 'email' 
                LIMIT 1
            )
            WHERE p.person_type = 'deceased'
            GROUP BY p.id, p.first_name, p.last_name, p.date_of_death, m.message, contact_person.first_name, contact_person.last_name
            ORDER BY p.date_of_death DESC NULLS LAST;
        `);

        console.log('\n⚱️ Memorial Records with Family Connections:');
        memorialIntegration.rows.forEach(row => {
            console.log(`   ${row.deceased_name} (${row.date_of_death || 'Date unknown'})`);
            console.log(`     Family connections: ${row.family_connections}`);
            if (row.contact_name) {
                console.log(`     Contact: ${row.contact_name}`);
            }
            if (row.memorial_message) {
                console.log(`     Message: ${row.memorial_message.substring(0, 80)}...`);
            }
        });

        console.log('\n🎉 Family Relationship Exploration Complete!');
        console.log('\n📊 Summary of Bay View Association Families:');
        console.log('• Complex multi-generational relationships tracked');
        console.log('• Blended family structures supported');
        console.log('• Memorial integration with family connections');
        console.log('• Property/contact associations maintained');
        console.log('• Flexible relationship types for any family structure');
        console.log('• Cross-system search and unified views');

    } catch (error) {
        console.error('Family exploration failed:', error.message);
        console.error(error.stack);
    } finally {
        await manager.disconnect();
    }
}

exploreFamilyRelationships();