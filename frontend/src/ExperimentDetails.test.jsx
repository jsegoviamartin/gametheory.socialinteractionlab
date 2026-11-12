import React from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import ExperimentDetails from './ExperimentDetails'

function EditorLocation() {
  return <div>{useLocation().search}</div>
}

test('shows condition names and opens the selected condition for editing', async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const originalFetch = global.fetch
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({
    id: 'study', name: 'Study', game_type: 'prisoner',
    prisoner_conditions: [
      { id: 11, condition_name: 'Baseline', rounds: 5 },
      { id: 22, condition_name: 'High reward', rounds: 12 },
    ],
  }) })
  try {
    await act(async () => root.render(
      <MemoryRouter initialEntries={['/experiments/study?conditionId=22']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path='/experiments/:id' element={<ExperimentDetails />} />
          <Route path='/create-experiment' element={<EditorLocation />} />
        </Routes>
      </MemoryRouter>
    ))
    expect(Array.from(container.querySelectorAll('.tab-btn'), button => button.textContent)).toEqual(['Baseline', 'High reward'])
    expect(container.querySelector('.tab-btn.active').textContent).toBe('High reward')
    expect(container.querySelector('.header-label').textContent).toBe('High reward')
    act(() => container.querySelectorAll('.tab-btn')[0].click())
    expect(container.querySelector('.header-label').textContent).toBe('Baseline')
    act(() => container.querySelector('.edit-cond-mini').click())
    const params = new URLSearchParams(container.textContent)
    expect(params.get('experimentId')).toBe('study')
    expect(params.get('gameType')).toBe('prisoner')
    expect(params.get('conditionId')).toBe('11')
  } finally {
    act(() => root.unmount())
    container.remove()
    global.fetch = originalFetch
  }
})
