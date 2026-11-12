import React from "react"
import { createRoot } from "react-dom/client"
import { act } from "react-dom/test-utils"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import CustomExperimentHome from "./CustomExperimentHome"
import { gameApi } from "./services/gameApi"

jest.mock("./components/PayoffMatrix", () => () => null)
jest.mock("./services/gameApi", () => ({
  gameApi: {
    matchmakeCustomTheGame: jest.fn().mockResolvedValue({}),
    matchmakeCustomUltimatum: jest.fn().mockResolvedValue({}),
  },
  getPlayerFingerprint: () => "test-participant",
}))

let container
let root
const originalFetch = global.fetch

function MatchmakingLocation() {
  const { search } = useLocation()
  return <div>{search}</div>
}

async function renderHome() {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={["/experiments/test-experiment/play"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/experiments/:id/play" element={<CustomExperimentHome />} />
          <Route path="/experiments/:id/consent" element={<div>Consent required</div>} />
          <Route path="*" element={<MatchmakingLocation />} />
        </Routes>
      </MemoryRouter>
    )
  })
}

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
  jest.clearAllMocks()
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  global.fetch = originalFetch
})

test.each(["prisoner", "ultimatum", "public_goods", "common_pool"].flatMap(gameType =>
  ["online", "bot"].map(mode => [gameType, mode])
))("%s shows and launches only the assigned condition in %s mode", async (gameType, mode) => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      id: "test-experiment",
      name: "Test study",
      game_type: gameType,
      game_mode: mode,
      condition: { id: 2, rounds: 17, room_type: "basic", room_name: "Prisoner's Dilemma" },
    }),
  })

  await renderHome()

  const expectedTitle = mode === "bot" ? "Play with Bot" : "Play Online"
  expect(global.fetch).toHaveBeenCalledWith(
    "/api/custom-rooms/experiments/test-experiment/participation/?player_fingerprint=test-participant"
  )
  expect(container.querySelectorAll(".condition-tabs, .tab-btn")).toHaveLength(0)
  expect(container.textContent).toContain("17")
  expect(container.querySelectorAll(".custom-game-mode-card")).toHaveLength(1)
  expect(container.querySelector(".custom-game-mode-title").textContent).toBe(expectedTitle)

  const buttons = container.querySelectorAll(".custom-game-mode-button")
  expect(buttons).toHaveLength(1)
  expect(buttons[0].textContent).toBe("Start the game")

  await act(async () => buttons[0].click())
  if (gameType === "prisoner" || gameType === "ultimatum") {
    const matchmake = gameType === "prisoner" ? gameApi.matchmakeCustomTheGame : gameApi.matchmakeCustomUltimatum
    expect(matchmake).toHaveBeenCalledWith("test-experiment", "test-participant", 2, mode)
  } else {
    const query = new URLSearchParams(container.textContent)
    expect(query.get("mode")).toBe(mode)
    expect(query.get("condition_id")).toBe("2")
  }
})

test("requires server consent even if a local consent marker exists", async () => {
  sessionStorage.setItem("consent_test-experiment", "accepted")
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403 })
  try {
    await renderHome()
    expect(container.textContent).toBe("Consent required")
    expect(container.querySelectorAll(".custom-game-mode-button")).toHaveLength(0)
  } finally {
    sessionStorage.removeItem("consent_test-experiment")
  }
})

test("an unavailable assignment shows an error without offering another condition", async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 400 })
  await renderHome()
  expect(container.querySelector('[role="alert"]').textContent).toContain("contact the researcher")
  expect(container.querySelectorAll(".custom-game-mode-button, .tab-btn")).toHaveLength(0)
})
