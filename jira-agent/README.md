# Jira AI Agent

An AI-powered assistant that lets you query your Jira project using plain English.
Built with Node.js, Groq (Llama 3), and the Jira REST API.

## Features

- Natural language to JQL conversion via Groq AI
- Live Jira API integration
- Web UI with JWT authentication
- Auto session logging
- Full error handling

## Tech Stack

- **Backend:** Node.js, Express
- **AI:** Groq API (Llama 3.3-70b)
- **Jira:** Atlassian REST API v3
- **Auth:** JWT tokens
- **Frontend:** HTML, CSS, JavaScript

## Setup

### 1. Clone the repo

git clone https://github.com/YOUR_USERNAME/jira-ai-agent.git
cd jira-ai-agent

### 2. Install dependencies

npm install

### 3. Create your .env file

cp .env.example .env

Fill in your values:
JIRA_BASE_URL=https://rinawarnav.atlassian.net

JIRA_EMAIL=your-email@example.com

JIRA_API_TOKEN=YOUR_JIRA_API_TOKEN_HERE

JIRA_PROJECT_KEY=YOUR_PROJECT_KEY

GROQ_API_KEY=YOUR_GROQ_API_KEY_HERE

ADMIN_USERNAME=admin

ADMIN_PASSWORD=your-password-here

PORT=3000

JWT_SECRET=your-jwt-secret-here

### 4. Run the server

node server.js

### 5. Open in browser

http://localhost:5174

## Project Structure

jira-ai-agent/
├── server.js # Express backend with JWT auth
├── index.js # Terminal version of the agent
├── public/
│ └── index.html # Web UI with login page
├── logs/ # Auto-generated session logs
├── .env.example # Example environment variables
└── README.md

## How It Works

1. Admin logs in via the web UI
2. Types a natural language query
3. Groq AI converts it to JQL
4. Agent fetches results from Jira API
5. Results displayed in the browser
