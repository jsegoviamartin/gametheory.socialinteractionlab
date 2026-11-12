import React from 'react'
import { createRoot } from 'react-dom/client'
import { act, Simulate } from 'react-dom/test-utils'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import GameBoard from './GameBoard'

let container
let root
let sockets
const originalFetch = global.fetch
const originalWebSocket = global.WebSocket

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true
  jest.useFakeTimers()
  jest.spyOn(console, 'log').mockImplementation(() => {})
  jest.spyOn(console, 'error').mockImplementation(() => {})
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  sockets = []
  global.WebSocket = class {
    static OPEN = 1
    static CONNECTING = 0
    constructor() {
      this.readyState = 1
      this.send = jest.fn()
      this.close = jest.fn()
      sockets.push(this)
    }
  }
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  localStorage.clear()
  global.fetch = originalFetch
  global.WebSocket = originalWebSocket
  jest.useRealTimers()
  jest.restoreAllMocks()
})

test.each([
  ['custom experiment', undefined, 'obsolete-participant', false],
  ['reloaded match', undefined, null, true],
  ['standard game', 'standard-participant', null, false],
])('%s submits the survey with the same participant identity used to join the match', async (_, fingerprintProp, legacyFingerprint, retry) => {
  localStorage.setItem('player_fingerprint', 'saved-participant')
  if (legacyFingerprint) localStorage.setItem('playerUUID', legacyFingerprint)
  const expectedFingerprint = fingerprintProp || 'saved-participant'
  global.fetch = jest.fn()
  if (retry) global.fetch.mockResolvedValueOnce({
    ok: false, status: 400, json: async () => ({ message: 'Survey could not be saved. Please try again.' }),
  })
  global.fetch.mockResolvedValue({ ok: true, json: async () => ({ status: 'success' }) })

  await act(async () => root.render(
    <MemoryRouter initialEntries={['/prisoners/game/test-match?experiment=study']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path='/prisoners/game/:matchId' element={<GameBoard playerFingerprint={fingerprintProp} />} />
      </Routes>
    </MemoryRouter>
  ))
  const socket = sockets[0]
  act(() => {
    socket.onopen()
    socket.onmessage({ data: JSON.stringify({ game_state: {
      player1Fingerprint: expectedFingerprint, waitingForOpponent: false, gameOver: true,
    } }) })
  })
  expect(JSON.parse(socket.send.mock.calls[0][0]).player_fingerprint).toBe(expectedFingerprint)
  for (let i = 0; i < 4; i++) act(() => jest.advanceTimersByTime(1000))
  const navigation = container.querySelectorAll('.game-actions button:not(.survey-button)')
  expect(navigation).toHaveLength(1)
  expect(navigation[0].textContent).toBe('Go back to portal')
  act(() => container.querySelector('.survey-button').click())

  const answers = {
    age: '25', gender: 'Prefer not to say', nationality: 'Morocco', residence: 'Morocco',
    education: "Bachelor's degree", religion: 'No religion', meditation: 'No', punitive_God: 'No', game_theory: 'Yes',
  }
  act(() => Object.entries(answers).forEach(([field, value]) => {
    Simulate.change(container.querySelector(`#${field}`), { target: { value } })
  }))
  await act(async () => Simulate.submit(container.querySelector('.survey-form')))
  if (retry) {
    expect(container.querySelector('.submit-error').textContent).toBe('Survey could not be saved. Please try again.')
    expect(container.querySelector('#age').value).toBe('25')
    await act(async () => Simulate.submit(container.querySelector('.survey-form')))
  }
  const [url, options] = global.fetch.mock.calls[0]
  expect(url).toContain('/api/prisoners/submit_survey/')
  expect(JSON.parse(options.body)).toEqual({
    match_id: 'test-match', player_fingerprint: expectedFingerprint,
    survey_data: { ...answers, meditation_years: '', other: '' },
  })
  expect(document.body.textContent).toContain('Survey Submitted')
})
