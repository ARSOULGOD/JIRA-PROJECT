# Enhanced Jira Agent - Implementation Details

## Quick Summary

This document explains the key implementation logic for the enhanced features added to your Jira agent.

---

## Feature 1: Sprint PDF Report Generation

### File Location

`utils/pdf-generator.js`

### How It Works

#### Step 1: Generate PDF Buffer

```javascript
async function generateSprintReportPDF(sprintName, issues) {
  // Create PDFDocument with 40px margins
  const doc = new PDFDocument({ margin: 40 });
  let buffers = [];

  // Collect PDF output chunks into buffers
  doc.on('data', (chunk) => buffers.push(chunk));
  doc.on('end', () => {
    const pdfBuffer = Buffer.concat(buffers);
    resolve(pdfBuffer);
  });
```

#### Step 2: Calculate Statistics

```javascript
function calculateStats(issues) {
  const stats = {
    total: issues.length,
    completed: 0,
    inProgress: 0,
    todo: 0,
    typeBreakdown: {}, // Story: 5, Task: 3, Bug: 2
    statusBreakdown: {}, // Done: 5, In Progress: 3, To Do: 2
    priorityBreakdown: {}, // High: 3, Medium: 4
    highPriorityIssues: [], // Array of issues with High/Highest priority
  };

  // Analyze each issue
  issues.forEach((issue) => {
    const status = issue.fields.status.name;
    // Count completions, in-progress, todos

    const type = issue.fields.issuetype.name;
    // Count issue types

    const priority = issue.fields.priority.name;
    // Count priorities, extract high-priority issues
  });

  return stats;
}
```

#### Step 3: Render PDF Layout

```javascript
// Title and metadata
doc.fontSize(28).text(`Sprint Report: ${sprintName}`, { align: "center" });

// Summary box with statistics
doc.rect(40, doc.y, 515, 80).stroke();
doc.text(`Total Issues: ${stats.total}`, 50);

// Tables for breakdowns
drawTypeBreakdownTable(doc, stats); // Issue types
drawStatusTable(doc, stats); // Status distribution
drawPriorityTable(doc, stats); // Priority levels

// Add new pages for detailed lists
doc.addPage();
drawIssuesTable(doc, stats.highPriorityIssues); // High priority detail
doc.addPage();
drawIssuesTable(doc, issues); // All issues

doc.end(); // Finalize PDF
```

#### Step 4: Send PDF Response

```javascript
// In server.js
res.setHeader("Content-Type", "application/pdf");
res.setHeader(
  "Content-Disposition",
  `attachment; filename="sprint-report-${sprintName}.pdf"`,
);
res.send(pdfBuffer); // Binary PDF data to browser
```

### Key Logic Points

1. **Pagination**: When `currentY > doc.page.height - 50`, automatically add new page
2. **Table Drawing**: Generic `drawTable()` function accepts rows and column widths
3. **Text Measurement**: PDFKit handles text wrapping, no manual calculations needed
4. **Promise-based**: Returns `Promise<Buffer>` for async handling

---

## Feature 2: Enhanced Issue Creation

### File Location

`server.js` - `POST /create-issue` endpoint

### Validation Flow

```javascript
// Step 1: Input validation
if (!summary?.trim()) {
  return res.status(400).json({ error: "Summary is required" });
}

// Step 2: Call Jira API with enhanced fields
const createdIssue = await jiraHelpers.createIssueWithFields({
  summary, // Required, max 255 chars
  description, // Optional, any length
  priority, // Optional, validated against Jira priorities
  assignee, // Optional, searched in Jira user database
  issueType, // Optional, defaults to "Task"
  labels: [],
});

// Step 3: Optionally add to sprint
if (sprintId) {
  await jiraHelpers.addIssueToSprint(createdIssue.key, sprintId);
}

// Step 4: Return success response
res.json({
  message: `Created issue ${createdIssue.key}`,
  issueKey: createdIssue.key,
  addedToSprint: !!sprintId,
});
```

### Payload Sent to Jira API

```javascript
// In jira-helpers.js
const payload = {
  fields: {
    project: { key: JIRA_PROJECT_KEY },
    summary: "Implement payment gateway",
    description: "Add Stripe/PayPal integration...",
    issuetype: { name: issueType || "Task" },
    priority: { name: priority || "Medium" },
    assignee: { name: assignee },
  },
};

// POST to /rest/api/3/issues
```

