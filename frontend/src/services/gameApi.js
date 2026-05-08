// ===============================
// Base URLs (CRA proxy friendly)
// ===============================

// Ultimatum
const API_BASE_URL =
  window.location.hostname === "localhost"
    ? "/api/ultimatum"
    : `${window.location.protocol}//${window.location.host}/api/ultimatum`

// Public Goods
const PG_API_BASE_URL =
  window.location.hostname === "localhost"
    ? "/api/public-goods"
    : `${window.location.protocol}//${window.location.host}/api/public-goods`

// Strategic Games (2x2)
const THE_GAME_API_BASE_URL =
  window.location.hostname === "localhost"
    ? "/api/prisoners"
    : `${window.location.protocol}//${window.location.host}/api/prisoners`

// ===============================
// Ultimatum API
// ===============================

export const gameApi = {
  // -------------------------------
  // Ultimatum Endpoints
  // -------------------------------
  async createMatch(gameMode, playerFingerprint) {
    console.log("🎮 [Ultimatum] Creating match:", { gameMode, playerFingerprint })

    const response = await fetch(`${API_BASE_URL}/create-match-ultimatum/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        game_mode: gameMode,
        player_fingerprint: playerFingerprint,
      }),
    })

    if (!response.ok) {
      const isTimeout = response.status === 504
      throw new Error(
        isTimeout
          ? "Matchmaking server timed out while creating a match."
          : `HTTP error! status: ${response.status}`
      )
    }

    const data = await response.json()
    console.log("✅ [Ultimatum] Match created/joined:", data)
    return data
  },

  async cancelMatch(matchId, playerFingerprint) {
    console.log("🛑 [Ultimatum] Cancelling match:", { matchId, playerFingerprint })

    const response = await fetch(`${API_BASE_URL}/cancel-match/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        match_id: matchId,
        player_fingerprint: playerFingerprint,
      }),
    })

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

    return response.json()
  },

  async getMatchStats(matchId) {
    console.log("📊 [Ultimatum] Getting stats for:", matchId)
    const response = await fetch(`${API_BASE_URL}/match-stats/${matchId}/`)
    if (!response.ok) {
      if (response.status === 404) throw new Error("Match not found")
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return response.json()
  },

  async getMatchHistory(matchId) {
    console.log("📜 [Ultimatum] Getting history for:", matchId)
    const response = await fetch(`${API_BASE_URL}/match-history/${matchId}/`)
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    return response.json()
  },

  async matchmakeCustomUltimatum(experimentId, playerFingerprint, conditionId = null) {
    console.log("🎮 [Ultimatum] Custom Matchmaking:", { experimentId, playerFingerprint, conditionId })
    const res = await fetch(`${API_BASE_URL}/matchmake-custom/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        experiment_id: experimentId,
        player_fingerprint: playerFingerprint,
        condition_id: conditionId,
      }),
    })
    if (!res.ok) throw new Error(`HTTP error ${res.status}`)
    const data = await res.json()
    console.log("✅ [Ultimatum] Custom Match created/joined:", data)
    return data
  },

  // -------------------------------
  // Public Goods Endpoints
  // -------------------------------
  async createMatchPublicGoods(room, gameMode, playerFingerprint) {
    console.log("🌍 [Public Goods] Creating match:", { room, gameMode, playerFingerprint })

    const res = await fetch(`${PG_API_BASE_URL}/create-match/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        room: room,
        game_mode: gameMode,
        player_fingerprint: playerFingerprint,
      }),
    })

    const payload = { room, game_mode: gameMode, player_fingerprint: playerFingerprint }
    console.log("📦 [gameApi] Payload sent:", payload)

    if (!res.ok) throw new Error(`HTTP error ${res.status}`)

    const data = await res.json()
    console.log("✅ [Public Goods] Match created/joined:", data)
    return data
  },

  async matchmakeCustomPublicGoods(experimentId, playerFingerprint, conditionId = null) {
    console.log("🎮 [Public Goods] Custom Matchmaking:", { experimentId, playerFingerprint, conditionId })

    const res = await fetch(`${PG_API_BASE_URL}/matchmake-custom/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        experiment_id: experimentId,
        player_fingerprint: playerFingerprint,
        condition_id: conditionId,
      }),
    })

    if (!res.ok) throw new Error(`HTTP error ${res.status}`)

    const data = await res.json()
    console.log("✅ [Public Goods] Custom Match created/joined:", data)
    return data
  },

  async getPublicGoodsMatchStats(matchId) {
    console.log("📊 [Public Goods] Getting stats for:", matchId)
    const res = await fetch(`${PG_API_BASE_URL}/match-stats/${matchId}/?t=${Date.now()}`)
    if (!res.ok) throw new Error(`HTTP error ${res.status}`)
    return res.json()
  },

  // -------------------------------
  // Strategic (2x2) Endpoints
  // -------------------------------
  async matchmakeCustomTheGame(experimentId, playerFingerprint, conditionId = null) {
    console.log("🎮 [Strategic] Custom Matchmaking:", { experimentId, playerFingerprint, conditionId })
    const res = await fetch(`${THE_GAME_API_BASE_URL}/matchmake_custom/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        experiment_id: experimentId,
        player_fingerprint: playerFingerprint,
        condition_id: conditionId,
      }),
    })
    if (!res.ok) throw new Error(`HTTP error ${res.status}`)
    const data = await res.json()
    console.log("✅ [Strategic] Custom Match created/joined:", data)
    return data
  },

  // -------------------------------
  // WebSocket for Public Goods
  // -------------------------------
  connectPublicGoodsWs(matchId, onMessageCallback) {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws"
    const wsUrl = `${protocol}://${window.location.host}/ws/public-goods/${matchId}/`
    console.log("🌐 Connecting WebSocket to:", wsUrl)

    const ws = new WebSocket(wsUrl)

    ws.onopen = () => console.log("✅ WebSocket connected:", wsUrl)
    ws.onclose = () => console.log("❌ WebSocket disconnected:", wsUrl)
    ws.onerror = (err) => console.error("⚠️ WebSocket error:", err)
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        onMessageCallback(data)
      } catch (e) {
        console.error("⚠️ WebSocket parse error:", e)
      }
    }

    return ws
  },

  sendWsMessage(ws, action, payload = {}) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn("⚠️ WebSocket not open, cannot send:", action)
      return
    }
    const msg = { action, ...payload }
    ws.send(JSON.stringify(msg))
    console.log("📤 Sent WS message:", msg)
  },

  joinPublicGoodsRoom(ws, playerFingerprint) {
    this.sendWsMessage(ws, "join", { player_fingerprint: playerFingerprint })
  },

  submitContribution(ws, playerFingerprint, contribution) {
    this.sendWsMessage(ws, "submit_contribution", {
      player_fingerprint: playerFingerprint,
      contribution,
    })
  },
}

// ===============================
// Player Fingerprint (shared)
// ===============================

export const generatePlayerFingerprint = () => {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 15)
  const fingerprint = `player_${timestamp}_${random}`
  console.log("👤 Generated fingerprint:", fingerprint)
  return fingerprint
}

export const getPlayerFingerprint = () => {
  const storageKey = "player_fingerprint"
  let fingerprint = localStorage.getItem(storageKey)
  if (!fingerprint) {
    fingerprint = generatePlayerFingerprint()
    localStorage.setItem(storageKey, fingerprint)
    console.log("💾 Saved fingerprint:", fingerprint)
  } else console.log("🔄 Using stored fingerprint:", fingerprint)
  return fingerprint
}

export const clearPlayerFingerprint = () => {
  localStorage.removeItem("player_fingerprint")
  console.log("🗑️ Cleared player fingerprint")
}
