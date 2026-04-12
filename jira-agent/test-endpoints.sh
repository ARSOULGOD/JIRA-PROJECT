#!/bin/bash
# Jira Agent - Quick Testing Guide
# This script tests all major endpoints with realistic examples

BASE_URL="http://localhost:3000"
USERNAME="arnav"
PASSWORD="arnav123"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
PASSED=0
FAILED=0

# Test function
test_endpoint() {
  local name="$1"
  local method="$2"
  local endpoint="$3"
  local data="$4"
  local expected_code="$5"
  
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${YELLOW}Test: $name${NC}"
  
  if [ "$method" == "GET" ]; then
    response=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL$endpoint" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json")
  else
    response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL$endpoint" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "$data")
  fi
  
  http_code=$(echo "$response" | tail -n 1)
  body=$(echo "$response" | head -n -1)
  
  echo "Method: $method"
  echo "Endpoint: $endpoint"
  echo "HTTP Code: $http_code"
  echo "Response:"
  echo "$body" | jq . 2>/dev/null || echo "$body"
  
  if [ "$http_code" == "$expected_code" ] || [ -z "$expected_code" ]; then
    echo -e "${GREEN}✅ PASSED${NC}"
    ((PASSED++))
  else
    echo -e "${RED}❌ FAILED (Expected: $expected_code, Got: $http_code)${NC}"
    ((FAILED++))
  fi
  echo ""
}

# ─────────────────────────────────────────────────────────────────
# TEST SUITE
# ─────────────────────────────────────────────────────────────────

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║    JIRA AGENT - COMPREHENSIVE ENDPOINT TEST SUITE          ║"
echo "║          Testing All Enhanced Features v2.0                ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ─────────────────────────────────────────────────────────────────
# 1. HEALTH CHECK
# ─────────────────────────────────────────────────────────────────

echo -e "${BLUE}\n▶ PHASE 1: HEALTH & AUTHENTICATION${NC}\n"

test_endpoint \
  "Health Check (No Auth)" \
  "GET" \
  "/health" \
  "" \
  "200"

# ─────────────────────────────────────────────────────────────────
# 2. AUTHENTICATION
# ─────────────────────────────────────────────────────────────────

echo -e "${BLUE}▶ PHASE 2: AUTHENTICATION${NC}\n"

# Login
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token')
USERNAME_RETURNED=$(echo "$LOGIN_RESPONSE" | jq -r '.username')

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Test: Login${NC}"
echo "Username: $USERNAME"
echo "Password: ****"
echo "Response:"
echo "$LOGIN_RESPONSE" | jq .

if [ ! -z "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
  echo -e "${GREEN}✅ PASSED - Token received${NC}"
  ((PASSED++))
else
  echo -e "${RED}❌ FAILED - No token received${NC}"
  ((FAILED++))
  exit 1
fi
echo ""

# Verify token
test_endpoint \
  "Verify Token" \
  "GET" \
  "/verify" \
  "" \
  "200"

# ─────────────────────────────────────────────────────────────────
# 3. SPRINT MANAGEMENT
# ─────────────────────────────────────────────────────────────────

echo -e "${BLUE}▶ PHASE 3: SPRINT MANAGEMENT${NC}\n"

test_endpoint \
  "Get All Sprints" \
  "GET" \
  "/sprints" \
  "" \
  "200"

# Extract active sprint ID for later use
SPRINT_ID=$(curl -s "$BASE_URL/sprints" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.activeSprint.id // "1"')

# ─────────────────────────────────────────────────────────────────
# 4. ISSUE CREATION
# ─────────────────────────────────────────────────────────────────

echo -e "${BLUE}▶ PHASE 4: BASIC ISSUE CREATION${NC}\n"

TIMESTAMP=$(date +%s)
TEST_SUMMARY="Test Issue $TIMESTAMP"

test_endpoint \
  "Create Issue with All Fields" \
  "POST" \
  "/create-issue" \
  "{
    \"summary\": \"$TEST_SUMMARY\",
    \"description\": \"This is a test issue created at $TIMESTAMP\",
    \"priority\": \"High\",
    \"assignee\": \"$USERNAME\",
    \"issueType\": \"Task\",
    \"sprintId\": $SPRINT_ID
  }" \
  "200"

# ─────────────────────────────────────────────────────────────────
# 5. SMART ISSUE CREATION
# ─────────────────────────────────────────────────────────────────

echo -e "${BLUE}▶ PHASE 5: SMART ISSUE CREATION WITH FOLLOW-UP${NC}\n"

SMART_CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/create-issue-smart" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"summary\": \"Smart Test Issue $TIMESTAMP\",
    \"description\": \"Testing smart creation with follow-up\",
    \"priority\": \"Medium\",
    \"assignee\": \"$USERNAME\"
  }")

