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

  try {
    // Get commit information
    const commitInfo = JSON.parse(execSync(`git show --format='{"sha":"%H","author":"%an","date":"%ad","message":"%s"}' --no-patch ${commitSha}`, { encoding: 'utf8' }));
    
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

    // Prepare review prompt
    const reviewPrompt = `
Please review this commit to the Bay View Association unified system project:

**Commit SHA:** ${commitSha}
**Author:** ${commitInfo.author}
**Date:** ${commitInfo.date}
**Message:** ${commitInfo.message}

**Changed Files:** ${changedFiles.join(', ')}

**Context:** This is the Bay View Association administrative system managing chapel services and memorial garden applications for a 150-year-old National Historic Landmark Chautauqua community in Petoskey, Michigan.

**Diff:**
\`\`\`diff
${diffOutput.slice(0, 8000)} // Truncate for API limits
\`\`\`

Please provide a focused code review covering:

1. **Security Analysis**: Authentication, input validation, SQL injection prevention
2. **Code Quality**: Best practices, error handling, maintainability  
3. **Bay View Context**: Proper terminology (leaseholders not owners), cultural preservation
4. **Performance**: Database queries, API efficiency
5. **Architecture**: Follows dual-write pattern for migration safety

Please be concise and focus on actionable feedback.`;

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
    const commentBody = `**Claude finished @bvaadmin's task** —— [View job](https://github.com/bvaadmin/unified-system/actions/runs/${{ github.run_id }})

---
### Commit Review: ${commitInfo.message} ✅

${reviewContent}

---`;

    try {
      // Post commit comment
      execSync(`gh api repos/bvaadmin/unified-system/commits/${commitSha}/comments -f body='${commentBody.replace(/'/g, "'\\''")}' --silent`);
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