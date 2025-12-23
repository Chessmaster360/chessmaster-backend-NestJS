# Chessmaster 360 - Backend

Backend service for the Chessmaster 360 chess analysis platform. Built with NestJS and integrated with Stockfish engine for deep position analysis.

## Features

- **Game Analysis**: Deep position analysis using Stockfish engine with configurable depth (15-20)
- **Move Classification**: Probability-based classification system (Best, Excellent, Good, Inaccuracy, Mistake, Blunder)
- **Opening Detection**: Automatic book move detection using 3400+ opening positions database
- **Chess.com Integration**: Fetch player archives and games directly from Chess.com API
- **Accuracy Calculation**: Win probability-based accuracy metrics for both players

## Move Classification Thresholds

Classifications are based on centipawn loss (cpLoss):

| Classification | CP Loss     |
|---------------|-------------|
| Best          | 0 (engine's top choice) |
| Excellent     | <= 10 cp    |
| Good          | <= 25 cp    |
| Inaccuracy    | <= 100 cp   |
| Mistake       | <= 350 cp   |
| Blunder       | > 350 cp    |
| Book          | Opening position from database |
| Brilliant     | Best move + material sacrifice |

## Tech Stack

- NestJS (Node.js framework)
- TypeScript
- Stockfish 16 (chess engine)
- chess.js (move validation)
- MongoDB (optional, for persistence)

## Project Structure

```
src/
├── chess/
│   ├── chess.service.ts      # Core chess logic, move classification
│   ├── AnalysisService.ts    # Game analysis orchestration
│   ├── openings.service.ts   # Opening book detection
│   └── evaluation.util.ts    # Win probability calculations
├── engine/
│   ├── engine.service.ts     # Stockfish integration
│   └── stockfish/            # Stockfish executable
├── interfaces/
│   └── analysis.interfaces.ts
└── main.ts
```

## Installation

```bash
# Install dependencies
npm install

# Build
npm run build

# Run development server
npm run start:dev

# Run production
npm run start:prod
```

## Environment Variables

Create a `.env` file:

```env
PORT=3001
MONGO_URI=mongodb://localhost:27017/chessmaster  # Optional
```

## API Endpoints

### POST /chess/analyze
Analyze a chess game from PGN.

**Request Body:**
```json
{
  "pgn": "[Event \"...\"]\n1. e4 e5 2. Nf3 ...",
  "depth": 18
}
```

**Response:**
```json
{
  "positions": [...],
  "accuracies": {
    "white": 85.2,
    "black": 78.4
  },
  "classifications": {
    "white": { "best": 12, "excellent": 5, ... },
    "black": { "best": 8, "mistake": 2, ... }
  }
}
```

### GET /chess/archives/:username
Get player's game archives from Chess.com.

### GET /chess/games/:username/:year/:month
Get games for a specific month.

## Development

The backend includes debug logging for move classification. Check console output for:

```
[Move 27] Rxe6 | Best: Qf3 | isBest: false | Loss: 350cp
```

## License

MIT
