import React, { useState, useEffect } from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter, Routes, Route } from "react-router-dom"

import "./index.css"
import "./App.css"
import reportWebVitals from "./reportWebVitals"
import Modal from "./components/Modal"
import MainLandingPage from "./MainLandingPage"
import StandardGamesPage from "./StandardGamesPage"
import CustomizedGamesLanding from "./CustomizedGamesLanding"
import AuthPage from "./AuthPage"
import DashboardPage from "./DashboardPage"
import ExperimentForm from "./ExperimentForm"
import ExperimentDetails from "./ExperimentDetails"
import CustomExperimentLobby from "./CustomExperimentLobby"
import CustomExperimentHome from "./CustomExperimentHome"

// Prisoner's Dilemma game
import PrisonersApp from "./prisoners/PrisonersApp"

// Ultimatum game
import RootLayout from "./ultimatum/RootLayout"
import UltimatumHome from "./ultimatum/HomePage"
import UltimatumGame from "./ultimatum/GamePage"
import UltimatumMatchmaking from "./ultimatum/MatchmakingPage"

import PublicGoodsGamesHome from "./PublicGoodsGames/HomePage"
import PublicGoodsRoomPage from "./PublicGoodsGames/PublicGoodsRoomPage"
import PublicGoodsMatchmakingPage from "./PublicGoodsGames/MatchmakingPage"
import PublicGoodsGamePage from "./PublicGoodsGames/PublicGoodsGamePage"

import CommonPoolResourceHome from "./CommonPoolResource/HomePage"
import CommonPoolResourceRoomPage from "./CommonPoolResource/CommonPoolResourceRoomPage"
import CommonPoolResourceMatchmakingPage from "./CommonPoolResource/MatchmakingPage"
import CommonPoolResourceGamePage from "./CommonPoolResource/CommonPoolResourceGamePage"
function GlobalModalBus() {
  const [payload, setPayload] = useState({ open: false })

  useEffect(() => {
    const handler = (e) => setPayload({ open: true, ...e.detail })
    window.addEventListener("GLOBAL_MODAL", handler)
    return () => window.removeEventListener("GLOBAL_MODAL", handler)
  }, [])

  if (!payload.open) return null

  return <Modal open title={payload.title} message={payload.msg} onClose={() => setPayload({ open: false })} />
}

const root = ReactDOM.createRoot(document.getElementById("root"))
root.render(
  <React.StrictMode>
    <GlobalModalBus />
    <BrowserRouter>
      <Routes>
        {/* Main landing page */}
        <Route path="/" element={<MainLandingPage />} />

        {/* Standard games landing page */}
        <Route path="/standard" element={<StandardGamesPage />} />
        
        {/* Customized games lobby */}
        <Route path="/customized" element={<CustomExperimentLobby />} />
        <Route path="/join-custom" element={<CustomExperimentLobby />} />
        
        {/* Auth routes */}
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/create-experiment" element={<ExperimentForm />} />
        <Route path="/experiments/:id" element={<ExperimentDetails />} />
        <Route path="/experiments/:id/home" element={<CustomExperimentHome />} />

        {/* Prisoner's Dilemma App */}
        <Route path="/prisoners/*" element={<PrisonersApp />} />

        {/* Ultimatum Game Routes */}
        <Route
          path="/ultimatum"
          element={
            <RootLayout>
              <UltimatumHome />
            </RootLayout>
          }
        />
        <Route
          path="/ultimatum/matchmaking"
          element={
            <RootLayout>
              <UltimatumMatchmaking />
            </RootLayout>
          }
        />
        <Route
          path="/ultimatum/game"
          element={
            <RootLayout>
              <UltimatumGame />
            </RootLayout>
          }
        />

        <Route
          path="/public-goods"
          element={
            <RootLayout>
              <PublicGoodsRoomPage />
            </RootLayout>
          }
        />


        <Route
          path="/public-goods/:room"
          element={
            <RootLayout>
              <PublicGoodsGamesHome />
            </RootLayout>
          }
        />


        <Route
          path="/public-goods/matchmaking"
          element={
            <RootLayout>
              <PublicGoodsMatchmakingPage />
            </RootLayout>
          }
        />
        <Route
          path="/public-goods/game"
          element={
            <RootLayout>
              <PublicGoodsGamePage key={window.location.search} />
            </RootLayout>
          }
        />

        {/* Common-pool Resource Game Routes */}
        <Route
          path="/common-pool"
          element={
            <RootLayout>
              <CommonPoolResourceRoomPage />
            </RootLayout>
          }
        />

        <Route
          path="/common-pool/:room"
          element={
            <RootLayout>
              <CommonPoolResourceHome />
            </RootLayout>
          }
        />

        <Route
          path="/common-pool/matchmaking"
          element={
            <RootLayout>
              <CommonPoolResourceMatchmakingPage />
            </RootLayout>
          }
        />
        <Route
          path="/common-pool/game"
          element={
            <RootLayout>
              <CommonPoolResourceGamePage key={window.location.search} />
            </RootLayout>
          }
        />



      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)

reportWebVitals()