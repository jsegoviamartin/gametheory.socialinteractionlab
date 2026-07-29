import { Users, Bot, Coins } from "lucide-react"
import { useNavigate, useParams } from "react-router-dom"
import "./HomePage.css"

export default function HomePage() {
  const navigate = useNavigate()
  const { room } = useParams()
  const gameType = room === "one-shot" ? "one_shot" : "iterative"

  const handleStartGame = (mode) => {
    if (mode === "online") {
      navigate(`/ultimatum/matchmaking?type=${gameType}`)
    } else {
      navigate(`/ultimatum/game?mode=${mode}&type=${gameType}`)
    }
  }

  const isOneShot = gameType === "one_shot"

  return (
    <div className="homepage">
      <div className="homepage-container">
        <div className="homepage-header">
          <h1 className="homepage-title">Ultimatum</h1>
          <p className="homepage-subtitle">
            {isOneShot ? (
              "A single classic round. Player 1 proposes how to split 100 coins. If Player 2 rejects, both get nothing."
            ) : (
              "Divide a stack of coins simultaneously over multiple rounds. Rejection means you both get nothing for that proposal."
            )}
          </p>
          <p style={{ marginTop: "1rem", color: "rgba(255, 255, 255, 0.6)", fontSize: "1.1rem" }}>
            Room Mode: <strong>{isOneShot ? "One-Shot" : "Iterative"}</strong>
          </p>
        </div>

        {/* Game Description Card */}
        <div className="how-to-play-card">
          <div className="how-to-play-header">
            <Coins className="how-to-play-icon" />
            <h2 className="how-to-play-title">How to Play ({isOneShot ? "One-Shot" : "Iterative"})</h2>
          </div>
          <div className="how-to-play-steps">
            <div className="step">
              <div className="step-number">
                <span>1</span>
              </div>
              <h3 className="step-title">{isOneShot ? "Player 1 Proposes" : "Make an Offer"}</h3>
              <p className="step-description">
                {isOneShot 
                  ? "Player 1 decides how much of the 100 coins to offer to Player 2" 
                  : "Decide how much of the 100 coins to offer your opponent"}
              </p>
            </div>
            <div className="step">
              <div className="step-number">
                <span>2</span>
              </div>
              <h3 className="step-title">{isOneShot ? "Player 2 Decides" : "Wait for Decision"}</h3>
              <p className="step-description">
                {isOneShot 
                  ? "Player 2 accepts or rejects the offer" 
                  : "Your opponent will accept or reject your offer"}
              </p>
            </div>
            <div className="step">
              <div className="step-number">
                <span>3</span>
              </div>
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
                  <span>You are about to play <strong>25 rounds</strong> of a two-simultaneous ultimatum game with the same other player.</span>
                )}
              </p>
              
              <div className="instruction-details">
                <h4>Rules:</h4>
                {isOneShot ? (
                  <ul>
                    <li>The Proposer is given <strong>100 coins</strong>.</li>
                    <li>The Proposer decides on an offer to give the Responder (between 0 and 100).</li>
                    <li>The Responder sees the offer and chooses to <strong>accept or reject it</strong>.</li>
                    <li>If the Responder accepts: the Proposer gets 100 - offer, and Responder gets the offer.</li>
                    <li>If the Responder rejects: both players receive <strong>0 coins</strong>.</li>
                  </ul>
                ) : (
                  <ul>
                    <li>In each round, you will <strong>make an offer</strong>: decide how to split 100 coins between you and the other player.</li>
                    <li>The other player will also make an offer at the same time.</li>
                    <li>Then, you'll see the other player's offer and choose to <strong>accept or reject it</strong>.</li>
                    <li>At the same time, the other player will decide whether to accept your offer.</li>
                    <li>Proposals are only valid if they are accepted. If a proposal is rejected, it is invalid and no coins are given from it.</li>
                  </ul>
                )}
              </div>
              
              {!isOneShot && (
                <div className="examples-section">
                  <h4>Examples (Iterative):</h4>
                  
                  <div className="example">
                    <h5><strong>Example 1: Both offers accepted</strong></h5>
                    <p>You offer: keep 40, give 60 → they accept</p>
                    <p>They offer: keep 70, give 30 → you accept</p>
                    <p className="example-result">✅ You earn: 40 + 30 = <strong>70 coins</strong></p>
                  </div>
                  
                  <div className="example">
                    <h5><strong>Example 2: You reject, they accept</strong></h5>
                    <p>You offer: keep 80, give 20 → they accept</p>
                    <p>They offer: keep 90, give 10 → you reject</p>
                    <p className="example-result">✅ You earn: 80 + 0 = <strong>80 coins</strong></p>
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

        {/* Game Mode Selection */}
        <div className="game-modes">
          <div className="game-mode-card">
            <div className="game-mode-icon-container">
              <Users className="game-mode-icon" />
            </div>
            <h3 className="game-mode-title">Play Online</h3>
            <p className="game-mode-description">Challenge a real player in our matchmaking system</p>
            <button onClick={() => handleStartGame("online")} className="game-mode-button online-button" style={{ marginTop: '15px' }}>
              Find Match
            </button>
          </div>

          <div className="game-mode-card">
            <div className="game-mode-icon-container">
              <Bot className="game-mode-icon" />
            </div>
            <h3 className="game-mode-title">Play with Bot</h3>
            <p className="game-mode-description">Practice against our AI opponent</p>
            <button onClick={() => handleStartGame("bot")} className="game-mode-button bot-button" style={{ marginTop: '15px' }}>
              Start Game
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}