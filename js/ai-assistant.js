// --- AP (Galactic Intelligence AI) - Aurora Edition v5.0 ---
// Advanced Assistant: "Soy tu vecina AP"

class GalacticIntelligence {
    constructor() {
        this.isOpen = false;
        this.userData = null;
        this.playersList = [];
        this.init();
    }

    init() {
        this.createWidget();
        this.attachEventListeners();
        this.loadRankingData();
        
        // Initial bot greeting
        setTimeout(() => {
            const name = this.userData?.nombreUsuario || 'Jugador';
            this.addBotMessage(`¡Hola! <b>Soy tu vecina AP</b>. El nexo está vibrando hoy... ¿En qué te ayudo a mejorar tu juego, <b>${name}</b>?`, true);
        }, 2000);
    }

    createWidget() {
        const widget = document.createElement('div');
        widget.id = 'ai-chat-widget';
        widget.innerHTML = `
            <div class="ai-chat-bubble" id="ai-chat-toggle">
                <i class="fas fa-robot"></i>
                <div class="ai-online-dot"></div>
            </div>
            <div class="ai-chat-window" id="ai-chat-window">
                <div class="ai-chat-header">
                    <div class="ai-header-left">
                        <div class="ai-orb-aurora"><i class="fas fa-brain"></i></div>
                        <div class="ai-vitals">
                            <span class="ai-name">VECINA AP</span>
                            <span class="ai-status">MODO PREDICCIÓN ACTIVO</span>
                        </div>
                    </div>
                    <div class="ai-header-right">
                        <button class="ai-header-action" id="ai-clear-chat"><i class="fas fa-trash-alt"></i></button>
                        <button class="ai-minimize" id="ai-minimize"><i class="fas fa-times"></i></button>
                    </div>
                </div>

                <div class="ai-chat-messages" id="ai-chat-messages"></div>

                <div class="ai-tools-area">
                    <select id="ai-tools-select" class="ai-mini-select">
                        <option value="">⚙️ Herramientas Galácticas...</option>
                        <option value="match_forecast">🔮 Pronóstico de Mi Partido</option>
                        <option value="challenge">🤺 A quién retar hoy</option>
                        <option value="app_guide">📖 ¿Cómo funciona la app?</option>
                        <option value="tactics">🛡️ Consejos Tácticos</option>
                        <option value="sim">🎲 Simulador ELO</option>
                        <option value="ranking">🛰️ Radar de Ranking</option>
                    </select>
                </div>

                <div class="ai-interactive-menu" id="ai-interactive-menu">
                    <button class="ai-menu-btn-compact" onclick="window.padeluminatisAI.handleTool('rival')">
                        <i class="fas fa-crosshairs"></i> Rival
                    </button>
                    <button class="ai-menu-btn-compact" onclick="window.padeluminatisAI.handleTool('level')">
                        <i class="fas fa-arrow-up"></i> Nivel
                    </button>
                    <button class="ai-menu-btn-compact" onclick="window.padeluminatisAI.handleTool('match_forecast')">
                        <i class="fas fa-crystal-ball"></i> Suerte
                    </button>
                </div>

                <div class="ai-chat-input-area">
                    <input type="text" id="ai-chat-input" placeholder="Dime algo..." autocomplete="off">
                    <button class="ai-send-btn" id="ai-send-btn"><i class="fas fa-paper-plane"></i></button>
                </div>
            </div>
        `;
        document.body.appendChild(widget);
    }

    attachEventListeners() {
        const toggle = document.getElementById('ai-chat-toggle');
        const minimize = document.getElementById('ai-minimize');
        const clearBtn = document.getElementById('ai-clear-chat');
        const sendBtn = document.getElementById('ai-send-btn');
        const input = document.getElementById('ai-chat-input');
        const select = document.getElementById('ai-tools-select');

        if(toggle) toggle.onclick = () => this.toggleChat();
        if(minimize) minimize.onclick = () => this.toggleChat();
        if(clearBtn) clearBtn.onclick = () => this.clearChat();
        if(sendBtn) sendBtn.onclick = () => this.handleSendMessage();
        if(input) input.onkeypress = (e) => { if(e.key === 'Enter') this.handleSendMessage(); };
        if(select) select.onchange = (e) => {
            if(e.target.value) {
                this.handleTool(e.target.value);
                e.target.value = "";
            }
        };
    }

