import { useState, useEffect } from 'react'
import './App.css'

interface User {
  id: number
  firstName: string
  lastName: string
}

const API_URL =
  import.meta.env.VITE_API_URL ||
  'https://intexbackend-dragb9ahdsfvejfe.centralus-01.azurewebsites.net'

function App() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${API_URL}/api/users`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => setUsers(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="container">
      <h1>Our Team</h1>
      <p className="subtitle">Meet the people behind the project</p>

      {loading && <p className="status">Loading...</p>}
      {error && <p className="status error">Error: {error}</p>}

      <div className="user-list">
        {users.map((user) => (
          <div key={user.id} className="user-card">
            <div className="avatar">
              {user.firstName[0]}
              {user.lastName[0]}
            </div>
            <div className="user-info">
              <span className="user-name">
                {user.firstName} {user.lastName}
              </span>
              <span className="user-role">Team Member</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default App
