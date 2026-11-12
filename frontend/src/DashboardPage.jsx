import React, { useState, useEffect } from "react"
import { useNavigate, Link } from "react-router-dom"
import { User as UserIcon, LogOut, PlusCircle, Trash2, Database, FileSpreadsheet, Layers, FolderPlus, Clipboard, Info } from "lucide-react"
import "./DashboardPage.css"
import { getGameCsvFilename } from "./utils/downloadUtils"

const downloadOptions = [
  {
    type: "prisoner",
    label: "2x2",
    title: "2x2 Game Data",
    description: "Exports only your 2x2 economic games data in one single CSV file."
  },
  {
    type: "ultimatum",
    label: "Ultimatum",
    title: "Ultimatum Data",
    description: "Exports only your ultimatum games data in one single CSV file."
  },
  {
    type: "public_goods",
    label: "PGG",
    title: "Public Goods Data",
    description: "Exports only your public goods games data in one single CSV file."
  },
  {
    type: "common_pool",
    label: "CPR",
    title: "Common-Pool Resource Data",
    description: "Exports only your common-pool resource games data in one single CSV file."
  },
  {
    type: "all",
    label: "Download All (Combined)",
    title: "Combined Data",
    description: "Exports all your games data in one single CSV file."
  }
]

function DownloadInfo({ title, description }) {
  return (
    <span className="download-info-wrap">
      <button className="download-info-btn" type="button" aria-label={`${title}: ${description}`}>
        <Info size={14} />
      </button>
      <span className="download-info-popover" role="tooltip">
        <strong>{title}</strong>
        <span>{description}</span>
      </span>
    </span>
  )
}