SESSION_ID=$(echo "$SMART_CREATE_RESPONSE" | jq -r '.sessionId')
ISSUE_KEY=$(echo "$SMART_CREATE_RESPONSE" | jq -r '.issueKey')

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Test: Create Issue (Smart)${NC}"
echo "Summary: Smart Test Issue $TIMESTAMP"
echo "Response:"
echo "$SMART_CREATE_RESPONSE" | jq .

if [ ! -z "$SESSION_ID" ] && [ "$SESSION_ID" != "null" ]; then
  echo -e "${GREEN}✅ PASSED${NC}"
  ((PASSED++))
else
  echo -e "${RED}❌ FAILED${NC}"
  ((FAILED++))
fi
echo ""

# Follow-up response
test_endpoint \
  "Follow-up: Add to Sprint" \
  "POST" \
  "/follow-up" \
  "{
    \"sessionId\": \"$SESSION_ID\",
    \"response\": \"sprint\"
  }" \
  "200"

# ─────────────────────────────────────────────────────────────────
# 6. PDF REPORT GENERATION
# ─────────────────────────────────────────────────────────────────

echo -e "${BLUE}▶ PHASE 6: PDF REPORT GENERATION${NC}\n"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Test: Generate Sprint Report PDF${NC}"
echo "Sprint ID: $SPRINT_ID"

REPORT_FILE="sprint-report-test-$(date +%s).pdf"

curl -s "$BASE_URL/report?sprint=$SPRINT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  --output "$REPORT_FILE"

if [ -f "$REPORT_FILE" ] && [ -s "$REPORT_FILE" ]; then
  FILE_SIZE=$(stat -c%s "$REPORT_FILE" 2>/dev/null || stat -f%z "$REPORT_FILE")
  echo "Output file: $REPORT_FILE"
  echo "File size: $FILE_SIZE bytes"
  echo -e "${GREEN}✅ PASSED - PDF generated successfully${NC}"
  ((PASSED++))
else
  echo -e "${RED}❌ FAILED - PDF not generated${NC}"
  ((FAILED++))
fi
echo ""

# ─────────────────────────────────────────────────────────────────
# 7. QUERY ENDPOINT
# ─────────────────────────────────────────────────────────────────

echo -e "${BLUE}▶ PHASE 7: ISSUE QUERIES (NATURAL LANGUAGE)${NC}\n"

test_endpoint \
  "Query: High Priority Items" \
  "POST" \
  "/query" \
  "{
    \"question\": \"Show me all high priority issues\"
  }" \
  "200"

test_endpoint \
  "Query: Issues Assigned to Me" \
  "POST" \
  "/query" \
  "{
    \"question\": \"What issues are assigned to me?\"
  }" \
  "200"

# ─────────────────────────────────────────────────────────────────
# 8. ACTION ENDPOINT
# ─────────────────────────────────────────────────────────────────

echo -e "${BLUE}▶ PHASE 8: AI-POWERED ACTIONS${NC}\n"

test_endpoint \
  "Action: Create Issue" \
  "POST" \
  "/action" \
  "{
    \"question\": \"Create a task called test action create with medium priority\"
  }" \
  "200"

test_endpoint \
  "Action: Update Status" \
  "POST" \
  "/action" \
  "{
    \"question\": \"Move $ISSUE_KEY to in progress\"
  }" \
  "200"

# ─────────────────────────────────────────────────────────────────
# 9. ERROR HANDLING
# ─────────────────────────────────────────────────────────────────

echo -e "${BLUE}▶ PHASE 9: ERROR HANDLING & EDGE CASES${NC}\n"

test_endpoint \
  "Error: Missing Summary" \
  "POST" \
  "/create-issue" \
  "{
    \"priority\": \"High\"
  }" \
  "400"

test_endpoint \
  "Error: Invalid Sprint" \
  "GET" \
  "/report?sprint=9999" \
  "" \
  "404"

test_endpoint \
  "Error: No Auth Header" \
  "GET" \
  "/sprints" \
  "" \
  "401"

# ─────────────────────────────────────────────────────────────────
# SUMMARY
# ─────────────────────────────────────────────────────────────────

echo -e "${BLUE}\n╔════════════════════════════════════════════════════════════╗"
echo "║                    TEST SUMMARY                              ║"
echo "╚════════════════════════════════════════════════════════════╝${NC}"

TOTAL=$((PASSED + FAILED))
PERCENTAGE=$((PASSED * 100 / TOTAL))

echo ""
echo -e "${GREEN}✅ Passed: $PASSED${NC}"
echo -e "${RED}❌ Failed: $FAILED${NC}"
echo -e "Total Tests: $TOTAL"
echo -e "Success Rate: ${PERCENTAGE}%"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}🎉 ALL TESTS PASSED!${NC}"
  exit 0
else
  echo -e "${RED}⚠️  SOME TESTS FAILED${NC}"
  exit 1
fi
