import React, { useState, useEffect } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { Coins, ArrowLeft, Database, Zap, Play } from "lucide-react"
import PayoffMatrix from "./components/PayoffMatrix"
import { gameApi, getPlayerFingerprint } from "./services/gameApi"
import "./CustomExperimentHome.css"

function CustomExperimentHome() {
  const { id } = useParams()
  const [experiment, setExperiment] = useState(null)
  const [activeTab, setActiveTab] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isLaunching, setIsLaunching] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    // Force consent check
    const consentAccepted = sessionStorage.getItem(`consent_${id}`)
    if (consentAccepted !== "accepted") {
      navigate(`/experiments/${id}/consent`)
    } else {
      fetchExperiment()
    }
  }, [id, navigate])

  const fetchExperiment = async () => {
    try {
      const token = localStorage.getItem("token")
      const detailResp = await fetch(`/api/custom-rooms/experiments/${id}/`, {
         headers: token ? { "Authorization": `Bearer ${token}` } : {}
      })
      if (detailResp.ok) {
         setExperiment(await detailResp.json())
      }
    } catch (err) {
      console.error("Home fetch error:", err)
    } finally {
      setIsLoading(false)
    }
  }
  
  const handleLaunchGame = async () => {
    try {
      setIsLaunching(true)
      const fp = getPlayerFingerprint()

      const selectedCondition = conditions[activeTab]
      const conditionId = selectedCondition ? selectedCondition.id : null

      if (experiment.game_type === 'public_goods') {
        // Navigate to specialized matchmaking page for PGG
        navigate(`/public-goods/matchmaking?room=basic&mode=online&experiment_id=${experiment.id}&condition_id=${conditionId || ''}`)
        return;
      }
      if (experiment.game_type === 'common_pool') {
        // Navigate to specialized matchmaking page for CPR
        navigate(`/common-pool/matchmaking?room=basic&mode=online&experiment_id=${experiment.id}&condition_id=${conditionId || ''}`)
        return;
      }

      let data = null;
      if (experiment.game_type === 'ultimatum') {
        data = await gameApi.matchmakeCustomUltimatum(id, fp, conditionId)
      } else {
        // Strategic Games (prisoner / 2x2)
        data = await gameApi.matchmakeCustomTheGame(id, fp, conditionId)
      }

      if (data && data.match_id) {
        let finalUrl = ""
        if (experiment.game_type === 'ultimatum') {
          finalUrl = `/ultimatum/game?match=${data.match_id}&experiment=${id}&mode=online`
        } else {
          finalUrl = `/prisoners/game/${data.match_id}?experiment=${id}&mode=online`
        }
        navigate(finalUrl)
      }
    } catch (err) {
      console.error("Matchmaking error:", err)
      alert(`Error joining game: ${err.message || 'Unknown error'}`)
    } finally {
      setIsLaunching(false)
    }
  }

  if (isLoading) {
    return (
      <div className="hub-loading">
        <Database size={48} className="pulse-icon" />
        <p>Preparing the room...</p>
      </div>
    )
  }

  if (!experiment) return <div className="hub-error">Study not found.</div>

  const conditions = [
    ...(experiment.prisoner_conditions || []),
    ...(experiment.ultimatum_conditions || []),
    ...(experiment.public_goods_conditions || []),
    ...(experiment.common_pool_conditions || [])
  ]

  const currentCondition = conditions[activeTab] || {}

  const renderStage2Rules = (cond) => {
    switch (cond.room_type) {
      case "punishment":
        return (
          <>
            <li>After seeing all contributions, you may punish any of the other players (or punish no one).</li>
            <li>For each punishment: Punisher pays <b>{cond.punishment_cost} units</b>, Target loses <b>{cond.punishment_value} units</b>.</li>
            <li>Then the round ends.</li>
          </>
        )
      case "reward":
        return (
          <>
            <li>After seeing all contributions, you may reward any of the other players (or reward no one).</li>
            <li>For each reward: Giver pays <b>{cond.reward_cost} units</b>, Target gains <b>{cond.reward_value} units</b>.</li>
            <li>Then the round ends.</li>
          </>
        )
      case "mixed":
        return (
          <>
            <li>After seeing all contributions, for each of the other players, choose exactly one action:</li>
            <ul>
              <li>Reward: pay <b>{cond.reward_cost}</b>, target gains <b>{cond.reward_value}</b></li>
              <li>Punish: pay <b>{cond.punishment_cost}</b>, target loses <b>{cond.punishment_value}</b></li>
              <li>Do nothing</li>
            </ul>
            <li>Then the round ends.</li>
          </>
        )
      default:
        return null
    }
  }

  const renderInformationRules = (cond) => {
    if (cond.room_type === "basic") {
      return (
        <>
          <li>After payoff is computed, the round ends immediately.</li>
          <li>Move to the next round.</li>
        </>
      )
    }
    return (
      <>
        <li>You will learn if someone rewarded or punished <strong>you</strong>.</li>
        <li>You will not see actions taken toward other players.</li>
      </>
    )
  }

  const renderPublicGoodsContent = () => (
    <div className="how-to-play-card">
      <div className="how-to-play-header">
        <Coins className="how-to-play-icon" />
        <h2 className="how-to-play-title">How to Play</h2>
      </div>

      <div className="how-to-play-steps">
        <div className="step">
          <div className="step-number"><span>1</span></div>
          <h3 className="step-title">Receive Your Endowment</h3>
          <p className="step-description">At the start of each round, you receive <b>{currentCondition.endowment || 20} units</b>.</p>
        </div>
        <div className="step">
          <div className="step-number"><span>2</span></div>
          <h3 className="step-title">Choose Your Contribution</h3>
          <p className="step-description">Decide how much (0–{currentCondition.endowment || 20}) to contribute to the public pool.</p>
        </div>
        <div className="step">
          <div className="step-number"><span>3</span></div>
          <h3 className="step-title">See the Outcome</h3>
          <p className="step-description">The total contribution is increased and shared equally among all players.</p>
        </div>
      </div>

      <div className="how-to-play-instructions">
         <div className="instruction-section">
            <div className="instruction-details">
              <h4>Stage 1 — Contribution</h4>
              <ul>
                <li>Each player receives <strong>{currentCondition.endowment || 20} units</strong>.</li>
                <li>Each player chooses a contribution <strong>c ∈ [0, {currentCondition.endowment || 20}]</strong>.</li>
                <li>The total pool is multiplied by <strong>{currentCondition.multiplier || 1.6}</strong>.</li>
                <li>The result is split equally among all players.</li>
                <li>Per player payoff after Stage 1: <strong>({currentCondition.endowment || 20} − own contribution) + ({currentCondition.multiplier || 1.6} × total contributions / 4)</strong></li>
              </ul>
            </div>

            {currentCondition.room_type !== "basic" && (
              <div className="instruction-details">
                <h4>Stage 2 — Room Rules</h4>
                <ul>{renderStage2Rules(currentCondition)}</ul>
              </div>
            )}

            <div className="instruction-details">
              <h4>Information</h4>
              <ul>{renderInformationRules(currentCondition)}</ul>
            </div>
         </div>
      </div>
       <div className="rule-box">
         <div className="rule-item"><span>Your Balance:</span><strong>{currentCondition.endowment || 20} Coins</strong></div>
         <div className="rule-item"><span>Pool Multiplier:</span><strong>×{currentCondition.multiplier || 1.6}</strong></div>
         <div className="rule-item"><span>Total Rounds:</span><strong>{currentCondition.rounds || 10}</strong></div>
      </div>
    </div>
  )

  const renderCommonPoolContent = () => (
    <div className="how-to-play-card">
      <div className="how-to-play-header">
        <Coins className="how-to-play-icon" />
        <h2 className="how-to-play-title">How to Play</h2>
      </div>

      <div className="how-to-play-steps">
        <div className="step">
          <div className="step-number"><span>1</span></div>
          <h3 className="step-title">Fish Stock</h3>
          <p className="step-description">The lake starts with <b>{currentCondition.initial_fish_stock || 100} fish</b>.</p>
        </div>
        <div className="step">
          <div className="step-number"><span>2</span></div>
          <h3 className="step-title">Choose Extraction</h3>
          <p className="step-description">Decide how many fish (0–{currentCondition.max_extraction || 10}) to catch from the lake.</p>
        </div>
        <div className="step">
          <div className="step-number"><span>3</span></div>
          <h3 className="step-title">Lake Replenishment</h3>
          <p className="step-description">Remaining fish spawn new offspring, replenishing the lake up to <b>{currentCondition.max_fish_stock || 100} fish</b>.</p>
        </div>
      </div>

      <div className="how-to-play-instructions">
         <div className="instruction-section">
            <div className="instruction-details">
              <h4>Stage 1 — Harvest</h4>
              <ul>
                <li>Lake holds up to <strong>{currentCondition.max_fish_stock || 100} fish</strong>.</li>
                <li>Each player requests to catch <strong>0–{currentCondition.max_extraction || 10} fish</strong>.</li>
                <li>If the total requested exceeds the stock, catches are scaled down proportionally.</li>
                <li>Remaining fish reproduce: <strong>new born = 0.8 × remaining × (1 − remaining / {currentCondition.max_fish_stock || 100})</strong>.</li>
                <li>Payoff per round: <strong>1 point per fish caught</strong> (+ final stock bonus at the end).</li>
              </ul>
            </div>

            {currentCondition.room_type !== "basic" && (
              <div className="instruction-details">
                <h4>Stage 2 — Room Rules</h4>
                <ul>{renderStage2Rules(currentCondition)}</ul>
              </div>
            )}

            <div className="instruction-details">
              <h4>Information</h4>
              <ul>{renderInformationRules(currentCondition)}</ul>
            </div>
         </div>
      </div>
       <div className="rule-box">
         <div className="rule-item"><span>Max Catch/Rd:</span><strong>{currentCondition.max_extraction || 10} Fish</strong></div>
         <div className="rule-item"><span>End Game Bonus:</span><strong>{currentCondition.final_bonus_multiplier || 0.4} × final stock</strong></div>
         <div className="rule-item"><span>Total Rounds:</span><strong>{currentCondition.rounds || 20}</strong></div>
      </div>
    </div>
  )

  const renderPrisonerContent = () => (
    <div className="game-rules-container">
      <div className="how-to-play-card">
        <div className="how-to-play-header">
          <Zap className="how-to-play-icon" />
          <h2 className="how-to-play-title">How to Play</h2>
        </div>
        <div className="how-to-play-steps">
          <div className="step">
            <div className="step-number"><span>1</span></div>
            <h3 className="step-title">Choose Your Action</h3>
            <p className="step-description">Each round, decide whether to Cooperate or Defect within 15 seconds.</p>
          </div>
          <div className="step">
            <div className="step-number"><span>2</span></div>
            <h3 className="step-title">See the Results</h3>
            <p className="step-description">Points are awarded based on both players' choices.</p>
          </div>
          <div className="step">
            <div className="step-number"><span>3</span></div>
            <h3 className="step-title">Play {currentCondition.rounds || 25} Rounds</h3>
            <p className="step-description">Accumulate points across multiple rounds to win.</p>
          </div>
          <div className="step">
            <div className="step-number"><span>4</span></div>
            <h3 className="step-title">Time Limit</h3>
            <p className="step-description">You have 15 seconds per round to make your choice.</p>
          </div>
        </div>
      </div>

      <div className="payoff-section">
        <h3 className="payoff-title">Payoff Matrix</h3>
        <div className="matrix-wrapper">
           <PayoffMatrix 
              customPayoffs={{
                 p1_cc: currentCondition.p1_cc, p2_cc: currentCondition.p2_cc,
                 p1_cd: currentCondition.p1_cd, p2_cd: currentCondition.p2_cd,
                 p1_dc: currentCondition.p1_dc, p2_dc: currentCondition.p2_dc,
                 p1_dd: currentCondition.p1_dd, p2_dd: currentCondition.p2_dd
              }}
           />
        </div>
      </div>
    </div>
  )

  const renderUltimatumContent = () => {
    const isOneShot = currentCondition.game_type === "one_shot"
    const endowment = currentCondition.endowment || 100
    const rounds = currentCondition.rounds || 10

    return (
      <div className="how-to-play-card">
        <div className="how-to-play-header">
          <Coins className="how-to-play-icon" />
          <h2 className="how-to-play-title">How to Play ({isOneShot ? "One-Shot" : "Iterative"})</h2>
        </div>
        <div className="how-to-play-steps">
          <div className="step">
            <div className="step-number"><span>1</span></div>
            <h3 className="step-title">{isOneShot ? "Player 1 Proposes" : "Make an Offer"}</h3>
            <p className="step-description">
              {isOneShot 
                ? `Player 1 decides how much of the ${endowment} coins to offer to Player 2` 
                : `Decide how much of the ${endowment} coins to offer your opponent`}
            </p>
          </div>
          <div className="step">
            <div className="step-number"><span>2</span></div>
            <h3 className="step-title">{isOneShot ? "Player 2 Decides" : "Wait for Decision"}</h3>
            <p className="step-description">
              {isOneShot 
                ? "Player 2 accepts or rejects the offer" 
                : "Your opponent will accept or reject your offer"}
            </p>
          </div>
          <div className="step">
            <div className="step-number"><span>3</span></div>
            <h3 className="step-title">Get Results</h3>
            <p className="step-description">
              {isOneShot 
                ? "If accepted, the split is paid. If rejected, both get 0." 
                : "Earn coins for accepted offers. Rejected offers yield 0."}
            </p>
          </div>
        </div>

        <div className="how-to-play-instructions">
          <div className="instruction-section">
            <p className="instruction-intro">
              {isOneShot ? (
                <span>You are about to play a <strong>single (1) round</strong> of the classic Ultimatum Game. Roles (proposer or responder) are assigned randomly.</span>
              ) : (
                <span>You are about to play <strong>{rounds} rounds</strong> of a two-simultaneous ultimatum game.</span>
              )}
            </p>
            
            <div className="instruction-details">
              <h4>Rules:</h4>
              {isOneShot ? (
                <ul>
                  <li>The Proposer is given <strong>{endowment} coins</strong>.</li>
                  <li>The Proposer decides on an offer to give the Responder (between 0 and {endowment}).</li>
                  <li>The Responder sees the offer and chooses to <strong>accept or reject it</strong>.</li>
                  <li>If the Responder accepts: the Proposer gets {endowment} - offer, and Responder gets the offer.</li>
                  <li>If the Responder rejects: both players receive <strong>0 coins</strong>.</li>
                </ul>
              ) : (
                <ul>
                  <li>In each round, you will <strong>make an offer</strong>: decide how to split {endowment} coins.</li>
                  <li>The other player will also make an offer at the same time.</li>
                  <li>Then, you'll see the other player's offer and choose to <strong>accept or reject it</strong>.</li>
                  <li>At the same time, the other player will decide whether to accept your offer.</li>
                  <li>Proposals are only valid if they are accepted. If a proposal is rejected, no coins are given from it.</li>
                </ul>
              )}
            </div>
            
            {!isOneShot && (
              <div className="examples-section">
                <h4>Examples (Iterative):</h4>
                
                <div className="example">
                  <h5><strong>Example 1: Both offers accepted</strong></h5>
                  <p>You offer: keep 40%, give 60% → they accept</p>
                  <p>They offer: keep 70%, give 30% → you accept</p>
                  <p className="example-result">✅ You earn: {Math.floor(endowment * 0.4)} + {Math.floor(endowment * 0.3)} = <strong>{Math.floor(endowment * 0.7)} coins</strong></p>
                </div>
                
                <div className="example">
                  <h5><strong>Example 2: You reject, they accept</strong></h5>
                  <p>You offer: keep 80%, give 20% → they accept</p>
                  <p>They offer: keep 90%, give 10% → you reject</p>
                  <p className="example-result">✅ You earn: {Math.floor(endowment * 0.8)} + 0 = <strong>{Math.floor(endowment * 0.8)} coins</strong></p>
                </div>
                
                <div className="example">
                  <h5><strong>Example 3: Both offers rejected</strong></h5>
                  <p>Both of you reject each other's offer</p>
                  <p className="example-result">❌ You earn: <strong>0 coins</strong></p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="hub-page">
      <div className="hub-container">
        <div className="hub-header">
          <Link to="/join-custom" className="back-link">
            <ArrowLeft size={18} /> Back to Lobby
          </Link>
          <div className="study-branding">
            <h1 className="study-title">{experiment.name}</h1>
            <p className="host-by">
              Hosted by {experiment.creator_username || 'Research Team'} • 
              {experiment.game_type === 'prisoner' ? ' 2X2 ECONOMIC GAMES' : ` ${experiment.game_type?.toUpperCase().replace('_', ' ')}`}
            </p>
          </div>
        </div>

        {conditions.length > 1 && (
          <div className="condition-tabs">
            {conditions.map((_, idx) => (
              <button 
                key={idx} 
                className={`tab-btn ${activeTab === idx ? "active" : ""}`} 
                onClick={() => setActiveTab(idx)}
              >
                Condition {idx + 1}
              </button>
            ))}
          </div>
        )}

        <div className="hub-main">
          {experiment.game_type === 'prisoner' && renderPrisonerContent()}
          {experiment.game_type === 'ultimatum' && renderUltimatumContent()}
          {experiment.game_type === 'public_goods' && renderPublicGoodsContent()}
          {experiment.game_type === 'common_pool' && renderCommonPoolContent()}
        </div>

        <div className="hub-actions">
           <button 
             className="play-study-btn" 
             onClick={handleLaunchGame}
             disabled={isLaunching}
           >
              <Play size={24} fill="currentColor" />
              {isLaunching ? "Connecting..." : "Start a game"}
           </button>
        </div>
      </div>
    </div>
  )
}

export default CustomExperimentHome
