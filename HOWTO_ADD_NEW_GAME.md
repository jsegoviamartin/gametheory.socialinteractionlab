# How to Add a New Game

This guide describes the process of adding a new game (e.g., Public Goods) to the platform, covering both Backend (Django) and Frontend (React).

## 1. Backend Implementation

### 1.1 Create the Game App
1.  Navigate to `backend/game`.
2.  Create a new folder for your game, e.g., `public_goods`.
3.  Add `__init__.py` and `apps.py`.

### 1.2 Define Models (`models.py`)
1.  Define a `Match` model (e.g., `PublicGoodsMatch`) to track the game session, players, and game specifics (e.g., multiplier).
2.  Define a `Round` model (e.g., `PublicGoodsRound`) to track data for each round (contributions, payoffs).
3.  Run `makemigrations` and `migrate`.

### 1.3 Implement Game Logic (`game_logic.py`)
Create a `game_logic.py` file to handle pure game mechanics. This separates logic from views/consumers.
-   **Functions**:
    -   `calculate_payoff(...)`: Returns the results based on inputs.
    -   `update_game_stats(match_uuid, round_number)`: Coordinator function that checks if a round is complete, calls `calculate_payoff`, and updates the database.

### 1.4 create WebSocket Consumer (`consumers.py`)
Handles real-time communication.
1.  Inherit from `AsyncWebsocketConsumer`.
2.  **`connect`**: Validate match ID, add player to channel group.
3.  **`receive`**: Handle actions like `submit_decision`.
4.  **`game_action`**: Broadcast updates.
5.  **Bot Logic**: If playing against bots, trigger bot moves when the human plays (or simultaneously).

### 1.5 Update Routing (`routing.py`)
Register the WebSocket URL in the main `routing.py` or the app-specific one.

## 2. Frontend Implementation

### 2.1 Create Game Page
1.  Create a folder in `frontend/src/YourGame`.
2.  Create `GamePage.jsx`.
3.  Use `useWebSocket` hook (or custom implementation) to connect to the backend.

### 2.2 Handle Game States
1.  **Waiting**: Waiting for players.
2.  **Playing**: Input phase (e.g., Contribution slider).
3.  **Results**: Show roundup of the round.
4.  **Game Over**: Final scores.

## 3. Online vs Bot Modes

### Online
-   Wait for real players to join.
-   `consumers.py` checks `match.players_count()` before starting.

### Bot Mode
-   Consumer detects `game_mode='bot'`.
-   Fill empty slots with "bot" fingerprints.
-   When human submits, trigger `handle_bot_move()` which generates random/heuristic inputs for bots immediately or with a delay.

## 4. Example: Public Goods

**Backend Logic**:
-   Inputs: Contributions from 4 players.
-   Logic: `Pot = Sum(Contributions) * Multiplier`. `Payoff = (Endowment - Contribution) + Pot/4`.

**Frontend**:
-   Slider 0-20.
-   Timer.
