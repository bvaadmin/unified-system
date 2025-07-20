#!/usr/bin/env node

/**
 * Claude Code Review for Direct Commits
 * Analyzes commit changes and provides intelligent code review using Claude API
 */

import { Anthropic } from '@anthropic-ai/sdk';
import { execSync } from 'child_process';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function reviewCommit(commitSha) {
  console.log(`🤖 Starting Claude Code review for commit ${commitSha}`);

  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('⚠️ ANTHROPIC_API_KEY not found. Skipping Claude review.');
    console.log('📝 To enable Claude reviews, add ANTHROPIC_API_KEY to GitHub secrets.');
    return;
  }

  try {
    // Get commit information
    const commitMessage = execSync(`git log -1 --format=%s ${commitSha}`, { encoding: 'utf8' }).trim();
    const commitAuthor = execSync(`git log -1 --format=%an ${commitSha}`, { encoding: 'utf8' }).trim();
    const commitDate = execSync(`git log -1 --format=%ad ${commitSha}`, { encoding: 'utf8' }).trim();
    
    // Get commit diff
    const diffOutput = execSync(`git show ${commitSha}`, { encoding: 'utf8' });
    
    // Get changed files
    const changedFiles = fs.readFileSync('changed_files.txt', 'utf8').split('\n').filter(f => f.trim());
    
    // Read relevant file contents for context
    const fileContents = {};
    for (const file of changedFiles.slice(0, 10)) { // Limit to first 10 files
      try {
        if (fs.existsSync(file)) {
          fileContents[file] = fs.readFileSync(file, 'utf8');
        }
      } catch (error) {
        console.warn(`Could not read file ${file}: ${error.message}`);
      }
    }

    // Analyze commit type and context
    const isInfrastructure = changedFiles.some(f => 
      f.includes('.github/workflows/') || 
      f.includes('package') || 
      (f.includes('scripts/') && (f.includes('claude-review') || f.includes('validate-constraints') || f.includes('test-')))
    );
    
    const isAPIChange = changedFiles.some(f => f.startsWith('api/'));
    const isLibChange = changedFiles.some(f => f.startsWith('lib/'));
    const isConfigChange = changedFiles.some(f => f.includes('config') || f.includes('.env') || f.includes('.json'));
    
    const commitType = isInfrastructure ? 'infrastructure' : 
                      isAPIChange ? 'api' : 
                      isLibChange ? 'library' : 
                      isConfigChange ? 'configuration' : 'application';

    // Prepare enhanced review prompt
    const reviewPrompt = `
Review this ${commitType} change to the Bay View Association unified system:

**Commit:** ${commitMessage}
**Type:** ${commitType.toUpperCase()} (${changedFiles.length} files)
**Files:** ${changedFiles.join(', ')}

**Context:** Bay View Association administrative system - 150-year-old National Historic Landmark Chautauqua community managing chapel services and memorial garden applications.

**Diff (first 8000 chars):**
\`\`\`diff
${diffOutput.slice(0, 8000)}
\`\`\`

**Review Focus for ${commitType} changes:**

${commitType === 'infrastructure' ? `
🔧 **Infrastructure Review:**
- CI/CD pipeline security and efficiency
- Deployment safety and rollback capability  
- Environment configuration correctness
- Tool integration and automation quality
` : commitType === 'api' ? `
🌐 **API Review:**
- Authentication and authorization
- Input validation and SQL injection prevention
- Error handling and API design
- Rate limiting and security headers
` : `
💻 **Application Review:**
- Code quality and maintainability
- Business logic correctness
- Data integrity and validation
- User experience and accessibility
`}

**Priority Levels:**
🚨 **CRITICAL** - Security vulnerabilities, data loss risks, breaking changes
⚠️ **IMPORTANT** - Performance issues, maintainability concerns, architecture violations  
💡 **SUGGESTION** - Code style, optimizations, best practices

**Bay View Specific:**
- Cultural preservation (leaseholder not owner terminology)
- Dual-write pattern compliance for migration safety
- Member vs non-member business rules
- 150-year heritage considerations

Provide **actionable feedback only** - focus on what should be changed and why. Skip generic observations.`;

    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: reviewPrompt
      }]
    });

    const reviewContent = response.content[0].text;

    // Create commit comment via GitHub API
    const commentBody = `**Claude finished @bvaadmin's task** —— [View job](https://github.com/bvaadmin/unified-system/commit/${commitSha})

---
### Commit Review: ${commitMessage} ✅

${reviewContent}

---`;

    try {
      // Post commit comment using custom token if available
      const token = process.env.CLAUDE_GITHUB_TOKEN || process.env.GITHUB_TOKEN;
      execSync(`gh api repos/bvaadmin/unified-system/commits/${commitSha}/comments -f body='${commentBody.replace(/'/g, "'\\''")}' --silent`, {
        env: { ...process.env, GITHUB_TOKEN: token }
      });
      console.log(`✅ Posted Claude review for commit ${commitSha}`);
    } catch (error) {
      console.error('Failed to post commit comment:', error.message);
      // Still log the review locally
      console.log('Review content:', reviewContent);
    }

  } catch (error) {
    console.error('Review failed:', error);
    process.exit(1);
  }
}

// Get commit SHA from command line
const commitSha = process.argv[2];
if (!commitSha) {
  console.error('Usage: node claude-review-commit.js <commit-sha>');
  process.exit(1);
}

reviewCommit(commitSha);