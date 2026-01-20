// ===== NEO INTELLIGENCE - Sistema de IA Avanzado =====

class NeoIntelligence {
    constructor() {
        this.isOpen = false;
        this.userData = null;
        this.playersList = [];
        this.conversationHistory = [];
        this.knowledgeBase = this.buildKnowledgeBase();
        this.init();
    }

    init() {
        this.createWidget();
        this.attachEventListeners();
        this.setupQuickQuestions();
        setTimeout(() => {
            this.addBotMessage(this.getRandomGreeting());
            this.loadKnowledgeBase();
        }, 1000);
    }

    buildKnowledgeBase() {
        return {
            // Features del sistema
            features: {
                ranking: {
                    title: "🏆 Sistema de Ranking",
                    description: "Tu posición se calcula con un algoritmo ELO avanzado que considera: diferencia de nivel, resultado en sets, racha actual y calidad del rival.",
                    tips: [
                        "Gana a jugadores de nivel superior para más puntos",
                        "Mantén una racha positiva para multiplicadores",
                        "Los retos otorgan más puntos que los amistosos"
                    ]
                },
                nivel: {
                    title: "📈 Sistema de Niveles",
                    description: "Tu nivel (2.0-5.0) se ajusta automáticamente según rendimiento. El Consejo puede realizar ajustes especiales.",
                    progression: "Cada 0.5 de nivel requiere aproximadamente 10 victorias contra jugadores de nivel similar o superior."
                },
                reservas: {
                    title: "🎯 Sistema de Reservas",
                    description: "Puedes reservar pistas por franjas horarias. Los colores indican: Verde (libre), Naranja (partida abierta), Rojo (ocupado).",
                    tips: [
                        "Las mejores horas son 18:00-21:00",
                        "Puedes crear retos al reservar",
                        "Máximo 4 jugadores por pista"
                    ]
                },
                puntos: {
                    title: "💎 Family Points",
                    description: "Moneda interna del sistema. Se apuestan en retos y se ganan en eventos especiales.",
                    uses: [
                        "Apuestas en retos",
                        "Comprar mejoras de perfil",
                        "Acceso a torneos premium"
                    ]
                }
            },

            // Análisis táctico
            tactics: {
                beginner: [
                    "Enfócate en consistencia antes que potencia",
                    "Juega al rival débil en dobles",
                    "Mantén la pelota en juego"
                ],
                intermediate: [
                    "Aprende el globo efectivo",
                    "Domina el saque con efecto",
                    "Varía tus tiros para sorprender"
                ],
                advanced: [
                    "Aplica presión con voleas",
                    "Usa el contra-pared estratégicamente",
                    "Controla el centro de la pista"
                ]
            },

            // Análisis de rendimiento
            performance: {
                winStreak: "🔥 Mantén tu racha para bonus de puntos",
                losing: "💡 Analiza tus partidos perdidos en el historial",
                consistency: "📊 Juega regularmente para mejorar tu nivel"
            },

            // Respuestas inteligentes
            responses: {
                greetings: [
                    "¡Hola, campeón! ¿En qué puedo ayudarte hoy?",
                    "Sistemas Nexus activados. Analizando tu rendimiento...",
                    "¡Bienvenido de nuevo! Tu progreso es impresionante.",
                    "Detectando energía competitiva. ¿Listo para mejorar?"
                ],
                encouragement: [
                    "Tu curva de mejora es ascendente. ¡Sigue así!",
                    "Cada partido es una oportunidad para crecer.",
                    "La consistencia es la clave del éxito en el pádel.",
                    "Tienes potencial para llegar al top 10. ¡Enfócate!"
                ],
                unknown: [
                    "Mi análisis no encuentra esa información. ¿Podrías reformular?",
                    "Esa variable no está en mi base de datos Nexus.",
                    "Interesante pregunta. Voy a aprender de ella.",
                    "Puedo ayudarte mejor con: ranking, reservas, niveles o tácticas."
                ]
            }
        };
    }

