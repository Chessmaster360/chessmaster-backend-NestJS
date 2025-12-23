
export class EvaluationUtils {

  /**
   * Convierte centipawns a porcentaje de victoria (0.0 a 1.0)
   * Usa una función sigmoide ajustada para ajedrez.
   * Fuente: WintrChess / Lichess models
   */
  static getWinProbability(centipawns: number): number {
    return 1 / (1 + Math.exp(-0.0035 * centipawns));
  }

  /**
   * Calcula la pérdida de probabilidad entre dos posiciones.
   * Siempre devuelve un valor positivo (0.0 a 1.0).
   */
  static getProbabilityLoss(
    prevEvalCp: number,
    currentEvalCp: number,
    isWhiteTurn: boolean // De quién fue el turno
  ): number {
    // Convertimos evaluaciones relativas a absolutas para el cálculo
    // Si es turno de blancas, queremos maximizar. Si es negras, minimizar (pero la sigmoide espera CP positivos para ganar)

    // Normalizamos: Probabilidad de ganar para el jugador que movió
    const prevProb = this.getWinProbability(isWhiteTurn ? prevEvalCp : -prevEvalCp);
    const currentProb = this.getWinProbability(isWhiteTurn ? currentEvalCp : -currentEvalCp);

    return Math.max(0, prevProb - currentProb);
  }

  /**
   * Calcula la precisión (0-100) de un movimiento basado en la pérdida.
   * Fórmula avanzada de regresión.
   */
  static getMoveAccuracy(probLoss: number): number {
    // Fórmula calibrada: Una pérdida de 0 da ~100%, pérdidas altas bajan rápido.
    const accuracy = 103.16 * Math.exp(-4 * probLoss) - 3.17;
    return Math.min(100, Math.max(0, accuracy)); // Clamp entre 0 y 100
  }
}