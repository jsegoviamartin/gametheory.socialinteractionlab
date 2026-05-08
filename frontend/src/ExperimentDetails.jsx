import React, { useState, useEffect } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { ArrowLeft, PlusCircle, Database, Settings, Layers, TrendingUp, Trash2 } from "lucide-react"
import "./ExperimentDetails.css"

function ExperimentDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [experiment, setExperiment] = useState(null)
  const [conditions, setConditions] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(0)

  useEffect(() => {
    fetchExperiment()
  }, [id])

  const fetchExperiment = async () => {
    const token = localStorage.getItem("access_token")
    try {
      const resp = await fetch(`/api/custom-rooms/experiments/${id}/`, {
        headers: { "Authorization": `Bearer ${token}` }
      })
      if (resp.ok) {
        const data = await resp.json()
        setExperiment(data)
        const allConditions = [
          ...(data.prisoner_conditions || []),
          ...(data.ultimatum_conditions || []),
          ...(data.public_goods_conditions || [])
        ]
        setConditions(allConditions)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const deleteCondition = async (conditionId) => {
    if (!window.confirm("Are you sure you want to delete this specific condition?")) return
    const token = localStorage.getItem("access_token")
    try {
      const resp = await fetch(`/api/custom-rooms/experiments/${id}/delete_condition/?condition_id=${conditionId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      })
      if (resp.ok) {
        fetchExperiment()
        setActiveTab(0)
      }
    } catch (err) {
      console.error(err)
    }
  }

  if (isLoading) {
    return (
      <div className="details-page">
        <div className="lab-sync-view">
          <div className="sync-node">
            <Database size={48} className="pulse-icon" />
            <div className="sync-text-group">
              <h2 className="sync-title">Loading study details...</h2>
              <p className="sync-subtitle">Just a moment while we set things up.</p>
            </div>
          </div>
        </div>
      </div>
    )
  }
  if (!experiment) return null

  const currentCondition = conditions[activeTab]

  const getActionLabels = (roomName) => {
    if (roomName === "Stag Hunt") return { a: "Stag", b: "Hare" }
    if (roomName && roomName.includes("Battle")) return { a: "A", b: "B" }
    return { a: "Cooperate", b: "Defect" }
  }

  const { a, b } = currentCondition ? getActionLabels(currentCondition.room_name) : { a: "A", b: "B" }

  return (
    <div className="details-page">
      <Link to="/dashboard" className="back-link">
        <ArrowLeft size={18} /> Back
      </Link>

      <div className="details-container">
        <div className="project-header">
          <div className="project-info">
            <span className={`game-badge ${experiment.game_type}`}>
              {experiment.game_type === 'prisoner' ? '2x2 Game' : experiment.game_type.replace('_', ' ')}
            </span>
            <h1 className="project-title">{experiment.name}</h1>
          </div>
          <button 
            className="add-cond-btn"
            onClick={() => navigate(`/create-experiment?experimentId=${experiment.id}&gameType=${experiment.game_type}`)}
          >
            <PlusCircle size={20} />
            Add Condition
          </button>
        </div>

        {/* Tab Selection */}
        <div className="condition-tabs">
          {conditions.map((cond, idx) => (
            <button 
              key={cond.id || idx} 
              className={`tab-btn ${activeTab === idx ? 'active' : ''}`}
              onClick={() => setActiveTab(idx)}
            >
              {cond.condition_name}
            </button>
          ))}
          {conditions.length === 0 && (
            <div className="empty-tabs">No conditions yet.</div>
          )}
        </div>

        {/* Details View */}
        {currentCondition && (
          <div className="condition-workspace">
            <div className="workspace-header">
              <div className="header-label">
                <Database size={16} />
                <span>Condition Rules</span>
              </div>
              <button className="delete-cond-btn" onClick={() => deleteCondition(currentCondition.id)}>
                <Trash2 size={16} />
                Delete Condition
              </button>
            </div>

            <div className="params-grid">
              <div className="param-group">
                <h4>Rounds</h4>
                <div className="stat-card">
                  <span className="stat-label">Total Rounds</span>
                  <span className="stat-val">{currentCondition.rounds}</span>
                </div>
              </div>

              {experiment.game_type === 'prisoner' && (
                <div className="param-group wide">
                  <h4>Matrix: {currentCondition.room_name}</h4>
                  <div className="read-only-matrix">
                    <div className="m-cell empty"></div>
                    <div className="m-head">{a}</div>
                    <div className="m-head">{b}</div>
                    <div className="m-side">{a}</div>
                    <div className="m-val">{currentCondition.p1_cc} / {currentCondition.p2_cc}</div>
                    <div className="m-val">{currentCondition.p1_cd} / {currentCondition.p2_cd}</div>
                    <div className="m-side">{b}</div>
                    <div className="m-val">{currentCondition.p1_dc} / {currentCondition.p2_dc}</div>
                    <div className="m-val">{currentCondition.p1_dd} / {currentCondition.p2_dd}</div>
                  </div>
                </div>
              )}

              {experiment.game_type === 'ultimatum' && (
                <div className="param-group">
                  <h4>Money Settings</h4>
                  <div className="stat-card">
                    <span className="stat-label">Endowment</span>
                    <span className="stat-val">{currentCondition.endowment}</span>
                  </div>
                </div>
              )}

              {experiment.game_type === 'public_goods' && (
                <div className="param-group">
                  <h4>Interaction Rules</h4>
                  <div className="stat-card">
                    <span className="stat-label">Room Type</span>
                    <span className="stat-val capitalize">{currentCondition.room_type}</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-label">Money</span>
                    <span className="stat-val">{currentCondition.endowment}</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-label">Multiplier</span>
                    <span className="stat-val">x{currentCondition.multiplier}</span>
                  </div>
                  {currentCondition.room_type !== 'basic' && (
                    <>
                      <div className="stat-card">
                        <span className="stat-label">Reward (Ratio)</span>
                        <span className="stat-val">{currentCondition.reward_cost} : {currentCondition.reward_value}</span>
                      </div>
                      <div className="stat-card">
                        <span className="stat-label">Punishment (Ratio)</span>
                        <span className="stat-val">{currentCondition.punishment_cost} : {currentCondition.punishment_value}</span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ExperimentDetails
