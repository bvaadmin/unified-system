#!/usr/bin/env node

/**
 * Database Export/Import Utility
 * Provides full system backup and portability
 */

import { Client } from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

class DatabaseExporter {
    constructor(connectionString) {
        this.connectionString = connectionString;
        this.client = null;
    }

    async connect() {
        this.client = new Client({
            connectionString: this.connectionString
        });
        await this.client.connect();
    }

    async disconnect() {
        if (this.client) {
            await this.client.end();
        }
    }

    /**
     * Export entire database to portable format
     */
    async exportDatabase(outputDir, format = 'all') {
        console.log(`Starting database export to ${outputDir}...`);
        
        // Create output directory
        await fs.mkdir(outputDir, { recursive: true });
        
        // Create metadata file
        const metadata = {
            exportDate: new Date().toISOString(),
            postgresqlVersion: await this.getPostgreSQLVersion(),
            format: format,
            schemas: []
        };

        // Get all schemas
        const schemas = await this.getSchemas();
        
        for (const schema of schemas) {
            console.log(`Exporting schema: ${schema}`);
            const schemaDir = path.join(outputDir, schema);
            await fs.mkdir(schemaDir, { recursive: true });
            
            const schemaMetadata = {
                name: schema,
                tables: []
            };

            // Export schema structure
            if (format === 'all' || format === 'sql') {
                const ddl = await this.exportSchemaDDL(schema);
                await fs.writeFile(
                    path.join(schemaDir, '00_schema.sql'),
                    ddl
                );
            }

            // Export each table
            const tables = await this.getTablesInSchema(schema);
            for (const table of tables) {
                console.log(`  Exporting table: ${schema}.${table}`);
                
                const tableMetadata = {
                    name: table,
                    rowCount: 0,
                    formats: []
                };

                // Export in multiple formats
                if (format === 'all' || format === 'sql') {
                    const sql = await this.exportTableSQL(schema, table);
                    await fs.writeFile(
                        path.join(schemaDir, `${table}.sql`),
                        sql
                    );
                    tableMetadata.formats.push('sql');
                }

                if (format === 'all' || format === 'json') {
                    const json = await this.exportTableJSON(schema, table);
                    await fs.writeFile(
                        path.join(schemaDir, `${table}.json`),
                        JSON.stringify(json, null, 2)
                    );
                    tableMetadata.formats.push('json');
                    tableMetadata.rowCount = json.data.length;
                }

                if (format === 'all' || format === 'csv') {
                    const csv = await this.exportTableCSV(schema, table);
                    await fs.writeFile(
                        path.join(schemaDir, `${table}.csv`),
                        csv
                    );
                    tableMetadata.formats.push('csv');
                }

                schemaMetadata.tables.push(tableMetadata);
            }

            metadata.schemas.push(schemaMetadata);
        }

        // Save metadata
        await fs.writeFile(
            path.join(outputDir, 'export_metadata.json'),
            JSON.stringify(metadata, null, 2)
        );

        // Create restore script
        await this.createRestoreScript(outputDir, metadata);

        console.log('Export completed successfully!');
        return metadata;
    }

    /**
     * Get PostgreSQL version
     */
    async getPostgreSQLVersion() {
        const result = await this.client.query('SELECT version()');
        return result.rows[0].version;
    }

    /**
     * Get all user schemas (excluding system schemas)
     */
    async getSchemas() {
        const result = await this.client.query(`
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
              AND schema_name NOT LIKE 'pg_%'
            ORDER BY schema_name
        `);
        return result.rows.map(row => row.schema_name);
    }

