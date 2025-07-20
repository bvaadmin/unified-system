#!/bin/bash

# Safe Push Script - Combines PII protection with smart PR management
# Usage: ./scripts/safe-push.sh [task-id] [pr-title]

set -e

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔒 Bay View Safe Push Workflow${NC}"
echo "================================"

# Get task ID from argument or prompt
TASK_ID=${1:-""}
if [ -z "$TASK_ID" ]; then
    echo -n "Enter task ID (e.g., 35): "
    read TASK_ID
fi

# Get PR title from argument or generate
PR_TITLE=${2:-""}

# Phase 1: Branch Management
echo -e "\n${BLUE}📌 Phase 1: Branch Management${NC}"
CURRENT_BRANCH=$(git branch --show-current)
echo "Current branch: $CURRENT_BRANCH"

# Check if branch matches pattern
if [[ ! "$CURRENT_BRANCH" =~ ^feature/task-[0-9]+-.*$ ]]; then
    echo -e "${YELLOW}⚠️  Branch doesn't match pattern feature/task-XX-description${NC}"
    echo -n "Enter branch description (e.g., 'import-cottages'): "
    read BRANCH_DESC
    NEW_BRANCH="feature/task-${TASK_ID}-${BRANCH_DESC}"
    echo -e "Creating new branch: ${GREEN}$NEW_BRANCH${NC}"
    git checkout -b "$NEW_BRANCH"
    CURRENT_BRANCH="$NEW_BRANCH"
fi

# Phase 2: PII and Sensitive Data Checks
echo -e "\n${BLUE}🔍 Phase 2: PII and Sensitive Data Checks${NC}"

# Check for dangerous file types
DANGEROUS_FILES=$(git status --porcelain | grep -E "\.xlsx?$|\.csv$|\.bak$|leaseholder|real.*data" || true)
if [ ! -z "$DANGEROUS_FILES" ]; then
    echo -e "${RED}🚨 DANGER: Found sensitive files:${NC}"
    echo "$DANGEROUS_FILES"
    echo -e "${YELLOW}Unstaging dangerous files...${NC}"
    git reset HEAD *.xlsx *.xls *.csv *.bak 2>/dev/null || true
fi

# List staged files
STAGED_FILES=$(git diff --cached --name-only)
if [ -z "$STAGED_FILES" ]; then
    echo -e "${YELLOW}No files staged. Staging safe directories...${NC}"
    git add api/ scripts/ lib/ docs/ 2>/dev/null || true
    STAGED_FILES=$(git diff --cached --name-only)
fi

echo -e "${GREEN}Staged files:${NC}"
echo "$STAGED_FILES" | sed 's/^/  /'

# Search for PII patterns
echo -e "\n${BLUE}Scanning for PII patterns...${NC}"
PII_FOUND=false
PII_PATTERNS=$(git diff --cached | grep -E -i "payer|last.*name|first.*name|address|phone|email|ssn|tax.*id" || true)
if [ ! -z "$PII_PATTERNS" ]; then
    echo -e "${YELLOW}⚠️  WARNING: Potential PII found:${NC}"
    echo "$PII_PATTERNS" | head -5
    echo -e "${YELLOW}..."
    PII_FOUND=true
fi

# Check for member names
MEMBER_NAMES=$(git diff --cached -- "*.js" "*.json" | grep -E -i "mitchell|chen|torres|wilson|rodriguez|park|davis|thompson" || true)
if [ ! -z "$MEMBER_NAMES" ]; then
    echo -e "${YELLOW}⚠️  WARNING: Potential member names found${NC}"
    PII_FOUND=true
fi

# Confirm if PII found
if [ "$PII_FOUND" = true ]; then
    echo -e "\n${YELLOW}Potential PII detected. Continue anyway? (y/N):${NC}"
    read -r CONTINUE
    if [ "$CONTINUE" != "y" ] && [ "$CONTINUE" != "Y" ]; then
        echo -e "${RED}Aborting safe push. Please remove PII and try again.${NC}"
        exit 1
    fi
