#!/usr/bin/env node

// Simple test script for issue-wizard endpoint
const http = require('http');

const BASE_URL = 'http://localhost:3000';

// Helper function to make HTTP requests
function makeRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(data)
          });
        } catch (err) {
          resolve({
            status: res.statusCode,
            data: data
          });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

async function test() {
  try {
    console.log('[1] Testing login...');
    const loginRes = await makeRequest('POST', '/login', {
      username: 'arnav',
      password: 'arnav123'
    });
    console.log(`Login status: ${loginRes.status}`);
    const token = loginRes.data.token;
    console.log(`Token: ${token.substring(0, 30)}...`);

    console.log('\n[2] Testing /health...');
    const healthRes = await makeRequest('GET', '/health');
    console.log(`Health status: ${healthRes.status}`);
    console.log(`Health: ${JSON.stringify(healthRes.data)}`);

    console.log('\n[3] Testing /issue-wizard (initialize)...');
    const wizardRes = await makeRequest('POST', '/issue-wizard', {}, token);
    console.log(`Wizard status: ${wizardRes.status}`);
    console.log(`Wizard response: ${JSON.stringify(wizardRes.data, null, 2)}`);

    if (wizardRes.data.sessionId) {
      const sessionId = wizardRes.data.sessionId;
      console.log(`\n[4] Testing /issue-wizard (provide summary)...`);
      const step2 = await makeRequest('POST', '/issue-wizard', {
        sessionId,
        response: 'Fix login button issue'
      }, token);
      console.log(`Step 2 status: ${step2.status}`);
      console.log(`Step 2 response: ${JSON.stringify(step2.data, null, 2)}`);

      console.log('\n[5] Testing /issue-wizard (provide priority)...');
      const step3 = await makeRequest('POST', '/issue-wizard', {
        sessionId,
        response: 'High'
      }, token);
      console.log(`Step 3 status: ${step3.status}`);
      console.log(`Step 3 response: ${JSON.stringify(step3.data, null, 2)}`);
    }

    console.log('\n✅ Tests completed successfully!');
  } catch (err) {
    console.error('❌ Test failed:', err);
  }
}

test();