    /**
     * Get all tables in a schema
     */
    async getTablesInSchema(schema) {
        const result = await this.client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = $1 
              AND table_type = 'BASE TABLE'
            ORDER BY table_name
        `, [schema]);
        return result.rows.map(row => row.table_name);
    }

    /**
     * Export schema DDL (CREATE statements)
     */
    async exportSchemaDDL(schema) {
        let ddl = `-- Schema: ${schema}\n\n`;
        
        // Create schema
        ddl += `CREATE SCHEMA IF NOT EXISTS ${schema};\n\n`;
        
        // Get all tables with their definitions
        const tables = await this.getTablesInSchema(schema);
        
        for (const table of tables) {
            // Get table structure
            const tableSQL = await this.getTableDDL(schema, table);
            ddl += tableSQL + '\n\n';
            
            // Get indexes
            const indexes = await this.getTableIndexes(schema, table);
            ddl += indexes + '\n\n';
            
            // Get constraints
            const constraints = await this.getTableConstraints(schema, table);
            ddl += constraints + '\n\n';
        }
        
        return ddl;
    }

    /**
     * Get CREATE TABLE statement
     */
    async getTableDDL(schema, table) {
        // Get column definitions
        const columns = await this.client.query(`
            SELECT 
                column_name,
                data_type,
                character_maximum_length,
                numeric_precision,
                numeric_scale,
                is_nullable,
                column_default
            FROM information_schema.columns
            WHERE table_schema = $1 AND table_name = $2
            ORDER BY ordinal_position
        `, [schema, table]);
        
        let ddl = `CREATE TABLE IF NOT EXISTS ${schema}.${table} (\n`;
        
        const columnDefs = columns.rows.map(col => {
            let def = `    ${col.column_name} ${col.data_type}`;
            
            if (col.character_maximum_length) {
                def += `(${col.character_maximum_length})`;
            } else if (col.numeric_precision) {
                def += `(${col.numeric_precision}`;
                if (col.numeric_scale) {
                    def += `,${col.numeric_scale}`;
                }
                def += ')';
            }
            
            if (col.is_nullable === 'NO') {
                def += ' NOT NULL';
            }
            
            if (col.column_default) {
                def += ` DEFAULT ${col.column_default}`;
            }
            
            return def;
        });
        
        ddl += columnDefs.join(',\n');
        ddl += '\n);';
        
        return ddl;
    }

    /**
     * Export table data as SQL INSERT statements
     */
    async exportTableSQL(schema, table) {
        const result = await this.client.query(
            `SELECT * FROM ${schema}.${table} ORDER BY 1`
        );
        
        if (result.rows.length === 0) {
            return `-- No data in ${schema}.${table}\n`;
        }
        
        let sql = `-- Data for ${schema}.${table}\n`;
        sql += `-- ${result.rows.length} rows\n\n`;
        
        const columns = Object.keys(result.rows[0]);
        
        for (const row of result.rows) {
            const values = columns.map(col => {
                const value = row[col];
                if (value === null) return 'NULL';
                if (typeof value === 'string') {
                    return `'${value.replace(/'/g, "''")}'`;
                }
                if (value instanceof Date) {
                    return `'${value.toISOString()}'`;
                }
                if (typeof value === 'object') {
                    return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
                }
                return value;
            });
            
            sql += `INSERT INTO ${schema}.${table} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
        }
        
        return sql;
    }

    /**
     * Export table data as JSON
     */
    async exportTableJSON(schema, table) {
        const result = await this.client.query(
            `SELECT * FROM ${schema}.${table} ORDER BY 1`
        );
        
        return {
            schema: schema,
            table: table,
            columns: result.fields.map(f => ({
                name: f.name,
                dataTypeID: f.dataTypeID,
                dataTypeSize: f.dataTypeSize
            })),
            data: result.rows
        };
    }

    /**
     * Export table data as CSV
     */
    async exportTableCSV(schema, table) {
        const result = await this.client.query(
            `SELECT * FROM ${schema}.${table} ORDER BY 1`
        );
        
        if (result.rows.length === 0) {
            return '';
        }
        
        return stringify(result.rows, {
            header: true,
            columns: Object.keys(result.rows[0])
        });
    }

    /**
     * Get table indexes
     */
    async getTableIndexes(schema, table) {
        const result = await this.client.query(`
            SELECT indexdef 
            FROM pg_indexes 
            WHERE schemaname = $1 
              AND tablename = $2
              AND indexname NOT LIKE '%_pkey'
        `, [schema, table]);
        
        if (result.rows.length === 0) {
            return '-- No indexes';
        }
        
        return result.rows.map(row => row.indexdef + ';').join('\n');
    }

    /**
     * Get table constraints
     */
    async getTableConstraints(schema, table) {
        const result = await this.client.query(`
            SELECT conname, pg_get_constraintdef(oid) as condef
            FROM pg_constraint
            WHERE conrelid = ($1 || '.' || $2)::regclass
              AND contype IN ('f', 'c', 'u')
        `, [schema, table]);
        
        if (result.rows.length === 0) {
            return '-- No additional constraints';
        }
        
        let sql = '-- Constraints\n';
        for (const row of result.rows) {
            sql += `ALTER TABLE ${schema}.${table} ADD CONSTRAINT ${row.conname} ${row.condef};\n`;
        }
        
        return sql;
    }

    /**
     * Create restore script
     */
    async createRestoreScript(outputDir, metadata) {
        let script = `#!/bin/bash
