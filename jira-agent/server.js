require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const axios = require('axios');
const Groq = require('groq-sdk');
const fs = require('fs');
const path = require('path');

// Import utilities
const jiraHelpers = require('./utils/jira-helpers');
const { generateSprintReportPDF } = require('./utils/pdf-generator');

const app = express();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const {
  JIRA_BASE_URL,
  JIRA_EMAIL,
  JIRA_API_TOKEN,
  JIRA_PROJECT_KEY,
  JWT_SECRET,
  PORT
} = process.env;

// ── Session Store for Conversational Context ───
const sessionStore = new Map();

// ── Session Cleanup (every 30 minutes) ─────────
setInterval(() => {
  const maxAge = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
  const now = Date.now();

  for (const [sessionId, session] of sessionStore.entries()) {
    if (now - session.timestamp > maxAge) {
      sessionStore.delete(sessionId);
      console.log(`[SESSION CLEANUP] Removed expired session: ${sessionId}`);
    }
  }
}, 30 * 60 * 1000); // Run every 30 minutes

// ── Middleware ─────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json());

// ── Logger ─────────────────────────────────────
const LOG_DIR = path.join(__dirname, 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR);

function log(user, query, jql, resultCount) {
  const file = path.join(LOG_DIR, `session-${new Date().toISOString().slice(0, 10)}.log`);
  const entry = `[${new Date().toLocaleString()}] user=${user} query="${query}" jql="${jql}" results=${resultCount}\n`;
  fs.appendFileSync(file, entry);
}

// ── Auth Middleware ────────────────────────────
function requireAuth(req, res, next) {
  const header = req.headers['authorization'];
  if (!header) return res.status(401).json({ error: 'No token provided' });

  const token = header.split(' ')[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ── LOGIN ──────────────────────────────────────
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return res.status(400).json({ error: 'Username and password required' });

  if (
    username !== process.env.ADMIN_USERNAME ||
    password !== process.env.ADMIN_PASSWORD
  ) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ token, username });
});

// ── VERIFY ─────────────────────────────────────
app.get('/verify', requireAuth, (req, res) => {
  res.json({ valid: true, username: req.user.username });
});

