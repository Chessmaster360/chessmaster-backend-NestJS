# Chessmaster Backend - Game Analysis Documentation

## Overview

The Chessmaster backend provides chess game analysis using the Stockfish engine. It receives PGN (Portable Game Notation) from the frontend, parses game positions, evaluates each move using Stockfish, and returns a detailed report with move classifications and accuracy metrics.

---

## Requirements

### System Requirements

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | 18+ | LTS recommended |
| MongoDB | Atlas or local | For user data storage |
| Stockfish | 17+ | Native binary required |

### Stockfish Binary

The system uses a native Stockfish binary instead of WASM for better performance and stability.

**Location**: `src/engine/stockfish/stockfish-windows-x86-64-avx2.exe`

**For Linux deployment**: Download `stockfish-ubuntu-x86-64-avx2` from GitHub releases.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
│                    POST /api/chess/analyze                       │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           v
┌─────────────────────────────────────────────────────────────────┐
│                     ChessController                              │
│                    chess.controller.ts                           │
│              Receives PGN + depth parameters                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           v
┌─────────────────────────────────────────────────────────────────┐
│                     AnalysisService                              │
│                    AnalysisService.ts                            │
│            Orchestrates the analysis workflow                    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
           ┌───────────────┴───────────────┐
           v                               v
┌─────────────────────┐         ┌─────────────────────┐
│    ChessService     │         │    EngineService    │
│   chess.service.ts  │         │  engine.service.ts  │
│                     │         │                     │
│ - Parse PGN         │         │ - Stockfish process │
│ - Classify moves    │         │ - Evaluate positions│
│ - Calculate accuracy│         │ - Get best moves    │
└─────────────────────┘         └──────────┬──────────┘
                                           │
                                           v
                                ┌─────────────────────┐
                                │  Stockfish Binary   │
                                │    (child_process)  │
                                └─────────────────────┘
```

---

## Module Descriptions

### ChessController

**File**: `src/chess/chess.controller.ts`

**Endpoints**:

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/archives/:username` | Get player game archives from Chess.com |
| GET | `/games/:username/:year/:month` | Get games for a specific month |
| GET | `/pgn/:username/:year/:month` | Get PGN for a specific month |
| POST | `/analyze` | Analyze a game with Stockfish |

**Analyze Request Body**:
```typescript
{
  pgn: string;   // Full PGN of the game
  depth: number; // Analysis depth (10-20 recommended)
}
```

---

### AnalysisService

**File**: `src/chess/AnalysisService.ts`

**Purpose**: Orchestrates the complete analysis workflow.

**Method**: `analyzeGame(pgn: string, depth: number)`

**Flow**:
1. Validate the PGN format
2. Parse PGN into positions using ChessService
3. Evaluate each position using EngineService
4. Classify each move based on evaluation delta
5. Calculate accuracy percentages
6. Return formatted report

---

### ChessService

**File**: `src/chess/chess.service.ts`

**Purpose**: Chess logic and external API integration.

**Key Methods**:

| Method | Description |
|--------|-------------|
| `parsePgn(pgn)` | Converts PGN to array of positions with FEN |
| `classifyMove(delta)` | Returns move classification based on eval change |
| `calculateAccuracy(classifications)` | Computes accuracy percentage |
| `formatAnalysisReport(positions, accuracy)` | Formats final report |

**Move Classification Logic**:

| Classification | Evaluation Delta (centipawns) |
|----------------|-------------------------------|
| best | 0 (engine's top choice) |
| excellent | 0-50 loss |
| good | 50-150 loss |
| inaccuracy | 150-300 loss |
| mistake | 300-700 loss |
| blunder | 700+ loss |

---

### EngineService

**File**: `src/engine/engine.service.ts`

**Purpose**: Interface with Stockfish binary.

**Implementation Details**:

- Uses `child_process.spawn` to run Stockfish as subprocess
- Communicates via UCI (Universal Chess Interface) protocol
- Keeps Stockfish process alive between analyses for efficiency
- Supports MultiPV (multiple principal variations)

**Key Methods**:

| Method | Description |
|--------|-------------|
| `evaluatePosition(fen, depth)` | Get engine evaluation for position |
| `getSuggestedMove(lines, fen)` | Extract best move in SAN notation |
| `calculateEvaluationDelta(current, previous)` | Compare evaluations |

**Stockfish Communication**:

```
Application -> Stockfish: "uci"
Stockfish -> Application: "uciok"
Application -> Stockfish: "position fen [FEN]"
Application -> Stockfish: "go depth [N]"
Stockfish -> Application: "info depth N ... score cp X pv [move]..."
Stockfish -> Application: "bestmove [move]"
```

---

## Data Interfaces

### Position

```typescript
interface Position {
  fen: string;
  move: {
    san: string;  // Standard Algebraic Notation (e.g., "Nf3")
    uci: string;  // UCI notation (e.g., "g1f3")
  };
}
```

### EvaluatedPosition

```typescript
interface EvaluatedPosition {
  fen: string;
  move: { san: string; uci: string };
  evaluation: { type: 'cp' | 'mate'; value: number };
  classification: Classification;
  suggestedMove: { san: string; uci: string };
}
```

### Report (API Response)

```typescript
interface Report {
  positions: EvaluatedPosition[];
  accuracies: {
    white: number;  // 0-100
    black: number;  // 0-100
  };
  classifications: {
    white: Record<Classification, number>;
    black: Record<Classification, number>;
  };
}
```

---

## Analysis Flow Example

```
1. Frontend sends: POST /api/chess/analyze
   Body: { pgn: "1. e4 e5 2. Nf3 Nc6...", depth: 15 }

2. ChessController receives request
   Calls: analysisService.analyzeGame(pgn, depth)

3. AnalysisService.analyzeGame()
   3.1. validatePgn(pgn) - Verify PGN is valid
   3.2. chessService.parsePgn(pgn) - Get positions array
        Result: [{fen: "...", move: {san: "e4", uci: "e2e4"}}, ...]

4. AnalysisService.classifyAndSuggest(positions, depth)
   For each position:
   4.1. engineService.evaluatePosition(fen, depth)
        Stockfish returns: [{evaluation: {cp: 30}, moveUCI: "d7d5"}]
   4.2. Calculate delta from previous position
   4.3. chessService.classifyMove(delta)
        Result: "excellent" | "good" | "mistake" | etc.

5. ChessService.formatAnalysisReport()
   - Separate white/black moves
   - Count classifications per player
   - Calculate accuracy percentages

6. Return Report to frontend
```

---

## Deployment Notes

### Docker Configuration

Include Stockfish binary in Docker image:

```dockerfile
FROM node:18-alpine

# Install Stockfish
RUN wget https://github.com/official-stockfish/Stockfish/releases/download/sf_17/stockfish-ubuntu-x86-64-avx2.tar.gz \
    && tar -xzf stockfish-ubuntu-x86-64-avx2.tar.gz \
    && mv stockfish /app/src/engine/stockfish/

WORKDIR /app
COPY . .
RUN npm install
RUN npm run build

CMD ["npm", "run", "start:prod"]
```

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| NODE_ENV | Environment mode | development / production |
| MONGO_URI | MongoDB connection string | mongodb+srv://... |
| PORT | Server port (optional) | 3000 |

---

## Performance Considerations

| Factor | Recommendation |
|--------|----------------|
| Analysis depth | 10-15 for speed, 18-20 for accuracy |
| Concurrent analyses | Limit to 2-3 simultaneous games |
| Stockfish process | Reused between analyses (not restarted) |
| Long games (50+ moves) | May take 30-60 seconds at depth 15 |
