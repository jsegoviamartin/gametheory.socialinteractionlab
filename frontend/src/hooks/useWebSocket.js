import { useState, useEffect, useRef, useCallback } from "react"

// Prefer same-origin `/ws/...` so CRA proxy (dev) and nginx (prod) just work.
// useWebSocket.js (for local dev)
const WS_BASE_URL =
  window.location.protocol === "https:"
    ? `wss://${window.location.hostname}`
    : `ws://${window.location.hostname}`;

const TERMINAL_CLOSE_CODES = new Set([4001, 4004])

export const useWebSocket = (matchId, playerFingerprint) => {
  const [socket, setSocket] = useState(null)
  const [gameState, setGameState] = useState(null)
  const [connectionStatus, setConnectionStatus] = useState("disconnected")
  const [error, setError] = useState(null)
  const [matchTerminated, setMatchTerminated] = useState(false)
  const [terminationReason, setTerminationReason] = useState(null)
  const [latestResults, setLatestResults] = useState(null)

  const reconnectTimeoutRef = useRef(null)
  const reconnectAttemptsRef = useRef(0)
  const connectionRef = useRef(null)
  const socketRef = useRef(null)
  const leaveSentRef = useRef(false)
  const maxReconnectAttempts = 5

  const log = (...args) => {
    console.log(new Date().toISOString(), ...args)
  }

  const connect = useCallback(() => {
    log("🔎 [connect] called")
    log("[connect] connectionRef.current =", connectionRef.current)
    log("[connect] matchTerminated =", matchTerminated)
    log("[connect] socketRef.current =", socketRef.current)

    if (!matchId || !playerFingerprint) {
      log("❌ Cannot connect: missing matchId or playerFingerprint")
      return
    }

    if (matchTerminated) {
      log("❌ Match was terminated - not reconnecting")
      return
    }

    if (connectionRef.current === "connecting" || connectionRef.current === "connected") {
      log("⚠️ Connection already in progress or established", {
        connectionRef: connectionRef.current,
        socketReadyState: socketRef.current?.readyState
      })
      return
    }

    if (reconnectTimeoutRef.current) {
      log("⏱ Clearing pending reconnect timeout")
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    try {
      const wsUrl = `${WS_BASE_URL}/ws/ultimatum-game/${matchId}/`
      log("🔌 Connecting to WebSocket:", wsUrl)
      log("👤 Player fingerprint:", playerFingerprint)

      connectionRef.current = "connecting"
      setConnectionStatus("connecting")

      const ws = new WebSocket(wsUrl)
      leaveSentRef.current = false
      log("🔎 WebSocket instance created, socket readyState =", ws.readyState)

      ws.onopen = () => {
        log("✅ WebSocket onopen fired")
        log("[onopen] socket readyState =", ws.readyState)
        setConnectionStatus("connected")
        connectionRef.current = "connected"
        setError(null)
        reconnectAttemptsRef.current = 0

        const joinMessage = { action: "join", player_fingerprint: playerFingerprint }
        log("📤 Sending join message:", joinMessage)
        try {
          ws.send(JSON.stringify(joinMessage))
          log("📤 Join message sent successfully")
        } catch (err) {
          console.error("❌ Failed to send join message:", err)
        }
      }

      ws.onmessage = (event) => {
        log("📥 onmessage fired, raw data:", event.data)
        try {
          const data = JSON.parse(event.data)
          log("📥 Parsed WebSocket message:", data)

          if (data.action === "joined") {
            log("🎉 Server acknowledged join:", data)
          }

          if (data.match_terminated) {
            log("🚫 Match terminated:", data.reason)
            setMatchTerminated(true)
            setError(`Match ended: ${data.reason}`)
            reconnectAttemptsRef.current = maxReconnectAttempts
            setTerminationReason(data.reason)
            return
          }

          if (data.error) {
            console.error("❌ Server error:", data.error)
            setError(data.error)
            const criticalErrors = ["full", "already started", "Cannot join match"]
            if (criticalErrors.some(err => data.error.includes(err))) {
              reconnectAttemptsRef.current = maxReconnectAttempts
            }
            return
          }

          if (data.game_state) {
            log("🎮 Game state update:", data.game_state)
            setGameState(data.game_state)
            if (!data.game_state.error) setError(null)
          }

          if (data.game_over) {
            log("🏁 Game over:", data)
            setGameState(prev => ({ ...prev, gameOver: true, player1Score: data.player1_score || 0, player2Score: data.player2_score || 0 }))
          }

          if (data.round_results) {
            log("🏆 Round results:", data.round_results)
            setLatestResults(data.round_results)
            setTimeout(() => setLatestResults(null), 3500)
          }

          if (data.action) {
            log("🎯 Player action:", data)
            setGameState(prev => {
              if (!prev) return prev
              const updated = { ...prev }

              if (data.action === "make_offer") {
                if (data.player_fingerprint === prev.player1Fingerprint) {
                  updated.currentRoundState = {
                    ...updated.currentRoundState,
                    player1OfferMade: true,
                    player1CoinsToKeep: data.coins_to_keep,
                    player1CoinsToOffer: data.coins_to_offer,
                    player1Offer: data.coins_to_offer,
                  }
                } else if (data.player_fingerprint === prev.player2Fingerprint) {
                  updated.currentRoundState = {
                    ...updated.currentRoundState,
                    player2OfferMade: true,
                    player2CoinsToKeep: data.coins_to_keep,
                    player2CoinsToOffer: data.coins_to_offer,
                    player2Offer: data.coins_to_offer,
                  }
                }
              }

              if (data.action === "respond_to_offer") {
                if (data.player_fingerprint === prev.player1Fingerprint && data.target_player === "player_2") {
                  updated.currentRoundState = { ...updated.currentRoundState, player1ResponseMade: true, player1Response: data.response }
                } else if (data.player_fingerprint === prev.player2Fingerprint && data.target_player === "player_1") {
                  updated.currentRoundState = { ...updated.currentRoundState, player2ResponseMade: true, player2Response: data.response }
                }
              }

              return updated
            })
          }
        } catch (err) {
          console.error("❌ Error parsing WebSocket message:", err, event.data)
        }
      }

      ws.onclose = (event) => {
        log("🔌 WebSocket onclose fired:", event.code, event.reason)
        log("[onclose] socket readyState =", ws.readyState)
        setConnectionStatus("disconnected")
        connectionRef.current = "disconnected"
        socketRef.current = null
        setSocket(null)

        if (reconnectTimeoutRef.current) {
          log("⏱ Clearing reconnect timeout in onclose")
          clearTimeout(reconnectTimeoutRef.current)
          reconnectTimeoutRef.current = null
        }

        if (matchTerminated) {
          log("🚫 Match terminated - skipping reconnect")
          return
        }

        if (TERMINAL_CLOSE_CODES.has(event.code)) {
          const reason = event.code === 4004 ? "match_not_found" : "Player disconnected"
          log("🚫 Terminal WebSocket close - ending match:", reason)
          setMatchTerminated(true)
          setTerminationReason(reason)
          setError(null)
          reconnectAttemptsRef.current = maxReconnectAttempts
          return
        }

        if (event.code === 1000 || reconnectAttemptsRef.current >= maxReconnectAttempts) {
          log("🚫 Not attempting to reconnect")
          return
        }

        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000)
        log(`🔄 Attempting to reconnect in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`)

        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttemptsRef.current++
          connectionRef.current = "disconnected"
          log("🔎 [reconnect attempt] Calling connect() again")
          connect()
        }, delay)
      }

      ws.onerror = (error) => {
        console.error("❌ WebSocket onerror fired:", error)
        log("[onerror] socket readyState =", ws.readyState)
        setConnectionStatus("error")
        connectionRef.current = "error"
      }

      socketRef.current = ws
      setSocket(ws)
    } catch (err) {
      console.error("❌ Failed to create WebSocket connection:", err)
      setError("Failed to connect to game server")
      setConnectionStatus("error")
      connectionRef.current = "error"
    }
  }, [matchId, playerFingerprint, matchTerminated])

  const disconnect = useCallback(() => {
    log("🔌 Manual disconnect requested")
    setMatchTerminated(true)

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    connectionRef.current = "disconnected"
    reconnectAttemptsRef.current = maxReconnectAttempts

    const currentSocket = socketRef.current
    if (currentSocket && currentSocket.readyState === WebSocket.OPEN && !leaveSentRef.current) {
      leaveSentRef.current = true
      currentSocket.send(JSON.stringify({ action: "leave", player_fingerprint: playerFingerprint }))
    }

    if (
      currentSocket &&
      (currentSocket.readyState === WebSocket.OPEN || currentSocket.readyState === WebSocket.CONNECTING)
    ) {
      currentSocket.close(4001, "Client left match")
    }

    socketRef.current = null
    setSocket(null)
    setConnectionStatus("disconnected")
  }, [playerFingerprint])

  const sendMessage = useCallback(
    (message) => {
      if (matchTerminated) {
        log("❌ Cannot send message: match termianted")
        return false
      }
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        log("📤 Sending message:", message)
        socketRef.current.send(JSON.stringify(message))
        return true
      } else {
        console.error("❌ Cannot send message: WebSocket not connected")
        setError("Not connected to game server")
        return false
      }
    },
    [matchTerminated]
  )

  useEffect(() => {
    log("🔎 useEffect triggered")
    if (matchId && playerFingerprint && !matchTerminated) {
      connect()
    }

    return () => {
      if (connectionRef.current === "connected") {
        log("🔎 useEffect cleanup: disconnecting WebSocket")
        disconnect()
      }
    }
  }, [matchId, playerFingerprint, matchTerminated, connect, disconnect])

  return {
    socket,
    gameState,
    latestResults,
    connectionStatus,
    error,
    matchTerminated,
    terminationReason,
    sendMessage,
    connect,
    disconnect,
  }
}
