require('dotenv').config();
const axios = require('axios');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const Groq = require('groq-sdk');

const { JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, JIRA_PROJECT_KEY, GEMINI_API_KEY } = process.env;

const auth   = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });


const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// ── Log file setup ────────────────────────────────────────────────────
const LOG_DIR  = path.join(__dirname, 'logs');
const LOG_FILE = path.join(LOG_DIR, `session-${new Date().toISOString().slice(0,10)}.log`);

function initLogFile() {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR);
  const header = `\n${'='.repeat(60)}\n  JIRA AGENT SESSION — ${new Date().toLocaleString()}\n${'='.repeat(60)}\n`;
  fs.appendFileSync(LOG_FILE, header);
}

function log(text) {
  fs.appendFileSync(LOG_FILE, text + '\n');
}

// ── Formatting helpers ────────────────────────────────────────────────
const divider = '─'.repeat(60);
const thin    = '·'.repeat(60);

function printHeader() {
  console.log('\n' + divider);
  console.log('  JIRA AGENT  (powered by Groq + Llama 3)');
  console.log(divider);
  console.log('  Ask anything about your team\'s work.');
  console.log(`  Logs saved to: logs/session-${new Date().toISOString().slice(0,10)}.log`);
  console.log('  Type "exit" to quit.');
  console.log(divider + '\n');
}

function formatIssue(issue, index) {
  const key      = issue.key;
  const summary  = issue.fields.summary;
  const status   = issue.fields.status.name;
  const assignee = issue.fields.assignee?.displayName || 'Unassigned';
  const updated  = new Date(issue.fields.updated).toLocaleDateString();
  return `  ${index + 1}. [${key}] ${summary}\n     Status: ${status}  |  Assignee: ${assignee}  |  Updated: ${updated}`;
}

function printAndLogResults(issues, adminQuery, jql) {
  const timestamp = new Date().toLocaleString();

  let block = '\n' + divider + '\n';
  block += `  Time  : ${timestamp}\n`;
  block += `  Query : "${adminQuery}"\n`;
  block += `  JQL   : ${jql}\n`;
  block += `  Found : ${issues.length} issue(s)\n`;
  block += divider + '\n\n';

  if (issues.length === 0) {
    block += '  No issues found. Try rephrasing your query.\n';
  } else {
    issues.forEach((issue, i) => {
      block += formatIssue(issue, i) + '\n';
      block += '  ' + thin + '\n';
    });
  }

  console.log(block);
  log(block);
  console.log(`  Saved to log: ${LOG_FILE}\n`);
}

// ── Validate .env on startup ──────────────────────────────────────────
function validateEnv() {
  const required = ['JIRA_BASE_URL', 'JIRA_EMAIL', 'JIRA_API_TOKEN', 'JIRA_PROJECT_KEY', 'GROQ_API_KEY'];
  const missing  = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error(`\nMissing .env variables: ${missing.join(', ')}`);
    console.error('Please fill them in and restart.\n');
    process.exit(1);
  }
}
// ── Convert natural language → JQL via Gemini ────────────────────────
async function generateJQL(adminQuery) {
  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 256,
      messages: [
        {
          role: 'system',
          content: `You are a Jira JQL expert. Convert the user's natural language query into a valid JQL string only.
                    Project key is ${JIRA_PROJECT_KEY}. Return ONLY the JQL, no explanation, no markdown, no backticks.`
        },
        { role: 'user', content: adminQuery }
      ]
    });
    return response.choices[0].message.content.trim();
  } catch (err) {
    if (err.status === 401) throw new Error('Groq API key is invalid. Check your GROQ_API_KEY in .env.');
    if (err.status === 429) throw new Error('Groq rate limit hit. Please wait a moment and try again.');
    throw new Error(`Groq error: ${err.message}`);
  }
}

// ── Send JQL to Jira ──────────────────────────────────────────────────
async function queryJira(jql) {
  try {
    const response = await axios.get(`${JIRA_BASE_URL}/rest/api/3/search/jql`, {
      auth: {
        username: process.env.JIRA_EMAIL,
        password: process.env.JIRA_API_TOKEN
      },
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      params: {
        jql,
        maxResults: 20,
        fields: 'summary,status,assignee,updated'
      }
    });
    return response.data.issues;
  } catch (err) {
    console.log('  Jira status:', err.response?.status);
    console.log('  Jira detail:', JSON.stringify(err.response?.data));
    if (err.response?.status === 401) throw new Error('Jira auth failed. Check your JIRA_EMAIL and JIRA_API_TOKEN.');
    if (err.response?.status === 400) throw new Error(`Invalid JQL: "${jql}". Try rephrasing your query.`);
    if (err.response?.status === 403) throw new Error('Permission denied. Check your Jira project access.');
    if (err.response?.status === 410) throw new Error('Jira endpoint gone. Check your JIRA_BASE_URL.');
    if (err.code === 'ENOTFOUND')     throw new Error('Cannot reach Jira. Check your JIRA_BASE_URL and internet.');
    throw new Error(`Jira error: ${err.message}`);
  }
}

// ── Main handler ──────────────────────────────────────────────────────
async function handleQuery(adminQuery) {
  if (!adminQuery.trim()) {
    console.log('  Please enter a question.\n');
    return askQuestion();
  }

  console.log('\n  Thinking...');

  try {
    const jql    = await generateJQL(adminQuery);
    console.log(`  JQL: ${jql}`);
    const issues = await queryJira(jql);
    printAndLogResults(issues, adminQuery, jql);
  } catch (err) {
    const errMsg = `\n  Error: ${err.message}\n`;
    console.error(errMsg);
    log(`  [ERROR] ${new Date().toLocaleString()} — ${err.message}`);
  }

  askQuestion();
}

function askQuestion() {
  rl.question('Ask > ', async (input) => {
    if (input.toLowerCase() === 'exit') {
      log(`\n  Session ended: ${new Date().toLocaleString()}\n`);
      console.log('\n  Goodbye! Session saved to log.\n');
      rl.close();
      return;
    }
    await handleQuery(input);
  });
}

// ── Start ─────────────────────────────────────────────────────────────
validateEnv();
initLogFile();
printHeader();
askQuestion();