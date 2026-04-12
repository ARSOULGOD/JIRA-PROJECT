#!/bin/bash

# Jira Enhanced API - Example Requests
# This file contains practical examples for using the enhanced API

BASE_URL="http://localhost:3000"
USERNAME="arnav"
PASSWORD="arnav123"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Jira API Examples ===${NC}\n"

# 1. Login and get token
echo -e "${BLUE}1. Login${NC}"
LOGIN=$(curl -s -X POST "$BASE_URL/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo $LOGIN | grep -o '"token":"[^"]*' | cut -d'"' -f4)
echo -e "${GREEN}Token obtained${NC}\n"

# 2. Check health
echo -e "${BLUE}2. Health Check${NC}"
curl -s "$BASE_URL/health" | jq '.'
echo

# 3. Get all sprints
echo -e "${BLUE}3. Get All Sprints${NC}"
SPRINTS=$(curl -s "$BASE_URL/sprints" \
  -H "Authorization: Bearer $TOKEN")
echo $SPRINTS | jq '.'
SPRINT_ID=$(echo $SPRINTS | jq -r '.activeSprint.id // 1')
echo -e "${GREEN}Active sprint ID: $SPRINT_ID${NC}\n"

# 4. Create issue with immediate sprint assignment
echo -e "${BLUE}4. Create Issue (with auto sprint)${NC}"
ISSUE=$(curl -s -X POST "$BASE_URL/create-issue" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"summary\": \"Update user profile page\",
    \"description\": \"Add bio and profile picture section\",
    \"priority\": \"High\",
    \"assignee\": \"arnav\",
    \"issueType\": \"Task\",
    \"sprintId\": $SPRINT_ID
  }")
echo $ISSUE | jq '.'
ISSUE_KEY=$(echo $ISSUE | jq -r '.issueKey')
echo -e "${GREEN}Issue created: $ISSUE_KEY${NC}\n"

# 5. Create issue with smart follow-up
echo -e "${BLUE}5. Create Issue (Smart with Follow-up)${NC}"
SMART_ISSUE=$(curl -s -X POST "$BASE_URL/create-issue-smart" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"summary\": \"Design new checkout flow\",
    \"description\": \"Redesign checkout process for better UX\",
    \"priority\": \"High\",
    \"assignee\": \"arnav\"
  }")
echo $SMART_ISSUE | jq '.'
SESSION_ID=$(echo $SMART_ISSUE | jq -r '.sessionId')
echo -e "${GREEN}Session ID for follow-up: $SESSION_ID${NC}\n"

# 6. Follow up - add to sprint
echo -e "${BLUE}6. Follow-up Response (Add to Sprint)${NC}"
FOLLOWUP=$(curl -s -X POST "$BASE_URL/follow-up" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"response\": \"sprint\"
  }")
echo $FOLLOWUP | jq '.'
echo

# 7. Query issues with natural language
echo -e "${BLUE}7. Query Issues (Natural Language)${NC}"
QUERY=$(curl -s -X POST "$BASE_URL/query" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"question\": \"Show me all issues assigned to arnav that are in progress\"
  }")
echo $QUERY | jq '.'
echo

# 8. Perform actions
echo -e "${BLUE}8. Perform Action (Create via AI)${NC}"
ACTION=$(curl -s -X POST "$BASE_URL/action" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"question\": \"Create a bug titled 'Fix broken links on homepage' with highest priority assigned to arnav\"
  }")
echo $ACTION | jq '.'
echo

# 9. Update issue status
echo -e "${BLUE}9. Perform Action (Update Status)${NC}"
if [ ! -z "$ISSUE_KEY" ]; then
  STATUS=$(curl -s -X POST "$BASE_URL/action" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"question\": \"Move $ISSUE_KEY to in progress\"
    }")
  echo $STATUS | jq '.'
  echo
fi

# 10. Generate PDF report
echo -e "${BLUE}10. Generate Sprint Report (PDF)${NC}"
if [ ! -z "$SPRINT_ID" ]; then
  echo "Generating PDF report for sprint $SPRINT_ID..."
  curl -s "$BASE_URL/report?sprint=$SPRINT_ID" \
    -H "Authorization: Bearer $TOKEN" \
    --output "sprint-report-$SPRINT_ID.pdf"
  echo -e "${GREEN}PDF saved as sprint-report-$SPRINT_ID.pdf${NC}\n"
fi

echo -e "${BLUE}=== Examples Complete ===${NC}"
