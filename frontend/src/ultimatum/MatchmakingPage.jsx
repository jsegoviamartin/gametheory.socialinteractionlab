import { useState, useEffect, useRef, useCallback } from "react"
import { Loader2, Wifi, WifiOff, Users } from "lucide-react"
import { useSearchParams, useNavigate } from "react-router-dom"
import { gameApi, getPlayerFingerprint } from "../services/gameApi"
import "./MatchmakingPage.css"

export default function MatchmakingPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const gameType = searchParams.get("type") || "iterative"
  
  const [playerFingerprint] = useState(() => getPlayerFingerprint())
  
  const [matchId, setMatchId] = useState(null)
  const [status, setStatus] = useState("searching") // searching, waiting, found, error
  const [error, setError] = useState(null)
  const pollTimeoutRef = useRef(null)
  const mountedRef = useRef(true)
  const pollAttempts = useRef(0)
  const hasFetched = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current)
      }
    }
  }, [])

  const checkMatchStatus = useCallback(async (matchId) => {
    if (!mountedRef.current) return
    
    try {
      pollAttempts.current++
      console.log(`🔄 Checking match status (attempt ${pollAttempts.current})`)
      
      const stats = await gameApi.getMatchStats(matchId)
      
      if (!mountedRef.current) return
      
      console.log("📊 Match stats:", stats)
      
      // Check if second player joined
      if (stats.players_count >= 2 || stats.is_ready) {
        console.log("🎯 Opponent found! Starting game...")
        setStatus("found")
        setTimeout(() => {
          if (mountedRef.current) {
            navigate(`/ultimatum/game?mode=online&type=${gameType}&match=${matchId}`, { replace: true })
          }
        }, 1000)
        return
      }
      
      const delay = Math.min(1000 + (Math.min(pollAttempts.current, 10) * 200), 5000)
      pollTimeoutRef.current = setTimeout(() => {
        checkMatchStatus(matchId)
      }, delay)
      
    } catch (error) {
      console.error("❌ Error checking match status:", error)
      
      // If we get repeated errors, still don't give up - but increase delay
      const delay = Math.min(2000 + (pollAttempts.current * 500), 10000) // Max 10 second delay on errors
      pollTimeoutRef.current = setTimeout(() => {
        checkMatchStatus(matchId)
      }, delay)
    }
  }, [navigate, gameType])

  useEffect(() => {
    const findMatch = async () => {
      if (!mountedRef.current) return
      
      try {
        console.log("🔍 Searching for online match with fingerprint:", playerFingerprint)
        setStatus("searching")

        const matchData = await gameApi.createMatch("online", playerFingerprint, gameType)

        if (!mountedRef.current) return

        console.log("✅ Match result:", matchData)
        setMatchId(matchData.match_id)

        if (matchData.status === "joined_existing_match") {
          console.log("🎯 Joined existing match, starting game immediately")
          setStatus("found")
          setTimeout(() => {
            if (mountedRef.current) {
              navigate(`/ultimatum/game?mode=online&type=${gameType}&match=${matchData.match_id}`, { replace: true })
            }
          }, 1500)
        } else if (matchData.status === "created_new_match" || matchData.status === "already_joined") {
          console.log(matchData.status === "already_joined"
            ? "🔄 Re-joined existing waiting match"
            : "⏳ Created new match, waiting for opponent")
          setStatus("waiting")
          pollAttempts.current = 0
          checkMatchStatus(matchData.match_id)
        }
      } catch (error) {
        console.error("❌ Error finding match:", error)
        if (mountedRef.current) {
          setError(error.message)
          setStatus("error")
        }
      }
    }

    if (hasFetched.current) return
    hasFetched.current = true
    findMatch()
  }, [checkMatchStatus, navigate, playerFingerprint])
  const handleCancel = () => {
    console.log("❌ User cancelled matchmaking")

    if (matchId) {
      gameApi.cancelMatch(matchId, playerFingerprint).catch((cancelError) => {
        console.error("❌ Error cancelling match:", cancelError)
      })
    }

    if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current)
    mountedRef.current = false
    navigate("/ultimatum")
  }

  // const handleCancel = () => {
  //   console.log("❌ User cancelled matchmaking")
  //   mountedRef.current = false
  //   if (pollTimeoutRef.current) {
  //     clearTimeout(pollTimeoutRef.current)
  //   }
  //   navigate("/ultimatum")
  // }

  const handleRetry = () => {
    console.log("🔄 Retrying matchmaking")
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current)
    }
    setError(null)
    setStatus("searching")
    setMatchId(null)
    pollAttempts.current = 0
    // Trigger re-render to restart the effect
    window.location.reload()
  }

  return (
    <div className="matchmaking-page">
      <div className="matchmaking-container">
        <div className="matchmaking-header">
          <h1 className="matchmaking-title">Ultimatum Game</h1>
          <p className="matchmaking-subtitle">Finding an opponent for your online match...</p>
        </div>

        <div className="matchmaking-card">
          <div className="matchmaking-icon-container">
            {status === "searching" || status === "waiting" ? (
              <Loader2 className="matchmaking-spinner" />
            ) : status === "found" ? (
              <div className="matchmaking-success">
                <Users className="success-icon" />
              </div>
            ) : (
              <div className="matchmaking-error">
                <WifiOff className="error-icon" />
              </div>
            )}
          </div>

          <h2 className="matchmaking-status-title">
            {status === "searching" && "Searching for Match..."}
            {status === "waiting" && "Waiting for Opponent..."}
            {status === "found" && "Opponent Found!"}
            {status === "error" && "Connection Error"}
          </h2>

          <p className="matchmaking-status-text">
            {status === "searching" && "Looking for available matches or creating a new one..."}
            {status === "waiting" && `Match created! Waiting for another player to join... (${pollAttempts.current} checks)`}
            {status === "found" && "Match found! Starting game..."}
            {status === "error" && (error || "Something went wrong. Please try again.")}
          </p>

          <div className="matchmaking-info">
            <div className="matchmaking-info-row">
              <span>Your ID:</span>
              <span className="matchmaking-player-id">{playerFingerprint}</span>
            </div>
            {matchId && (
              <div className="matchmaking-info-row">
                <span>Match ID:</span>
                <span className="matchmaking-match-id">{matchId}</span>
              </div>
            )}
            <div className="matchmaking-info-row">
              <span>Status:</span>
              <div className="connection-status">
                {status === "searching" || status === "waiting" ? (
                  <>
                    <Loader2 className="connection-icon connection-connecting" />
                    <span className="connection-connecting">{status === "searching" ? "Searching" : "Waiting"}</span>
                  </>
                ) : status === "found" ? (
                  <>
                    <Wifi className="connection-icon connection-connected" />
                    <span className="connection-connected">Ready</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="connection-icon connection-disconnected" />
                    <span className="connection-disconnected">Error</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="matchmaking-buttons">
            {(status === "searching" || status === "waiting") && (
              <button onClick={handleCancel} className="cancel-button">
                Cancel Search
              </button>
            )}
            {status === "error" && (
              <>
                <button onClick={handleRetry} className="retry-button">
                  Try Again
                </button>
                <button onClick={handleCancel} className="cancel-button">
                  Back to Menu
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