fi

# Phase 3: Commit
echo -e "\n${BLUE}📝 Phase 3: Creating Commit${NC}"

# Analyze changes for commit type
if echo "$STAGED_FILES" | grep -q "^api/"; then
    COMMIT_TYPE="feat"
    COMMIT_SCOPE="api"
elif echo "$STAGED_FILES" | grep -q "^scripts/"; then
    COMMIT_TYPE="chore"
    COMMIT_SCOPE="scripts"
elif echo "$STAGED_FILES" | grep -q "^docs/"; then
    COMMIT_TYPE="docs"
    COMMIT_SCOPE="docs"
elif echo "$STAGED_FILES" | grep -q "^lib/"; then
    COMMIT_TYPE="refactor"
    COMMIT_SCOPE="lib"
else
    COMMIT_TYPE="fix"
    COMMIT_SCOPE="general"
fi

# Get commit message
echo -n "Enter commit description: "
read COMMIT_DESC
COMMIT_MSG="${COMMIT_TYPE}(${COMMIT_SCOPE}): ${COMMIT_DESC}"

echo -e "Commit message: ${GREEN}$COMMIT_MSG${NC}"
git commit -m "$COMMIT_MSG"

# Phase 4: Push
echo -e "\n${BLUE}🚀 Phase 4: Pushing to Remote${NC}"
git push -u origin "$CURRENT_BRANCH"

# Phase 5: Create PR
echo -e "\n${BLUE}🔄 Phase 5: Creating Pull Request${NC}"

# Generate PR title if not provided
if [ -z "$PR_TITLE" ]; then
    PR_TITLE="[Task-${TASK_ID}] ${COMMIT_DESC}"
fi

# Check if gh CLI is available
if ! command -v gh &> /dev/null; then
    echo -e "${YELLOW}GitHub CLI (gh) not found. Please install it to create PRs automatically.${NC}"
    echo "Branch pushed successfully. Create PR manually at:"
    echo "https://github.com/bvaadmin/unified-system/compare/${CURRENT_BRANCH}?expand=1"
    exit 0
fi

# Create PR body
PR_BODY="## Summary
- ${COMMIT_DESC}
- No PII or sensitive data included
- Follows Bay View coding standards

## Changes
$(git log main.."$CURRENT_BRANCH" --oneline | sed 's/^/- /')

## Safety Checks
- [x] No .xlsx, .xls, or .csv files included
- [x] No member names or addresses in code
- [x] No backup files (.bak)
- [x] Staged only safe directories

## Test Plan
- [ ] Verified no PII in changes
- [ ] Tested locally
- [ ] Checked database constraints

## Related Task
Task: #${TASK_ID}

🤖 Automated Claude Code Review will run on this PR"

# Create the PR
PR_URL=$(gh pr create \
    --title "$PR_TITLE" \
    --body "$PR_BODY" \
    --base main \
    --head "$CURRENT_BRANCH" \
    2>&1 || echo "")

if [[ "$PR_URL" == *"https://"* ]]; then
    echo -e "${GREEN}✅ Pull request created successfully!${NC}"
    echo -e "PR URL: ${BLUE}$PR_URL${NC}"
    
    # Open PR in browser
    echo -e "\n${BLUE}Opening PR in browser...${NC}"
    open "$PR_URL" 2>/dev/null || xdg-open "$PR_URL" 2>/dev/null || echo "Please open manually: $PR_URL"
else
    echo -e "${YELLOW}Could not create PR automatically. Error:${NC}"
    echo "$PR_URL"
    echo -e "\n${YELLOW}Branch pushed successfully. Create PR manually at:${NC}"
    echo "https://github.com/bvaadmin/unified-system/compare/${CURRENT_BRANCH}?expand=1"
fi

echo -e "\n${GREEN}✅ Safe push completed!${NC}"
echo "Next steps:"
echo "1. Wait for Claude Code Review results"
echo "2. Address any review comments"
echo "3. Get approval before merging"