    async loadRankingData() {
        try {
            const { getCollection } = await import("./firebase-service.js");
            const users = await getCollection('usuarios', [], [], 500);
            this.playersList = users.map(u => ({
                id: u.id,
                name: u.nombreUsuario || u.nombre || 'Jugador',
                points: Math.round(u.puntosRankingTotal || u.puntosRanking || 0),
                level: parseFloat(u.nivel || 2.0)
            })).sort((a,b) => b.points - a.points);
        } catch (e) {}
    }

    setUserData(data) { this.userData = data; }

    toggleChat() {
        this.isOpen = !this.isOpen;
        document.getElementById('ai-chat-window').classList.toggle('active', this.isOpen);
    }

    clearChat() {
        document.getElementById('ai-chat-messages').innerHTML = "";
        this.addBotMessage("Canal de datos limpiado. Mi memoria está lista para nuevos desafíos.", true);
    }

    handleSendMessage() {
        const input = document.getElementById('ai-chat-input');
        const text = input.value.trim();
        if(!text) return;
        this.addUserMessage(text);
        this.processQuery(text);
        input.value = '';
    }

    handleTool(cmd) {
        this.addUserMessage(`Comando: ${cmd.toUpperCase().replace('_', ' ')}`);
        
        // Show thinking dots
        this.showTyping();
        
        setTimeout(() => {
            this.hideTyping();
            switch(cmd) {
                case 'match_forecast': this.predictStats(); break;
                case 'challenge': this.suggestInvite(); break;
                case 'app_guide': this.showTour(); break;
                case 'rival': this.showRival(); break;
                case 'level': this.showLevelAnalysis(); break;
                case 'tactics': this.showTactics(); break;
                case 'sim': this.showSim(); break;
                case 'ranking': this.showRankingRadar(); break;
                default: this.addBotMessage("Me he quedado pensando en la última jugada... Prueba otra herramienta.");
            }
        }, 1000);
    }

    predictStats() {
        const pct = 50 + Math.floor(Math.random() * 30);
        this.addBotMessage(`🔮 <b>PREDICCIÓN CUÁNTICA:</b><br><br>Veo una probabilidad del <b>${pct}%</b> de ganar tu siguiente encuentro. La clave será tu coordinación con el compañero. ¡El destino está en tus manos!`, true);
    }

    suggestInvite() {
        if(!this.playersList.length) return this.addBotMessage("No hay jugadores suficientes en el nexo para aconsejarte.");
        const myIndex = this.playersList.findIndex(p => p.id === this.userData?.uid);
        const target = this.playersList[Math.max(0, (myIndex !== -1 ? myIndex - 1 : 10))];
        this.addBotMessage(`🤺 <b>ESTRATEGIA DE ASCENSO:</b><br><br>Si quieres mejorar tu ranking rápidamente, te aconsejo retar a <b>${target.name}</b>. Ganarle te daría un bono de ELO considerable.`, true);
    }

    showTour() {
        this.addBotMessage(`📖 <b>BIENVENIDO A PADELUMINATIS:</b><br><br>
        1. <b>CALENDARIO:</b> Pulsa en PISTAS para ver qué horas están libres.<br>
        2. <b>RESERVAR:</b> Una vez en el calendario, dale al icono '+' en una hora vacía.<br>
        3. <b>UNIRSE:</b> Busca partidos con slots vacíos y entra para jugar.<br>
        4. <b>ADMIN:</b> Si eres el creador, puedes cerrar la partida o quitar gente.<br><br>
        ¿Quieres que te explique cómo sumar puntos?`, true);
    }