// ── HEALTH CHECK ───────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── GET SPRINTS ────────────────────────────────
app.get('/sprints', requireAuth, async (req, res) => {
  try {
    const sprints = await jiraHelpers.getAllSprints(true);
    const activeSprint = await jiraHelpers.getActiveSprint();

    res.json({
      sprints: sprints.map(s => ({
        id: s.id,
        name: s.name,
        state: s.state,
        isActive: s.state === 'active'
      })),
      activeSprint: activeSprint ? {
        id: activeSprint.id,
        name: activeSprint.name,
        state: activeSprint.state
      } : null
    });
  } catch (err) {
    console.error('[SPRINTS ERROR]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── REPORT GENERATION ──────────────────────────
app.get('/report', requireAuth, async (req, res) => {
  const { sprint } = req.query;

  if (!sprint) {
    return res.status(400).json({ error: 'Sprint ID or name is required' });
  }

  try {
    let issues, reportName;

    if (sprint === '__all__') {
      // No sprint — fetch all project issues
      reportName = `${JIRA_PROJECT_KEY} - All Issues`;
      issues = await jiraHelpers.searchIssues(
        `project = ${JIRA_PROJECT_KEY} ORDER BY updated DESC`,
        100
      );
    } else {
      const sprintObj = await jiraHelpers.getSprintByNameOrId(sprint);
      if (!sprintObj) {
        return res.status(404).json({ error: `Sprint "${sprint}" not found` });
      }
      reportName = sprintObj.name;
      issues = await jiraHelpers.getSprintIssues(sprintObj.id);
      log(req.user.username, `report:${sprintObj.name}`, `sprint=${sprintObj.id}`, issues.length);
    }

    const pdfBuffer = await generateSprintReportPDF(reportName, issues);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="report-${reportName.replace(/\s+/g, '_')}.pdf"`);
    res.send(pdfBuffer);

  } catch (err) {
    console.error('[REPORT ERROR]', err.message);
    res.status(500).json({ error: err.message });
  }
});


// ── ENHANCED ISSUE CREATION ────────────────────
app.post('/create-issue', requireAuth, async (req, res) => {
  const { summary, description, priority, assignee, issueType, sprintId } = req.body;

  if (!summary?.trim()) {
    return res.status(400).json({ error: 'Summary is required' });
  }

  try {
    const createdIssue = await jiraHelpers.createIssueWithFields({
      summary,
      description,
      priority,
      assignee,
      issueType,
      labels: []
    });

    if (sprintId) {
      await jiraHelpers.addIssueToSprint(createdIssue.key, sprintId);
    }

    log(req.user.username, `create-issue:${summary}`, `key=${createdIssue.key}`, 1);

    res.json({
      message: `Created issue ${createdIssue.key}`,
      issueKey: createdIssue.key,
      issueId: createdIssue.id,
      addedToSprint: sprintId ? true : false
    });
  } catch (err) {
    console.error('[CREATE ISSUE ERROR]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── SMART ISSUE CREATION WITH FOLLOW-UP ────────
app.post('/create-issue-smart', requireAuth, async (req, res) => {
  const { summary, description, priority, assignee, issueType } = req.body;
  const sessionId = req.user.username + '-' + Date.now();

  if (!summary?.trim()) {
    return res.status(400).json({ error: 'Summary is required' });
  }

  try {
    const createdIssue = await jiraHelpers.createIssueWithFields({
      summary,
      description,
      priority,
      assignee,
      issueType,
      labels: []
    });

    const activeSprint = await jiraHelpers.getActiveSprint();

    sessionStore.set(sessionId, {
      issueKey: createdIssue.key,
      summary,
      timestamp: Date.now()
    });

    log(req.user.username, `create-issue-smart:${summary}`, `key=${createdIssue.key}`, 1);

    res.json({
      message: `Created issue ${createdIssue.key}`,
      issueKey: createdIssue.key,
      issueId: createdIssue.id,
      sessionId,
      activeSprint: activeSprint ? { id: activeSprint.id, name: activeSprint.name } : null,
      questionResolution: !activeSprint ? {
        type: 'follow-up',
        question: `Do you want to add issue ${createdIssue.key} to a sprint or leave it in the backlog?`,
        options: ['sprint', 'backlog']
      } : null
    });
  } catch (err) {
    console.error('[CREATE ISSUE SMART ERROR]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── FOLLOW-UP RESPONSE ─────────────────────────
app.post('/follow-up', requireAuth, async (req, res) => {
  const { sessionId, response, sprintId } = req.body;

  if (!sessionId || !response?.trim()) {
    return res.status(400).json({ error: 'Session ID and response are required' });
  }

  try {
    const session = sessionStore.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }

    const { issueKey } = session;

    if (response.toLowerCase() === 'sprint' || response.toLowerCase().includes('sprint')) {
      let sprint;

      if (sprintId) {
        sprint = await jiraHelpers.getSprintByNameOrId(sprintId);
      } else {
        sprint = await jiraHelpers.getActiveSprint();
      }

      if (!sprint) {
        return res.status(400).json({ error: 'No active sprint found. Please provide a sprint ID.' });
      }

      await jiraHelpers.addIssueToSprint(issueKey, sprint.id);
      sessionStore.delete(sessionId);

      res.json({
        message: `Added ${issueKey} to sprint "${sprint.name}"`,
        issueKey,
        sprintName: sprint.name
      });
    } else if (response.toLowerCase() === 'backlog' || response.toLowerCase().includes('backlog')) {
      sessionStore.delete(sessionId);

      res.json({
        message: `${issueKey} left in backlog`,
        issueKey,
        location: 'backlog'
      });
    } else {
      const sprint = await jiraHelpers.getSprintByNameOrId(response);
      if (sprint) {
        await jiraHelpers.addIssueToSprint(issueKey, sprint.id);
        sessionStore.delete(sessionId);

        res.json({
          message: `Added ${issueKey} to sprint "${sprint.name}"`,
          issueKey,
          sprintName: sprint.name
        });
      } else {
        return res.status(400).json({ error: `Could not find sprint "${response}". Please respond with "sprint", "backlog", or a sprint ID/name.` });
      }
    }
  } catch (err) {
    console.error('[FOLLOW-UP ERROR]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── QUERY ──────────────────────────────────────
app.post('/query', requireAuth, async (req, res) => {
  const { question } = req.body;

  if (!question?.trim())
    return res.status(400).json({ error: 'Question is required' });

  try {
    const aiResponse = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `Convert natural language to Jira Query Language (JQL).
Project key is ${JIRA_PROJECT_KEY}. Return ONLY the JQL string, nothing else.

JQL Tips:
- Use sprint in openSprints() for current/active sprint issues
- Use sprint in closedSprints() for past sprint issues  
- Status values use spaces not hyphens: "To Do", "In Progress", "Done"
- For priority use: Highest, High, Medium, Low, Lowest
- Use ORDER BY updated DESC for recent items
- Use assignee = currentUser() for user's own issues
- For workload queries, group by assignee
- For recently completed: status = Done AND updated >= -7d`
        },
        { role: 'user', content: question }
      ]
    });

    let jql = aiResponse.choices[0].message.content.trim();

    if (!jql.includes('project =')) {
      jql = `project = ${JIRA_PROJECT_KEY} AND ${jql}`;
    }

    const jiraRes = await axios.get(
      `${JIRA_BASE_URL}/rest/api/3/search/jql`,
      {
        auth: {
          username: JIRA_EMAIL,
          password: JIRA_API_TOKEN
        },
        headers: { Accept: 'application/json' },
        params: {
          jql,
          maxResults: 20,
          fields: 'summary,status,assignee,priority,updated,description'
        }
      }
    );

    const issues = jiraRes.data.issues;

    log(req.user.username, question, jql, issues.length);

    res.json({
      jql,
      issues,
      total: issues.length
    });

  } catch (err) {
    console.error('Query error:', err.response?.data || err.message);

    const status = err.response?.status;

    if (status === 401)
      return res.status(500).json({ error: 'Jira auth failed' });

    if (status === 400)
      return res.status(400).json({
        error: err.response?.data?.errorMessages?.[0] || 'Invalid JQL'
      });

    res.status(500).json({ error: err.message });
  }
});

// ── INTERACTIVE ISSUE CREATION WITH AI FOLLOW-UPS ─
app.post('/issue-wizard', requireAuth, async (req, res) => {
  const { sessionId, step, response } = req.body;

  try {
    let session;
    let newSessionId = sessionId || `wizard-${req.user.username}-${Date.now()}`;

    // If this is the first step (no session), initialize it
    if (!sessionId) {
      session = {
        step: 'summary',
        data: {},
        timestamp: Date.now()
      };
      sessionStore.set(newSessionId, session);

      // Ask for summary
      return res.json({
        sessionId: newSessionId,
        step: 'summary',
        question: 'What would you like to name this issue?',
        hint: 'Provide a clear, concise title (e.g., "Fix login button on mobile")',
        placeholder: 'Issue summary'
      });
    }

    // Get existing session
    session = sessionStore.get(newSessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }

    // Store the response from previous step
    if (response?.trim()) {
      if (session.step === 'summary') {
        session.data.summary = response.trim();
        session.step = 'priority';
        sessionStore.set(newSessionId, session);

        return res.json({
          sessionId: newSessionId,
          step: 'priority',
          question: 'What is the priority of this issue?',
          options: ['Lowest', 'Low', 'Medium', 'High', 'Highest'],
          hint: 'Select the priority level'
        });
      }

      if (session.step === 'priority') {
        const validPriorities = ['Lowest', 'Low', 'Medium', 'High', 'Highest'];
        const selected = validPriorities.find(p => p.toLowerCase() === response.toLowerCase());

        if (!selected) {
          return res.status(400).json({ error: 'Invalid priority. Choose from: ' + validPriorities.join(', ') });
        }

        session.data.priority = selected;
        session.step = 'assignee';
        sessionStore.set(newSessionId, session);

        return res.json({
          sessionId: newSessionId,
          step: 'assignee',
          question: 'Who should this be assigned to?',
          hint: 'Enter username or skip by typing "skip"',
          placeholder: 'Username or "skip"'
        });
      }

      if (session.step === 'assignee') {
        if (response.toLowerCase() !== 'skip' && response.toLowerCase() !== 'none') {
          session.data.assignee = response.trim();
        }
        session.step = 'issueType';
        sessionStore.set(newSessionId, session);

        return res.json({
          sessionId: newSessionId,
          step: 'issueType',
          question: 'What type of issue is this?',
          options: ['Task', 'Bug', 'Story', 'Epic'],
          hint: 'Select the issue type'
        });
      }

      if (session.step === 'issueType') {
        const validTypes = ['Task', 'Bug', 'Story', 'Epic'];
        const selected = validTypes.find(t => t.toLowerCase() === response.toLowerCase());

        if (!selected) {
          return res.status(400).json({ error: 'Invalid type. Choose from: ' + validTypes.join(', ') });
        }

        session.data.issueType = selected;
        session.step = 'description';
        sessionStore.set(newSessionId, session);

        return res.json({
          sessionId: newSessionId,
          step: 'description',
          question: 'Any additional details? (optional)',
          hint: 'Provide context or skip',
          placeholder: 'Description or "skip"'
        });
      }

      if (session.step === 'description') {
        if (response.toLowerCase() !== 'skip' && response.toLowerCase() !== 'none') {
          session.data.description = response.trim();
        }
        session.step = 'confirm';
        sessionStore.set(newSessionId, session);

        // Show summary before creating
        return res.json({
          sessionId: newSessionId,
          step: 'confirm',
          question: 'Ready to create this issue?',
          summary: {
            summary: session.data.summary,
            priority: session.data.priority,
            issueType: session.data.issueType,
            assignee: session.data.assignee || '(unassigned)',
            description: session.data.description || '(none)'
          },
          options: ['yes', 'no'],
          hint: 'Confirm to create, or type "no" to cancel'
        });
      }

      if (session.step === 'confirm') {
        if (response.toLowerCase() === 'no' || response.toLowerCase() === 'cancel') {
          sessionStore.delete(newSessionId);
          return res.json({ message: 'Issue creation cancelled' });
        }

        if (response.toLowerCase() === 'yes' || response.toLowerCase() === 'create') {
          // Create the issue
          try {
            const createdIssue = await jiraHelpers.createIssueWithFields({
              summary: session.data.summary,
              description: session.data.description,
              priority: session.data.priority,
              assignee: session.data.assignee,
              issueType: session.data.issueType,
              labels: []
            });

            log(req.user.username, `issue-wizard:${session.data.summary}`, `key=${createdIssue.key}`, 1);
            sessionStore.delete(newSessionId);

            return res.json({
              success: true,
              message: `✅ Issue created successfully!`,
              issueKey: createdIssue.key,
              issueId: createdIssue.id,
              summary: session.data.summary,
              link: `${JIRA_BASE_URL}/browse/${createdIssue.key}`
            });
          } catch (err) {
            console.error('[ISSUE WIZARD ERROR]', err.message);
            return res.status(500).json({
              error: `Failed to create issue: ${err.message}`,
              sessionId: newSessionId,
              step: 'confirm'
            });
          }
        }

        return res.status(400).json({ error: 'Please respond with "yes" or "no"' });
      }
    }

    return res.status(400).json({ error: 'No response provided' });
  } catch (err) {
    console.error('[ISSUE WIZARD ERROR]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── ACTION ─────────────────────────────────────
app.post('/action', requireAuth, async (req, res) => {
  const { question } = req.body;

  if (!question?.trim())
    return res.status(400).json({ error: 'Action description is required' });

  try {
    const aiResponse = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are a Jira action parser. You MUST respond with ONLY a JSON object, nothing else.
            
Examples of correct responses:
{"action": "create", "summary": "Implement payment integration", "description":"full details", "priority":"High", "assignee":"arnav"}
{"action": "update_status", "issueKey": "${JIRA_PROJECT_KEY}-123", "status": "In Progress"}
{"action": "assign", "issueKey": "${JIRA_PROJECT_KEY}-123", "assignee": "arnav"}
{"action": "generate_report", "sprint": "active"}
{"action": "assign_by_summary", "summary": "Fix final report", "assignee": "arnav"}
{"action": "delete", "issueKey": "${JIRA_PROJECT_KEY}-123"}

Rules:
- Respond with ONLY the JSON object
- No markdown, no backticks, no text before or after
- action field is REQUIRED
- summary is REQUIRED for create actions
- description, priority, assignee are OPTIONAL for create actions
- sprint is REQUIRED for generate_report action (use "active" for current sprint)
- issueKey and status are REQUIRED for update_status
- If issue key is clear (e.g., "SHIP-123"), use "assign" with issueKey
- If issue key is unclear (e.g., "Fix final report"), use "assign_by_summary" with the issue summary and assignee
- issueKey and assignee are REQUIRED for assign action
- summary and assignee are REQUIRED for assign_by_summary action
- issueKey is REQUIRED for delete
- For assignee, extract just the username/name part (e.g., "arnav" not "arnav rinawa")

Project key is ${JIRA_PROJECT_KEY}.`
        },
        { role: 'user', content: question }
      ]
    });

    let raw = aiResponse.choices[0].message.content.trim();
    console.log('[ACTION API] Raw AI response:', raw);

    raw = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[ACTION ERROR] No JSON found in response:', raw);
      throw new Error('AI response did not contain valid JSON');
    }

    let actionData;
    try {
      actionData = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.error('[ACTION ERROR] JSON parse failed:', jsonMatch[0], parseErr.message);
      throw new Error('Invalid JSON in AI response');
    }

    console.log('[ACTION PARSED]', JSON.stringify(actionData));

    if (!actionData.action) {
      console.error('[ACTION ERROR] No action field found in:', actionData);
      throw new Error('Missing action field in response. Got: ' + JSON.stringify(actionData));
    }

    let result;
    const action = actionData.action.toLowerCase().trim();
    console.log('[ACTION NORMALIZED]', action);

    switch (action) {
      case 'generate_report': {
        let sprintObj;
        if (!actionData.sprint || actionData.sprint.toLowerCase() === 'active') {
          sprintObj = await jiraHelpers.getActiveSprint();
        } else {
          sprintObj = await jiraHelpers.getSprintByNameOrId(actionData.sprint);
        }

        // Fallback: if no sprint found, report on all project issues
        const reportSprint = sprintObj ? sprintObj.name : '__all__';

        result = {
          action: 'generate_report',
          message: sprintObj
            ? `Sprint report for "${sprintObj.name}" is ready to be downloaded.`
            : `No active sprint found. The report will cover all project issues instead.`,
          sprintId: sprintObj ? sprintObj.id : null,
          sprintName: reportSprint
        };
        break;
      }

      case 'create': {
        if (!actionData.summary) {
          throw new Error('summary is required for create action');
        }
        const createdIssue = await jiraHelpers.createIssueWithFields({
          summary: actionData.summary,
          description: actionData.description,
          priority: actionData.priority,
          assignee: actionData.assignee,
          issueType: actionData.issueType || 'Task'
        });

        const activeSprint = await jiraHelpers.getActiveSprint();
        const sessionId = req.user.username + '-' + Date.now();

        sessionStore.set(sessionId, {
          issueKey: createdIssue.key,
          summary: actionData.summary,
          timestamp: Date.now()
        });

        result = { 
          message: `Created issue ${createdIssue.key}`, 
          issueKey: createdIssue.key,
          sessionId,
          activeSprint: activeSprint ? { id: activeSprint.id, name: activeSprint.name } : null,
          questionResolution: {
            type: 'follow-up',
            question: `Do you want to add issue ${createdIssue.key} to a sprint or leave it in the backlog?`,
            options: ['sprint', 'backlog']
          }
        };
        break;
      }

      case 'update_status': {
        if (!actionData.issueKey || !actionData.status) {
          throw new Error('issueKey and status are required for update_status action');
        }
        const transitionsRes = await axios.get(
          `${JIRA_BASE_URL}/rest/api/3/issue/${actionData.issueKey}/transitions`,
          {
            auth: {
              username: JIRA_EMAIL,
              password: JIRA_API_TOKEN
            }
          }
        );

        const transition = transitionsRes.data.transitions.find(
          t => t.name.toLowerCase() === actionData.status.toLowerCase()
        );

        if (!transition) {
          throw new Error(`Status "${actionData.status}" not found`);
        }

        await axios.post(
          `${JIRA_BASE_URL}/rest/api/3/issue/${actionData.issueKey}/transitions`,
          { transition: { id: transition.id } },
          {
            auth: {
              username: JIRA_EMAIL,
              password: JIRA_API_TOKEN
            }
          }
        );
        result = { message: `Updated ${actionData.issueKey} to ${actionData.status}` };
        break;
      }

      case 'assign': {
        if (!actionData.issueKey || !actionData.assignee) {
          throw new Error('issueKey and assignee are required for assign action');
        }
        console.log(`[ASSIGN] Attempting to assign ${actionData.issueKey} to ${actionData.assignee}`);

        let usersRes;
        try {
          usersRes = await axios.get(
            `${JIRA_BASE_URL}/rest/api/3/user/search`,
            {
              params: { query: actionData.assignee },
              auth: {
                username: JIRA_EMAIL,
                password: JIRA_API_TOKEN
              }
            }
          );
          console.log(`[ASSIGN] Found ${usersRes.data.length} users matching "${actionData.assignee}"`);
        } catch (searchErr) {
          console.error('[ASSIGN USER SEARCH ERROR]', searchErr.response?.data || searchErr.message);
          throw new Error(`Failed to search for user "${actionData.assignee}"`);
        }

        if (!usersRes.data.length) {
          throw new Error(`User "${actionData.assignee}" not found in Jira`);
        }

        try {
          await axios.put(
            `${JIRA_BASE_URL}/rest/api/3/issue/${actionData.issueKey}/assignee`,
            { accountId: usersRes.data[0].accountId },
            {
              auth: {
                username: JIRA_EMAIL,
                password: JIRA_API_TOKEN
              }
            }
          );
          console.log(`[ASSIGN SUCCESS] Assigned ${actionData.issueKey} to ${usersRes.data[0].displayName}`);
        } catch (assignErr) {
          console.error('[ASSIGN ISSUE ERROR]', assignErr.response?.data || assignErr.message);
          throw new Error(`Failed to assign issue`);
        }

        result = { message: `Assigned ${actionData.issueKey} to ${actionData.assignee}` };
        break;
      }

      case 'assign_by_summary': {
        if (!actionData.summary || !actionData.assignee) {
          throw new Error('summary and assignee are required for assign_by_summary action');
        }
        console.log(`[ASSIGN_BY_SUMMARY] Searching for issues matching "${actionData.summary}"`);

        let matchingIssues;
        try {
          const jql = `project = ${JIRA_PROJECT_KEY} ORDER BY updated DESC`;
          const issuesRes = await axios.get(
            `${JIRA_BASE_URL}/rest/api/3/search/jql`,
            {
              params: {
                jql,
                maxResults: 50,
                fields: 'summary,status,assignee,priority,updated,description'
              },
              auth: {
                username: JIRA_EMAIL,
                password: JIRA_API_TOKEN
              }
            }
          );

          const summaryLower = actionData.summary.toLowerCase();
          matchingIssues = issuesRes.data.issues.filter(i =>
            i.fields.summary.toLowerCase().includes(summaryLower)
          );

          console.log(`[ASSIGN_BY_SUMMARY] Found ${matchingIssues.length} issues matching "${actionData.summary}"`);

          if (!matchingIssues.length) {
            throw new Error(`No issues found matching "${actionData.summary}"`);
          }
        } catch (searchErr) {
          console.error('[ASSIGN_BY_SUMMARY SEARCH ERROR]', searchErr.response?.data || searchErr.message);
          throw new Error(`Failed to search for issues`);
        }

        const matchingIssueKey = matchingIssues[0].key;
        console.log(`[ASSIGN_BY_SUMMARY] Using issue ${matchingIssueKey} for assignment`);

        let usersRes;
        try {
          usersRes = await axios.get(
            `${JIRA_BASE_URL}/rest/api/3/user/search`,
            {
              params: { query: actionData.assignee },
              auth: {
                username: JIRA_EMAIL,
                password: JIRA_API_TOKEN
              }
            }
          );
          console.log(`[ASSIGN_BY_SUMMARY] Found ${usersRes.data.length} users matching "${actionData.assignee}"`);
        } catch (searchErr) {
          console.error('[ASSIGN_BY_SUMMARY USER SEARCH ERROR]', searchErr.response?.data || searchErr.message);
          throw new Error(`Failed to search for user "${actionData.assignee}"`);
        }

        if (!usersRes.data.length) {
          throw new Error(`User "${actionData.assignee}" not found in Jira`);
        }

        try {
          await axios.put(
            `${JIRA_BASE_URL}/rest/api/3/issue/${matchingIssueKey}/assignee`,
            { accountId: usersRes.data[0].accountId },
            {
              auth: {
                username: JIRA_EMAIL,
                password: JIRA_API_TOKEN
              }
            }
          );
          console.log(`[ASSIGN_BY_SUMMARY SUCCESS] Assigned ${matchingIssueKey} to ${usersRes.data[0].displayName}`);
        } catch (assignErr) {
          console.error('[ASSIGN_BY_SUMMARY ISSUE ERROR]', assignErr.response?.data || assignErr.message);
          throw new Error(`Failed to assign issue`);
        }

        result = { message: `Assigned ${matchingIssueKey} to ${actionData.assignee}` };
        break;
      }

      case 'delete': {
        if (!actionData.issueKey) {
          throw new Error('issueKey is required for delete action');
        }
        await axios.delete(
          `${JIRA_BASE_URL}/rest/api/3/issue/${actionData.issueKey}`,
          {
            auth: {
              username: JIRA_EMAIL,
              password: JIRA_API_TOKEN
            }
          }
        );
        result = { message: `Deleted ${actionData.issueKey}` };
        break;
      }

      default:
        throw new Error(`Unknown action: "${action}". Expected: create, update_status, assign, assign_by_summary, or delete`);
    }

    log(req.user.username, question, `action:${actionData.action}`, 1);
    res.json(result);

  } catch (err) {
    console.error('Action error:', err.response?.data || err.message);
    res.status(500).json({
      error: err.response?.data?.errorMessages?.[0] || err.message
    });
  }
});

// ── START ──────────────────────────────────────
const serverPort = PORT || 3000;
app.listen(serverPort, () => {
  console.log(`✅ Server running on http://localhost:${serverPort}`);
  console.log(`📋 Jira Project: ${JIRA_PROJECT_KEY || 'Not set'}`);
  console.log(`🤖 Groq AI: ${process.env.GROQ_API_KEY ? 'Ready' : 'Missing API key'}`);
  console.log(`🔐 Login: ${process.env.ADMIN_USERNAME} / ****`);
});
