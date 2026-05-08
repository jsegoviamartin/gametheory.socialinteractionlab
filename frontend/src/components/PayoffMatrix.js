import "./PayoffMatrix.css"
import { useRef, useEffect } from "react"

const roomConfigs = {
  "prisoners-dilemma": {
    actionA: { label: "Cooperate", class: "cooperate" },
    actionB: { label: "Defect", class: "defect" },
    payoffs: {
      aa: { p1: 20, p2: 20, label: "Mutual Cooperation" },
      ab: { p1: 0, p2: 30, label: "Sucker's Payoff" },
      ba: { p1: 30, p2: 0, label: "Temptation" },
      bb: { p1: 10, p2: 10, label: "Mutual Defection" },
    },
  },
  "bach-stravinsky-1": {
    actionA: { label: "Prize Fight", class: "bach" },
    actionB: { label: "Ballet", class: "stravinsky" },
    payoffs: {
      aa: { p1: 30, p2: 20, label: "Coordinated (Fight)" },
      ab: { p1: 0, p2: 0, label: "Mismatched" },
      ba: { p1: 0, p2: 0, label: "Mismatched" },
      bb: { p1: 20, p2: 30, label: "Coordinated (Ballet)" },
    },
  },
  "bach-stravinsky-2": {
    actionA: { label: "Prize Fight", class: "bach" },
    actionB: { label: "Ballet", class: "stravinsky" },
    payoffs: {
      aa: { p1: 30, p2: 20, label: "Coordinated (Fight)" },
      ab: { p1: 10, p2: 10, label: "Mismatched (Safe)" },
      ba: { p1: 0, p2: 0, label: "Mismatched" },
      bb: { p1: 20, p2: 30, label: "Coordinated (Ballet)" },
    },
  },
  "stag-hunt": {
    actionA: { label: "Stag", class: "stag" },
    actionB: { label: "Hare", class: "hare" },
    payoffs: {
      aa: { p1: 10, p2: 10, label: "Successful Hunt (Stag)" },
      ab: { p1: 1, p2: 8, label: "You missed (Stag), They caught (Hare)" },
      ba: { p1: 8, p2: 1, label: "You caught (Hare), They missed (Stag)" },
      bb: { p1: 5, p2: 5, label: "Safe Bet (Hare)" },
    },
  },
}

