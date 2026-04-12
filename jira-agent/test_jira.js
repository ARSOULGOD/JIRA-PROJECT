// test-jira.js
require('dotenv').config();
const axios = require('axios');

const { JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, JIRA_PROJECT_KEY } = process.env;

async function test() {
  try {
    const response = await axios.get(`${JIRA_BASE_URL}/rest/api/3/search/jql`, {
      auth: {
        username: JIRA_EMAIL,
        password: JIRA_API_TOKEN
      },
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      params: {
        jql: `project = ${JIRA_PROJECT_KEY}`,
        maxResults: 5,
        fields: 'summary,status,assignee'
      }
    });
    console.log('Search works! Issues found:', response.data.total);
    response.data.issues.forEach(i => {
      console.log(`- [${i.key}] ${i.fields.summary}`);
    });
  } catch (err) {
    console.log('Status:', err.response?.status);
    console.log('Error:', JSON.stringify(err.response?.data, null, 2));
  }
}

test();