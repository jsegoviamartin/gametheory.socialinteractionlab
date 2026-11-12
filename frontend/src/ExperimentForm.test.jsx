import React from "react"
import { createRoot } from "react-dom/client"
import { act } from "react-dom/test-utils"
import { Simulate } from "react-dom/test-utils"
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom"
import ExperimentForm from "./ExperimentForm"

test("researcher selects one mode that stays selected across the condition step", async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  const originalFetch = global.fetch
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => [] })
  try {
    act(() => root.render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ExperimentForm />
      </MemoryRouter>
    ))
    const online = container.querySelector('input[value="online"]')
    const bot = container.querySelector('input[value="bot"]')
    expect(online.checked).toBe(true)
    expect(bot.checked).toBe(false)
    act(() => bot.click())
    expect(bot.checked).toBe(true)
    expect(online.checked).toBe(false)

    act(() => Simulate.change(container.querySelector('input[type="text"]'), {
      target: { value: "Bot study" },
    }))
    await act(async () => container.querySelector(".next-step-btn").click())
    expect(container.querySelector(".step-title").textContent).toBe("Condition Rules")
    act(() => container.querySelector(".secondary-btn").click())
    expect(container.querySelector('input[value="bot"]').checked).toBe(true)
    expect(container.querySelector('input[value="online"]').checked).toBe(false)
  } finally {
    act(() => root.unmount())
    container.remove()
    global.fetch = originalFetch
  }
})

function SavedLocation() {
  const location = useLocation()
  return <div>{location.pathname}{location.search}</div>
}

test.each([
  ['prisoner', { p1_cc: 9, p2_cc: 7, p1_cd: 0, p2_cd: 30, p1_dc: 30, p2_dc: 0, p1_dd: 10, p2_dd: 10 }],
  ['ultimatum', { endowment: 60, game_type: 'one_shot' }],
  ['public_goods', { endowment: 25, multiplier: 2.5, room_type: 'reward', reward_cost: 0, reward_value: 8 }],
  ['common_pool', { room_type: 'mixed', initial_fish_stock: 0, max_fish_stock: 100, max_extraction: 10, final_bonus_multiplier: 0, reward_cost: 0, reward_value: 0, punishment_cost: 0, punishment_value: 0 }],
])('edits the selected %s condition without adding a condition', async (gameType, settings) => {
  global.IS_REACT_ACT_ENVIRONMENT = true
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const originalFetch = global.fetch
  const originalUrl = window.location.href
  const url = `/create-experiment?experimentId=study&gameType=${gameType}&conditionId=22`
  window.history.replaceState({}, '', url)
  global.fetch = jest.fn().mockImplementation(async (requestUrl) => {
    if (requestUrl.endsWith('/consent/')) return { ok: false, status: 404 }
    return { ok: true, json: async () => ({
      name: 'Study', game_type: gameType, game_mode: 'bot',
      [`${gameType}_conditions`]: [
        { id: 11, condition_name: 'Baseline', rounds: 5 },
        { id: 22, condition_name: 'Treatment', rounds: 12, room_name: "Prisoner's Dilemma", ...settings },
      ],
    }) }
  })
  try {
    await act(async () => root.render(
      <MemoryRouter initialEntries={[url]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path='/create-experiment' element={<ExperimentForm />} />
          <Route path='/experiments/:id' element={<SavedLocation />} />
        </Routes>
      </MemoryRouter>
    ))
    expect(container.querySelector('.step-title').textContent).toBe('Edit Condition')
    const name = container.querySelector('input[type="text"]')
    expect(name.value).toBe('Treatment')
    expect(container.textContent).not.toContain('Save and Add Another Condition')
    act(() => Simulate.change(name, { target: { value: 'Renamed treatment' } }))
    await act(async () => container.querySelector('.primary-btn').click())
    const writes = global.fetch.mock.calls.filter(([, options]) => options?.method)
    expect(writes).toHaveLength(1)
    expect(writes[0][0]).toBe('/api/custom-rooms/experiments/study/update_condition/?condition_id=22')
    expect(writes[0][1].method).toBe('PATCH')
    expect(JSON.parse(writes[0][1].body)).toMatchObject({
      condition_name: 'Renamed treatment', rounds: 12, ...settings,
    })
    expect(container.textContent).toBe('/experiments/study?conditionId=22')
  } finally {
    act(() => root.unmount())
    container.remove()
    global.fetch = originalFetch
    window.history.replaceState({}, '', originalUrl)
  }
})