    createWidget() {
        const widget = document.createElement('div');
        widget.className = 'neo-ai-widget';
        widget.id = 'ai-widget';
        widget.innerHTML = `
            <div class="neo-ai-chat-container">
                <div class="neo-ai-chat-header">
                    <div class="neo-ai-chat-title">
                        <div class="neo-ai-avatar">
                            <i class="fas fa-robot"></i>
                        </div>
                        <div>
                            <h4>NEXUS INTELLIGENCE</h4>
                            <p class="neo-ai-subtitle">Tu asistente de pádal</p>
                        </div>
                    </div>
                    <button class="neo-ai-close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="neo-ai-messages" id="ai-messages"></div>
                
                <div class="neo-ai-quick-questions" id="quick-questions">
                    <button class="neo-quick-question" data-question="¿Cómo subo de nivel?">
                        Subir nivel
                    </button>
                    <button class="neo-quick-question" data-question="¿Quién es el número 1?">
                        Top Ranking
                    </button>
                    <button class="neo-quick-question" data-question="¿Cómo reservo una pista?">
                        Reservar
                    </button>
                    <button class="neo-quick-question" data-question="Dame consejos tácticos">
                        Tácticas
                    </button>
                </div>
                
                <div class="neo-ai-input-container">
                    <input type="text" 
                           class="neo-ai-input" 
                           id="ai-input" 
                           placeholder="Escribe tu pregunta..."
                           autocomplete="off">
                    <button class="neo-ai-send" id="ai-send">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(widget);
    }

    attachEventListeners() {
        const input = document.getElementById('ai-input');
        const sendBtn = document.getElementById('ai-send');
        const closeBtn = document.querySelector('.neo-ai-close');
        
        input?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
        
        sendBtn?.addEventListener('click', () => this.sendMessage());
        closeBtn?.addEventListener('click', () => this.closeChat());
    }

    setupQuickQuestions() {
        document.querySelectorAll('.neo-quick-question').forEach(btn => {
            btn.addEventListener('click', () => {
                const question = btn.dataset.question;
                this.addUserMessage(question);
                this.processQuery(question);
            });
        });
    }

    toggleChat() {
        const widget = document.getElementById('ai-widget');
        this.isOpen = !this.isOpen;
        
        if (this.isOpen) {
            widget.classList.add('open');
            document.getElementById('ai-input').focus();
        } else {
            widget.classList.remove('open');
        }
    }

    closeChat() {
        document.getElementById('ai-widget').classList.remove('open');
        this.isOpen = false;
    }

    sendMessage() {
        const input = document.getElementById('ai-input');
        const message = input.value.trim();
        
        if (!message) return;
        
        this.addUserMessage(message);
        input.value = '';
        this.processQuery(message);
    }

    addUserMessage(text) {
        this.appendMessage(text, 'user');
        this.conversationHistory.push({ role: 'user', content: text });
    }

    addBotMessage(text, options = {}) {
        this.appendMessage(text, 'bot', options);
        this.conversationHistory.push({ role: 'bot', content: text });
    }

    appendMessage(text, type, options = {}) {
        const container = document.getElementById('ai-messages');
        
        const message = document.createElement('div');
        message.className = `neo-ai-message ${type}`;
        
        if (options.isHTML) {
            message.innerHTML = text;
        } else {
            message.textContent = text;
        }
        
        container.appendChild(message);
        container.scrollTop = container.scrollHeight;
    }

    async loadKnowledgeBase() {
        try {
            const { getDocs, collection } = await import("https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js");
            const { db } = await import("./firebase-config.js");
            
            const snapshot = await getDocs(collection(db, "usuarios"));
            this.playersList = [];
            
            snapshot.forEach(doc => {
                const data = doc.data();
                this.playersList.push({
                    id: doc.id,
                    name: data.nombreUsuario || data.nombre || "Jugador",
                    level: parseFloat(data.nivel || 2.0),
                    points: parseFloat(data.puntosRanking || data.puntosRankingTotal || 0),
                    matches: parseInt(data.partidosJugados || 0),
                    wins: parseInt(data.victorias || 0),
                    winRate: data.partidosJugados > 0 ? 
                        Math.round((data.victorias / data.partidosJugados) * 100) : 0
                });
            });
            
            this.playersList.sort((a, b) => b.points - a.points);
            console.log("Neo Intelligence: Base de conocimiento actualizada");
            
        } catch (error) {
            console.error("Error cargando base de conocimiento:", error);
        }
    }

    setUserData(data) {
        this.userData = data;
        this.generatePersonalizedAdvice();
    }

    generatePersonalizedAdvice() {
        if (!this.userData) return;
        
        const level = parseFloat(this.userData.nivel || 2.0);
        const streak = parseInt(this.userData.rachaActual || 0);
        const winRate = this.userData.partidosJugados > 0 ? 
            Math.round((this.userData.victorias / this.userData.partidosJugados) * 100) : 0;
        
        let advice = "";
        
        if (streak > 3) {
            advice = `🔥 ¡Racha de ${streak} victorias! Sigue así para subir rápidamente en el ranking.`;
        } else if (streak < 0) {
            advice = "💡 Enfócate en consistencia. Juega contra rivales de nivel similar para recuperar confianza.";
        } else if (winRate > 70) {
            advice = "🌟 Tu winrate es excelente. Prueba jugar contra niveles superiores para seguir mejorando.";
        } else if (level < 3.0) {
            advice = "🎯 Enfócate en dominar los fundamentos. La consistencia es clave en este nivel.";
        } else if (level >= 3.0 && level < 4.0) {
            advice = "⚡ Trabaja en tus golpes especiales y tácticas de dobles.";
        } else {
            advice = "🚀 Eres un jugador avanzado. Perfecciona los detalles y el juego mental.";
        }
        
        // Actualizar UI
        const suggestionEl = document.getElementById('ai-suggestion');
        if (suggestionEl) {
            suggestionEl.innerHTML = `<p>${advice}</p>`;
        }
    }

    processQuery(query) {
        const q = query.toLowerCase().trim();
        
        // Mostrar typing indicator
        this.showTypingIndicator();
        
        setTimeout(() => {
            this.hideTypingIndicator();
            this.generateResponse(q);
        }, 800 + Math.random() * 500);
    }

    showTypingIndicator() {
        const container = document.getElementById('ai-messages');
        const typing = document.createElement('div');
        typing.className = 'neo-ai-message bot';
        typing.id = 'typing-indicator';
        typing.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;
        
        const style = document.createElement('style');
        style.textContent = `
            .typing-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: var(--neo-text-muted);
                animation: typing 1.4s infinite;
            }
            .typing-dot:nth-child(2) { animation-delay: 0.2s; }
            .typing-dot:nth-child(3) { animation-delay: 0.4s; }
            @keyframes typing {
                0%, 60%, 100% { transform: translateY(0); }
                30% { transform: translateY(-8px); }
            }
        `;
        document.head.appendChild(style);
        
        container.appendChild(typing);
        container.scrollTop = container.scrollHeight;
    }

    hideTypingIndicator() {
        const typing = document.getElementById('typing-indicator');
        if (typing) typing.remove();
    }

    generateResponse(query) {
        // 1. Saludos
        if (this.isGreeting(query)) {
            this.respondToGreeting();
            return;
        }
        
        // 2. Intenciones específicas
        const intent = this.detectIntent(query);
        
        switch(intent) {
            case 'ranking':
                this.respondWithRankingInfo();
                break;
                
            case 'reserva':
                this.respondWithReservationInfo();
                break;
                
            case 'nivel':
                this.respondWithLevelInfo();
                break;
                
            case 'puntos':
                this.respondWithPointsInfo();
                break;
                
            case 'tactica':
                this.respondWithTactics();
                break;
                
            case 'proximo':
                this.respondWithNextMatch();
                break;
                
            case 'estadisticas':
                this.respondWithStats();
                break;
                
            case 'consejo':
                this.respondWithPersonalAdvice();
                break;
                
            default:
                this.respondWithGeneralKnowledge(query);
        }
    }

    detectIntent(query) {
        const intents = {
            ranking: ['ranking', 'posición', 'puesto', 'top', 'clasificación', 'puntos'],
            reserva: ['reservar', 'pista', 'calendario', 'horario', 'disponible'],
            nivel: ['nivel', 'subir nivel', 'mejorar', 'progreso'],
            puntos: ['puntos', 'family points', 'fp', 'moneda', 'apostar'],
            tactica: ['táctica', 'consejo', 'mejorar', 'jugada', 'estrategia'],
            proximo: ['próximo', 'siguiente', 'partido', 'cita', 'cuándo juego'],
            estadisticas: ['estadísticas', 'stats', 'rendimiento', 'racha', 'victorias'],
            consejo: ['consejo', 'ayuda', 'qué hacer', 'recomendación']
        };
        
        for (const [intent, keywords] of Object.entries(intents)) {
            if (keywords.some(keyword => query.includes(keyword))) {
                return intent;
            }
        }
        
        return 'unknown';
    }

    respondToGreeting() {
        const greeting = this.getRandomItem(this.knowledgeBase.responses.greetings);
        this.addBotMessage(greeting);
        
        if (this.userData) {
            const name = this.userData.nombreUsuario || 'campeón';
            const followUp = `Veo que tu nivel actual es ${this.userData.nivel || '2.0'}. ¿En qué puedo ayudarte hoy, ${name}?`;
            setTimeout(() => this.addBotMessage(followUp), 1000);
        }
    }

    respondWithRankingInfo() {
        if (!this.playersList.length) {
            this.addBotMessage("Cargando datos de ranking...");
            return;
        }
        
        const top3 = this.playersList.slice(0, 3);
        let userRank = 'No encontrado';
        
        if (this.userData) {
            const rankIndex = this.playersList.findIndex(p => p.id === this.userData.id);
            userRank = rankIndex !== -1 ? `#${rankIndex + 1}` : 'No clasificado';
        }
        
        const response = `
            <div style="margin-bottom: 8px;">
                <strong>🏆 TOP 3 DEL RANKING</strong>
            </div>
            
            ${top3.map((player, index) => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="color: ${index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : '#CD7F32'}; font-weight: 800;">#${index + 1}</span>
                        <span>${player.name}</span>
                    </div>
                    <div style="font-weight: 700;">${Math.round(player.points)} pts</div>
                </div>
            `).join('')}
            
            ${this.userData ? `
                <div style="margin-top: 12px; padding: 8px; background: rgba(138,43,226,0.1); border-radius: 8px; border-left: 3px solid var(--neo-primary);">
                    <div style="font-size: 0.85rem;">
                        <strong>Tu posición:</strong> ${userRank}
                        <br>
                        <strong>Tus puntos:</strong> ${Math.round(this.userData.puntosRanking || 0)}
                    </div>
                </div>
            ` : ''}
            
            <div style="margin-top: 12px; font-size: 0.8rem; color: var(--neo-text-muted);">
                El ranking se actualiza después de cada partido.
                Los retos otorgan más puntos que los amistosos.
            </div>
        `;
        
        this.addBotMessage(response, { isHTML: true });
    }

    respondWithReservationInfo() {
        const response = `
            <div style="margin-bottom: 12px;">
                <strong>🎯 CÓMO RESERVAR UNA PISTA</strong>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 12px; height: 12px; border-radius: 50%; background: #00E676;"></div>
                    <span>Verde: Pista disponible</span>
                </div>
                
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 12px; height: 12px; border-radius: 50%; background: #FFD700;"></div>
                    <span>Naranja: Partida abierta (puedes unirte)</span>
                </div>
                
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 12px; height: 12px; border-radius: 50%; background: #FF1744;"></div>
                    <span>Rojo: Pista ocupada</span>
                </div>
            </div>
            
            <div style="background: rgba(0,195,255,0.1); padding: 10px; border-radius: 8px; border-left: 3px solid var(--neo-secondary); margin-bottom: 12px;">
                <strong>📅 Pasos para reservar:</strong>
                <ol style="margin: 8px 0 0 0; padding-left: 20px;">
                    <li>Ve a "Reservas" en el menú inferior</li>
                    <li>Selecciona día y hora disponible</li>
                    <li>Elige tipo de partida (amistoso/reto)</li>
                    <li>Invita a otros jugadores</li>
                    <li>¡Listo! Recibirás notificación</li>
                </ol>
            </div>
            
            <button class="neo-quick-action-btn" onclick="window.location.href='calendario.html'" style="width: 100%; margin-top: 8px;">
                <i class="fas fa-calendar-alt"></i> IR AL CALENDARIO
            </button>
        `;
        
        this.addBotMessage(response, { isHTML: true });
    }

    respondWithLevelInfo() {
        const level = this.userData?.nivel || 2.0;
        const nextLevel = Math.min(5.0, Math.ceil(level * 2) / 2);
        const progress = ((level - 2) / 3) * 100;
        
        const response = `
            <div style="margin-bottom: 12px;">
                <strong>📈 TU PROGRESIÓN DE NIVEL</strong>
            </div>
            
            <div style="text-align: center; margin-bottom: 16px;">
                <div style="font-size: 2rem; font-weight: 800; background: var(--neo-gradient-primary); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 4px;">
                    ${level.toFixed(1)}
                </div>
                <div style="font-size: 0.8rem; color: var(--neo-text-muted);">
                    Siguiente nivel: ${nextLevel.toFixed(1)}
                </div>
            </div>
            
            <div style="margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span style="font-size: 0.8rem;">Progreso</span>
                    <span style="font-size: 0.8rem; font-weight: 700;">${Math.round(progress)}%</span>
                </div>
                <div style="height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
                    <div style="height: 100%; width: ${progress}%; background: var(--neo-gradient-primary); border-radius: 3px;"></div>
                </div>
            </div>
            
            <div style="background: rgba(0,227,118,0.1); padding: 10px; border-radius: 8px; border-left: 3px solid var(--neo-success);">
                <strong>🚀 PARA SUBIR DE NIVEL:</strong>
                <ul style="margin: 8px 0 0 0; padding-left: 20px;">
                    <li>Gana a jugadores de nivel superior</li>
                    <li>Mantén racha positiva de victorias</li>
                    <li>Participa en retos y torneos</li>
                    <li>Mejora tu winrate por encima del 60%</li>
                </ul>
            </div>
            
            <div style="margin-top: 12px; font-size: 0.8rem; color: var(--neo-text-muted);">
                <i class="fas fa-lightbulb"></i> Consejo: Enfócate en jugar contra rivales 0.5 puntos por encima de tu nivel para progresar más rápido.
            </div>
        `;
        
        this.addBotMessage(response, { isHTML: true });
    }

    respondWithTactics() {
        const level = this.userData?.nivel || 2.0;
        let tactics = [];
        
        if (level < 3.0) {
            tactics = this.knowledgeBase.tactics.beginner;
        } else if (level < 4.0) {
            tactics = this.knowledgeBase.tactics.intermediate;
        } else {
            tactics = this.knowledgeBase.tactics.advanced;
        }
        
        const response = `
            <div style="margin-bottom: 12px;">
                <strong>🎯 TÁCTICAS PARA NIVEL ${level.toFixed(1)}</strong>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px;">
                ${tactics.map(tactic => `
                    <div style="display: flex; align-items: flex-start; gap: 8px; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 8px;">
                        <div style="color: var(--neo-success); margin-top: 2px;">
                            <i class="fas fa-check"></i>
                        </div>
                        <span style="flex: 1;">${tactic}</span>
                    </div>
                `).join('')}
            </div>
            
            <div style="background: rgba(255,215,0,0.1); padding: 10px; border-radius: 8px; border-left: 3px solid var(--neo-warning);">
                <strong>💡 CONSEJO ESPECIAL:</strong>
                <p style="margin: 8px 0 0 0;">
                    ${this.getRandomItem([
                        "En dobles, la comunicación con tu pareja es clave.",
                        "Varía la dirección y profundidad de tus tiros.",
                        "Aprende a leer los movimientos del rival.",
                        "Mantén la calma en puntos importantes."
                    ])}
                </p>
            </div>
        `;
        
        this.addBotMessage(response, { isHTML: true });
    }

    respondWithPersonalAdvice() {
        if (!this.userData) {
            this.addBotMessage("Necesito tus datos para darte consejos personalizados.");
            return;
        }
        
        const streak = parseInt(this.userData.rachaActual || 0);
        const winRate = this.userData.partidosJugados > 0 ? 
            Math.round((this.userData.victorias / this.userData.partidosJugados) * 100) : 0;
        
        let advice = "";
        let action = "";
        
        if (streak > 0) {
            advice = `Tu racha de ${streak} victorias es impresionante.`;
            action = "Intenta jugar contra jugadores de nivel superior para maximizar puntos.";
        } else if (streak < 0) {
            advice = `Llevas ${Math.abs(streak)} derrotas consecutivas.`;
            action = "Juega un amistoso para recuperar confianza antes de otro reto.";
        } else {
            advice = "Tu rendimiento es estable.";
            action = "Busca mejorar tu consistencia en los puntos clave.";
        }
        
        if (winRate < 50) {
            advice += " Tu winrate puede mejorar.";
            action = "Enfócate en jugar contra rivales de nivel similar o ligeramente inferior.";
        } else if (winRate > 70) {
            advice += " ¡Excelente winrate!";
            action = "Desafíate con rivales más fuertes para seguir creciendo.";
        }
        
        const response = `
            <div style="margin-bottom: 12px;">
                <strong>🎯 ANÁLISIS PERSONALIZADO</strong>
            </div>
            
            <div style="margin-bottom: 16px;">
                <p>${advice}</p>
                
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin: 12px 0;">
                    <div style="text-align: center;">
                        <div style="font-size: 1.5rem; font-weight: 800; color: ${streak > 0 ? 'var(--neo-success)' : streak < 0 ? 'var(--neo-danger)' : 'var(--neo-text-primary)'}">
                            ${streak > 0 ? '+' : ''}${streak}
                        </div>
                        <div style="font-size: 0.7rem; color: var(--neo-text-muted);">Racha actual</div>
                    </div>
                    
                    <div style="text-align: center;">
                        <div style="font-size: 1.5rem; font-weight: 800; color: ${winRate > 60 ? 'var(--neo-success)' : winRate > 40 ? 'var(--neo-warning)' : 'var(--neo-danger)'}">
                            ${winRate}%
                        </div>
                        <div style="font-size: 0.7rem; color: var(--neo-text-muted);">Winrate</div>
                    </div>
                </div>
                
                <div style="background: rgba(138,43,226,0.1); padding: 10px; border-radius: 8px; border-left: 3px solid var(--neo-primary);">
                    <strong>💡 ACCIÓN RECOMENDADA:</strong>
                    <p style="margin: 8px 0 0 0;">${action}</p>
                </div>
            </div>
        `;
        
        this.addBotMessage(response, { isHTML: true });
    }

    respondWithGeneralKnowledge(query) {
        // Búsqueda inteligente en knowledge base
        let found = false;
        
        for (const [category, data] of Object.entries(this.knowledgeBase.features)) {
            if (query.includes(category)) {
                const response = `
                    <strong>${data.title}</strong>
                    <p style="margin: 8px 0;">${data.description}</p>
                    
                    ${data.tips ? `
                        <div style="margin-top: 12px;">
                            <strong>💡 Consejos:</strong>
                            <ul style="margin: 8px 0 0 0; padding-left: 20px;">
                                ${data.tips.map(tip => `<li>${tip}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                `;
                
                this.addBotMessage(response, { isHTML: true });
                found = true;
                break;
            }
        }
        
        if (!found) {
            const randomResponse = this.getRandomItem(this.knowledgeBase.responses.unknown);
            this.addBotMessage(randomResponse);
            
            // Sugerir temas relevantes
            setTimeout(() => {
                this.addBotMessage("Puedo ayudarte con: ranking, reservas, niveles, tácticas, o estadísticas personales.");
            }, 1000);
        }
    }

    isGreeting(query) {
        const greetings = ['hola', 'buenas', 'hey', 'hi', 'qué tal', 'saludos'];
        return greetings.some(greet => query.includes(greet));
    }

    getRandomItem(array) {
        return array[Math.floor(Math.random() * array.length)];
    }

    getRandomGreeting() {
        return this.getRandomItem(this.knowledgeBase.responses.greetings);
    }

    // Métodos utilitarios
    analyzePerformanceTrend(userData) {
        if (!userData) return null;
        
        const trend = {
            direction: 'stable',
            message: 'Rendimiento estable',
            color: 'var(--neo-text-muted)'
        };
        
        const winRate = userData.partidosJugados > 0 ? 
            (userData.victorias / userData.partidosJugados) * 100 : 0;
        
        if (userData.rachaActual > 3) {
            trend.direction = 'up';
            trend.message = '¡En ascenso!';
            trend.color = 'var(--neo-success)';
        } else if (userData.rachaActual < -2) {
            trend.direction = 'down';
            trend.message = 'Necesita ajustes';
            trend.color = 'var(--neo-danger)';
        } else if (winRate > 60) {
            trend.direction = 'up';
            trend.message = 'Rendimiento alto';
            trend.color = 'var(--neo-success)';
        }
        
        return trend;
    }

    predictNextLevel(userData) {
        if (!userData) return null;
        
        const currentLevel = parseFloat(userData.nivel || 2.0);
        const matchesNeeded = Math.max(1, Math.ceil((5.0 - currentLevel) * 20));
        
        return {
            current: currentLevel,
            next: Math.min(5.0, Math.ceil(currentLevel * 2) / 2),
            matchesNeeded,
            progress: ((currentLevel - 2) / 3) * 100
        };
    }
}

// Inicializar al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    window.neoAI = new NeoIntelligence();
    
    // También disponible globalmente para otros scripts
    window.NexusAI = window.neoAI;
    
    console.log('Neo Intelligence inicializado');
});

// Exportar para uso modular
export default NeoIntelligence;