# Database Restore Script
# Generated: ${metadata.exportDate}
# PostgreSQL Version: ${metadata.postgresqlVersion}

set -e

echo "Bay View Association Database Restore"
echo "====================================="
echo ""
echo "This script will restore the database from the export."
echo "WARNING: This will overwrite existing data!"
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Restore cancelled."
    exit 1
fi

# Database connection
read -p "Enter database connection string: " DB_URL

echo "Starting restore..."

`;

        // Add schema creation
        for (const schema of metadata.schemas) {
            script += `\n# Restore schema: ${schema.name}\n`;
            script += `psql "$DB_URL" < "${schema.name}/00_schema.sql"\n`;
            
            // Add table data
            for (const table of schema.tables) {
                if (table.formats.includes('sql')) {
                    script += `psql "$DB_URL" < "${schema.name}/${table.name}.sql"\n`;
                }
            }
        }

        script += `
echo "Restore completed successfully!"
`;

        await fs.writeFile(
            path.join(outputDir, 'restore.sh'),
            script,
            { mode: 0o755 }
        );
    }
}

/**
 * Database Importer
 */
class DatabaseImporter {
    constructor(connectionString) {
        this.connectionString = connectionString;
        this.client = null;
    }

    async connect() {
        this.client = new Client({
            connectionString: this.connectionString
        });
        await this.client.connect();
    }

    async disconnect() {
        if (this.client) {
            await this.client.end();
        }
    }

    /**
     * Import from export directory
     */
    async importDatabase(inputDir, options = {}) {
        console.log(`Starting database import from ${inputDir}...`);
        
        // Read metadata
        const metadataPath = path.join(inputDir, 'export_metadata.json');
        const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
        
        console.log(`Export date: ${metadata.exportDate}`);
        console.log(`PostgreSQL version: ${metadata.postgresqlVersion}`);
        
        // Import each schema
        for (const schema of metadata.schemas) {
            if (options.schemas && !options.schemas.includes(schema.name)) {
                console.log(`Skipping schema: ${schema.name}`);
                continue;
            }
            
            console.log(`Importing schema: ${schema.name}`);
            
            // Create schema
            if (!options.skipSchema) {
                await this.client.query(`CREATE SCHEMA IF NOT EXISTS ${schema.name}`);
            }
            
            // Import tables
            for (const table of schema.tables) {
                if (options.tables && !options.tables.includes(table.name)) {
                    console.log(`  Skipping table: ${table.name}`);
                    continue;
                }
                
                console.log(`  Importing table: ${table.name} (${table.rowCount} rows)`);
                
                // Choose format
                const format = options.format || 'sql';
                if (!table.formats.includes(format)) {
                    throw new Error(`Format ${format} not available for ${table.name}`);
                }
                
                const filePath = path.join(inputDir, schema.name, `${table.name}.${format}`);
                
                switch (format) {
                    case 'sql':
                        await this.importSQL(filePath);
                        break;
                    case 'json':
                        await this.importJSON(filePath, schema.name, table.name);
                        break;
                    case 'csv':
                        await this.importCSV(filePath, schema.name, table.name);
                        break;
                }
            }
        }
        
        console.log('Import completed successfully!');
    }

    /**
     * Import SQL file
     */
    async importSQL(filePath) {
        const sql = await fs.readFile(filePath, 'utf8');
        await this.client.query(sql);
    }