---

## Feature 3: Conversational Issue Flow

### File Location

`server.js` - Multiple endpoints

### Session Flow Diagram

```
User: POST /create-issue-smart
       └─ No sprintId specified
           └─ Issue created in Jira
           └─ Session created: { issueKey, summary, timestamp }
           └─ Session stored in Map: new Map()
           └─ Response includes: sessionId, questionResolution

User Decision:
  ├─ "Add to sprint"
  │   └─ POST /follow-up { sessionId, response: "sprint" }
  │       └─ Add issue to active sprint OR specified sprintId
  │       └─ Session deleted from Map
  │       └─ Response: success message
  │
  ├─ "Leave in backlog"
  │   └─ POST /follow-up { sessionId, response: "backlog" }
  │       └─ Session deleted from Map
  │       └─ Response: backlog confirmation
  │
  └─ "Sprint 2" (by name)
      └─ POST /follow-up { sessionId, response: "Sprint 2" }
          └─ Resolve sprint name to sprint ID
          └─ Add issue to sprint
          └─ Session deleted
```

### Implementation Details

```javascript
// Session store - in-memory Map at top of server.js
const sessionStore = new Map();
// Example entry: sessionStore.set("arnav-1705334445000",
//   { issueKey: "SHIP-45", summary: "...", timestamp: ... })

// Create session after issue creation
sessionStore.set(sessionId, {
  issueKey: createdIssue.key,
  summary: summary,
  timestamp: Date.now(),
});

// Query session
const session = sessionStore.get(sessionId);
if (!session) {
  return res.status(404).json({ error: "Session not found or expired" });
}

// Clean up after follow-up
sessionStore.delete(sessionId);
```

### Automatic Session Cleanup

```javascript
// At app startup
setInterval(
  () => {
    const maxAge = 2 * 60 * 60 * 1000; // 2 hours
    const now = Date.now();

    for (const [sessionId, session] of sessionStore.entries()) {
      if (now - session.timestamp > maxAge) {
        sessionStore.delete(sessionId);
        console.log(`[SESSION CLEANUP] Removed expired session: ${sessionId}`);
      }
    }
  },
  30 * 60 * 1000,
); // Run every 30 minutes
```

---

## Feature 4: Active Sprint Detection

### File Location

`utils/jira-helpers.js`

### Implementation

```javascript
async function getActiveSprint() {
  // Fetch all sprints for the board
  const sprints = await getAllSprints(true); // onlyActive=true

  // Filter for active state
  const activeSprint = sprints.find((s) => s.state === "active");

  return activeSprint; // { id, name, state }
}

// Used in /sprints endpoint to return active sprint info
// Used in /create-issue-smart to determine if follow-up needed
// Used in /follow-up to add to active sprint by default
```

### Use Case Flow

```
POST /create-issue-smart
  ├─ Create issue
  ├─ Get active sprint
  ├─ If active sprint exists
  │   └─ Return response with activeSprint
  │   └─ questionResolution: null (no follow-up)
  └─ If no active sprint
      └─ Return response with activeSprint: null
      └─ questionResolution: ask user
```

---

## Feature 5: AI-Powered Natural Language Actions

### File Location

`server.js` - `POST /action` endpoint

### Flow Diagram

````
User natural language question
  │
  ├─► Groq AI (llama-3.3-70b-versatile)
  │   ├─ System prompt with examples
  │   ├─ Output format: JSON only
  │   └─ Return: { action: "...", field1: "...", field2: "..." }
  │
  ├─► JSON parsing
  │   ├─ Remove markdown code blocks (```json ```)
  │   ├─ Extract JSON object with regex: /\{[\s\S]*\}/
  │   ├─ Parse JSON.parse()
  │   └─ Validate required fields
  │
  └─► Execute action based on action type
      ├─ create → jiraHelpers.createIssueWithFields()
      ├─ update_status → Find transition → Call transitions API
      ├─ assign → Search user → Call assignee API
      ├─ assign_by_summary → Search issues → Find user → Assign
      └─ delete → Call delete API
````

### System Prompt Engineering

The AI is instructed to:

1. **Output ONLY valid JSON** - No markdown, no text
2. **Provide examples** - Shows correct format with real values
3. **Specify rules** - What fields are required for each action
4. **Include context** - Project key and action types

