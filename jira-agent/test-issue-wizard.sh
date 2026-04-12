#!/bin/bash

# Interactive Issue Wizard Test Script
# Tests the conversational AI-driven issue creation workflow

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="http://localhost:3000"
TOKEN="${1:-}"

if [ -z "$TOKEN" ]; then
  echo -e "${YELLOW}No token provided. First logging in...${NC}"
  LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/login" \
    -H "Content-Type: application/json" \
    -d '{
      "username": "arnav",
      "password": "arnav123"
    }')
  
  TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
  echo -e "${GREEN}✓ Got token: ${TOKEN:0:20}...${NC}"
fi

echo ""
echo -e "${BLUE}=== INTERACTIVE ISSUE WIZARD TEST ===${NC}"
echo ""

# Step 1: Initialize wizard
echo -e "${YELLOW}Step 1: Initialize Wizard${NC}"
STEP1=$(curl -s -X POST "$BASE_URL/issue-wizard" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}')

SESSION_ID=$(echo "$STEP1" | grep -o '"sessionId":"[^"]*' | cut -d'"' -f4)
echo -e "${GREEN}✓ Session ID: $SESSION_ID${NC}"
echo "Question: $(echo "$STEP1" | grep -o '"question":"[^"]*' | cut -d'"' -f4)"
echo ""

# Step 2: Provide summary
echo -e "${YELLOW}Step 2: Provide Summary${NC}"
SUMMARY="Implement OAuth2 authentication for API"
echo "Responding: $SUMMARY"
STEP2=$(curl -s -X POST "$BASE_URL/issue-wizard" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"response\": \"$SUMMARY\"
  }")

echo "Question: $(echo "$STEP2" | grep -o '"question":"[^"]*' | cut -d'"' -f4)"
OPTIONS=$(echo "$STEP2" | grep -o '"options":\[\(\?[^\]]*\]' | head -1)
echo "Options: $OPTIONS"
echo ""

# Step 3: Provide priority
echo -e "${YELLOW}Step 3: Provide Priority${NC}"
PRIORITY="High"
echo "Responding: $PRIORITY"
STEP3=$(curl -s -X POST "$BASE_URL/issue-wizard" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"response\": \"$PRIORITY\"
  }")

echo "Question: $(echo "$STEP3" | grep -o '"question":"[^"]*' | cut -d'"' -f4)"
echo ""

# Step 4: Provide assignee
echo -e "${YELLOW}Step 4: Provide Assignee${NC}"
ASSIGNEE="arnav"
echo "Responding: $ASSIGNEE"
STEP4=$(curl -s -X POST "$BASE_URL/issue-wizard" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"response\": \"$ASSIGNEE\"
  }")

echo "Question: $(echo "$STEP4" | grep -o '"question":"[^"]*' | cut -d'"' -f4)"
OPTIONS=$(echo "$STEP4" | grep -o '"options":\[\(\?[^\]]*\]' | head -1)
echo "Options: $OPTIONS"
echo ""

# Step 5: Provide issue type
echo -e "${YELLOW}Step 5: Provide Issue Type${NC}"
ISSUETYPE="Story"
echo "Responding: $ISSUETYPE"
STEP5=$(curl -s -X POST "$BASE_URL/issue-wizard" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"response\": \"$ISSUETYPE\"
  }")

echo "Question: $(echo "$STEP5" | grep -o '"question":"[^"]*' | cut -d'"' -f4)"
echo ""

# Step 6: Provide description
echo -e "${YELLOW}Step 6: Provide Description${NC}"
DESCRIPTION="Implement OAuth2 flow for secure API authentication with support for third-party integrations."
echo "Responding: $DESCRIPTION"
STEP6=$(curl -s -X POST "$BASE_URL/issue-wizard" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"response\": \"$DESCRIPTION\"
  }")

echo "Question: $(echo "$STEP6" | grep -o '"question":"[^"]*' | cut -d'"' -f4)"
echo "Summary:"
echo "$STEP6" | grep -o '"summary":{[^}]*}' | head -1 | jq . 2>/dev/null || echo "$STEP6" | grep '"summary"'
echo ""

# Step 7: Confirm creation
echo -e "${YELLOW}Step 7: Confirm Creation${NC}"
echo "Responding: yes"
FINAL=$(curl -s -X POST "$BASE_URL/issue-wizard" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"response\": \"yes\"
  }")

echo ""
echo -e "${GREEN}=== RESULT ===${NC}"
echo "$FINAL" | jq . 2>/dev/null || echo "$FINAL"
echo ""

ISSUE_KEY=$(echo "$FINAL" | grep -o '"issueKey":"[^"]*' | cut -d'"' -f4)
if [ -n "$ISSUE_KEY" ]; then
  echo -e "${GREEN}✓ Issue created successfully: $ISSUE_KEY${NC}"
else
  echo -e "${YELLOW}Check the response above for details${NC}"
fi
