# Jira Enhanced API Documentation

## Overview
This is an enhanced Jira integration with:
- Spring PDF Report Generation
- Enhanced Issue Creation with multiple fields
- Smart Conversational Issue Creation with follow-up flow
- JQL-based Sprint Handling
- Issue Assignment and Status Management

## Base URL
```
http://localhost:3000
```

## Authentication
All endpoints (except `/login` and `/health`) require a JWT token in the `Authorization` header:
```
Authorization: Bearer <token>
```

## Endpoints

### 1. Authentication

#### POST /login
Login to get a JWT token.

**Request:**
```json
{
  "username": "arnav",
  "password": "arnav123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "username": "arnav"
}
```

#### GET /verify
Verify if token is valid.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "valid": true,
  "username": "arnav"
}
```

#### GET /health
Health check endpoint (no auth required).

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:45.123Z"
}
```

---

### 2. Sprint Management

#### GET /sprints
Get all active and future sprints and the currently active sprint.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "sprints": [
    {
      "id": 1,
      "name": "Sprint 1",
      "state": "active"
    },
    {
      "id": 2,
      "name": "Sprint 2",
      "state": "future"
    }
  ],
  "activeSprint": {
    "id": 1,
    "name": "Sprint 1",
    "state": "active"
  }
}
```

#### GET /report?sprint=<sprint_id_or_name>
Generate a PDF report for a specific sprint.

**Parameters:**
- `sprint` (required): Sprint ID or Sprint Name

**Example:**
```
GET /report?sprint=1
GET /report?sprint=Sprint%201
```

**Response:**
- Content-Type: `application/pdf`
- Returns a downloadable PDF file containing:
  - Sprint summary
  - Issue breakdown by type
  - Status distribution
  - Priority breakdown
  - High priority issues detail
  - All issues list

**Example using curl:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/report?sprint=1" \
  --output sprint-report.pdf
```

---

### 3. Issue Creation

#### POST /create-issue
Create a new issue with enhanced fields.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "summary": "Implement user authentication",
  "description": "Add JWT-based authentication to the system",
  "priority": "High",
  "assignee": "arnav",
  "issueType": "Task",
  "sprintId": 1
}
```

**Field Details:**
- `summary` (required): Issue title/summary (string)
- `description` (optional): Detailed description (string)
- `priority` (optional): One of ["Lowest", "Low", "Medium", "High", "Highest"]
- `assignee` (optional): Username to assign to (string)
- `issueType` (optional): Default is "Task". Can be ["Task", "Story", "Bug", "Epic"]
- `sprintId` (optional): Sprint ID to add issue to immediately (number)

**Response:**
```json
{
  "message": "Created issue SHIP-45",
  "issueKey": "SHIP-45",
  "issueId": "1234567890",
  "addedToSprint": true
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/create-issue \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "summary": "Fix login bug",
    "description": "Users cannot login with OAuth",
    "priority": "Highest",
    "assignee": "arnav",
    "sprintId": 1
  }'
```

---

### 4. Smart Issue Creation with Follow-up

#### POST /create-issue-smart
Create an issue and ask for sprint confirmation if no active sprint.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "summary": "Design payment system",
  "description": "Create UI and API for payments",
  "priority": "High",
  "assignee": "arnav"
}
```

**Response (with follow-up):**
```json
{
  "message": "Created issue SHIP-46",
  "issueKey": "SHIP-46",
  "issueId": "1234567891",
  "sessionId": "arnav-1705334445000",
  "activeSprint": null,
  "questionResolution": {
    "type": "follow-up",
    "question": "Do you want to add issue SHIP-46 to a sprint or leave it in the backlog?",
    "options": ["sprint", "backlog"]
  }
}
```

**Response (no follow-up if sprint exists):**
```json
{
  "message": "Created issue SHIP-46",
  "issueKey": "SHIP-46",
  "issueId": "1234567891",
  "sessionId": "arnav-1705334445000",
  "activeSprint": {
    "id": 1,
    "name": "Sprint 1"
  },
  "questionResolution": null
}
```

---

#### POST /follow-up
Respond to an issue creation follow-up question.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body (Option 1 - Add to active sprint):**
```json
{
  "sessionId": "arnav-1705334445000",
  "response": "sprint"
}
```

**Request Body (Option 2 - Add to specific sprint):**
```json
{
  "sessionId": "arnav-1705334445000",
  "response": "sprint",
  "sprintId": 2
}
```

**Request Body (Option 3 - Leave in backlog):**
```json
{
  "sessionId": "arnav-1705334445000",
  "response": "backlog"
}
```

**Request Body (Option 4 - Sprint by name):**
```json
{
  "sessionId": "arnav-1705334445000",
  "response": "Sprint 2"
}
```

**Response (Sprint):**
```json
{
  "message": "Added SHIP-46 to sprint \"Sprint 1\"",
  "issueKey": "SHIP-46",
  "sprintName": "Sprint 1"
}
```

