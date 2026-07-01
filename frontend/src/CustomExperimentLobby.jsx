import React, { useState, useEffect } from "react"
import { useNavigate, Link } from "react-router-dom"
import { ArrowLeft, Users, Play, ShieldCheck, Search, Database } from "lucide-react"
import "./CustomExperimentLobby.css"

function CustomExperimentLobby() {
  const [experiments, setExperiments] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeCodeEntry, setActiveCodeEntry] = useState(null)
  const [inputCode, setInputCode] = useState("")
  const navigate = useNavigate()

  useEffect(() => {
    fetchLobby()
  }, [])

  const fetchLobby = async () => {
    try {
      const token = localStorage.getItem("token")
      const headers = {}
      if (token) headers["Authorization"] = `Bearer ${token}`
      
      const resp = await fetch("/api/custom-rooms/experiments/lobby/", { headers })
      if (resp.ok) {
        const data = await resp.json()
        setExperiments(data)
      }
    } catch (err) {
      console.error("Lobby error:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleJoinAttempt = (exp) => {
    setActiveCodeEntry(exp.id)
    setInputCode("")
  }

  const handleJoinSubmit = (exp) => {
    if (inputCode === exp.secret_code) {
      navigate(`/experiments/${exp.id}/home`)
    } else {
      alert("Invalid Access Code. Please check with your researcher.")
    }
  }

  const filteredExperiments = experiments.filter(e => 
    e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (e.creator_username || "").toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (isLoading) {
    return (
      <div className="lobby-page">
        <div className="lobby-loading">
          <Database className="pulse-icon" size={48} />
          <p>Looking for rooms...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="lobby-page">
      <div className="lobby-header">
        <Link to="/" className="back-link">
          <ArrowLeft size={20} />
          Main Portal
        </Link>
        <div className="lobby-title-group">
          <h1>Active Research Projects</h1>
          <p>Browse available studies and enter your participant code to join.</p>
        </div>
        <div className="lobby-search">
          <Search size={18} />
          <input 
            placeholder="Search experiments or researchers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="room-list">
        {filteredExperiments.map((exp) => (
          <div key={exp.id} className="room-card">
            <div className="room-main">
              <div className="room-badge-group">
                <span className={`game-mode-tag ${exp.game_type}`}>
                  {exp.game_type === 'prisoner' ? '2x2 Game' : exp.game_type === 'ultimatum' ? 'Ultimatum' : exp.game_type === 'common_pool' ? 'Common Pool' : 'Public Goods'}
                </span>
              </div>
              <div className="room-info">
                <h3 className="room-name">{exp.name}</h3>
                <span className="host-label">Host: {exp.creator_username || 'Admin'}</span>
              </div>
            </div>

            <div className="room-action-side">
              {activeCodeEntry === exp.id ? (
                <div className="room-code-gate">
                  <input 
                    autoFocus
                    maxLength={6}
                    placeholder="Enter Code"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value)}
                  />
                  <div className="gate-btns">
                    <button className="gate-enter" onClick={() => handleJoinSubmit(exp)}>Enter</button>
                    <button className="gate-back" onClick={() => setActiveCodeEntry(null)}>Back</button>
                  </div>
                </div>
              ) : (
                <button className="room-join-btn" onClick={() => handleJoinAttempt(exp)}>
                  <Play size={18} fill="currentColor" />
                  Join Room
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredExperiments.length === 0 && !isLoading && (
        <div className="empty-lobby">
          <Database size={64} opacity={0.1} />
          <p>No studies currently match your search criteria.</p>
        </div>
      )}
    </div>
  )
}

export default CustomExperimentLobby