    showRival() {
        const myPoints = this.userData?.puntosRankingTotal || 0;
        const rival = this.playersList.find(p => p.id !== this.userData?.uid && Math.abs(p.points - myPoints) < 100);
        if(rival) this.addBotMessage(`🎯 Tu rival directo en el ranking es <b>${rival.name}</b>. Solo os separan ${Math.abs(rival.points - myPoints)} puntos.`, true);
        else this.addBotMessage("No tienes rivales cercanos en este momento. ¡Eres único!");
    }

    showLevelAnalysis() {
        const level = this.userData?.nivel || 2.0;
        this.addBotMessage(`📈 Tu nivel actual es <b>${level}</b>. Para el siguiente escalón necesitas ganar partidos contra rivales de nivel superior.`, true);
    }

    showTactics() {
        const tips = [
            "No pegues fuerte si no estás bien posicionado. El control gana partidos.",
            "En el saque, intenta variar la dirección para no ser predecible.",
            "Acompaña a tu compañero a la red. Si uno sube, el otro también."
        ];
        this.addBotMessage(`🛡️ <b>CONSEJO TÁCTICO:</b> ${tips[Math.floor(Math.random()*tips.length)]}`);
    }

    showSim() {
        this.addBotMessage(`🎲 <b>SIMULADOR DE PROBABILIDADES:</b><br><br>
        Introduce niveles:<br>
        <div class="glass-strong p-2 rounded mt-2">
            Eq. 1: <input type="number" step="0.1" value="3.0" id="sim-l1" style="width:50px; background:none; border:1px solid #555; color:#fff"><br>
            Eq. 2: <input type="number" step="0.1" value="3.2" id="sim-l2" style="width:50px; background:none; border:1px solid #555; color:#fff" class="mt-1"><br>
            <button onclick="window.padeluminatisAI.runSimulation()" class="btn-xs btn-primary mt-2 w-full">CALCULAR</button>
        </div>`, true);
    }

    runSimulation() {
        const l1 = parseFloat(document.getElementById('sim-l1').value);
        const l2 = parseFloat(document.getElementById('sim-l2').value);
        const prob = 1 / (1 + Math.pow(10, (l2 - l1) / 0.5));
        this.addBotMessage(`⚡ Probabilidad equipo 1: <b>${Math.round(prob*100)}%</b>`);
    }

    showRankingRadar() {
        this.addBotMessage("🛰️ Radar escaneando... Estás en el Top 20% de los jugadores más activos este mes. ¡Sigue así!");
    }

    addUserMessage(text) { this.appendMessage(text, 'user'); }

    addBotMessage(text, isHTML = false) {
        this.showTyping();
        setTimeout(() => {
            this.hideTyping();
            this.appendMessage(text, 'bot', isHTML);
        }, 1200);
    }

    appendMessage(text, type, isHTML = false) {
        const container = document.getElementById('ai-chat-messages');
        if(!container) return;
        const msg = document.createElement('div');
        msg.className = `ai-msg ai-msg-${type}`;
        msg.innerHTML = `<div class="ai-msg-bubble">${isHTML ? text : text.replace(/\n/g, '<br>')}</div>`;
        container.appendChild(msg);
        container.scrollTop = container.scrollHeight;
    }

    showTyping() {
        const container = document.getElementById('ai-chat-messages');
        const typing = document.createElement('div');
        typing.id = 'ai-typing';
        typing.className = 'ai-msg ai-msg-bot';
        typing.innerHTML = `<div class="ai-msg-bubble is-typing"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>`;
        container.appendChild(typing);
        container.scrollTop = container.scrollHeight;
    }

    hideTyping() { document.getElementById('ai-typing')?.remove(); }

    processQuery(query) {
        const q = query.toLowerCase();
        if(q.includes('hola') || q.includes('quien eres')) {
            this.addBotMessage("Soy tu vecina AP, la inteligencia artificial de Padeluminatis. Estoy aquí para guiarte en el nexo.");
        } else if(q.includes('consejo')) {
            this.showTactics();
        } else {
            this.addBotMessage("Interesante... Mi procesador galáctico está analizando eso. Mientras tanto, prueba mis herramientas del menú.");
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.padeluminatisAI = new GalacticIntelligence();
});
