import React from "react"
import { createRoot } from "react-dom/client"
import { act } from "react-dom/test-utils"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import ConsentFormParticipant from "./ConsentFormParticipant"

jest.mock("./services/gameApi", () => ({ getPlayerFingerprint: () => "test-participant" }))

let container
let root
const originalFetch = global.fetch

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  global.fetch = originalFetch
})

async function renderConsent() {
  await act(async () => root.render(
    <MemoryRouter initialEntries={["/experiments/study/consent"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/experiments/:id/consent" element={<ConsentFormParticipant />} />
        <Route path="/experiments/:id/home" element={<div>Assigned instructions</div>} />
      </Routes>
    </MemoryRouter>
  ))
}

test("requests assignment only after acceptance and waits for it before showing instructions", async () => {
  let finishAssignment
  global.fetch = jest.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ study_title: "Study" }) })
    .mockImplementationOnce(() => new Promise(resolve => { finishAssignment = resolve }))
  await renderConsent()
  expect(global.fetch).toHaveBeenCalledTimes(1)
  expect(container.querySelector(".accept-btn").disabled).toBe(true)
  act(() => container.querySelector('input[type="checkbox"]').click())
  act(() => container.querySelector(".accept-btn").click())

  expect(global.fetch).toHaveBeenLastCalledWith("/api/custom-rooms/experiments/study/participation/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ player_fingerprint: "test-participant", accepted: true }),
  })
  expect(container.querySelector(".accept-btn").disabled).toBe(true)
  expect(container.textContent).not.toContain("Assigned instructions")
  await act(async () => finishAssignment({ ok: true }))
  expect(container.textContent).toBe("Assigned instructions")
})

test("a failed assignment keeps participants on consent and allows a retry", async () => {
  global.fetch = jest.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ study_title: "Study" }) })
    .mockResolvedValueOnce({ ok: false })
  await renderConsent()
  act(() => container.querySelector('input[type="checkbox"]').click())
  await act(async () => container.querySelector(".accept-btn").click())
  expect(container.querySelector('[role="alert"]').textContent).toContain("Please try again")
  expect(container.querySelector(".accept-btn").disabled).toBe(false)
  expect(container.textContent).not.toContain("Assigned instructions")
})
