#!/usr/bin/env node

/**
 * Constraint Validation Engine
 * Enforces Bay View system constraints before any commits or deployments
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import pg from 'pg';
import dotenv from 'dotenv';

const { Client } = pg;
dotenv.config();

class ConstraintValidator {
  constructor() {
    this.violations = [];
    this.warnings = [];
  }

  async validateAll() {
    console.log('🔍 Running Bay View constraint validation...\n');

    // Core validation checks
    await this.validateDatabasePatterns();
    await this.validateAPIPatterns();
    await this.validateBayViewTerminology();
    await this.validateSecurityPatterns();
    await this.validateArchitectureCompliance();
    await this.validateGitConventions();

    // Report results
    this.reportResults();
    
    return {
      violations: this.violations,
      warnings: this.warnings,
      passed: this.violations.length === 0
    };
  }

  async validateDatabasePatterns() {
    console.log('🗄️  Validating database patterns...');
    
    // Check for direct database writes without dual-write
    const sqlFiles = this.findFiles('**/*.{js,sql}');
    
    for (const file of sqlFiles) {
      const content = fs.readFileSync(file, 'utf8');
      
      // Look for INSERT/UPDATE without dual-write pattern
      if (content.includes('INSERT INTO') || content.includes('UPDATE ')) {
        if (!content.includes('createNotionPage') && !content.includes('dual-write') && 
            !file.includes('migration') && !file.includes('test')) {
          this.addViolation('DATABASE_DUAL_WRITE', 
            `File ${file} contains database writes without dual-write pattern`);
        }
      }
      
      // Check for proper parameterized queries
      const sqlInjectionPattern = /query\(['"`][^'"`]*\$\{|query\(['"`][^'"`]*\+/;
      if (sqlInjectionPattern.test(content)) {
        this.addViolation('SQL_INJECTION_RISK', 
          `File ${file} has potential SQL injection vulnerability`);
      }
      
      // Validate constraint adherence
      if (content.includes('task_type') && !content.includes("IN ('Feature', 'Bug', 'Configuration', 'Migration')")) {
        if (content.includes('INSERT') || content.includes('UPDATE')) {
          this.addWarning('CONSTRAINT_VALIDATION', 
            `File ${file} may not validate task_type constraint`);
        }
      }
    }
  }

  async validateAPIPatterns() {
    console.log('🌐 Validating API patterns...');
    
    const apiFiles = this.findFiles('api/**/*.js');
    
    for (const file of apiFiles) {
      const content = fs.readFileSync(file, 'utf8');
      
      // Check CORS configuration
      if (!content.includes('applyCors') && !content.includes('withCors')) {
        this.addViolation('MISSING_CORS', 
          `API file ${file} missing CORS configuration`);
      }
      
      // Check proper error handling
      if (!content.includes('try {') || !content.includes('catch')) {
        this.addViolation('MISSING_ERROR_HANDLING', 
          `API file ${file} missing proper error handling`);
      }
      
      // Validate response format
      const hasStructuredResponse = content.includes('res.status(') && 
                                   content.includes('.json({');
      if (!hasStructuredResponse) {
        this.addWarning('RESPONSE_FORMAT', 
          `API file ${file} should use structured JSON responses`);
      }
      
      // Check authentication for admin endpoints
      if (file.includes('admin/') && !content.includes('ADMIN_TOKEN')) {
        this.addViolation('MISSING_AUTH', 
          `Admin API file ${file} missing authentication check`);
      }
    }
  }

  async validateBayViewTerminology() {
    console.log('🏛️  Validating Bay View terminology...');
    
    const codeFiles = this.findFiles('**/*.{js,jsx,ts,tsx,md}');
    const prohibitedTerms = [
      { term: 'owner', correct: 'leaseholder', context: 'property' },
      { term: 'deed', correct: 'lease', context: 'property' },
      { term: 'address', correct: 'block/lot', context: 'property' },
      { term: 'customer', correct: 'member', context: 'general' }
    ];
    
    for (const file of codeFiles) {
      const content = fs.readFileSync(file, 'utf8').toLowerCase();
      
      for (const { term, correct, context } of prohibitedTerms) {
        if (content.includes(term) && !content.includes(correct)) {
          // Skip if it's in a comment explaining the difference
          if (!content.includes(`not ${term}`) && !content.includes(`instead of ${term}`)) {
            this.addWarning('BAY_VIEW_TERMINOLOGY', 
              `File ${file} uses "${term}" - consider "${correct}" for ${context} context`);
          }
        }
      }
      
      // Check for proper Block/Lot format
      if (content.includes('block') && content.includes('lot')) {
        if (!content.includes('block') || !content.includes('lot')) {
          this.addWarning('BLOCK_LOT_FORMAT', 
            `File ${file} should use "Block X Lot Y" format`);
        }
      }
    }
  }

  async validateSecurityPatterns() {
    console.log('🔒 Validating security patterns...');
    
    const jsFiles = this.findFiles('**/*.{js,jsx,ts,tsx}');
    
    for (const file of jsFiles) {
      const content = fs.readFileSync(file, 'utf8');
      
      // Check for hardcoded secrets
      const secretPatterns = [
        /api[_-]?key\s*[:=]\s*['"`][^'"`]{10,}['"`]/i,
        /password\s*[:=]\s*['"`][^'"`]+['"`]/i,
        /secret\s*[:=]\s*['"`][^'"`]{10,}['"`]/i,
        /token\s*[:=]\s*['"`][^'"`]{20,}['"`]/i
      ];
      
      for (const pattern of secretPatterns) {
        if (pattern.test(content)) {
          this.addViolation('HARDCODED_SECRET', 
            `File ${file} contains potential hardcoded secret`);
        }
      }
      
      // Check for proper environment variable usage
      if (content.includes('process.env.') && !content.includes('dotenv')) {
        if (!file.includes('config') && !file.includes('.env')) {
          this.addWarning('ENV_VAR_USAGE', 
            `File ${file} uses environment variables without dotenv import`);
        }
      }
      
      // Validate SSL configuration
      if (content.includes('rejectUnauthorized: false')) {
        if (!content.includes('// SSL required for production')) {
          this.addWarning('SSL_CONFIGURATION', 
            `File ${file} disables SSL verification - ensure this is intentional`);
        }
      }
    }
  }

  async validateArchitectureCompliance() {
    console.log('🏗️  Validating architecture compliance...');
    
    // Check for proper utility usage
    const jsFiles = this.findFiles('**/*.{js,jsx,ts,tsx}');
    
    for (const file of jsFiles) {
      const content = fs.readFileSync(file, 'utf8');
      
      // Check for database connection patterns
      if (content.includes('new Client(') && !content.includes('lib/db')) {
        if (!file.includes('lib/db.js') && !file.includes('script')) {
          this.addWarning('DB_UTIL_USAGE', 
            `File ${file} should use lib/db.js utilities for database connections`);
        }
      }
      
      // Check for CORS utility usage
      if (content.includes('Access-Control-Allow-Origin') && !content.includes('lib/cors')) {
        this.addWarning('CORS_UTIL_USAGE', 
          `File ${file} should use lib/cors.js utilities for CORS handling`);
      }
      
      // Validate proper import patterns
      if (content.includes('require(') && content.includes('import ')) {
        this.addViolation('MIXED_IMPORTS', 
          `File ${file} mixes require() and import statements`);
      }
    }
    
    // Check directory structure compliance
    const apiFiles = this.findFiles('api/**/*.js');
    for (const file of apiFiles) {
      const parts = file.split('/');
      if (parts.length < 3) {
        this.addWarning('API_STRUCTURE', 
          `API file ${file} should be in category subdirectory (api/category/endpoint.js)`);
      }
    }
  }

  async validateGitConventions() {
    console.log('📝 Validating Git conventions...');
    
    try {
      // Check current branch name
      const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
      
      if (branch !== 'main' && !branch.startsWith('feature/') && 
          !branch.startsWith('bugfix/') && !branch.startsWith('hotfix/')) {
        this.addWarning('BRANCH_NAMING', 
          `Branch "${branch}" doesn't follow naming convention (feature/*, bugfix/*, hotfix/*)`);
      }
      
      // Check if there are uncommitted changes
      const status = execSync('git status --porcelain', { encoding: 'utf8' });
      if (status.trim()) {
        this.addWarning('UNCOMMITTED_CHANGES', 
          'There are uncommitted changes that should be committed before validation');
      }
      
      // Validate last commit message format
      const lastCommit = execSync('git log -1 --pretty=%B', { encoding: 'utf8' }).trim();
      const commitPattern = /^(Feature|Bug|Config|Migration|Docs): .+/;
      
      if (!commitPattern.test(lastCommit)) {
        this.addWarning('COMMIT_MESSAGE_FORMAT', 
          `Last commit message doesn't follow format: "Type: Description"`);
      }
      
    } catch (error) {
      this.addWarning('GIT_VALIDATION', `Could not validate Git conventions: ${error.message}`);
    }
  }

  findFiles(pattern) {
    try {
      const output = execSync(`find . -path "./node_modules" -prune -o -name "${pattern.replace('**/', '')}" -type f -print`, 
        { encoding: 'utf8' });
      return output.split('\n').filter(f => f.trim() && !f.includes('node_modules'));
    } catch (error) {
      return [];
    }
  }

  addViolation(type, message) {
    this.violations.push({ type, message, severity: 'error' });
    console.log(`❌ VIOLATION [${type}]: ${message}`);
  }

  addWarning(type, message) {
    this.warnings.push({ type, message, severity: 'warning' });
    console.log(`⚠️  WARNING [${type}]: ${message}`);
  }

  reportResults() {
    console.log('\n📊 Constraint Validation Results:');
    console.log(`❌ Violations: ${this.violations.length}`);
    console.log(`⚠️  Warnings: ${this.warnings.length}`);
    
    if (this.violations.length === 0) {
      console.log('✅ All critical constraints passed!');
    } else {
      console.log('\n🚫 Critical violations must be fixed before proceeding:');
      this.violations.forEach(v => console.log(`   • ${v.message}`));
    }
    
    if (this.warnings.length > 0) {
      console.log('\n💡 Warnings (recommended fixes):');
      this.warnings.forEach(w => console.log(`   • ${w.message}`));
    }
  }
}

// CLI execution
async function main() {
  const validator = new ConstraintValidator();
  const result = await validator.validateAll();
  
  // Exit with error code if violations found
  process.exit(result.passed ? 0 : 1);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { ConstraintValidator };