import { useState } from 'react'
import IssueCard from './IssueCard'
import styles from './Dashboard.module.css'

function Dashboard({ user, token, onLogout }) {
  const [query, setQuery] = useState('')
  const [issues, setIssues] = useState([])
  const [jql, setJql] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hasQueried, setHasQueried] = useState(false)

  const handleQuerySubmit = async (e) => {
    e.preventDefault()

    if (!query.trim()) {
      setError('Please enter a question')
      return
    }

    setError('')
    setLoading(true)
    setHasQueried(true)

    try {
      // Call backend /query endpoint with JWT token
      const response = await fetch('http://localhost:3000/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ question: query }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Query failed')
        setLoading(false)
        return
      }

      setJql(data.jql)
      // Transform backend response to match IssueCard props
      const transformedIssues = data.issues.map((issue) => ({
        id: issue.key,
        title: issue.summary,
        description: `Status: ${issue.status} | Assignee: ${issue.assignee} | Updated: ${issue.updated}`,
        status: issue.status,
        priority: 'Medium', // Backend doesn't return priority, so default to Medium
      }))
      setIssues(transformedIssues)
    } catch (err) {
      setError('Failed to connect to server. Make sure backend is running on port 3000.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.dashboardContainer}>
      <header className={styles.header}>
        <h1>Dashboard</h1>
        <div className={styles.userInfo}>
          <span>Welcome, {user?.username}</span>
          <button className={styles.logoutBtn} onClick={onLogout}>
            Logout
          </button>
        </div>
      </header>

      <main className={styles.mainContent}>
        {/* Query Form */}
        <div className={styles.querySection}>
          <form onSubmit={handleQuerySubmit}>
            <div className={styles.queryForm}>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder='Ask something like "Show me all open issues" or "Find bugs assigned to me"'
                disabled={loading}
              />
              <button type="submit" disabled={loading}>
                {loading ? 'Searching...' : 'Ask Jira Agent'}
              </button>
            </div>
          </form>
          {jql && (
            <div className={styles.jqlDisplay}>
              <strong>Generated JQL:</strong> <code>{jql}</code>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && <div className={styles.error}>{error}</div>}

        {/* Loading State */}
        {loading && <div className={styles.loading}>Searching Jira...</div>}

        {/* Results */}
        {!loading && hasQueried && issues.length > 0 && (
          <div>
            <h2 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Found {issues.length} issue(s)</h2>
            <div className={styles.issuesGrid}>
              {issues.map((issue) => (
                <IssueCard key={issue.id} issue={issue} />
              ))}
            </div>
          </div>
        )}

        {/* No Results */}
        {!loading && hasQueried && issues.length === 0 && !error && (
          <div className={styles.emptyState}>No issues found. Try rephrasing your question.</div>
        )}
      </main>
    </div>
  )
}

export default Dashboard
