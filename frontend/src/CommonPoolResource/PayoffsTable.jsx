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

  if (!rounds.length) {
    return (
      <>
        <h3 className="cpr-payoffs-title">Game History</h3>
        <p>No rounds played yet.</p>
      </>
    )
  }

  return (
    <>
      <h3 className="cpr-payoffs-title">Game History</h3>

      <div className="cpr-payoffs-wrapper">
        <table className="cpr-payoffs-table">
          <thead>
            <tr>
              <th className="cpr-player-col">Round</th>
              {rounds.map((r) => (
                <th key={r} className="cpr-round-col">
                  {r}
                </th>
              ))}
              <th className="cpr-total-col">Total</th>
            </tr>
          </thead>

          <tbody>
            {[0, 1, 2, 3].map((pIdx) => (
              <tr key={`contrib-${pIdx}`}>
                <td className="cpr-payoffs-player-label">
                  {`P${pIdx + 1} Contribution`}
                </td>
                {rounds.map((r) => (
                  <td key={r}>{getPlayerContribution(r, pIdx)}</td>
                ))}
                <td className="cpr-empty-total-cell">-</td>
              </tr>
            ))}

            {[0, 1, 2, 3].map((pIdx) => (
              <tr key={`actions-${pIdx}`}>
                <td className="cpr-payoffs-player-label">
                  {`P${pIdx + 1} Actions`}
                </td>
                {rounds.map((r) => (
                  <td key={r} style={{ fontSize: "0.7rem", color: "#CBD5E1" }}>
                    {getPlayerActions(r, pIdx)}
                  </td>
                ))}
                <td className="cpr-empty-total-cell">-</td>
              </tr>
            ))}

            {[0, 1, 2, 3].map((pIdx) => (
              <tr key={`payoff-${pIdx}`}>
                <td className="cpr-payoffs-player-label">
                  {`P${pIdx + 1} Payoff`}
                </td>
                {rounds.map((r) => (
                  <td key={r}>{getPlayerPayoff(r, pIdx)}</td>
                ))}
                <td className="cpr-running-total-cell">
                  {getPlayerTotalPayoff(pIdx)}
                </td>
              </tr>
            ))}

            <tr>
              <td className="cpr-payoffs-player-label">Total Contribution</td>
              {rounds.map((r) => (
                <td key={r}>{getTotalContribution(r)}</td>
              ))}
              <td className="cpr-empty-total-cell">-</td>
            </tr>

            <tr>
              <td className="cpr-payoffs-player-label">Group Return</td>
              {rounds.map((r) => {
                const rd = getRoundData(r)
                return <td key={r}>{rd?.groupReturn?.toFixed(2) ?? ""}</td>
              })}
              <td className="cpr-empty-total-cell">-</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  )
}
