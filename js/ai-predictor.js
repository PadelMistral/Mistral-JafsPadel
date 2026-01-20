import { db } from './firebase-config.js';

export function initAIPredictor() {
    const btn = document.getElementById('btn-open-oracle');
    if(btn) {
        btn.onclick = openOracleModal;
    }
}

function openOracleModal() {
    const modal = document.getElementById('oracle-modal');
    if(!modal) return;
    modal.classList.add('active');
    
    // Set default values if empty
    if(!document.getElementById('oracle-my-level').value) document.getElementById('oracle-my-level').value = "3.00";
    if(!document.getElementById('oracle-partner-level').value) document.getElementById('oracle-partner-level').value = "3.00";
    if(!document.getElementById('oracle-rival1-level').value) document.getElementById('oracle-rival1-level').value = "3.00";
    if(!document.getElementById('oracle-rival2-level').value) document.getElementById('oracle-rival2-level').value = "3.00";

    document.getElementById('btn-calculate-oracle').onclick = calculatePrediction;
}

window.closeOracleModal = () => {
    document.getElementById('oracle-modal').classList.remove('active');
}

function calculatePrediction() {
    const myLvl = parseFloat(document.getElementById('oracle-my-level').value);
    const pLvl = parseFloat(document.getElementById('oracle-partner-level').value);
    const r1Lvl = parseFloat(document.getElementById('oracle-rival1-level').value);
    const r2Lvl = parseFloat(document.getElementById('oracle-rival2-level').value);

    const myTeamAvg = (myLvl + pLvl) / 2;
    const rivalTeamAvg = (r1Lvl + r2Lvl) / 2;

    // Win Probability (Sigmoid-like based on level diff)
    const diff = myTeamAvg - rivalTeamAvg;
    // 0.2 diff is roughly 65% win rate
    const winProb = 1 / (1 + Math.pow(10, -(diff * 2))); 
    const winPct = Math.round(winProb * 100);

    // Points Estimate
    // We use the simplified formula from ranking.js logic
    const factorProgresivo = 1 - ((myLvl - 2.0) / 2.0) * 0.7;
    const baseWin = 12.5; 
    const baseLoss = -10.8;
    
    // Win Scenario
    const winPointsBase = Math.max(2, baseWin * factorProgresivo);
    const difficultyWin = (rivalTeamAvg - myLvl) * 15.7 * factorProgresivo;
    const partnerFactorWin = ((pLvl - rivalTeamAvg) * 6.3 * factorProgresivo);
    const estWinPoints = (winPointsBase + difficultyWin + partnerFactorWin) * 1.45; // Approx margins/exp

    // Loss Scenario
    const lossPointsBase = Math.min(-2, baseLoss * (2 - factorProgresivo));
    const difficultyLoss = (rivalTeamAvg - myLvl) * 15.7 * factorProgresivo; // Still same diff logic? Usually flipped.
    // Simplifying for UX:
    const estLossPoints = (lossPointsBase + difficultyWin + partnerFactorWin) * 0.8; 

    // Render Result
    const resContainer = document.getElementById('oracle-result');
    resContainer.style.display = 'block';
    
    let advice = "";
    if(winPct > 60) advice = "Tu equipo tiene la ventaja. ¡Aprovechad vuestro nivel superior!";
    else if(winPct < 40) advice = "Será un partido duro. Jugad con estrategia y paciencia.";
    else advice = "Partido muy igualado. Cada punto cuenta.";

    resContainer.innerHTML = `
        <div class="oracle-analysis animate-fade-in">
            <div class="flex-center mb-3">
                <div class="win-prob-circle">
                    <svg viewBox="0 0 36 36" class="circular-chart ${winPct > 50 ? 'success' : 'danger'}">
                        <path class="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                        <path class="circle" stroke-dasharray="${winPct}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                        <text x="18" y="20.35" class="percentage">${winPct}%</text>
                    </svg>
                    <div class="prob-label">VICTORIA</div>
                </div>
            </div>
            
            <div class="prediction-text text-center mb-3">
                "${advice}"
            </div>

            <div class="points-scenarios">
                <div class="scenario win">
                    <span class="badgex win">SI GANAS</span>
                    <span class="pts">+${estWinPoints.toFixed(1)}</span>
                </div>
                <div class="scenario loss">
                    <span class="badgex loss">SI PIERDES</span>
                    <span class="pts">${estLossPoints.toFixed(1)}</span>
                </div>
            </div>
        </div>
    `;
}
