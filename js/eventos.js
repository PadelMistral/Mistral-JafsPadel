import { 
    subscribeToCollection,
    getDocument,
    updateDocument,
    getTimestamp
} from './firebase-service.js';
import { authGuard } from './ui-core.js';
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js';

authGuard();

document.addEventListener('DOMContentLoaded', () => {
    const eventsList = document.getElementById('events-list-pro');
    const tabs = document.querySelectorAll('.event-tab');
    
    let currentUser = null;
    let currentFilter = 'all';
    let allEvents = [];

    onAuthStateChanged(auth, async (user) => {
        if (!user) return;
        currentUser = user;
        
        // Initial Avatar for header (reusing logic if needed or let ui-core handle it)
        
        // Real-time subscription to events
        subscribeToCollection('eventos', (events) => {
            allEvents = events.sort((a,b) => (a.startDate?.seconds || 0) - (b.startDate?.seconds || 0));
            renderEvents();
        }, [], [['startDate', 'asc']]);
    });

    function renderEvents() {
        const filtered = currentFilter === 'all' 
            ? allEvents 
            : allEvents.filter(e => e.type === currentFilter);

        if (filtered.length === 0) {
            eventsList.innerHTML = `
                <div class="p-5 text-center opacity-40">
                    <i class="fas fa-calendar-times text-4xl mb-3"></i>
                    <p class="font-bold">No hay eventos de este tipo.</p>
                </div>
            `;
            return;
        }

        eventsList.innerHTML = filtered.map((e, idx) => {
            const date = e.startDate?.toDate ? e.startDate.toDate() : new Date();
            const dateStr = date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
            const timeStr = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
            
            const max = e.maxParticipants || 16;
            const cur = e.currentParticipants || 0;
            const pct = Math.min((cur / max) * 100, 100);
            const isFull = cur >= max;
            const accent = e.type === 'tournament' ? '#FFD700' : (e.type === 'league' ? '#00C3FF' : '#FF6B35');

            return `
                <div class="event-card-neo slide-up" style="--card-accent: ${accent}; animation-delay: ${idx * 0.1}s">
                    <div class="ec-head">
                        <span class="ec-type">${e.type || 'EVENTO'}</span>
                        <span class="ec-status" style="color:${accent}AA">${(e.estado || 'ABIERTO').toUpperCase()}</span>
                    </div>
                    
                    <h3 class="ec-name">${e.name}</h3>
                    
                    <div class="ec-info-grid">
                        <div class="ec-info-item">
                            <i class="far fa-calendar"></i> ${dateStr} - ${timeStr}
                        </div>
                        <div class="ec-info-item">
                            <i class="fas fa-location-dot"></i> Benicalap
                        </div>
                        ${e.level ? `
                        <div class="ec-info-item" style="grid-column: span 2">
                            <i class="fas fa-signal"></i> RECOMENDADO: NIVEL ${e.level}
                        </div>` : ''}
                    </div>

                    <div class="ec-join-area">
                        <div class="ec-players-bar">
                            <div class="flex-between text-2xs font-bold opacity-60">
                                <span>INSCRITOS</span>
                                <span>${cur}/${max}</span>
                            </div>
                            <div class="bar-bg">
                                <div class="bar-fill" style="width:${pct}%"></div>
                            </div>
                        </div>

                        <div class="ec-prize">
                            <span class="prize-label">Premio</span>
                            <span class="prize-val">${e.prize || e.entryFee + '€' || 'Gloria'}</span>
                        </div>
                    </div>

                    <div class="mt-4 flex-between align-center">
                        <button class="btn-join-neo join-btn" data-id="${e.id}" ${isFull ? 'disabled' : ''}>
                            ${isFull ? 'COMPLETO' : 'INSCRIBIRSE'}
                        </button>
                        <span class="text-xs font-bold opacity-40">CUOTA: ${e.entryFee > 0 ? e.entryFee + '€' : 'GRATIS'}</span>
                    </div>
                </div>
            `;
        }).join('');

        // Attach listeners
        document.querySelectorAll('.join-btn').forEach(btn => {
            btn.onclick = () => handleJoin(btn.dataset.id);
        });
    }

    async function handleJoin(eventId) {
        import('./ui-core.js').then(ui => {
            ui.showToast('SISTEMA EN MANTENIMIENTO: Las inscripciones no están disponibles por el momento.', 'warning');
        });
    }

    // Tabs functionality
    tabs.forEach(tab => {
        tab.onclick = () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentFilter = tab.dataset.type;
            renderEvents();
        };
    });
});
