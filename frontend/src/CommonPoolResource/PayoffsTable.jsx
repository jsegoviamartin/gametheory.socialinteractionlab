import "./PayoffsTable.css"

export default function PayoffsTable({ history, playerIndex }) {
  const rounds = [...new Set(history.map(h => h.round))].sort((a, b) => a - b)

  const getRoundData = (roundNumber) => {
    return history.find((h) => h.round === roundNumber)
  }

  const getPlayerContribution = (roundNumber, playerIndex) => {
    const roundData = getRoundData(roundNumber)
    if (!roundData) return ""
    return roundData.players[playerIndex]?.contribution ?? ""
  }

  const getPlayerActualCatch = (roundNumber, playerIndex) => {
    const roundData = getRoundData(roundNumber)
    if (!roundData) return ""
    return roundData.players[playerIndex]?.actualCatch ?? ""
  }

  const getPlayerPayoff = (roundNumber, playerIndex) => {
    const roundData = getRoundData(roundNumber)
    if (!roundData) return ""
    return roundData.players[playerIndex]?.payoff?.toFixed(2) ?? ""
  }

  const getTotalContribution = (roundNumber) => {
    const roundData = getRoundData(roundNumber)
    if (!roundData) return ""
    return roundData.total ?? ""
  }

  const getTotalActualCatch = (roundNumber) => {
    const roundData = getRoundData(roundNumber)
    if (!roundData || !roundData.players) return ""
    return roundData.players.reduce((sum, p) => sum + (p.actualCatch || 0), 0)
  }

  const getPlayerActions = (roundNumber, pRowIdx0) => {
    const roundData = getRoundData(roundNumber)
    if (!roundData || !roundData.stage2Actions) return "-"

    const pRowIdx = pRowIdx0 + 1
    const actions = roundData.stage2Actions.filter((a) => {
      if (a.actor !== pRowIdx) return false
      // If it is the active player's row, show all his actions
      if (pRowIdx === playerIndex) return true
      // If it is another player's row, only show actions they did to the active player
      return a.target === playerIndex
    })

    if (actions.length === 0) return "-"

    return actions
      .map((a) => {
        const typeChar = a.type === "punish" ? "P" : "R"
        return `P${a.target}(${typeChar})`
      })
      .join(", ")
  }

  const getPlayerTotalPayoff = (playerIndex) => {
    return history
      .reduce((total, round) => {
        return total + (round.players[playerIndex]?.payoff ?? 0)
      }, 0)
      .toFixed(2)
  }

  const getFishLeft = (roundNumber) => {
    const rd = getRoundData(roundNumber)
    if (!rd || rd.fishStock == null) return ""
    const catchTotal = getTotalActualCatch(roundNumber) || 0
    return Math.max(0, rd.fishStock - catchTotal)
  }

  const getNewFishBorn = (roundNumber) => {
    const left = getFishLeft(roundNumber)
    if (left === "") return ""
    const result = Math.round(0.8 * left * (1 - left / 100))
    return `round(0.8 * ${left} * (1 - ${left} / 100)) = ${result}`
  }

  if (!rounds.length) {
    return (
      <>
        <h3 className="cpr-pgg-payoffs-title">Game History</h3>
        <p style={{ color: "#fff", textAlign: "center" }}>No rounds played yet.</p>
      </>
    )
  }

  return (
    <>
      <h3 className="cpr-pgg-payoffs-title">Game History</h3>

      <div className="cpr-pgg-payoffs-wrapper">
        <table className="cpr-pgg-payoffs-table">
          <thead>
            <tr>
              <th className="cpr-player-col">Round</th>
              {rounds.map((r) => (
                <th key={r} className="cpr-round-col">
                  {r}
                </th>
              ))}
              <th className="cpr-pgg-total-col">Total</th>
            </tr>
          </thead>

          <tbody>
            {/* Starting Fish Stock */}
            <tr>
              <td className="cpr-pgg-payoffs-player-label" style={{ color: "#38bdf8", fontWeight: "bold" }}>
                Starting Fish Stock
              </td>
              {rounds.map((r) => {
                const rd = getRoundData(r)
                return <td key={r} style={{ color: "#38bdf8", fontWeight: "bold" }}>{rd?.fishStock ?? ""}</td>
              })}
              <td className="cpr-pgg-empty-total-cell">-</td>
            </tr>

            {/* Contributions / Extraction requests */}
            {[0, 1, 2, 3].map((pIdx) => (
              <tr key={`contrib-${pIdx}`}>
                <td className="cpr-pgg-payoffs-player-label">
                  {`Player ${pIdx + 1} Harvest Request`}
                </td>
                {rounds.map((r) => (
                  <td key={r}>{getPlayerContribution(r, pIdx)}</td>
                ))}
                <td className="cpr-pgg-empty-total-cell">-</td>
              </tr>
            ))}

            {/* Total Harvest Requests */}
            <tr style={{ borderBottom: "2px solid rgba(255,255,255,0.3)" }}>
              <td className="cpr-pgg-payoffs-player-label" style={{ fontStyle: "italic" }}>Total Requests</td>
              {rounds.map((r) => (
                <td key={r} style={{ fontStyle: "italic" }}>{getTotalContribution(r)}</td>
              ))}
              <td className="cpr-pgg-empty-total-cell">-</td>
            </tr>

            {/* Actual Catches */}
            {[0, 1, 2, 3].map((pIdx) => (
              <tr key={`actual-${pIdx}`}>
                <td className="cpr-pgg-payoffs-player-label">
                  {`Player ${pIdx + 1} Actual Catch`}
                </td>
                {rounds.map((r) => (
                  <td key={r}>{getPlayerActualCatch(r, pIdx)}</td>
                ))}
                <td className="cpr-pgg-empty-total-cell">-</td>
              </tr>
            ))}

            {/* Total Actual Catch */}
            <tr style={{ borderBottom: "2px solid rgba(255,255,255,0.3)" }}>
              <td className="cpr-pgg-payoffs-player-label" style={{ fontStyle: "italic" }}>Total Actual Catch</td>
              {rounds.map((r) => (
                <td key={r} style={{ fontStyle: "italic" }}>{getTotalActualCatch(r)}</td>
              ))}
              <td className="cpr-pgg-empty-total-cell">-</td>
            </tr>

            {/* Stage 2 Actions */}
            {[0, 1, 2, 3].map((pIdx) => (
              <tr key={`actions-${pIdx}`}>
                <td className="cpr-pgg-payoffs-player-label">
                  {`Player ${pIdx + 1} Stage 2 Actions`}
                </td>
                {rounds.map((r) => (
                  <td key={r} style={{ fontSize: "0.7rem", color: "#CBD5E1" }}>
                    {getPlayerActions(r, pIdx)}
                  </td>
                ))}
                <td className="cpr-pgg-empty-total-cell">-</td>
              </tr>
            ))}

            {/* Player Payoffs */}
            {[0, 1, 2, 3].map((pIdx) => (
              <tr key={`payoff-${pIdx}`}>
                <td className="cpr-pgg-payoffs-player-label" style={{ fontWeight: "600" }}>
                  {`Player ${pIdx + 1} Payoff`}
                </td>
                {rounds.map((r) => (
                  <td key={r} style={{ fontWeight: "600" }}>{getPlayerPayoff(r, pIdx)}</td>
                ))}
                <td className="cpr-pgg-running-total-cell">
                  {getPlayerTotalPayoff(pIdx)}
                </td>
              </tr>
            ))}

            {/* Fish Left */}
            <tr style={{ borderTop: "2px solid rgba(255,255,255,0.3)" }}>
              <td className="cpr-pgg-payoffs-player-label" style={{ color: "#facc15" }}>
                Fish Left (Stock - Total Catch)
              </td>
              {rounds.map((r) => (
                <td key={r} style={{ color: "#facc15" }}>{getFishLeft(r)}</td>
              ))}
              <td className="cpr-pgg-empty-total-cell">-</td>
            </tr>

            {/* New Fish Born */}
            <tr>
              <td className="cpr-pgg-payoffs-player-label" style={{ color: "#facc15" }}>
                New Fish Born Formula
              </td>
              {rounds.map((r) => (
                <td key={r} style={{ color: "#facc15" }}>{getNewFishBorn(r)}</td>
              ))}
              <td className="cpr-pgg-empty-total-cell">-</td>
            </tr>

            {/* Next Fish Stock */}
            <tr>
              <td className="cpr-pgg-payoffs-player-label" style={{ color: "#34d399", fontWeight: "bold" }}>
                Next Fish Stock
              </td>
              {rounds.map((r) => {
                const rd = getRoundData(r)
                return <td key={r} style={{ color: "#34d399", fontWeight: "bold" }}>{rd?.nextFishStock ?? ""}</td>
              })}
              <td className="cpr-pgg-empty-total-cell">-</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  )
}
