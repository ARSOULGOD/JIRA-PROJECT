# Jira AI Agent Project

A full-stack AI-powered command center application designed to natively interact with Jira. It features a chat-like interactive frontend and a robust LLM-driven backend agent to manage Jira issues, extract unstructured data, and generate project reports.

## 🏗 High-Level Architecture

The project is an AI-powered project management assistant with two primary components:

1. **Frontend Command Center (`/jira-frontend`)**: 
   - A single-page web interface (`index.html`) using **Tailwind CSS** and Lucide icons.
   - A **React-based component** (`IssueWizard.jsx`) providing a step-by-step interactive conversational loop for user inputs.
   - Served via a lightweight Express server (`serve.js`) locally and optimized for **Vercel** deployment (`vercel.json`) in production.

2. **Backend Agent Node (`/jira-agent`)**:
   - A Node.js/Express API (`server.js`) acting as the intelligent intermediary.
   - Integrates **Groq** running the `llama-3.3-70b-versatile` model to parse natural language instructions into actionable strict JSON output.
   - Connects directly to the Jira REST API using Axios with Basic Auth.
   - Ready for scalable deployment on **Render** (`render.yaml`).

## 🛠 Core Technology Stack

* **AI Engine**: Groq SDK + Llama-3.3-70b-versatile
* **Backend**: Node.js, Express.js
* **Frontend**: React (JSX), HTML, Tailwind CSS
* **HTTP Client**: Axios
* **Report Generation**: PDFKit (`pdf-generator.js`)
* **Deployment**: Vercel (Client) & Render (API Server)
* **Integrations**: Jira REST API

## 📖 Deep Implementation Details

### Key Features & Endpoints

* **AI Command Parsing (`/action`)**: Takes unstructured natural-language prompts (e.g., *"assign the final report to Arnav"* or *"generate sprint 2 report"*). It sends the prompt to Groq configured with specialized system instructions demanding strict JSON output. This JSON triggers explicit Jira utility functions (like `create`, `create_sprint`, `update_status`, `assign`, `generate_report`, and `delete`).
* **Interactive Issue Wizard (`/issue-wizard`)**: A conversational loop endpoint that guides a user step-by-step to flesh out Jira tickets correctly, interactively prompting for missing info like descriptions or assignees.
* **Smart Issue Creation (`/create-issue-smart`)**: Allows users to dump unstructured text (like raw meeting notes). The AI intelligently extracts summaries, descriptions, priorities, and assignees to instantly spawn tickets.
* **Automated Sprint PDF Reporting**: A standout module (`utils/pdf-generator.js`) that queries a specific Jira sprint, calculates priority, issue-type, and status statistics, and outputs a downloadable PDF visual summary report. 

### Agent Utility Structure (`/jira-agent/utils/`)

Helper functions keep the core server clean:
- `jira-helpers.js`: Wraps sophisticated Jira API JQL searches, active sprint fetching (via explicit or partial name matching), user assignment, and data aggregation.
- `jira-api.js`: Handles backend HTTP configurations for Axios requests mapping to the given Jira instance.

## 🚀 Getting Started

### Prerequisites
* Node.js (v14 or higher)
* A Jira Developer Account and an API Token
* A **Groq API Key** for LLM functionality

### Setup Instructions

1. **Clone the repository**:
   ```bash
   git clone https://github.com/ARSOULGOD/JIRA-PROJECT.git
   cd jira-project
   ```

2. **Backend Setup**:
   ```bash
   cd jira-agent
   npm install
   cp .env.example .env
   # Add your JIRA_EMAIL, JIRA_API_TOKEN, JIRA_BASE_URL, JIRA_PROJECT_KEY, and GROQ_API_KEY
   node server.js
   # Server runs on http://localhost:3000
   ```

3. **Frontend Setup**:
   ```bash
   cd ../jira-frontend
   npm install
   node serve.js
   # Frontend runs natively on http://localhost:8080 (or port matched by script)
   ```

### Running Tests
The backend provides shell/Powershell scripts under `/jira-agent` (e.g. `test-endpoints.sh`, `test-issue-wizard.sh`) mimicking AI chat loops and testing connectivity flows securely against your project sandbox.
