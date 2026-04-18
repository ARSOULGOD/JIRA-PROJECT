# Jira Project

A full-stack application designed to interact with Jira, featuring an interactive frontend wizard and a robust backend agent for managing Jira issues and data via the Jira REST API.

## 🏗 Architecture

The project is split into two primary components:

1. **Frontend (`/jira-frontend`)**: 
   - A React-based user interface (`IssueWizard.jsx`) providing an interactive wizard for managing issues.
   - Served via a lightweight Express server (`serve.js`) in development and tailored for Vercel deployment (`vercel.json`) in production.

2. **Backend Agent (`/jira-agent`)**:
   - A Node.js/Express application acting as the intermediary agent.
   - Handles authentication and connects directly to the Jira REST API using Axios.
   - Provides various endpoints to fetch, create, and update Jira issues.
   - Ready for deployment on Render (`render.yaml`).

## 🛠 Tools & Technologies

* **Backend**: Node.js, Express.js
* **Frontend**: React (JSX), HTML/CSS
* **HTTP Client**: Axios
* **Deployment**: 
  * Frontend: Vercel
  * Backend: Render
* **Integrations**: Jira REST API

## 📖 Implementation Details

* **Agent Design**: The `/jira-agent` subdirectory contains the core API logic (`server.js`, `index.js`). It abstracts complex Jira API calls and provides simplified endpoints for the frontend. Extensive documentation such as `API_DOCUMENTATION.md` and `IMPLEMENTATION_DETAILS.md` is available inside the agent folder.
* **Testing & Utility**: Provides testing scripts for validating endpoints safely (`test-endpoints.sh`, `test-issue-wizard.sh`, `test-issue-wizard.ps1`). Utilities are modularized under `/jira-agent/utils/`.
* **Wizard Interface**: The frontend implements a step-by-step issue creation and management flow (`IssueWizard.jsx`), which is injected into the primary `index.html`.

## 🚀 Getting Started

### Prerequisites
* Node.js (v14 or higher)
* A Jira Developer Account and an API Token.

### Setup

1. **Clone the repository** (if you haven't already):
   ```bash
   git clone https://github.com/ARSOULGOD/JIRA-PROJECT.git
   cd jira-project
   ```

2. **Backend Setup**:
   ```bash
   cd jira-agent
   npm install
   cp .env.example .env
   # Edit .env with your Jira credentials and URL
   node server.js
   ```

3. **Frontend Setup**:
   ```bash
   cd ../jira-frontend
   npm install
   node serve.js
   ```

Your backend agent will typically run on `http://localhost:3000` (or `8080`), and the frontend will serve the React interface indicating where it listens.
