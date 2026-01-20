import { 
    getCollection, 
    addDocument, 
    updateDocument, 
    getDocument, 
    initializeAuthObserver,
    subscribeToCollection,
    getTimestamp
} from './firebase-service.js';
import { authGuard, initSharedUI } from './ui-core.js';

initSharedUI('EVENTOS');

authGuard();

document.addEventListener('DOMContentLoaded', () => {
    const eventsList = document.getElementById('eventsList');
    const createEventBtn = document.getElementById('createEventBtn');
    const applyFiltersBtn = document.getElementById('applyFilters');

    let currentUser = null;
    let userData = null;

    initializeAuthObserver(async (user) => {
        if (!user) {
            window.location.href = 'index.html';
            return;
        }
        currentUser = user;
        userData = await getDocument('usuarios', user.uid);

        if (userData && (userData.rol === 'Admin' || user.email === 'Juanan221091@gmail.com')) {
            createEventBtn.style.display = 'block';
        }

        // Real-time subscription to events
        subscribeToCollection('eventos', (events) => {
            renderEvents(events);
        }, [], [['startDate', 'asc']]);
    });

    function renderEvents(events) {
        if (events.length === 0) {
            eventsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-times"></i>
                    <p>No hay eventos programados en este momento.</p>
                </div>
            `;
            return;
        }

        eventsList.innerHTML = events.map(event => {
            const date = event.startDate?.toDate ? event.startDate.toDate() : new Date(event.startDate);
            const dateStr = date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
            const isFull = (event.currentParticipants || 0) >= (event.maxParticipants || 16);
            
            return `
                <div class="event-card-premium glass-strong slide-up mb-2" style="position:relative; overflow:hidden;" data-id="${event.id}">
                    <div style="background:var(--primary); position:absolute; top:0; left:0; padding:4px 8px; border-bottom-right-radius:10px; font-size:0.7rem; font-weight:800; color:white;">
                        ${event.type?.toUpperCase()}
                    </div>
                    <div class="p-4 pt-5">
                       <h3 class="text-xl font-bold font-rajdhani text-white mb-2 tracking-wide">${event.name}</h3>
                       <div class="flex-between text-muted text-sm mb-3">
                            <span class="flex-center gap-1"><i class="far fa-calendar-alt text-accent"></i> ${dateStr}</span>
                            <span class="flex-center gap-1"><i class="fas fa-users text-warning"></i> ${event.currentParticipants || 0}/${event.maxParticipants || 16}</span>
                       </div>
                       ${event.level ? `<div class="text-xs font-bold mb-3" style="color:var(--text-secondary)"><i class="fas fa-layer-group"></i> NIVEL RECOMENDADO: ${event.level}</div>` : ''}
                       <div class="flex-between align-center mt-2 border-t border-white/10 pt-3">
                           <span class="text-lg font-bold text-success">${event.entryFee > 0 ? event.entryFee + '€' : 'GRATIS'}</span>
                           <button class="btn btn-primary btn-sm join-btn" style="border-radius:20px; padding:6px 16px;" ${isFull ? 'disabled' : ''}>
                               ${isFull ? 'LLENO' : 'INSCRIBIRSE <i class="fas fa-arrow-right ml-1"></i>'}
                           </button>
                       </div>
                    </div>
                </div>
            `;
        }).join('');

        // Add listeners to join buttons
        document.querySelectorAll('.join-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const eventId = e.target.closest('.event-card').dataset.id;
                handleJoinEvent(eventId);
            });
        });
    }

    async function handleJoinEvent(eventId) {
        alert('LO SENTIMOS: La interacción con eventos no está disponible en este momento. Vuelve pronto.');
    }

    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', (e) => {
            e.preventDefault();
            alert('LO SENTIMOS: Los filtros no están disponibles en este momento.');
        });
    }
});
