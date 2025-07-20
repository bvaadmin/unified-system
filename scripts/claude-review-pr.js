#!/usr/bin/env node

/**
 * Claude Code Review for Pull Requests
 * Analyzes PR changes and provides intelligent code review using Claude API
 */

import { Anthropic } from '@anthropic-ai/sdk';
import { execSync } from 'child_process';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function reviewPullRequest(prNumber) {
  console.log(`🤖 Starting Claude Code review for PR #${prNumber}`);

  try {
    // Get PR information
    const prInfo = JSON.parse(execSync(`gh pr view ${prNumber} --json title,body,author,files,commits`, { encoding: 'utf8' }));
    
    // Get diff content
    const diffOutput = execSync(`git diff origin/main...HEAD`, { encoding: 'utf8' });
    
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

    // Analyze PR type and scope (similar to commit analysis)
    const isInfrastructure = changedFiles.some(f => 
      f.includes('.github/workflows/') || 
      f.includes('package') || 
      (f.includes('scripts/') && (f.includes('claude-review') || f.includes('validate-constraints') || f.includes('test-')))
    );
    
    const isAPIChange = changedFiles.some(f => f.startsWith('api/'));
    const isLibChange = changedFiles.some(f => f.startsWith('lib/'));
    const isConfigChange = changedFiles.some(f => f.includes('config') || f.includes('.env') || f.includes('.json'));
    
    const prType = isInfrastructure ? 'infrastructure' : 
                   isAPIChange ? 'api' : 
                   isLibChange ? 'library' : 
                   isConfigChange ? 'configuration' : 'application';

    // Prepare enhanced PR review prompt
    const reviewPrompt = `
Review this ${prType} Pull Request for the Bay View Association unified system:

**PR #${prNumber}:** ${prInfo.title}
**Author:** ${prInfo.author.login}
**Type:** ${prType.toUpperCase()} (${changedFiles.length} files changed)
**Files:** ${changedFiles.slice(0, 5).join(', ')}${changedFiles.length > 5 ? ` +${changedFiles.length - 5} more` : ''}

**Description:**
${prInfo.body || 'No description provided'}

**Context:** Bay View Association administrative system - 150-year-old National Historic Landmark Chautauqua community managing chapel services and memorial garden applications.

**Diff (first 8000 chars):**
\`\`\`diff
${diffOutput.slice(0, 8000)}${diffOutput.length > 8000 ? '\n... (truncated for length)' : ''}
\`\`\`

**Review Focus for ${prType} PR:**

${prType === 'infrastructure' ? `
🔧 **Infrastructure Review:**
- CI/CD pipeline security and efficiency
- Deployment safety and rollback capability  
- Environment configuration correctness
- Tool integration and automation quality
` : prType === 'api' ? `
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

**Required Response Format:**
1. **Overall Recommendation:** APPROVE / REQUEST_CHANGES / COMMENT
2. **Priority-based feedback** using 🚨⚠️💡 indicators
3. **Specific actionable improvements** - focus on what to change and why
4. **Bay View compliance check** - terminology and cultural preservation

Skip generic observations - provide actionable feedback only.
`;

    // Get Claude's review
    const response = await anthropic.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: reviewPrompt
      }]
    });

    const reviewContent = response.content[0].text;

    // Post review comment via GitHub CLI
    const reviewFile = `/tmp/claude-review-${prNumber}.md`;
    fs.writeFileSync(reviewFile, reviewContent);

    // Post the review
    execSync(`gh pr review ${prNumber} --comment --body-file ${reviewFile}`, { stdio: 'inherit' });

    // Clean up
    fs.unlinkSync(reviewFile);

    console.log(`✅ Claude Code review posted for PR #${prNumber}`);

    // Extract overall assessment
    const assessment = reviewContent.toLowerCase().includes('request_changes') ? 'REQUEST_CHANGES' :
                     reviewContent.toLowerCase().includes('approve') ? 'APPROVE' : 'COMMENT';
    
    return {
      prNumber,
      assessment,
      reviewPosted: true
    };

  } catch (error) {
    console.error(`❌ Error reviewing PR #${prNumber}:`, error.message);
    
    // Post error comment
    const errorComment = `🤖 Claude Code Review Error

Sorry, I encountered an error while reviewing this PR:
\`\`\`
${error.message}
\`\`\`

Please check the workflow logs for more details.`;

    try {
      execSync(`gh pr comment ${prNumber} --body "${errorComment}"`, { stdio: 'inherit' });
    } catch (commentError) {
      console.error('Failed to post error comment:', commentError.message);
    }

    throw error;
  }
}

// Main execution
async function main() {
  const prNumber = process.argv[2];
  
  if (!prNumber) {
    console.error('❌ Usage: node claude-review-pr.js <pr_number>');
    process.exit(1);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY environment variable required');
    process.exit(1);
  }

  try {
    const result = await reviewPullRequest(prNumber);
    console.log('🎉 Review completed:', result);
    process.exit(0);
  } catch (error) {
    console.error('❌ Review failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { reviewPullRequest };