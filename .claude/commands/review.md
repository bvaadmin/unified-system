# Code Review Workflow

When the user says "push this to git" or similar, follow this collaborative code review process:

1. Check git status to see what changes exist
2. Create a feature branch with a descriptive name based on the changes
3. Stage and commit all changes with a descriptive commit message
4. Push the feature branch to origin
5. Create a pull request to main branch
6. Explain that Claude Code Review will now analyze the changes
7. Provide the PR URL so the user can see the review results

This workflow ensures:
- All code changes get AI review before merging
- There's a discussion record for future reference
- The main branch stays stable
- Best practices are followed automatically

Always use conventional commit format (feat:, fix:, docs:, etc.) and include the Claude Code attribution in commits.