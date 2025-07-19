import dotenv from 'dotenv';
import { createDualWriteManager } from '../lib/database/dual-write-manager.js';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testDualWrite() {
    const DATABASE_URL = process.env.DATABASE_URL;
    
    if (!DATABASE_URL) {
        console.error('DATABASE_URL not found in environment variables');
        process.exit(1);
    }

    const manager = createDualWriteManager(DATABASE_URL);

    try {
        console.log('Testing Dual-Write Manager\n');

        // 1. Test migration progress
        console.log('1. Checking migration progress...');
        const progress = await manager.getMigrationProgress();
        console.log('Migration Progress:');
        console.log(`  Memorials: ${progress.memorials.migrated}/${progress.memorials.total} (${progress.memorials.percentage}%)`);
        console.log(`  Chapel: ${progress.chapel.migrated}/${progress.chapel.total} (${progress.chapel.percentage}%)`);
        console.log(`  Overall: ${progress.overall.migrated}/${progress.overall.total} (${progress.overall.percentage}%)\n`);

        // 2. Test creating a new memorial
        console.log('2. Testing memorial creation with dual-write...');
        const testMemorial = {
            submission_id: `TEST-${Date.now()}`,
            first_name: 'Test',
            last_name: 'Person',
            birth_date: '1950-01-01',
            death_date: '2024-01-01',
            message: 'Test memorial created via dual-write',
            contact_name: 'John Doe',
            contact_email: 'test@example.com',
            contact_phone: '555-1234',
            contact_address: '123 Test St'
        };

        const createResult = await manager.createMemorial(testMemorial);
        console.log('Create Result:');
        console.log(`  Success: ${createResult.success}`);
        console.log(`  Legacy ID: ${createResult.legacy?.id}`);
        console.log(`  Modern ID: ${createResult.modern?.id}`);
        console.log(`  Errors: ${createResult.errors.length === 0 ? 'None' : JSON.stringify(createResult.errors)}\n`);

        // 3. Test search
        console.log('3. Testing search across both systems...');
        const searchResults = await manager.search('Test', { limit: 5 });
        console.log('Search Results:');
        console.log(`  Modern persons: ${searchResults.modern.length}`);
        console.log(`  Legacy memorials: ${searchResults.legacy.memorials.length}`);
        console.log(`  Legacy chapel: ${searchResults.legacy.chapel.length}\n`);

        // 4. Test consistency check
        console.log('4. Checking data consistency...');
        const issues = await manager.validateConsistency();
        console.log(`Consistency Issues: ${issues.length === 0 ? 'None found!' : ''}`);
        issues.forEach(issue => {
            console.log(`  - ${issue.type}: ${issue.description} (${issue.count} records)`);
        });

        // 5. Test unified view (if we created a modern record)
        if (createResult.modern?.id) {
            console.log(`\n5. Testing unified person view for ID ${createResult.modern.id}...`);
            const unifiedView = await manager.getPersonUnifiedView(createResult.modern.id);
            console.log('Unified View:');
            console.log(`  Modern record: ${unifiedView.modern ? 'Yes' : 'No'}`);
            console.log(`  Legacy memorial: ${unifiedView.legacy.memorial ? 'Yes' : 'No'}`);
            console.log(`  Legacy chapel: ${unifiedView.legacy.chapel ? 'Yes' : 'No'}`);
        }

        // 6. Test batch migration
        console.log('\n6. Testing batch migration...');
        const migrationResult = await manager.batchMigrateMemorials(10);
        console.log('Batch Migration Result:');
        console.log(`  Total to migrate: ${migrationResult.total}`);
        console.log(`  Successfully migrated: ${migrationResult.migrated}`);
        console.log(`  Skipped: ${migrationResult.skipped}`);
        console.log(`  Errors: ${migrationResult.errors.length}`);
        
        if (migrationResult.errors.length > 0) {
            console.log('  Error details:');
            migrationResult.errors.forEach(err => {
                console.log(`    - Memorial ${err.memorial_id}: ${err.error}`);
            });
        }

        // Final progress check
        console.log('\n7. Final migration progress...');
        const finalProgress = await manager.getMigrationProgress();
        console.log(`  Memorials: ${finalProgress.memorials.migrated}/${finalProgress.memorials.total} (${finalProgress.memorials.percentage}%)`);

    } catch (error) {
        console.error('Test failed:', error.message);
        console.error(error.stack);
    } finally {
        await manager.disconnect();
    }
}

testDualWrite();