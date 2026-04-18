const axios = require('axios');

const {
  JIRA_BASE_URL,
  JIRA_EMAIL,
  JIRA_API_TOKEN,
  JIRA_PROJECT_KEY
} = process.env;

/**
 * Create axios instance with Jira authentication
 */
const jiraAxios = axios.create({
  baseURL: JIRA_BASE_URL,
  auth: {
    username: JIRA_EMAIL,
    password: JIRA_API_TOKEN
  },
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json'
  }
});

/**
 * Find the best board for this project (with fallback to all boards)
 */
async function getBoardForProject() {
  // Try 1: project-scoped board lookup
  try {
    const res = await jiraAxios.get(`/rest/agile/1.0/board?projectKeyOrId=${JIRA_PROJECT_KEY}&maxResults=10`);
    const boards = res.data.values || [];
    console.log(`[JIRA] Project-scoped boards: ${boards.length}`);
    if (boards.length > 0) {
      const scrum = boards.find(b => b.type === 'scrum');
      return scrum || boards[0];
    }
  } catch (e) {
    console.warn('[JIRA] Project-scoped board lookup failed:', e.response?.status, e.response?.data?.message || e.message);
  }

  // Try 2: list all accessible boards
  try {
    const allRes = await jiraAxios.get('/rest/agile/1.0/board?maxResults=50');
    const allBoards = allRes.data.values || [];
    console.log(`[JIRA] All accessible boards: ${allBoards.length}`);
    if (allBoards.length > 0) {
      // Look for a board that matches project key in its name
      const projectBoard = allBoards.find(b => b.name.toUpperCase().includes(JIRA_PROJECT_KEY));
      const scrum = allBoards.find(b => b.type === 'scrum');
      return projectBoard || scrum || allBoards[0];
    }
  } catch (e) {
    console.warn('[JIRA] Global board lookup failed:', e.response?.status, e.response?.data?.message || e.message);
  }

  return null; // No board found - callers handle this gracefully
}

/**
 * Get active sprint for the project
 */
async function getActiveSprint() {
  try {
    const board = await getBoardForProject();
    if (!board) {
      console.warn('[JIRA] No board found. Sprints unavailable.');
      return null;
    }
    console.log(`[JIRA] Using board: ${board.name} (id=${board.id}, type=${board.type})`);
    const sprintRes = await jiraAxios.get(`/rest/agile/1.0/board/${board.id}/sprint?state=active`);
    const sprints = sprintRes.data.values || [];
    return sprints[0] || null;
  } catch (err) {
    console.error('[JIRA] Error fetching active sprint:', err.message);
    return null; // Gracefully return null so callers can proceed without sprint
  }
}

/**
 * Get sprint by name or ID
 */
async function getSprintByNameOrId(sprintIdentifier) {
  try {
    const board = await getBoardForProject();
    if (!board) return null;
    const sprintRes = await jiraAxios.get(`/rest/agile/1.0/board/${board.id}/sprint?maxResults=50`);
    const sprints = sprintRes.data.values || [];
    
    let sprint = sprints.find(s => s.id === parseInt(sprintIdentifier));
    if (!sprint) {
      sprint = sprints.find(s => s.name.toLowerCase() === sprintIdentifier.toLowerCase());
    }
    return sprint || null;
  } catch (err) {
    console.error('[JIRA] Error fetching sprint:', err.message);
    return null;
  }
}

/**
 * Get issues for a sprint with detailed breakdown
 */
async function getSprintIssues(sprintId) {
  try {
    const jql = `project = ${JIRA_PROJECT_KEY} AND sprint = ${sprintId}`;
    
    const res = await jiraAxios.get('/rest/api/3/search/jql', {
      params: {
        jql,
        maxResults: 100,
        fields: 'summary,status,issuetype,priority,assignee,description,created,updated'
      }
    });

    return res.data.issues || [];
  } catch (err) {
    console.error('[JIRA] Error fetching sprint issues:', err.message);
    throw new Error(`Failed to fetch sprint issues: ${err.message}`);
  }
}

/**
 * Get all list of sprints
 */