**Response (Backlog):**
```json
{
  "message": "SHIP-46 left in backlog",
  "issueKey": "SHIP-46",
  "location": "backlog"
}
```

---

### 5. Query Issues

#### POST /query
Search for issues using natural language (converted to JQL).

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "question": "Show me all high priority bugs assigned to arnav"
}
```

**Response:**
```json
{
  "jql": "project = SHIP AND priority = High AND type = Bug AND assignee = arnav",
  "issues": [
    {
      "key": "SHIP-12",
      "id": "1234567",
      "fields": {
        "summary": "Payment processing fails",
        "status": { "name": "In Progress" },
        "priority": { "name": "High" },
        "assignee": { "displayName": "Arnav Rinawa" },
        "description": "..."
      }
    }
  ],
  "total": 1
}
```

**Example Natural Language Queries:**
- "Show me all to-do items"
- "Find all bugs in sprint 1"
- "List completed tasks assigned to me"
- "What tasks are in progress?"

---

### 6. Actions

#### POST /action
Perform various Jira actions using natural language.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Supported Actions:**

##### 6.1 Create Issue
**Request:**
```json
{
  "question": "Create a task called 'Setup database' with high priority assigned to arnav"
}
```

**Response:**
```json
{
  "message": "Created issue SHIP-47",
  "issueKey": "SHIP-47"
}
```

##### 6.2 Update Status
**Request:**
```json
{
  "question": "Move SHIP-12 to in progress"
}
```

**Response:**
```json
{
  "message": "Updated SHIP-12 to In Progress"
}
```

##### 6.3 Assign Issue
**Request:**
```json
{
  "question": "Assign SHIP-12 to arnav"
}
```

**Response:**
```json
{
  "message": "Assigned SHIP-12 to arnav"
}
```

##### 6.4 Assign by Summary
**Request:**
```json
{
  "question": "Assign the payment integration task to arnav"
}
```

**Response:**
```json
{
  "message": "Assigned SHIP-45 to arnav"
}
```

##### 6.5 Delete Issue
**Request:**
```json
{
  "question": "Delete SHIP-99"
}
```

**Response:**
```json
{
  "message": "Deleted SHIP-99"
}
```

---

## Error Handling

All error responses follow this format:

```json
{
  "error": "Descriptive error message"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `400` - Bad request (missing or invalid parameters)
- `401` - Unauthorized (missing or invalid token)
- `404` - Not found (resource doesn't exist)
- `500` - Server error

**Error Examples:**

```bash
# Missing token
curl http://localhost:3000/sprints
# Response: 401 - {"error": "No token provided"}

# Invalid sprint
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/report?sprint=999"
# Response: 404 - {"error": "Sprint \"999\" not found"}

# Missing required field
curl -X POST http://localhost:3000/create-issue \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"priority": "High"}'
# Response: 400 - {"error": "Summary is required"}
```

---

## Usage Examples

### Complete Workflow Example

```bash
#!/bin/bash

# 1. Login
TOKEN=$(curl -X POST http://localhost:3000/login \
  -H "Content-Type: application/json" \
  -d '{"username":"arnav","password":"arnav123"}' \
  | jq -r '.token')

echo "Token: $TOKEN"

# 2. Get available sprints
curl http://localhost:3000/sprints \
  -H "Authorization: Bearer $TOKEN"

# 3. Create an issue with smart follow-up
ISSUE=$(curl -X POST http://localhost:3000/create-issue-smart \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "summary": "Implement new feature",
    "description": "Add new dashboard page",
    "priority": "Medium"
  }')

SESSION_ID=$(echo $ISSUE | jq -r '.sessionId')
echo "Issue created. Session: $SESSION_ID"

# 4. Follow up - add to sprint
curl -X POST http://localhost:3000/follow-up \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"response\": \"sprint\"
  }"

# 5. Generate report
curl http://localhost:3000/report?sprint=1 \
  -H "Authorization: Bearer $TOKEN" \
  --output sprint-report.pdf
```

---

## Best Practices

1. **Store tokens securely**: Never expose JWT tokens in logs or client-side code
2. **Use /create-issue-smart** for better UX when sprint context is uncertain
3. **Check active sprint first**: Use GET /sprints before creating issues
4. **Session management**: Sessions expire after 1 hour, store sessionId on client if needed
5. **Error handling**: Always handle the error field in responses
6. **Batch operations**: For multiple actions, make separate requests
7. **PDF caching**: Cache PDF reports locally to reduce API calls

---

## Troubleshooting

### User not found error
- Verify user exists in Jira
- Check exact username spelling
- Use the user's email if display name doesn't work

### Sprint not found error
- Sprint might be closed/archived
- Use GET /sprints to see available sprints
- Use sprint ID instead of name if name has special characters

### Insufficient permissions
- Ensure JWT token is still valid (check with GET /verify)
- Verify Jira API token has proper permissions
- Check JIRA_EMAIL and JIRA_API_TOKEN in .env
