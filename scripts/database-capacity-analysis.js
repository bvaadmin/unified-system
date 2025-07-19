import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { withDatabase } from '../lib/db.js';

console.log('Database Capacity Analysis for Bay View Association PostgreSQL Database');
console.log('=======================================================================\n');

async function analyzeDatabaseCapacity() {
  try {
    await withDatabase(async (client) => {
      // 1. PostgreSQL Version and System Info
      console.log('1. DATABASE VERSION AND SYSTEM INFORMATION');
      console.log('------------------------------------------');
      const versionResult = await client.query('SELECT version()');
      console.log('PostgreSQL Version:', versionResult.rows[0].version);
      
      const currentDb = await client.query('SELECT current_database()');
      console.log('Current Database:', currentDb.rows[0].current_database);
      
      const currentUser = await client.query('SELECT current_user');
      console.log('Current User:', currentUser.rows[0].current_user);
      console.log('\n');

      // 2. Database Size
      console.log('2. DATABASE SIZE INFORMATION');
      console.log('----------------------------');
      const dbSize = await client.query(`
        SELECT 
          pg_database.datname as database_name,
          pg_size_pretty(pg_database_size(pg_database.datname)) as size,
          pg_database_size(pg_database.datname) as size_bytes
        FROM pg_database
        WHERE datname = current_database()
      `);
      console.log('Database Size:', dbSize.rows[0].size);
      console.log('Size in Bytes:', dbSize.rows[0].size_bytes);
      console.log('\n');

      // 3. Schema Information
      console.log('3. SCHEMAS AND TABLES');
      console.log('---------------------');
      const schemas = await client.query(`
        SELECT 
          table_schema as schema_name,
          COUNT(table_name) as table_count
        FROM information_schema.tables
        WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
          AND table_type = 'BASE TABLE'
        GROUP BY table_schema
        ORDER BY table_schema
      `);
      console.log('Schemas and Table Counts:');
      schemas.rows.forEach(row => {
        console.log(`  ${row.schema_name}: ${row.table_count} tables`);
      });
      console.log('\n');

      // 4. Detailed Table Information with Row Counts
      console.log('4. TABLE DETAILS AND ROW COUNTS');
      console.log('-------------------------------');
      const tables = await client.query(`
        SELECT 
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
          pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
        FROM pg_tables
        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
      `);

      for (const table of tables.rows) {
        try {
          const countResult = await client.query(
            `SELECT COUNT(*) as row_count FROM ${table.schemaname}.${table.tablename}`
          );
          console.log(`${table.schemaname}.${table.tablename}:`);
          console.log(`  Rows: ${countResult.rows[0].row_count}`);
          console.log(`  Size: ${table.total_size}`);
        } catch (err) {
          console.log(`${table.schemaname}.${table.tablename}: Error counting rows`);
        }
      }
      console.log('\n');

      // 5. Storage by Schema
      console.log('5. STORAGE BY SCHEMA');
      console.log('--------------------');
      const schemaSize = await client.query(`
        SELECT 
          schemaname,
          pg_size_pretty(SUM(pg_total_relation_size(schemaname||'.'||tablename))) as total_size,
          SUM(pg_total_relation_size(schemaname||'.'||tablename)) as size_bytes
        FROM pg_tables
        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
        GROUP BY schemaname
        ORDER BY size_bytes DESC
      `);
      schemaSize.rows.forEach(row => {
        console.log(`${row.schemaname}: ${row.total_size}`);
      });
      console.log('\n');

      // 6. Index Information
      console.log('6. INDEX ANALYSIS');
      console.log('-----------------');
      const indexes = await client.query(`
        SELECT 
          schemaname,
          tablename,
          indexname,
          pg_size_pretty(pg_relation_size(schemaname||'.'||indexname)) as index_size
        FROM pg_indexes
        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
        ORDER BY pg_relation_size(schemaname||'.'||indexname) DESC
        LIMIT 20
      `);
      console.log('Top 20 Largest Indexes:');
      indexes.rows.forEach(row => {
        console.log(`  ${row.schemaname}.${row.tablename} - ${row.indexname}: ${row.index_size}`);
      });
      console.log('\n');

      // 7. Table and Index Ratio
      console.log('7. TABLE AND INDEX SIZE RATIO');
      console.log('-----------------------------');
      const tableIndexRatio = await client.query(`
        SELECT 
          schemaname,
          tablename,
          pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
          pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as indexes_size,
          ROUND(100.0 * pg_indexes_size(schemaname||'.'||tablename) / 
            NULLIF(pg_relation_size(schemaname||'.'||tablename), 0), 2) as index_ratio_percent
        FROM pg_tables
        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
          AND pg_relation_size(schemaname||'.'||tablename) > 0
        ORDER BY pg_relation_size(schemaname||'.'||tablename) DESC
        LIMIT 10
      `);
      console.log('Top 10 Tables by Size with Index Ratios:');
      tableIndexRatio.rows.forEach(row => {
        console.log(`  ${row.schemaname}.${row.tablename}:`);
        console.log(`    Table: ${row.table_size}, Indexes: ${row.indexes_size}, Ratio: ${row.index_ratio_percent || 0}%`);
      });
      console.log('\n');

      // 8. Connection and Activity Stats
      console.log('8. CONNECTION AND ACTIVITY STATISTICS');
      console.log('------------------------------------');
      const connections = await client.query(`
        SELECT 
          COUNT(*) as total_connections,
          COUNT(*) FILTER (WHERE state = 'active') as active_connections,
          COUNT(*) FILTER (WHERE state = 'idle') as idle_connections,
          COUNT(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction
        FROM pg_stat_activity
        WHERE datname = current_database()
      `);
      const conn = connections.rows[0];
      console.log(`Total Connections: ${conn.total_connections}`);
      console.log(`Active: ${conn.active_connections}`);
      console.log(`Idle: ${conn.idle_connections}`);
      console.log(`Idle in Transaction: ${conn.idle_in_transaction}`);
      console.log('\n');

      // 9. Database Statistics
      console.log('9. DATABASE STATISTICS');
      console.log('----------------------');
      const dbStats = await client.query(`
        SELECT 
          numbackends as active_connections,
          xact_commit as transactions_committed,
          xact_rollback as transactions_rolled_back,
          blks_read as blocks_read,
          blks_hit as blocks_hit,
          ROUND(100.0 * blks_hit / NULLIF(blks_hit + blks_read, 0), 2) as cache_hit_ratio,
          tup_returned as rows_returned,
          tup_fetched as rows_fetched,
          tup_inserted as rows_inserted,
          tup_updated as rows_updated,
          tup_deleted as rows_deleted
        FROM pg_stat_database
        WHERE datname = current_database()
      `);
      const stats = dbStats.rows[0];
      console.log(`Transactions Committed: ${stats.transactions_committed}`);
      console.log(`Transactions Rolled Back: ${stats.transactions_rolled_back}`);
      console.log(`Cache Hit Ratio: ${stats.cache_hit_ratio || 0}%`);
      console.log(`Total Rows Inserted: ${stats.rows_inserted}`);
      console.log(`Total Rows Updated: ${stats.rows_updated}`);
      console.log(`Total Rows Deleted: ${stats.rows_deleted}`);
      console.log('\n');

      // 10. Available Extensions
      console.log('10. AVAILABLE POSTGRESQL EXTENSIONS');
      console.log('-----------------------------------');
      const extensions = await client.query(`
        SELECT name, installed_version, comment
        FROM pg_available_extensions
        WHERE installed_version IS NOT NULL
        ORDER BY name
      `);
      console.log('Installed Extensions:');
      extensions.rows.forEach(row => {
        console.log(`  ${row.name} (${row.installed_version}): ${row.comment}`);
      });
      console.log('\n');

      // 11. Table Bloat Analysis
      console.log('11. TABLE BLOAT ANALYSIS');
      console.log('------------------------');
      const bloat = await client.query(`
        WITH constants AS (
          SELECT current_setting('block_size')::numeric AS bs, 23 AS hdr, 8 AS ma
        ),
        no_stats AS (
          SELECT table_schema, table_name, 
            n_live_tup::numeric as est_rows,
            pg_table_size(relid)::numeric as table_size
          FROM information_schema.columns
            JOIN pg_stat_user_tables as psut
              ON table_schema = psut.schemaname
              AND table_name = psut.relname
            LEFT JOIN pg_stats
              ON table_schema = pg_stats.schemaname
              AND table_name = pg_stats.tablename
              AND column_name = attname
          WHERE attname IS NULL
            AND table_schema NOT IN ('pg_catalog', 'information_schema')
          GROUP BY table_schema, table_name, relid, n_live_tup
        ),
        null_headers AS (
          SELECT
            hdr+1+(sum(case when null_frac <> 0 THEN 1 else 0 END)/8) as nullhdr,
            SUM((1-null_frac)*avg_width) as datawidth,
            MAX(null_frac) as maxfracsum,
            schemaname,
            tablename,
            hdr, ma, bs
          FROM pg_stats CROSS JOIN constants
            LEFT JOIN no_stats
              ON schemaname = no_stats.table_schema
              AND tablename = no_stats.table_name
          WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
            AND no_stats.table_name IS NULL
            AND EXISTS (SELECT 1
              FROM information_schema.columns
              WHERE schemaname = columns.table_schema
                AND tablename = columns.table_name)
          GROUP BY schemaname, tablename, hdr, ma, bs
        ),
        data_headers AS (
          SELECT
            ma, bs, hdr, schemaname, tablename,
            (datawidth+(hdr+ma-(case when hdr%ma=0 THEN ma ELSE hdr%ma END)))::numeric AS datahdr,
            (maxfracsum*(nullhdr+ma-(case when nullhdr%ma=0 THEN ma ELSE nullhdr%ma END))) AS nullhdr2
          FROM null_headers
        ),
        table_estimates AS (
          SELECT schemaname, tablename, bs,
            reltuples::numeric as est_rows, relpages * bs as table_bytes,
            CEIL((reltuples*
                ((datahdr + nullhdr2) + 4 + ma -
                  (CASE WHEN datahdr%ma=0 THEN ma ELSE datahdr%ma END)
                )/(bs-20))) * bs AS expected_bytes,
            reltoastrelid
          FROM data_headers
            JOIN pg_class ON tablename = relname
            JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
              AND schemaname = nspname
          WHERE pg_class.relkind = 'r'
        ),
        estimates_with_toast AS (
          SELECT schemaname, tablename, 
            est_rows,
            table_bytes + (coalesce(toast.relpages, 0) * bs) as table_bytes,
            expected_bytes + (ceil(coalesce(toast.reltuples, 0) / 4) * bs) as expected_bytes
          FROM table_estimates LEFT OUTER JOIN pg_class as toast
            ON table_estimates.reltoastrelid = toast.oid
              AND toast.relkind = 't'
        ),
        table_estimates_plus AS (
          SELECT current_database() as databasename,
            schemaname, tablename, est_rows,
            CASE WHEN table_bytes > 0
              THEN table_bytes::NUMERIC
              ELSE NULL::NUMERIC END
              AS table_bytes,
            CASE WHEN expected_bytes > 0 
              THEN expected_bytes::NUMERIC
              ELSE NULL::NUMERIC END
                AS expected_bytes,
            CASE WHEN expected_bytes > 0 AND table_bytes > 0
              AND expected_bytes <= table_bytes
              THEN (table_bytes - expected_bytes)::NUMERIC
              ELSE 0::NUMERIC END AS bloat_bytes
          FROM estimates_with_toast
          UNION ALL
          SELECT current_database() as databasename, 
            table_schema, table_name, est_rows, table_size,
            NULL::NUMERIC, NULL::NUMERIC
          FROM no_stats
        ),
        bloat_data AS (
          SELECT current_database() as databasename,
            schemaname, tablename, 
            table_bytes, expected_bytes, bloat_bytes,
            round(bloat_bytes*100/table_bytes) as bloat_pct
          FROM table_estimates_plus
          WHERE table_bytes > 1024*1024
            AND bloat_bytes > 1024*1024
        )
        SELECT 
          schemaname,
          tablename,
          pg_size_pretty(table_bytes) as table_size,
          pg_size_pretty(bloat_bytes) as bloat_size,
          bloat_pct || '%' as bloat_percentage
        FROM bloat_data
        WHERE bloat_pct > 20
        ORDER BY bloat_bytes DESC
        LIMIT 10
      `);
      
      if (bloat.rows.length > 0) {
        console.log('Tables with significant bloat (>20%):');
        bloat.rows.forEach(row => {
          console.log(`  ${row.schemaname}.${row.tablename}: ${row.table_size} total, ${row.bloat_size} bloat (${row.bloat_percentage})`);
        });
      } else {
        console.log('No significant table bloat detected (>20%)');
      }
      console.log('\n');

      // 12. Unused Indexes
      console.log('12. UNUSED INDEXES');
      console.log('------------------');
      try {
        const unusedIndexes = await client.query(`
          SELECT 
            schemaname,
            relname as tablename,
            indexrelname as indexname,
            pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
            idx_scan as index_scans
          FROM pg_stat_user_indexes
          WHERE idx_scan = 0
          ORDER BY pg_relation_size(indexrelid) DESC
          LIMIT 10
        `);
        
        if (unusedIndexes.rows.length > 0) {
          console.log('Unused indexes (never scanned):');
          unusedIndexes.rows.forEach(row => {
            console.log(`  ${row.schemaname}.${row.tablename} - ${row.indexname}: ${row.index_size}`);
          });
        } else {
          console.log('No unused indexes found');
        }
      } catch (err) {
        console.log('Error analyzing unused indexes:', err.message);
      }
      console.log('\n');

      // 13. Missing Indexes (based on sequential scans)
      console.log('13. TABLES WITH HIGH SEQUENTIAL SCANS');
      console.log('-------------------------------------');
      const seqScans = await client.query(`
        SELECT 
          schemaname,
          relname as tablename,
          seq_scan,
          idx_scan,
          CASE WHEN seq_scan + idx_scan > 0 
            THEN ROUND(100.0 * seq_scan / (seq_scan + idx_scan), 2)
            ELSE 0 END as seq_scan_pct,
          n_live_tup as row_count
        FROM pg_stat_user_tables
        WHERE seq_scan > 100
          AND n_live_tup > 1000
        ORDER BY seq_scan DESC
        LIMIT 10
      `);
      
      console.log('Tables with high sequential scan activity:');
      seqScans.rows.forEach(row => {
        console.log(`  ${row.schemaname}.${row.tablename}: ${row.seq_scan} seq scans (${row.seq_scan_pct}% of all scans), ${row.row_count} rows`);
      });
      console.log('\n');

      // 14. Database Configuration
      console.log('14. KEY DATABASE CONFIGURATION');
      console.log('------------------------------');
      const configs = await client.query(`
        SELECT name, setting, unit, short_desc
        FROM pg_settings
        WHERE name IN (
          'max_connections',
          'shared_buffers',
          'effective_cache_size',
          'work_mem',
          'maintenance_work_mem',
          'checkpoint_segments',
          'checkpoint_completion_target',
          'wal_buffers',
          'max_wal_size',
          'min_wal_size',
          'random_page_cost',
          'effective_io_concurrency',
          'autovacuum',
          'autovacuum_max_workers'
        )
        ORDER BY name
      `);
      
      configs.rows.forEach(row => {
        console.log(`${row.name}: ${row.setting}${row.unit ? ' ' + row.unit : ''}`);
        console.log(`  ${row.short_desc}`);
      });
      console.log('\n');

      // 15. Table Constraints
      console.log('15. TABLE CONSTRAINTS SUMMARY');
      console.log('-----------------------------');
      const constraints = await client.query(`
        SELECT 
          contype,
          COUNT(*) as count,
          CASE contype
            WHEN 'p' THEN 'Primary Key'
            WHEN 'f' THEN 'Foreign Key'
            WHEN 'u' THEN 'Unique'
            WHEN 'c' THEN 'Check'
            WHEN 'x' THEN 'Exclusion'
            ELSE 'Other'
          END as constraint_type
        FROM pg_constraint
        WHERE connamespace NOT IN (
          SELECT oid FROM pg_namespace 
          WHERE nspname IN ('pg_catalog', 'information_schema')
        )
        GROUP BY contype
        ORDER BY count DESC
      `);
      
      console.log('Constraint Types:');
      constraints.rows.forEach(row => {
        console.log(`  ${row.constraint_type}: ${row.count}`);
      });
      console.log('\n');

      // Summary and Recommendations
      console.log('SUMMARY AND RECOMMENDATIONS');
      console.log('===========================');
      console.log('1. Database is using PostgreSQL on DigitalOcean');
      console.log('2. Monitor tables with high sequential scan activity for potential index opportunities');
      console.log('3. Consider removing unused indexes to save space and improve write performance');
      console.log('4. Tables with significant bloat may benefit from VACUUM FULL or pg_repack');
      console.log('5. Cache hit ratio should ideally be above 90% for good performance');
      
    });
  } catch (error) {
    console.error('Error analyzing database:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

analyzeDatabaseCapacity();