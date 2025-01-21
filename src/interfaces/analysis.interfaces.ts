export interface Position {
    fen: string; // La posición en formato FEN.
    move: { san: string; uci: string }; // Detalles del movimiento.
  }
  
  export interface EvaluatedPosition extends Position {
    evaluation: Evaluation; // Evaluación del motor.
    classification: Classification; // Clasificación del movimiento.
    suggestedMove: { san: string; uci: string }; // Movimiento sugerido.
  }
  
  export interface Report {
    accuracies: {
      white: number;
      black: number;
    };
    classifications: {
      white: Record<Classification, number>;
      black: Record<Classification, number>;
    };
    positions: EvaluatedPosition[];
  }
  
  export type Classification =
    | 'brilliant'
    | 'great'
    | 'best'
    | 'excellent'
    | 'good'
    | 'inaccuracy'
    | 'mistake'
    | 'blunder'
    | 'book'
    | 'forced';
  
  export interface Evaluation {
    type: 'cp' | 'mate';
    value: number;
  }
  
  // analysis.interfaces.ts
export interface StockfishRequest {
    fen: string;
    depth: number;
  }
  
  export interface StockfishResponse {
    type: 'evaluation' | 'bestmove';
    value?: number; // Para evaluación.
    move?: string;  // Para la mejor jugada.
  }
  
  export interface SuggestedMove {
    uci: string; // Movimiento sugerido en formato UCI.
  }
  