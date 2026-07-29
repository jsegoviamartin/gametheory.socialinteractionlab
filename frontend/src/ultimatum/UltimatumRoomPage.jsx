import { Coins, Zap } from "lucide-react"
import { useNavigate } from "react-router-dom"
import "./HomePage.css"

export default function UltimatumRoomPage() {
  const navigate = useNavigate()

  const selectRoom = (roomName) => {
    navigate(`/ultimatum/${roomName}`)
  }

  return (
    <div className="homepage">
      <div className="homepage-container">
        <div className="homepage-header">
          <h1 className="homepage-title">Choose a Room</h1>
          <p className="homepage-subtitle">
            Select an Ultimatum game room. Each room follows different rules for proposals and rounds.
          </p>
        </div>

        <div className="room-grid">
          <div className="game-mode-card">
            <div className="game-mode-icon-container">
              <Coins className="game-mode-icon" />
            </div>
            <h3 className="game-mode-title">Iterative Room</h3>
            <p className="game-mode-description">
              Play 25 rounds of simultaneous ultimatum game. Both players make offers and respond simultaneously each round.
            </p>
            <button
              className="game-mode-button online-button"
              onClick={() => selectRoom("iterative")}
            >
              Enter Room
            </button>
          </div>

          <div className="game-mode-card">
            <div className="game-mode-icon-container">
              <Zap className="game-mode-icon" />
            </div>
            <h3 className="game-mode-title">One-Shot Room</h3>
            <p className="game-mode-description">
              A single classic round. Player 1 proposes a split of $100, and Player 2 accepts or rejects it.
            </p>
            <button
              className="game-mode-button online-button"
              onClick={() => selectRoom("one-shot")}
            >
              Enter Room
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
