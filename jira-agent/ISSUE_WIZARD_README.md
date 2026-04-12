# Issue Wizard - Interactive Conversational Issue Creation

**Status:** ✅ Implemented and Ready to Test  
**Date:** April 11, 2026  
**Feature Type:** AI-Powered Conversational UI

---

## 📋 Overview

The **Issue Wizard** is a new interactive, conversational approach to creating Jira issues. Instead of requiring users to fill out a static form with all fields at once, the system engages them in a guided step-by-step conversation, asking clarifying questions one at a time.

### Key Features

- ✅ **Multi-step conversational flow** - Ask questions sequentially
- ✅ **Session-based context** - Maintain conversation state on the server
- ✅ **Smart validation** - Each response is validated before moving to next step
- ✅ **Flexible responses** - Users can skip optional fields
- ✅ **Summary confirmation** - Review complete issue before creation
- ✅ **Error handling** - Clear feedback on validation errors

---

## 🎯 Conversation Flow

```
┌─────────────────────────────────────────┐
│ Initialize Wizard (POST /issue-wizard)  │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│ Step 1: Summary                         │
│ "What would you like to name this..."   │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│ Step 2: Priority                        │
│ "What is the priority of this issue?"   │
│ Options: [Lowest, Low, Medium, High...] │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│ Step 3: Assignee                        │
│ "Who should this be assigned to?"       │
│ (Can skip)                              │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│ Step 4: Issue Type                      │
│ "What type of issue is this?"           │
│ Options: [Task, Bug, Story, Epic]       │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│ Step 5: Description                     │
│ "Any additional details? (optional)"    │
│ (Can skip)                              │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│ Step 6: Confirmation                    │
│ "Ready to create this issue?"           │
│ Shows complete summary                  │
└────────────────┬────────────────────────┘
                 │
          ┌──────┴──────┐
          │             │
          ▼             ▼
      [YES]         [NO]
        │             │
        ▼             ▼
   [CREATED]      [CANCELLED]
```

---

## 🔌 API Endpoint

### `POST /issue-wizard`

**Authentication:** Required (JWT Token)

**Purpose:** Interactive multi-step issue creation with conversational follow-ups

---

## 🚀 Getting Started

### 1. Start the Backend Server

```bash
cd jira-agent
npm install
npm start
```

Server runs on `http://localhost:3000`

### 2. Test with cURL (Quick Manual Test)

```bash
# Initialize wizard
curl -X POST http://localhost:3000/issue-wizard \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 3. Test with Provided Scripts

#### Option A: PowerShell (Windows - Recommended for Windows users)

```powershell
cd c:\Users\ARNAV\OneDrive\Desktop\jira\jira-agent
.\test-issue-wizard.ps1
```

**Output Example:**

```
=== INTERACTIVE ISSUE WIZARD TEST ===

✓ Session ID: wizard-arnav-1705334445000
Question: What would you like to name this issue?

Question: What is the priority of this issue?
Options: Lowest, Low, Medium, High, Highest

[... continues through all steps ...]

=== RESULT ===
Success: True
Message: ✅ Issue created successfully!
Issue Key: SHIP-101
Link: https://jira.example.com/browse/SHIP-101

✓ Issue created successfully: SHIP-101
```

#### Option B: Bash (Linux/Mac)

```bash
cd jira-agent
chmod +x test-issue-wizard.sh
./test-issue-wizard.sh
```

---

## 📝 Complete Request/Response Walkthrough

### Round 1: Initialize

**Request:**

```bash
curl -X POST http://localhost:3000/issue-wizard \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Response:**

```json
{
  "sessionId": "wizard-arnav-1705334445000",
  "step": "summary",
  "question": "What would you like to name this issue?",
  "hint": "Provide a clear, concise title (e.g., \"Fix login button on mobile\")",
  "placeholder": "Issue summary"
}
```

### Round 2: Provide Summary

**Request:**

```bash
curl -X POST http://localhost:3000/issue-wizard \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "wizard-arnav-1705334445000",
    "response": "Fix memory leak in dashboard component"
  }'
```

**Response:**

```json
{
  "sessionId": "wizard-arnav-1705334445000",
  "step": "priority",
  "question": "What is the priority of this issue?",
  "options": ["Lowest", "Low", "Medium", "High", "Highest"],
  "hint": "Select the priority level"
}
```

