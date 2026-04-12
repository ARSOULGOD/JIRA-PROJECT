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
 * Get active sprint for the project
 */
async function getActiveSprint() {
  try {
    const res = await jiraAxios.get(`/rest/api/3/board`);
    const boards = res.data.values || [];
    
    // Find Scrum board (typically Scrum projects have this)
    const board = boards.find(b => b.type === 'scrum');
    if (!board) {
      throw new Error('No Scrum board found');
    }

    // Get sprints for the board
    const sprintRes = await jiraAxios.get(`/rest/api/3/board/${board.id}/sprint`);
    const sprints = sprintRes.data.values || [];
    
    // Find active sprint (state = 'active')
    const activeSprint = sprints.find(s => s.state === 'active');
    return activeSprint || null;
  } catch (err) {
    console.error('[JIRA] Error fetching active sprint:', err.message);
    throw new Error(`Failed to fetch active sprint: ${err.message}`);
  }
}

/**
 * Get sprint by name or ID
 */
async function getSprintByNameOrId(sprintIdentifier) {
  try {
    const res = await jiraAxios.get(`/rest/api/3/board`);
    const boards = res.data.values || [];
    const board = boards.find(b => b.type === 'scrum');
    
    if (!board) {
      throw new Error('No Scrum board found');
    }

    const sprintRes = await jiraAxios.get(`/rest/api/3/board/${board.id}/sprint`);
    const sprints = sprintRes.data.values || [];
    
    // Try to match by ID first, then by name
    let sprint = sprints.find(s => s.id === parseInt(sprintIdentifier));
    if (!sprint) {
      sprint = sprints.find(s => s.name.toLowerCase() === sprintIdentifier.toLowerCase());
    }
    
    return sprint || null;
  } catch (err) {
    console.error('[JIRA] Error fetching sprint:', err.message);
    throw new Error(`Failed to fetch sprint: ${err.message}`);
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
    const res = await jiraAxios.get(`/rest/api/3/board`);
    const boards = res.data.values || [];
    const board = boards.find(b => b.type === 'scrum');
    
    if (!board) {
      throw new Error('No Scrum board found');
    }

    const sprintRes = await jiraAxios.get(`/rest/api/3/board/${board.id}/sprint`);
    let sprints = sprintRes.data.values || [];
    
    if (!includeInactive) {
      sprints = sprints.filter(s => s.state === 'active' || s.state === 'future');
    }
    
    return sprints;
  } catch (err) {
    console.error('[JIRA] Error fetching all sprints:', err.message);
    throw new Error(`Failed to fetch sprints: ${err.message}`);
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
    const res = await jiraAxios.post('/rest/api/3/sprint/' + sprintId + '/issue', {
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

module.exports = {
  jiraAxios,
  getActiveSprint,
  getSprintByNameOrId,
  getSprintIssues,
  getAllSprints,
  createIssueWithFields,
  addIssueToSprint,
  searchIssues
};
