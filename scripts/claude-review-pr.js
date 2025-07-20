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

    // Prepare review prompt
    const reviewPrompt = `
Please review this pull request for the Bay View Association unified system project:

**PR Title:** ${prInfo.title}
**Author:** ${prInfo.author.login}
**Description:**
${prInfo.body || 'No description provided'}

**Changed Files:**
${changedFiles.join('\n')}

**Diff:**
\`\`\`diff
${diffOutput.slice(0, 8000)} ${diffOutput.length > 8000 ? '... (truncated)' : ''}
\`\`\`

**Context - Project Overview:**
This is a PostgreSQL-based administrative system for Bay View Association, a 150-year-old Chautauqua community. The system manages chapel services, memorial garden applications, member records, and financial operations. Key features:

- Dual-write pattern for safe migration from legacy systems
- PostgreSQL with advanced features (JSONB, exclusion constraints, CTEs)
- Vercel serverless APIs with CORS configuration
- Notion integration for workflow management
- Configuration system for runtime-modifiable values

**Review Focus Areas:**
1. **Security**: SQL injection prevention, proper authentication, data validation
2. **Performance**: Database query optimization, API response times
3. **Bay View Authenticity**: Preserves traditions, uses correct terminology (Block/Lot, leaseholder not owner)
4. **Architecture**: Follows established patterns, maintains dual-write safety
5. **Code Quality**: Error handling, documentation, testing

Please provide:
1. Overall assessment (APPROVE, REQUEST_CHANGES, or COMMENT)
2. Specific code review comments with line references
3. Security concerns if any
4. Performance recommendations
5. Suggestions for improvement

Format your response as a GitHub review comment in markdown.
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