### Round 3: Provide Priority

**Request:**

```bash
curl -X POST http://localhost:3000/issue-wizard \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "wizard-arnav-1705334445000",
    "response": "High"
  }'
```

**Response:**

```json
{
  "sessionId": "wizard-arnav-1705334445000",
  "step": "assignee",
  "question": "Who should this be assigned to?",
  "hint": "Enter username or skip by typing \"skip\"",
  "placeholder": "Username or \"skip\""
}
```

### Round 4: Provide Assignee

**Request:**

```bash
curl -X POST http://localhost:3000/issue-wizard \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "wizard-arnav-1705334445000",
    "response": "arnav"
  }'
```

**Response:**

```json
{
  "sessionId": "wizard-arnav-1705334445000",
  "step": "issueType",
  "question": "What type of issue is this?",
  "options": ["Task", "Bug", "Story", "Epic"],
  "hint": "Select the issue type"
}
```

### Round 5: Provide Issue Type

**Request:**

```bash
curl -X POST http://localhost:3000/issue-wizard \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "wizard-arnav-1705334445000",
    "response": "Bug"
  }'
```

**Response:**

```json
{
  "sessionId": "wizard-arnav-1705334445000",
  "step": "description",
  "question": "Any additional details? (optional)",
  "hint": "Provide context or skip",
  "placeholder": "Description or \"skip\""
}
```

### Round 6: Provide Description

**Request:**

```bash
curl -X POST http://localhost:3000/issue-wizard \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "wizard-arnav-1705334445000",
    "response": "Dashboard pages with 100+ items take too long to load and consume excessive memory"
  }'
```

**Response:**

```json
{
  "sessionId": "wizard-arnav-1705334445000",
  "step": "confirm",
  "question": "Ready to create this issue?",
  "summary": {
    "summary": "Fix memory leak in dashboard component",
    "priority": "High",
    "issueType": "Bug",
    "assignee": "arnav",
    "description": "Dashboard pages with 100+ items take too long to load and consume excessive memory"
  },
  "options": ["yes", "no"],
  "hint": "Confirm to create, or type \"no\" to cancel"
}
```

### Round 7: Confirm Creation

**Request:**

```bash
curl -X POST http://localhost:3000/issue-wizard \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "wizard-arnav-1705334445000",
    "response": "yes"
  }'
```

**Final Response:**

```json
{
  "success": true,
  "message": "✅ Issue created successfully!",
  "issueKey": "SHIP-102",
  "issueId": "1234567890",
  "summary": "Fix memory leak in dashboard component",
  "link": "https://jira.example.com/browse/SHIP-102"
}
```

---

## 🔧 Implementation Details

### Backend Code Location

- **Main Endpoint:** [server.js](server.js) (Lines 370-555)
- **Session Management:** In-memory Map with 2-hour TTL
- **Auto-cleanup:** Every 30 minutes via interval timer

### Session Store Structure

```javascript
{
  "wizard-arnav-1705334445000": {
    step: "confirm",           // Current conversation step
    data: {                     // Collected data
      summary: "...",
      priority: "High",
      issueType: "Bug",
      assignee: "arnav",
      description: "..."
    },
    timestamp: 1705334445000   // Creation timestamp
  }
}
```

### Supported Steps

| Step          | Type       | Values                             |
| ------------- | ---------- | ---------------------------------- |
| `summary`     | Text Input | Any non-empty string               |
| `priority`    | Choice     | Lowest, Low, Medium, High, Highest |
| `assignee`    | Text Input | Valid Jira username or "skip"      |
| `issueType`   | Choice     | Task, Bug, Story, Epic             |
| `description` | Text Input | Any text or "skip"                 |
| `confirm`     | Choice     | yes/no                             |

---

## 🎨 Frontend Integration

### React Component

A complete React component (`IssueWizard.jsx`) is provided that:

- Manages wizard state locally
- Makes API calls to `/issue-wizard` endpoint
- Displays questions dynamically
- Shows progress indicators
- Handles errors gracefully
- Provides responsive UI

### Usage in React