    /**
     * Import JSON file
     */
    async importJSON(filePath, schema, table) {
        const data = JSON.parse(await fs.readFile(filePath, 'utf8'));
        
        if (data.data.length === 0) {
            return;
        }
        
        // Prepare batch insert
        const columns = Object.keys(data.data[0]);
        const values = data.data.map(row => columns.map(col => row[col]));
        
        // Generate placeholders
        const placeholders = values.map((row, i) => 
            `(${row.map((_, j) => `$${i * columns.length + j + 1}`).join(', ')})`
        ).join(', ');
        
        const flatValues = values.flat();
        
        const query = `
            INSERT INTO ${schema}.${table} (${columns.join(', ')})
            VALUES ${placeholders}
        `;
        
        await this.client.query(query, flatValues);
    }

    /**
     * Import CSV file
     */
    async importCSV(filePath, schema, table) {
        const csv = await fs.readFile(filePath, 'utf8');
        const records = parse(csv, {
            columns: true,
            skip_empty_lines: true
        });
        
        if (records.length === 0) {
            return;
        }
        
        // Import in batches
        const batchSize = 100;
        for (let i = 0; i < records.length; i += batchSize) {
            const batch = records.slice(i, i + batchSize);
            await this.importBatch(schema, table, batch);
        }
    }

    /**
     * Import a batch of records
     */
    async importBatch(schema, table, records) {
        const columns = Object.keys(records[0]);
        const values = records.map(row => columns.map(col => row[col]));
        
        const placeholders = values.map((row, i) => 
            `(${row.map((_, j) => `$${i * columns.length + j + 1}`).join(', ')})`
        ).join(', ');
        
        const flatValues = values.flat();
        
        const query = `
            INSERT INTO ${schema}.${table} (${columns.join(', ')})
            VALUES ${placeholders}
        `;
        
        await this.client.query(query, flatValues);
    }
}

// CLI Interface
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    
    if (!command || !['export', 'import'].includes(command)) {
        console.log(`
Usage: node export-import-utility.js <command> [options]

Commands:
  export <output-dir>  Export database to directory
  import <input-dir>   Import database from directory

Export Options:
  --format <format>    Export format: sql, json, csv, all (default: all)
  --schemas <list>     Comma-separated list of schemas to export
  --tables <list>      Comma-separated list of tables to export

Import Options:
  --format <format>    Import format: sql, json, csv (default: sql)
  --schemas <list>     Comma-separated list of schemas to import
  --tables <list>      Comma-separated list of tables to import
  --skip-schema        Skip schema creation

Environment:
  DATABASE_URL         PostgreSQL connection string
`);
        process.exit(1);
    }
    
    const DATABASE_URL = process.env.DATABASE_URL;
    if (!DATABASE_URL) {
        console.error('ERROR: DATABASE_URL environment variable is required');
        process.exit(1);
    }
    
    try {
        if (command === 'export') {
            const outputDir = args[1];
            if (!outputDir) {
                console.error('ERROR: Output directory is required');
                process.exit(1);
            }
            
            const exporter = new DatabaseExporter(DATABASE_URL);
            await exporter.connect();
            
            const options = {
                format: getOption(args, '--format') || 'all',
                schemas: getOption(args, '--schemas')?.split(','),
                tables: getOption(args, '--tables')?.split(',')
            };
            
            await exporter.exportDatabase(outputDir, options.format);
            await exporter.disconnect();
            
        } else if (command === 'import') {
            const inputDir = args[1];
            if (!inputDir) {
                console.error('ERROR: Input directory is required');
                process.exit(1);
            }
            
            const importer = new DatabaseImporter(DATABASE_URL);
            await importer.connect();
            
            const options = {
                format: getOption(args, '--format') || 'sql',
                schemas: getOption(args, '--schemas')?.split(','),
                tables: getOption(args, '--tables')?.split(','),
                skipSchema: args.includes('--skip-schema')
            };
            
            await importer.importDatabase(inputDir, options);
            await importer.disconnect();
        }
        
    } catch (error) {
        console.error('ERROR:', error.message);
        process.exit(1);
    }
}

function getOption(args, option) {
    const index = args.indexOf(option);
    if (index !== -1 && index + 1 < args.length) {
        return args[index + 1];
    }
    return null;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export { DatabaseExporter, DatabaseImporter };