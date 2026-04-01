import { useState, useEffect } from 'react'
import Login from './components/Login'
import Dashboard from './components/Dashboard'

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)

  // Load token from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('jiraToken')
    const savedUser = localStorage.getItem('jiraUser')
    if (savedToken && savedUser) {
      setToken(savedToken)
      setUser(JSON.parse(savedUser))
      setIsLoggedIn(true)
    }
  }, [])

  const handleLogin = (userData, jwtToken) => {
    setUser(userData)
    setToken(jwtToken)
    setIsLoggedIn(true)
    // Store in localStorage for persistence
    localStorage.setItem('jiraToken', jwtToken)
    localStorage.setItem('jiraUser', JSON.stringify(userData))
  }

  const handleLogout = () => {
    setUser(null)
    setToken(null)
    setIsLoggedIn(false)
    // Clear localStorage
    localStorage.removeItem('jiraToken')
    localStorage.removeItem('jiraUser')
  }

  return (
    <>
      {isLoggedIn ? (
        <Dashboard user={user} token={token} onLogout={handleLogout} />
      ) : (
        <Login onLogin={handleLogin} />
      )}
    </>
  )
}

export default App
