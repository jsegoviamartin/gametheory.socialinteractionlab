import { Coins, Shield, Gift, Scale } from "lucide-react"
import { useNavigate } from "react-router-dom"
import "./HomePage.css"

export default function CommonPoolResourceRoomChoice() {
  const navigate = useNavigate()

  const selectRoom = (room) => {
    navigate(`/common-pool/${room}`)
  }
  
  

  return (
    <div className="cpr-homepage">
      <div className="cpr-homepage-container">

        <div className="cpr-homepage-header">
          <h1 className="cpr-homepage-title">Choose a Room</h1>
          <p className="cpr-homepage-subtitle">
            Each room follows different rules for cooperation.
          </p>
        </div>

        {/* ROOM GRID */}
        <div className="cpr-room-grid">

          <div className="cpr-game-mode-card">
            <div className="cpr-game-mode-icon-container">
              <Coins className="cpr-game-mode-icon" />
            </div>
            <h3 className="cpr-game-mode-title">Standard Room</h3>
            <p className="cpr-game-mode-description">
              Only contribution decisions. No interactions after.
            </p>
            <button
              className="cpr-game-mode-button cpr-online-button"
              onClick={() => selectRoom("basic")}
            >
              Enter Room
            </button>
          </div>

          <div className="cpr-game-mode-card">
            <div className="cpr-game-mode-icon-container">
              <Shield className="cpr-game-mode-icon" />
            </div>
            <h3 className="cpr-game-mode-title">Punishment Room</h3>
            <p className="cpr-game-mode-description">
              Punish free-riders after seeing contributions.
            </p>
            <button
              className="cpr-game-mode-button cpr-online-button"
              onClick={() => selectRoom("punishment")}
            >
              Enter Room
            </button>
          </div>

          <div className="cpr-game-mode-card">
            <div className="cpr-game-mode-icon-container">
              <Gift className="cpr-game-mode-icon" />
            </div>
            <h3 className="cpr-game-mode-title">Reward Room</h3>
            <p className="cpr-game-mode-description">
              Reward cooperative players after the round.
            </p>
            <button
              className="cpr-game-mode-button cpr-online-button"
              onClick={() => selectRoom("reward")}
            >
              Enter Room
            </button>
          </div>

          <div className="cpr-game-mode-card">
            <div className="cpr-game-mode-icon-container">
              <Scale className="cpr-game-mode-icon" />
            </div>
            <h3 className="cpr-game-mode-title">Punishment + Reward</h3>
            <p className="cpr-game-mode-description">
              Choose to punish or reward after contributions.
            </p>
            <button
              className="cpr-game-mode-button cpr-online-button"
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