async function getAllSprints(includeInactive = false) {
  try {
    const board = await getBoardForProject();
    if (!board) return [];
    const stateFilter = includeInactive ? '' : '?state=active&state=future';
    const sprintRes = await jiraAxios.get(`/rest/agile/1.0/board/${board.id}/sprint${stateFilter}`);
    return sprintRes.data.values || [];
  } catch (err) {
    console.error('[JIRA] Error fetching all sprints:', err.message);
    return [];
  }
}

/**
 * Create issue with enhanced fields
 */
async function createIssueWithFields(fields) {
  try {
    // Format description as Atlassian Document Format (ADF)
    const formatDescription = (text) => {
      if (!text || !text.trim()) {
        return undefined; // Omit empty description
      }
      return {
        version: 1,
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: text
              }
            ]
          }
        ]
      };
    };

    const payload = {
      fields: {
        project: { key: JIRA_PROJECT_KEY },
        summary: fields.summary,
        issuetype: { name: fields.issueType || 'Task' },
        priority: fields.priority ? { name: fields.priority } : undefined,
        labels: fields.labels || []
      }
    };

    // Add description if provided (in ADF format)
    if (fields.description) {
      payload.fields.description = formatDescription(fields.description);
    }

    // Remove undefined fields
    Object.keys(payload.fields).forEach(key => {
      if (payload.fields[key] === undefined) delete payload.fields[key];
    });

    // Add assignee if provided
    if (fields.assignee) {
      const userRes = await jiraAxios.get('/rest/api/3/user/search', {
        params: { query: fields.assignee }
      });

      if (userRes.data.length === 0) {
        throw new Error(`User "${fields.assignee}" not found`);
      }

      payload.fields.assignee = { accountId: userRes.data[0].accountId };
    }

    console.log('[JIRA] Creating issue with payload:', JSON.stringify(payload, null, 2));

    const res = await jiraAxios.post('/rest/api/3/issue', payload);
    return res.data;
  } catch (err) {
    console.error('[JIRA] Error creating issue:', {
      message: err.message,
      status: err.response?.status,
      data: err.response?.data
    });
    const jiraError = err.response?.data?.errors || err.response?.data?.errorMessages?.[0] || err.message;
    throw new Error(`Failed to create issue: ${JSON.stringify(jiraError)}`);
  }
}

/**
 * Add issue to sprint
 */
async function addIssueToSprint(issueKey, sprintId) {
  try {
    const res = await jiraAxios.post('/rest/agile/1.0/sprint/' + sprintId + '/issue', {
      issues: [issueKey]
    });
    return res.data;
  } catch (err) {
    console.error('[JIRA] Error adding issue to sprint:', err.message);
    throw new Error(`Failed to add issue to sprint: ${err.message}`);
  }
}

/**
 * Get issues by JQL (general search)
 */
async function searchIssues(jql, maxResults = 50) {
  try {
    const res = await jiraAxios.get('/rest/api/3/search/jql', {
      params: {
        jql,
        maxResults,
        fields: 'summary,status,issuetype,priority,assignee,description,created,updated'
      }
    });

    return res.data.issues || [];
  } catch (err) {
    console.error('[JIRA] Error searching issues:', err.message);
    throw new Error(`Failed to search issues: ${err.message}`);
  }
}

/**
 * Create a new sprint for the project's board
 */
async function createSprint(name, startDate, endDate, goal) {
  try {
    const board = await getBoardForProject();
    if (!board) {
      throw new Error('No board found for this project.');
    }

    const payload = {
      name,
      originBoardId: board.id
    };
    if (startDate) payload.startDate = startDate;
    if (endDate) payload.endDate = endDate;
    if (goal) payload.goal = goal;

    console.log('[JIRA] Creating sprint:', JSON.stringify(payload, null, 2));
    const res = await jiraAxios.post('/rest/agile/1.0/sprint', payload);
    return res.data;
  } catch (err) {
    console.error('[JIRA] Error creating sprint:', err.response?.data || err.message);
    throw new Error(`Failed to create sprint: ${err.response?.data?.errorMessages?.[0] || err.message}`);
  }
}

module.exports = {
  jiraAxios,
  getBoardForProject,
  getActiveSprint,
  getSprintByNameOrId,
  getSprintIssues,
  getAllSprints,
  createIssueWithFields,
  addIssueToSprint,
  searchIssues,
  createSprint
};
