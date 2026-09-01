import { useState, useEffect, useRef, useCallback } from "react"
import { Loader2, WifiOff, Users } from "lucide-react"
import { useNavigate, useLocation } from "react-router-dom"

import { gameApi, getPlayerFingerprint } from "../services/gameApi"
import "./MatchmakingPage.css"

export default function PublicGoodsMatchmakingPage() {
  const navigate = useNavigate()
  const { search } = useLocation()

  const query = new URLSearchParams(search)
  const room = query.get("room") || "basic"
  const mode = query.get("mode") || "online"
  const experimentId = query.get("experiment_id")
  const conditionId = query.get("condition_id")

  // ---------------------------------
  // State
  // ---------------------------------
  const [playerFingerprint] = useState(() => getPlayerFingerprint())
  const [matchId, setMatchId] = useState(null)
  const [status, setStatus] = useState("searching") // searching | waiting | found | error
  const [error, setError] = useState(null)

  // ---------------------------------
  // Polling control
  // ---------------------------------
  const pollTimeoutRef = useRef(null)
  const mountedRef = useRef(true)
  const pollAttempts = useRef(0)

  // ---------------------------------
  // Cleanup
  // ---------------------------------
  useEffect(() => {
    mountedRef.current = true
    return () => {
      console.log("🧹 Matchmaking unmounted – cleaning up")
      mountedRef.current = false
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current)
    }
  }, [])

  // ---------------------------------
  // 🚀 CENTRALIZED NAVIGATION
  // ---------------------------------

  useEffect(() => {
    if (status === "found" && matchId) {
      let finalUrl = `/public-goods/game?mode=${mode}&match=${matchId}`
      if (experimentId) {
        finalUrl += `&experiment_id=${experimentId}`
      }
      console.log("🚀 Navigating to game page:", finalUrl)
      navigate(finalUrl, { replace: true })
    }
  }, [status, matchId, mode, navigate, experimentId])

  // ---------------------------------
  // Poll match status (ONLINE MODE)
  // ---------------------------------
  const pollMatchStatus = useCallback(
    async (matchId) => {
      if (!mountedRef.current) return

      try {
        pollAttempts.current += 1
        console.log(
          `📡 Polling match ${matchId} (attempt ${pollAttempts.current})`
        )

        const stats = await gameApi.getPublicGoodsMatchStats(matchId)

        if (!mountedRef.current) return

        console.log("📊 Match stats:", stats)

        if (stats.players_count >= 4 || stats.is_ready) {
          console.log("✅ Match is ready")
          setStatus("found")
          return
        }

        const delay = Math.min(
          1000 + Math.min(pollAttempts.current, 10) * 300,
          5000
        )

        pollTimeoutRef.current = setTimeout(
          () => pollMatchStatus(matchId),
          delay
        )
      } catch (err) {
        console.error("❌ Polling error:", err)

        const delay = Math.min(
          2000 + pollAttempts.current * 500,
          10000
        )

        pollTimeoutRef.current = setTimeout(
          () => pollMatchStatus(matchId),
          delay
        )
      }
    },
    []
  )

  // ---------------------------------
  // Find / create match
  // ---------------------------------

  const findMatch = useCallback(async () => {
    if (!mountedRef.current) return

    setStatus("searching")

    try {
      console.log("🎮 Creating/finding match:", { room, mode, playerFingerprint, experimentId })
      
      let matchData;
      if (experimentId) {
        // Use custom laboratory matchmaking if experimentId is present
        matchData = await gameApi.matchmakeCustomPublicGoods(experimentId, playerFingerprint, conditionId)
      } else {
        // Otherwise use standard public matchmaking
        matchData = await gameApi.createMatchPublicGoods(room, mode, playerFingerprint)
      }

      if (!mountedRef.current) return

      console.log("✅ Match data received:", matchData)
      setMatchId(matchData.match_id)

      // 🤖 BOT MODE → start immediately
      if (mode === "bot" || matchData.status === "created_bot_match") {
        setStatus("found")
        return
      }

      // 🌍 ONLINE MODE → already full
      if (matchData.players_count === 4) {
        setStatus("found")
        return
      }

      // ⏳ Otherwise wait
      setStatus("waiting")
      pollAttempts.current = 0
      pollMatchStatus(matchData.match_id)
    } catch (e) {
      console.error("❌ Public Goods matchmaking error:", e)
      if (mountedRef.current) {
        setError(e.message)
        setStatus("error")
      }
    }
  }, []) // ✅ empty dependency ensures it runs only once

  const hasFetched = useRef(false)

  useEffect(() => {
    if (hasFetched.current) return
    hasFetched.current = true
    findMatch()
  }, [findMatch])

  // ---------------------------------
  // Cancel matchmaking
  // ---------------------------------
  const handleCancel = () => {
    console.log("🛑 Matchmaking cancelled")
    if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current)
    mountedRef.current = false
    const exitPath = experimentId ? `/experiments/${experimentId}/home` : "/public-goods";
    navigate(exitPath)
  }

  // ---------------------------------
  // Retry
  // ---------------------------------
  const handleRetry = () => {
    console.log("🔁 Retrying matchmaking")
    if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current)
    setError(null)
    setStatus("searching")
    setMatchId(null)
    pollAttempts.current = 0
    window.location.reload()
  }

  // ---------------------------------
  // UI
  // ---------------------------------
  return (
    <div className="matchmaking-page">
      <div className="matchmaking-container">
        <div className="matchmaking-header">
          <h1 className="matchmaking-title">Public Goods Game</h1>
          <p className="matchmaking-subtitle">
            {status === "waiting"
              ? `Waiting for 4 players (${pollAttempts.current} checks)…`
              : "Waiting for players to join…"}
          </p>
        </div>

        <div className="matchmaking-card">
          <div className="matchmaking-icon-container">
            {status === "searching" || status === "waiting" ? (
              <Loader2 className="matchmaking-spinner" />
            ) : status === "found" ? (
              <Users className="success-icon" />
            ) : (
              <WifiOff className="error-icon" />
            )}
          </div>

          <h2 className="matchmaking-status-title">
            {status === "searching" && "Searching…"}
            {status === "waiting" && "Waiting for players…"}
            {status === "found" && "Match Ready!"}
            {status === "error" && "Error"}
          </h2>

          <p className="matchmaking-status-text">
            {status === "searching" &&
              "Looking for an existing Public Goods match."}
            {status === "waiting" &&
              "Please wait for other players to join."}
            {status === "found" &&
              "All players joined. Starting game…"}
            {status === "error" &&
              (error || "Something went wrong.")}
          </p>

          <div className="matchmaking-info">
            <div className="matchmaking-info-row">
              <span>Your ID:</span>
              <span className="matchmaking-player-id">
                {playerFingerprint}
              </span>
            </div>

            {matchId && (
              <div className="matchmaking-info-row">
                <span>Match ID:</span>
                <span className="matchmaking-match-id">
                  {matchId}
                </span>
              </div>
            )}
          </div>

          <div className="matchmaking-buttons">
            {(status === "searching" || status === "waiting") && (
              <button onClick={handleCancel} className="cancel-button">
                Cancel
              </button>
            )}

            {status === "error" && (
              <>
                <button onClick={handleRetry} className="retry-button">
                  Retry
                </button>
                <button onClick={handleCancel} className="cancel-button">
                  Back
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}