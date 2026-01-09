
/**
 * Sistema de ELO Profesional para Padeluminatis
 * Basado en el sistema de puntuación ELO estándar con adaptaciones para pádel.
 */

export class EloSystem {
    constructor() {
        this.K_FACTOR_DEFAULT = 32;
        this.K_FACTOR_PRO = 16; // Para jugadores con alto ELO
        this.K_FACTOR_NEW = 40; // Para primeros 30 partidos
        this.PRO_RATING_THRESHOLD = 2400;
    }

    /**
     * Calcula la probabilidad de victoria del Jugador A sobre el Jugador B
     * @param {number} ratingA - ELO del Jugador/Equipo A
     * @param {number} ratingB - ELO del Jugador/Equipo B
     * @returns {number} Probabilidad (0-1)
     */
    getExpectedScore(ratingA, ratingB) {
        return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
    }

    /**
     * Determina el factor K dinámico basado en el historial del jugador
     * @param {number} rating - ELO actual
     * @param {number} matchesPlayed - Partidos jugados
     * @returns {number} Factor K
     */
    getKFactor(rating, matchesPlayed) {
        if (matchesPlayed < 30) return this.K_FACTOR_NEW;
        if (rating >= this.PRO_RATING_THRESHOLD) return this.K_FACTOR_PRO;
        return this.K_FACTOR_DEFAULT;
    }

    /**
     * Calcula los nuevos ratings después de un partido
     * @param {number} ratingA - ELO Equipo A
     * @param {number} ratingB - ELO Equipo B
     * @param {number} actualScoreA - 1 (Victoria), 0.5 (Empate), 0 (Derrota)
     * @param {number} matchesA - Partidos jugados por A
     * @param {number} matchesB - Partidos jugados por B
     * @param {object} options - Opciones extra (diferencia sets, etc)
     * @returns {object} { newRatingA, newRatingB, changeA, changeB }
     */
    calculateMatchRatings(ratingA, ratingB, actualScoreA, matchesA, matchesB, options = {}) {
        const expectedA = this.getExpectedScore(ratingA, ratingB);
        const expectedB = 1 - expectedA; // O getExpectedScore(ratingB, ratingA)

        const kA = this.getKFactor(ratingA, matchesA);
        const kB = this.getKFactor(ratingB, matchesB);

        // Ajuste por margen de victoria (opcional, basado en sets)
        let marginMultiplier = 1;
        if (options.setsDifference) {
            // Si ganó 2-0 (diferencia 2), bonificación. Si 2-1 (diferencia 1), normal.
            marginMultiplier = Math.log(Math.abs(options.setsDifference) + 1); 
        }

        let changeA = kA * (actualScoreA - expectedA) * marginMultiplier;
        let changeB = kB * ((1 - actualScoreA) - expectedB) * marginMultiplier;

        // Redondear
        changeA = Math.round(changeA);
        changeB = Math.round(changeB);

        return {
            newRatingA: ratingA + changeA,
            newRatingB: ratingB + changeB,
            changeA,
            changeB
        };
    }

    /**
     * Calcula el progreso de Nivel (XP)
     * @param {number} currentXp - XP actual
     * @param {number} currentLevel - Nivel actual
     * @param {boolean} isWin - Si ganó
     * @param {number} performanceScore - Puntuación de desempeño (0-100)
     * @returns {object} { newXp, newLevel, levelUp }
     */
    calculateLevelProgress(currentXp, currentLevel, isWin, performanceScore = 50) {
        let xpGain = isWin ? 100 : 25; // Base XP
        
        // Bonus por desempeño
        xpGain += Math.round(performanceScore * 0.5);

        // Bonus por racha (se manejaría externamente, pero aquí asumimos base)
        
        let newXp = currentXp + xpGain;
        
        // Fórmula de nivel: XP necesaria = Nivel * 1000 (ejemplo simple)
        // O exponencial: 100 * (Level ^ 1.5)
        const xpForNextLevel = Math.floor(1000 * Math.pow(currentLevel, 1.2));
        
        let newLevel = currentLevel;
        let levelUp = false;

        if (newXp >= xpForNextLevel) {
            newLevel++;
            newXp = newXp - xpForNextLevel; // Reset XP bar or keep accumulating? 
            // Usually keep accumulating total XP, but for bar display we need relative.
            // Let's assume currentXp is TOTAL XP.
            levelUp = true;
        }

        return {
            xpAdded: xpGain,
            totalXp: newXp, // This logic assumes input was total XP
            newLevel,
            levelUp,
            xpForNextLevel: Math.floor(1000 * Math.pow(newLevel, 1.2))
        };
    }
}