function DashboardPage() {
  const [user, setUser] = useState(null)
  const [experiments, setExperiments] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    fetchUserData()
    fetchExperiments()
  }, [])

  const fetchUserData = async () => {
    const token = localStorage.getItem("access_token")
    if (!token) {
      navigate("/auth")
      return
    }

    try {
      const resp = await fetch("/api/accounts/user/", {
        headers: { "Authorization": `Bearer ${token}` },
        credentials: "include"
      })
      if (resp.ok) {
        const data = await resp.ok ? await resp.json() : null
        setUser(data)
      } else {
        localStorage.clear()
        navigate("/auth")
      }
    } catch (err) {
      console.error("Auth error", err)
    }
  }

  const fetchExperiments = async () => {
    const token = localStorage.getItem("access_token")
    try {
      const resp = await fetch("/api/custom-rooms/experiments/", {
        headers: { "Authorization": `Bearer ${token}` },
        credentials: "include"
      })
      if (resp.ok) {
        const data = await resp.json()
        setExperiments(data)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.clear()
    navigate("/")
  }

  const handleDownload = async (gameType) => {
    const token = localStorage.getItem("access_token")
    try {
      const response = await fetch(`/api/custom-rooms/experiments/download_data/?game_type=${gameType}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      })
      
      if (!response.ok) {
        alert("Failed to download data. Please make sure you have experiments with data.")
        return
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = getGameCsvFilename(response, gameType)
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error("Download error:", err)
      alert("An error occurred during download.")
    }
  }

  const handleDownloadExperiment = async (experimentId, gameType) => {
    const token = localStorage.getItem("access_token")
    try {
      const response = await fetch(`/api/custom-rooms/experiments/download_data/?experiment_id=${experimentId}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      })
      
      if (!response.ok) {
        alert("Failed to download experiment data.")
        return
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = getGameCsvFilename(response, gameType)
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error("Experiment download error:", err)
      alert("An error occurred during download.")
    }
  }


  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this experiment?")) return
    const token = localStorage.getItem("access_token")
    try {
      const resp = await fetch(`/api/custom-rooms/experiments/${id}/`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
        credentials: "include"
      })
      if (resp.ok) {
        setExperiments(experiments.filter(ex => ex.id !== id))
      }
    } catch (err) {
      console.error("Delete error", err)
    }
  }

  if (isLoading) {
    return (
      <div className="dashboard-page loading">
        <div className="hub-loading-view">
          <Database size={48} className="pulse-icon" />
          <h2 className="loading-title">Updating your room hub...</h2>
          <p className="loading-subtitle">Just a moment while we set things up.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="header-info">
          <div className="user-badge">
            <div className="user-icon-circle">
              <UserIcon size={20} />
            </div>
            <span className="user-name">Welcome, {user?.username || "Researcher"}</span>
          </div>
        </div>
        
        <div className="header-actions">
          <Link to="/" className="portal-btn">
            Portal
          </Link>
          <button onClick={handleLogout} className="logout-btn">
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="dash-hero-row">
          <div>
            <h1 className="dash-title">Customized Room Hub</h1>
            <p className="dash-subtitle">Manage your research experiments and laboratory conditions</p>
          </div>
          <div className="dash-actions-group">
            <div className="download-center">
              <span className="download-label">Download My Data:</span>
              <div className="download-btns">
                {downloadOptions.map((option) => (
                  <React.Fragment key={option.type}>
                    {option.type === "all" && <div className="download-divider"></div>}
                    <div className="download-option">
                      <button
                        className={`download-action-btn ${option.type === "all" ? "all-btn" : ""}`}
                        onClick={() => handleDownload(option.type)}
                      >
                        {option.label}
                      </button>
                      <DownloadInfo title={option.title} description={option.description} />
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>
            
            <Link to="/create-experiment" className="create-row-btn">
              <PlusCircle size={20} />
              New Experiment
            </Link>
          </div>
        </div>

        <div className="retention-warning-banner">
          <Database size={20} />
          <span>
            <strong>Please Note:</strong> All experiments and game results are saved for exactly <strong>14 days</strong> before being deleted. Please download your data files before they expire!
          </span>
        </div>

        <div className="experiments-rows-container">
          <div className="rows-header">
            <div className="col-name">Experiment Name</div>
            <div className="col-code">Secret Code</div>
            <div className="col-type">Game Type</div>
            <div className="col-stats">Conditions / mode</div>
            <div className="col-date">Created At</div>
            <div className="col-actions">Actions</div>
          </div>

          {experiments.map(exp => (
            <div key={exp.id} className="experiment-row">
              <div className="col-name">
                <span className="exp-name-val">{exp.name}</span>
                <span className="exp-row-id">ID: {exp.id.substring(0, 8)}...</span>
              </div>
              <div className="col-code">
                <div className="code-badge">
                  <code>{exp.secret_code}</code>
                  <button className="copy-mini-btn" onClick={() => {
                    navigator.clipboard.writeText(exp.secret_code)
                    alert(`Code ${exp.secret_code} copied!`)
                  }}>
                    <Clipboard size={14} />
                  </button>
                </div>
              </div>
              <div className="col-type">
                <span className={`game-type-badge ${exp.game_type}`}>
                  {exp.game_type === 'prisoner' ? '2x2 Game' : exp.game_type.replace('_', ' ')}
                </span>
              </div>
              <div className="col-stats">
                <div className="stats-pill">
                  <FileSpreadsheet size={14} />
                  <span>{
                    (exp.prisoner_conditions?.length || 0) + 
                    (exp.ultimatum_conditions?.length || 0) + 
                    (exp.public_goods_conditions?.length || 0) +
                    (exp.common_pool_conditions?.length || 0)
                  }</span>
                </div>
                <span className={`experiment-mode-badge ${exp.game_mode === "bot" ? "bot" : "online"}`}>
                  {exp.game_mode === "bot" ? "Bot mode" : "Online mode"}
                </span>
              </div>
              <div className="col-date">
                {new Date(exp.created_at).toLocaleDateString()}
              </div>
              <div className="col-actions">
                <button className="row-action-btn view" onClick={() => navigate(`/experiments/${exp.id}`)}>
                  <Layers size={18} />
                  View
                </button>
                <button className="row-action-btn download" onClick={() => handleDownloadExperiment(exp.id, exp.game_type)}>
                  <FileSpreadsheet size={18} />
                  CSV
                </button>
                <button className="row-action-btn delete" onClick={() => handleDelete(exp.id)}>
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}

          {!isLoading && experiments.length === 0 && (
            <div className="no-experiments-row">
              <FolderPlus size={48} opacity={0.3} />
              <p>No experiments found. Start by creating one!</p>
            </div>
          )}
        </div>
      </main>

      <footer className="dash-footer">
        <p>© 2026 Game Theory Platform. Built for Advanced Social Interaction Research.</p>
      </footer>
    </div>
  )
}

export default DashboardPage