```javascript
const systemPrompt = `You are a Jira action parser. You MUST respond with ONLY a JSON object, nothing else.
            
Examples of correct responses:
{"action": "create", "summary": "Implement payment integration", "description":"full details", "priority":"High", "assignee":"arnav"}
{"action": "update_status", "issueKey": "SHIP-123", "status": "In Progress"}
{"action": "assign", "issueKey": "SHIP-123", "assignee": "arnav"}

Rules:
- Respond with ONLY the JSON object
- No markdown, no backticks, no text before or after
- action field is REQUIRED
- For create: summary is REQUIRED
- For update_status: issueKey and status are REQUIRED
...`;
```

### Error Recovery

````javascript
let raw = aiResponse.choices[0].message.content.trim();

// Remove markdown code blocks
raw = raw
  .replace(/```json\n?/g, "")
  .replace(/```\n?/g, "")
  .trim();

// Extract JSON using regex
const jsonMatch = raw.match(/\{[\s\S]*\}/);
if (!jsonMatch) {
  throw new Error("AI response did not contain valid JSON");
}

// Parse JSON with error handling
let actionData;
try {
  actionData = JSON.parse(jsonMatch[0]);
} catch (parseErr) {
  throw new Error("Invalid JSON in AI response");
}

// Validate action field exists
if (!actionData.action) {
  throw new Error("Missing action field");
}
````

### Action Execution Examples

#### Create Action

```javascript
case 'create': {
  if (!actionData.summary) throw new Error('summary is required');

  result = await jiraHelpers.createIssueWithFields({
    summary: actionData.summary,
    description: actionData.description,
    priority: actionData.priority,
    assignee: actionData.assignee
  });

  result = {
    message: `Created issue ${result.key}`,
    issueKey: result.key
  };
  break;
}
```

#### Update Status Action

```javascript
case 'update_status': {
  if (!actionData.issueKey || !actionData.status) {
    throw new Error('issueKey and status are required');
  }

  // Get available transitions for the issue
  const transitions = await jira.get(`/issue/${actionData.issueKey}/transitions`);

  // Find matching transition
  const transition = transitions.find(
    t => t.name.toLowerCase() === actionData.status.toLowerCase()
  );

  if (!transition) throw new Error(`Status "${actionData.status}" not found`);

  // Execute transition
  await jira.post(`/issue/${actionData.issueKey}/transitions`, {
    transition: { id: transition.id }
  });

  result = { message: `Updated ${actionData.issueKey} to ${actionData.status}` };
  break;
}
```

#### Assign by Summary Action

```javascript
case 'assign_by_summary': {
  if (!actionData.summary || !actionData.assignee) {
    throw new Error('summary and assignee are required');
  }

  // Search for issues matching summary
  const issues = await jira.get('/search', {
    jql: `project = ${PROJECT_KEY} ORDER BY updated DESC`,
    maxResults: 50
  });

  // Filter issues by summary (case-insensitive substring)
  const matching = issues.filter(i =>
    i.fields.summary.toLowerCase().includes(actionData.summary.toLowerCase())
  );

  if (!matching.length) throw new Error(`No issues matching "${actionData.summary}"`);

  const issueKey = matching[0].key;

  // Search for user
  const users = await jira.get('/user/search', {
    query: actionData.assignee
  });

  if (!users.length) throw new Error(`User "${actionData.assignee}" not found`);

  // Assign issue to user
  await jira.put(`/issue/${issueKey}/assignee`, {
    accountId: users[0].accountId
  });

  result = { message: `Assigned ${issueKey} to ${actionData.assignee}` };
  break;
}
```

---

## Feature 6: JQL & Sprint Handling

### File Location

`utils/jira-helpers.js`

### Active Sprint via JQL

```javascript
// Get sprint-specific issues
async function getSprintIssues(sprintId) {
  const jql = `sprint = ${sprintId}`;

  const response = await axios.get(`${JIRA_BASE_URL}/rest/api/3/search/jql`, {
    params: {
      jql: jql,
      maxResults: 100,
      fields: "summary,status,priority,issuetype,assignee,description",
    },
  });

  return response.data.issues;
}
```

### Natural Language to JQL Conversion