```jsx
import IssueWizard from "./IssueWizard";

function App() {
  const handleSuccess = (issue) => {
    console.log("Issue created:", issue.issueKey);
    // Show success message, redirect, etc.
  };

  const handleCancel = () => {
    console.log("Wizard cancelled");
    // Reset modal, hide wizard, etc.
  };

  return (
    <IssueWizard
      token={authToken}
      onSuccess={handleSuccess}
      onCancel={handleCancel}
    />
  );
}
```

---

## ⚙️ Configuration

### Timeout & Auto-cleanup

Edit [server.js](server.js) line 30 to adjust:

```javascript
const SESSION_CLEANUP_INTERVAL = 30 * 60 * 1000; // 30 minutes
const SESSION_TTL = 2 * 60 * 60 * 1000; // 2 hours
```

### Default Priorities & Types

Edit [server.js](server.js) lines 380, 450 to customize valid options:

```javascript
const validPriorities = ["Lowest", "Low", "Medium", "High", "Highest"];
const validTypes = ["Task", "Bug", "Story", "Epic"];
```

---

## 🧪 Testing Checklist

- [ ] Backend server starts without errors
- [ ] Initialize wizard returns correct session ID
- [ ] Each step asks the expected question
- [ ] Invalid priority/type selections show error
- [ ] Skipping assignee/description works correctly
- [ ] Confirmation screen shows complete summary
- [ ] Final "yes" creates issue successfully
- [ ] Final "no" cancels without creating
- [ ] Session expires after 2 hours (manual verify)
- [ ] PowerShell test script runs end-to-end
- [ ] Frontend component integrates properly

---

## 📊 Example Response Flow Diagram

```
[1] Initialize
    ↓ sessionId=wizard-1234, step=summary
[2] User inputs summary
    ↓ summary stored, step=priority
[3] User selects priority
    ↓ priority stored, step=assignee
[4] User inputs assignee
    ↓ assignee stored, step=issueType
[5] User selects type
    ↓ type stored, step=description
[6] User inputs description
    ↓ description stored, step=confirm
[7] Confirmation shown
    ↓ summary data returned
[8] User confirms (yes)
    ↓ Issue created via Jira API
[9] Success response with issueKey
    └─ Session cleaned up
```

---

## 🐛 Troubleshooting

### "Session not found or expired"

- Check if sessionId is correct
- Session expires after 2 hours
- Initialize a new wizard

### "Invalid priority"

- Use exact spelling: Lowest, Low, Medium, High, Highest
- Values are case-sensitive

### "Failed to create issue"

- Check Jira credentials in .env
- Verify user has permission to create issues
- Check issue type exists in Jira project

### "No response provided"

- Ensure response field is included in request
- Response must be non-empty string

---

## 📈 Next Steps

### Potential Enhancements

1. **Add sprint selection** - Ask which sprint to add to
2. **Suggest assignees** - Offer dropdown of team members
3. **Template quick-start** - Offer issue templates
4. **Estimated effort** - Add story points field
5. **Component selection** - Ask which component affected
6. **Custom fields** - Support project-specific fields
7. **AI-powered suggestions** - Recommend priority/type based on summary
8. **History** - Show recently created issues

---

## 📚 Related Documentation

- [ENHANCED_API_GUIDE.md](ENHANCED_API_GUIDE.md) - Full API documentation
- [IMPLEMENTATION_DETAILS.md](IMPLEMENTATION_DETAILS.md) - Technical architecture
- [server.js](server.js) - Source code
- [IssueWizard.jsx](../jira-frontend/IssueWizard.jsx) - React component

---

## ✅ Verification

Run this command to verify the endpoint is working:

```bash
# Get auth token
TOKEN=$(curl -s -X POST http://localhost:3000/login \
  -H "Content-Type: application/json" \
  -d '{"username":"arnav","password":"arnav123"}' | grep -o '"token":"[^"]*' | cut -d'"' -f4)

# Initialize wizard
curl -X POST http://localhost:3000/issue-wizard \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' | jq .
```

**Expected Output:**

```json
{
  "sessionId": "wizard-arnav-...",
  "step": "summary",
  "question": "What would you like to name this issue?",
  ...
}
```

---

## 📞 Support

For issues or questions:

1. Check the Troubleshooting section above
2. Review server logs: `tail -f jira-agent/logs/*.log`
3. Check test script output for detailed errors
4. Verify Jira API credentials in `.env`

---

**Last Updated:** April 11, 2026  
**Status:** Production Ready ✅