function PayoffMatrix({ highlightedCell, room = "prisoners-dilemma", customPayoffs }) {
  const matrixRef = useRef(null)

  // Default to prisoners' dilemma if room not found
  let config = roomConfigs[room] || roomConfigs["prisoners-dilemma"]

  // Inject custom values if provided
  if (customPayoffs) {
    config = {
      ...config,
      actionA: { label: customPayoffs.labelA || config.actionA.label, class: config.actionA.class },
      actionB: { label: customPayoffs.labelB || config.actionB.label, class: config.actionB.class },
      payoffs: {
        aa: { p1: customPayoffs.p1_cc ?? config.payoffs.aa.p1, p2: customPayoffs.p2_cc ?? config.payoffs.aa.p2, label: customPayoffs.label_cc || config.payoffs.aa.label },
        ab: { p1: customPayoffs.p1_cd ?? config.payoffs.ab.p1, p2: customPayoffs.p2_cd ?? config.payoffs.ab.p2, label: customPayoffs.label_cd || config.payoffs.ab.label },
        ba: { p1: customPayoffs.p1_dc ?? config.payoffs.ba.p1, p2: customPayoffs.p2_dc ?? config.payoffs.ba.p2, label: customPayoffs.label_dc || config.payoffs.ba.label },
        bb: { p1: customPayoffs.p1_dd ?? config.payoffs.bb.p1, p2: customPayoffs.p2_dd ?? config.payoffs.bb.p2, label: customPayoffs.label_dd || config.payoffs.bb.label },
      }
    }
  }

  useEffect(() => {
    if (!matrixRef.current) return

    // Find and remove existing highlight
    const previouslyHighlighted = matrixRef.current.querySelector(".payoff-cell.highlighted")
    if (previouslyHighlighted) {
      previouslyHighlighted.classList.remove("highlighted")
    }

    // Add new highlight if data is available
    if (highlightedCell && highlightedCell.player1Action && highlightedCell.player2Action) {
      const p1Action = highlightedCell.player1Action.toLowerCase()
      const p2Action = highlightedCell.player2Action.toLowerCase()

      // Determine indices (a or b) based on the current room's actions
      let a1 = 'b', a2 = 'b'
      if (p1Action === config.actionA.label.toLowerCase()) a1 = 'a'
      if (p2Action === config.actionA.label.toLowerCase()) a2 = 'a'

      // Map a/b to cooperate/defect for CSS class selecting
      const c1 = a1 === 'a' ? 'cooperate' : 'defect'
      const c2 = a2 === 'a' ? 'cooperate' : 'defect'

      const cellSelector = `.${c1}-${c2}`
      const cellToHighlight = matrixRef.current.querySelector(cellSelector)
      if (cellToHighlight) {
        cellToHighlight.classList.add("highlighted")
      }
    }
  }, [highlightedCell, room, config])

  const renderExplanation = () => {
    const formatPayoff = (p1, p2) => {
      if (p1 === p2) return `${p1} points each`
      return `${p1} points for you / ${p2} for them`
    }

    return (
      <div className="payoff-explanation">
        <h3>How points are awarded:</h3>
        <ul>
          <li>IF you {config.actionA.label.toLowerCase()} and the other player {config.actionA.label.toLowerCase()}: {formatPayoff(config.payoffs.aa.p1, config.payoffs.aa.p2)}</li>
          <li>IF you {config.actionA.label.toLowerCase()} and the other player {config.actionB.label.toLowerCase()}: {formatPayoff(config.payoffs.ab.p1, config.payoffs.ab.p2)}</li>
          <li>IF you {config.actionB.label.toLowerCase()} and the other player {config.actionA.label.toLowerCase()}: {formatPayoff(config.payoffs.ba.p1, config.payoffs.ba.p2)}</li>
          <li>IF you {config.actionB.label.toLowerCase()} and the other player {config.actionB.label.toLowerCase()}: {formatPayoff(config.payoffs.bb.p1, config.payoffs.bb.p2)}</li>
        </ul>
      </div>
    )
  }

  return (
    <div className="payoff-matrix-container" ref={matrixRef}>
      <div className="payoff-matrix">
        <div className="matrix-header">
          <div className="matrix-corner"></div>
          <div className="matrix-col-header">
            <div className="player-label">Player 2</div>
            <div className="action-labels">
              <span className="action-cooperate">{config.actionA.label}</span>
              <span className="action-defect">{config.actionB.label}</span>
            </div>
          </div>
        </div>

        <div className="matrix-body">
          <div className="matrix-row-header">
            <div className="player-label vertical">Player 1</div>
            <div className="action-labels vertical">
              <span className="action-cooperate">{config.actionA.label}</span>
              <span className="action-defect">{config.actionB.label}</span>
            </div>
          </div>

          <div className="matrix-cells">
            <div className="matrix-row">
              <div className="payoff-cell cooperate-cooperate">
                <div className="payoff-values">
                  <span className="player1-payoff">{config.payoffs.aa.p1}</span>
                  <span className="payoff-separator">,</span>
                  <span className="player2-payoff">{config.payoffs.aa.p2}</span>
                </div>
                <div className="payoff-label">{config.payoffs.aa.label}</div>
              </div>
              <div className="payoff-cell cooperate-defect">
                <div className="payoff-values">
                  <span className="player1-payoff">{config.payoffs.ab.p1}</span>
                  <span className="payoff-separator">,</span>
                  <span className="player2-payoff">{config.payoffs.ab.p2}</span>
                </div>
                <div className="payoff-label">{config.payoffs.ab.label}</div>
              </div>
            </div>

            <div className="matrix-row">
              <div className="payoff-cell defect-cooperate">
                <div className="payoff-values">
                  <span className="player1-payoff">{config.payoffs.ba.p1}</span>
                  <span className="payoff-separator">,</span>
                  <span className="player2-payoff">{config.payoffs.ba.p2}</span>
                </div>
                <div className="payoff-label">{config.payoffs.ba.label}</div>
              </div>
              <div className="payoff-cell defect-defect">
                <div className="payoff-values">
                  <span className="player1-payoff">{config.payoffs.bb.p1}</span>
                  <span className="payoff-separator">,</span>
                  <span className="player2-payoff">{config.payoffs.bb.p2}</span>
                </div>
                <div className="payoff-label">{config.payoffs.bb.label}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {renderExplanation()}
    </div>
  )
}

export default PayoffMatrix
