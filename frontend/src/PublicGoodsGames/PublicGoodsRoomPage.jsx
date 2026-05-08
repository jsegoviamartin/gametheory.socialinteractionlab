import { Coins, Shield, Gift, Scale } from "lucide-react"
import { useNavigate } from "react-router-dom"
import "./HomePage.css"

export default function PublicGoodsRoomChoice() {
  const navigate = useNavigate()

  const selectRoom = (room) => {
    navigate(`/public-goods/${room}`)
  }
  
  

  return (
    <div className="homepage">
      <div className="homepage-container">

        <div className="homepage-header">
          <h1 className="homepage-title">Choose a Room</h1>
          <p className="homepage-subtitle">
            Each room follows different rules for cooperation.
          </p>
        </div>

        {/* ROOM GRID */}
        <div className="room-grid">

          <div className="game-mode-card">
            <div className="game-mode-icon-container">
              <Coins className="game-mode-icon" />
            </div>
            <h3 className="game-mode-title">Standard Room</h3>
            <p className="game-mode-description">
              Only contribution decisions. No interactions after.
            </p>
            <button
              className="game-mode-button online-button"
              onClick={() => selectRoom("basic")}
            >
              Enter Room
            </button>
          </div>

          <div className="game-mode-card">
            <div className="game-mode-icon-container">
              <Shield className="game-mode-icon" />
            </div>
            <h3 className="game-mode-title">Punishment Room</h3>
            <p className="game-mode-description">
              Punish free-riders after seeing contributions.
            </p>
            <button
              className="game-mode-button online-button"
              onClick={() => selectRoom("punishment")}
            >
              Enter Room
            </button>
          </div>

          <div className="game-mode-card">
            <div className="game-mode-icon-container">
              <Gift className="game-mode-icon" />
            </div>
            <h3 className="game-mode-title">Reward Room</h3>
            <p className="game-mode-description">
              Reward cooperative players after the round.
            </p>
            <button
              className="game-mode-button online-button"
              onClick={() => selectRoom("reward")}
            >
              Enter Room
            </button>
          </div>

          <div className="game-mode-card">
            <div className="game-mode-icon-container">
              <Scale className="game-mode-icon" />
            </div>
            <h3 className="game-mode-title">Punishment + Reward</h3>
            <p className="game-mode-description">
              Choose to punish or reward after contributions.
            </p>
            <button
              className="game-mode-button online-button"
              onClick={() => selectRoom("mixed")}
            >
              Enter Room
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
