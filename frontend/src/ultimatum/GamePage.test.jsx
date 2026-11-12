import React from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { MemoryRouter } from 'react-router-dom'
import GamePage from './GamePage'
import { useWebSocket } from '../hooks/useWebSocket'

jest.mock('../hooks/useWebSocket', () => ({ useWebSocket: jest.fn() }))
jest.mock('../services/gameApi', () => ({
  gameApi: { createMatch: jest.fn() }, getPlayerFingerprint: () => 'participant',
}))

test.each([60, 100, 200])('offer submission uses the %s-coin endowment received after the initial render', async (endowment) => {
  global.IS_REACT_ACT_ENVIRONMENT = true
  const log = jest.spyOn(console, 'log').mockImplementation(() => {})
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const sendMessage = jest.fn().mockReturnValue(true)
  const socket = {
    gameState: null, latestResults: null, connectionStatus: 'connected', error: null,
    matchTerminated: false, terminationReason: null, sendMessage, disconnect: jest.fn(),
  }
  useWebSocket.mockReturnValue(socket)
  const renderPage = () => root.render(
    <MemoryRouter initialEntries={['/ultimatum/game?match=test-match&mode=bot']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <GamePage />
    </MemoryRouter>
  )
  try {
    await act(async () => renderPage())
    useWebSocket.mockReturnValue({ ...socket, gameState: {
      endowment, currentRound: 1, maxRounds: 3, gameType: 'iterative', gameMode: 'bot',
      player1Fingerprint: 'participant', player2Fingerprint: 'bot',
      waitingForOpponent: false, gameOver: false, roundHistory: [],
      currentRoundState: {
        player1OfferMade: false, player2OfferMade: false,
        player1ResponseMade: false, player2ResponseMade: false,
      },
    } })
    await act(async () => renderPage())
    // Keep the initial zero offer: changing the input would hide the stale callback bug.
    act(() => container.querySelector('.submit-button-visual').click())
    expect(sendMessage).toHaveBeenCalledWith({
      action: 'make_offer', player_fingerprint: 'participant',
      coins_to_keep: endowment, coins_to_offer: 0,
    })
  } finally {
    act(() => root.unmount())
    container.remove()
    log.mockRestore()
  }
})