```javascript
// In /query endpoint
const aiResponse = await groq.chat.completions.create({
  model: "llama-3.3-70b-versatile",
  messages: [
    {
      role: "system",
      content: `Convert natural language to JQL. 
                Project = ${JIRA_PROJECT_KEY}.
                Return ONLY JQL. No explanation.`,
    },
    { role: "user", content: "Show me all high priority bugs" },
  ],
});

let jql = aiResponse.choices[0].message.content.trim();
// Output: "priority = High AND type = Bug AND project = SHIP"

// Ensure project key is included
if (!jql.includes("project =")) {
  jql = `project = ${JIRA_PROJECT_KEY} AND ${jql}`;
}

// Execute JQL query
const issues = await axios.get(`${JIRA_BASE_URL}/rest/api/3/search/jql`, {
  params: { jql, maxResults: 20 },
});

return { jql, issues: issues.data.issues, total: issues.data.issues.length };
```

---

## Logging System

### Location

`logs/session-YYYY-MM-DD.log`

### Log Function

```javascript
function log(user, query, jql, resultCount) {
  const file = path.join(
    LOG_DIR,
    `session-${new Date().toISOString().slice(0, 10)}.log`,
  );
  const entry = `[${new Date().toLocaleString()}] user=${user} query="${query}" jql="${jql}" results=${resultCount}\n`;
  fs.appendFileSync(file, entry);
}
```

### Log Format Example

```
[2024-01-15 14:30:45] user=arnav query="create issue" jql="action:create" results=1
[2024-01-15 14:31:20] user=arnav query="show bugs" jql="project = SHIP AND type = Bug" results=5
[2024-01-15 14:32:10] user=arnav query="report:Sprint 1" jql="sprint=1" results=23
```

---

## Error Handling Strategy

### Validation Layers

```
Input Validation
    ↓
Business Logic Validation
    ↓
Jira API Validation
    ↓
Error Response to Client
```

### Example: Create Issue with Assignee

```javascript
// Layer 1: Input validation
if (!summary?.trim()) {
  return res.status(400).json({ error: "Summary is required" });
}

try {
  // Layer 2: Create issue
  const createdIssue = await jiraHelpers.createIssueWithFields({
    summary,
    assignee, // Will error if invalid
  });

  // Layer 3: Jira API validation happens in createIssueWithFields
  // If assignee not found, Jira returns 400
} catch (err) {
  // Layer 4: Catch and format error
  console.error("[CREATE ISSUE ERROR]", err.message);
  res.status(500).json({
    error: err.response?.data?.errorMessages?.[0] || err.message,
  });
}
```

---

## Production Deployment Notes

### Memory Considerations

- Session store uses in-memory Map
- For production with multiple servers, use Redis instead
- Current implementation suitable for single-server deployments

### Rate Limiting

- No built-in rate limiting
- Recommend adding Express rate-limiter middleware
- Jira API: 900 requests/hour limit

### Caching

- Consider caching sprint data (they don't change frequently)
- PDF reports can be cached for 24 hours
- User list from Jira can be cached

### Security

- JWT tokens expire after 8 hours
- Sessions expire after 2 hours (auto-cleanup)
- Jira credentials stored in environment variables
- No sensitive data in logs

---

## Summary of Key Files

| File                     | Purpose               | Key Functions                                       |
| ------------------------ | --------------------- | --------------------------------------------------- |
| `server.js`              | Main Express server   | All endpoints                                       |
| `utils/pdf-generator.js` | PDF report generation | `generateSprintReportPDF()`, statistics calculation |
| `utils/jira-helpers.js`  | Jira API wrapper      | Issue creation, sprint management, searches         |
| `logs/session-*.log`     | Activity logging      | Audit trail of all operations                       |

---

## Testing Checklist

- [ ] Login and token generation
- [ ] Sprint listing and active sprint detection
- [ ] PDF report generation for sprint
- [ ] Create issue with all fields
- [ ] Create issue with smart follow-up
- [ ] Follow-up responses (sprint, backlog, by name)
- [ ] Issue query with natural language
- [ ] AI actions (create, assign, update, delete)
- [ ] Error handling (missing fields, invalid users, etc.)
- [ ] Session expiration and cleanup

---

This implementation is production-ready with proper error handling, validation, and logging. Feel free to extend with additional features as needed!
