import styles from './IssueCard.module.css'

function IssueCard({ issue }) {
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'High':
        return styles.priorityHigh
      case 'Medium':
        return styles.priorityMedium
      case 'Low':
        return styles.priorityLow
      default:
        return ''
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'In Progress':
        return styles.statusInProgress
      case 'To Do':
        return styles.statusToDo
      case 'Done':
        return styles.statusDone
      default:
        return ''
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h3 className={styles.issueId}>{issue.id}</h3>
        <span className={`${styles.priority} ${getPriorityColor(issue.priority)}`}>
          {issue.priority}
        </span>
      </div>

      <h2 className={styles.title}>{issue.title}</h2>
      <p className={styles.description}>{issue.description}</p>

      <div className={styles.cardFooter}>
        <span className={`${styles.status} ${getStatusColor(issue.status)}`}>
          {issue.status}
        </span>
      </div>
    </div>
  )
}

export default IssueCard
