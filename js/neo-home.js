// ===== NEO HOME LOGIC - Lógica avanzada para home.html =====

import { 
    getDocument, 
    getCollection, 
    initializeAuthObserver,
    subscribeToCollection 
} from './firebase-service.js';
import { db } from './firebase-config.js';
import { 
    collection, 
    getDocs, 
    query, 
    where, 
    orderBy, 
    limit 
} from 'https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js';
import { authGuard, showToast } from './ui-core.js';

class NeoHome {
    constructor() {
        this.currentUser = null;
        this.userData = null;
        this.upcomingMatches = [];
        this.libraryMatches = [];
        this.currentSlide = 0;
        this.activeFilters = {
            date: 'all',
            type: 'all',
            status: 'all'
        };
        
        this.init();
    }

    async init() {
        authGuard();
        this.setupEventListeners();
        
        initializeAuthObserver(async (user) => {
            if (user) {
                this.currentUser = user;
                await this.loadUserData(user.uid);
                await this.loadAllData();
                this.setupUI();
                this.startLiveUpdates();
            }
        });
    }

    async loadUserData(uid) {
        try {
            this.userData = await getDocument('usuarios', uid);
            
            if (this.userData) {
                this.updateUIWithUserData();
                
                // Pasar datos a la IA
                if (window.neoAI) {
                    window.neoAI.setUserData({
                        ...this.userData,
                        id: uid
                    });
                }
            }
        } catch (error) {
            console.error('Error cargando datos del usuario:', error);
            showToast('Error', 'No se pudieron cargar tus datos', 'error');
        }
    }

    updateUIWithUserData() {
        // Actualizar nombre
        const name = this.userData.nombreUsuario || this.userData.nombre || 'Jugador';
        document.getElementById('user-name').textContent = name.toUpperCase();
        
        // Actualizar avatar
        this.updateAvatar();
        
        // Actualizar estadísticas
        this.updateStats();
        
        // Actualizar saludo dinámico
        this.updateDynamicGreeting();
        
        // Actualizar progreso
        this.updateProgressBar();
    }

    updateAvatar() {
        const avatarBtn = document.getElementById('header-avatar');
        const heroAvatar = document.getElementById('hero-avatar');
        
        if (!avatarBtn || !heroAvatar) return;
        
        const photoUrl = this.userData.fotoPerfil || this.userData.fotoURL;
        const name = this.userData.nombreUsuario || this.userData.nombre || 'J';
        const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
        
        // Avatar del header
        if (photoUrl) {
            avatarBtn.innerHTML = `<img src="${photoUrl}" alt="Avatar" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
        } else {
            const colors = ['#FF6B35', '#00C3FF', '#8A2BE2', '#00E676', '#FFD700'];
            const hash = Array.from(name).reduce((acc, char) => char.charCodeAt(0) + acc, 0);
            const color = colors[hash % colors.length];
            
            avatarBtn.innerHTML = `
                <div style="width:100%; height:100%; background:${color}; border-radius:50%; display:flex; align-items:center; justify-content:center; color:white; font-weight:700; font-size:0.9rem;">
                    ${initials}
                </div>
            `;
        }
        
        // Avatar del hero
        const avatarContainer = heroAvatar.querySelector('.neo-avatar-placeholder');
        if (avatarContainer) {
            if (photoUrl) {
                avatarContainer.innerHTML = `<img src="${photoUrl}" alt="Avatar" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
            } else {
                avatarContainer.innerHTML = `<span style="font-size:1.5rem; font-weight:700;">${initials}</span>`;
            }
        }
    }

    updateStats() {
        // Calcular ranking
        this.calculateRankingPosition().then(position => {
            const rankEl = document.getElementById('stat-rank');
            if (rankEl) {
                rankEl.textContent = `#${position}`;
                rankEl.style.color = this.getRankColor(position);
            }
            
            const rankBadge = document.getElementById('user-rank');
            if (rankBadge) {
                rankBadge.textContent = this.getRankTitle(position);
            }
        });
        
        // Estadísticas principales
        const stats = {
            streak: document.getElementById('stat-streak'),
            points: document.getElementById('stat-points'),
            level: document.getElementById('stat-level')
        };
        
        if (stats.streak) {
            const streak = parseInt(this.userData.rachaActual || 0);
            stats.streak.textContent = streak > 0 ? `+${streak}` : streak;
            stats.streak.style.color = streak > 0 ? 'var(--neo-success)' : 
                                      streak < 0 ? 'var(--neo-danger)' : 
                                      'var(--neo-text-primary)';
        }
        
        if (stats.points) {
            const points = Math.round(this.userData.puntosRanking || this.userData.puntosRankingTotal || 0);
            stats.points.textContent = points;
        }
        
        if (stats.level) {
            const level = parseFloat(this.userData.nivel || 2.0).toFixed(1);
            stats.level.textContent = level;
        }
    }

    async calculateRankingPosition() {
        try {
            const allUsers = await getCollection('usuarios');
            allUsers.sort((a, b) => 
                (b.puntosRankingTotal || b.puntosRanking || 0) - 
                (a.puntosRankingTotal || a.puntosRanking || 0)
            );
            
            const index = allUsers.findIndex(u => u.id === this.currentUser.uid);
            return index !== -1 ? index + 1 : 0;
        } catch (error) {
            console.error('Error calculando ranking:', error);
            return 0;
        }
    }

    getRankColor(position) {
        if (position === 1) return '#FFD700';
        if (position === 2) return '#C0C0C0';
        if (position === 3) return '#CD7F32';
        if (position <= 10) return 'var(--neo-primary)';
        if (position <= 50) return 'var(--neo-secondary)';
        return 'var(--neo-text-muted)';
    }

    getRankTitle(position) {
        if (position === 1) return 'NEXUS CHAMPION';
        if (position <= 3) return 'TOP 3 ELITE';
        if (position <= 10) return 'TOP 10 MASTER';
        if (position <= 50) return 'COMPETITIVE PLAYER';
        return 'NEXUS EXPLORER';
    }

    updateDynamicGreeting() {
        const hour = new Date().getHours();
        let greeting = '¡BUENAS NOCHES!';
        
        if (hour >= 6 && hour < 12) greeting = '¡BUENOS DÍAS!';
        else if (hour >= 12 && hour < 20) greeting = '¡BUENAS TARDES!';
        
        const greetingEl = document.getElementById('dynamic-greeting');
        if (greetingEl) greetingEl.textContent = greeting;
    }

    updateProgressBar() {
        const level = parseFloat(this.userData.nivel || 2.0);
        const progress = ((level - 2) / 3) * 100;
        
        const progressFill = document.getElementById('progress-fill');
        if (progressFill) {
            progressFill.style.width = `${Math.min(100, Math.max(5, progress))}%`;
        }
        
        const aiProgressFill = document.getElementById('ai-progress-fill');
        if (aiProgressFill) {
            aiProgressFill.style.width = `${Math.min(100, Math.max(5, progress))}%`;
        }
    }

    async loadAllData() {
        await Promise.all([
            this.loadUpcomingMatches(),
            this.loadLibraryMatches()
        ]);
    }

    async loadUpcomingMatches() {
        try {
            const now = new Date();
            const uid = this.currentUser.uid;
            
            // Cargar amistosos y retos
            const [amistosos, retos] = await Promise.all([
                getCollection('partidosAmistosos', [['jugadores', 'array-contains', uid]]),
                getCollection('partidosReto', [['jugadores', 'array-contains', uid]])
            ]);
            
            this.upcomingMatches = [...amistosos, ...retos]
                .map(match => ({
                    ...match,
                    fechaObj: match.fecha?.toDate ? match.fecha.toDate() : new Date(match.fecha),
                    tipo: match.tipo || 'amistoso'
                }))
                .filter(match => match.estado !== 'jugado' && match.fechaObj >= now)
                .sort((a, b) => a.fechaObj - b.fechaObj)
                .slice(0, 5); // Máximo 5 partidos
            
            this.renderMatchCarousel();
            
        } catch (error) {
            console.error('Error cargando partidos próximos:', error);
            this.renderMatchCarouselError();
        }
    }

    renderMatchCarousel() {
        const slider = document.getElementById('match-slider');
        const dotsContainer = document.getElementById('carousel-dots');
        
        if (!slider || !dotsContainer) return;
        
        if (this.upcomingMatches.length === 0) {
            slider.innerHTML = `
                <div class="neo-match-slide" style="text-align: center; padding: 40px 20px;">
                    <div style="font-size: 2rem; margin-bottom: 12px; opacity: 0.3;">
                        <i class="fas fa-calendar-times"></i>
                    </div>
                    <div style="font-size: 0.9rem; color: var(--neo-text-muted); margin-bottom: 16px;">
                        No tienes partidos próximos
                    </div>
                    <button class="neo-quick-action-btn" onclick="window.location.href='calendario.html'">
                        <i class="fas fa-calendar-plus"></i> RESERVAR PISTA
                    </button>
                </div>
            `;
            dotsContainer.innerHTML = '';
            return;
        }
        
        // Renderizar slides
        slider.innerHTML = this.upcomingMatches.map((match, index) => {
            const date = match.fechaObj;
            const day = date.toLocaleDateString('es-ES', { weekday: 'short' }).toUpperCase();
            const dateStr = date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).toUpperCase();
            const time = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
            
            return `
                <div class="neo-match-slide" data-index="${index}">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px;">
                        <div>
                            <span class="neo-match-type ${match.tipo}">${match.tipo.toUpperCase()}</span>
                            <div style="font-size: 0.75rem; color: var(--neo-text-muted); margin-top: 4px;">
                                <i class="fas fa-users"></i> ${match.jugadores?.length || 0}/4 jugadores
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 0.75rem; color: var(--neo-text-muted);">${day}</div>
                            <div style="font-size: 1.5rem; font-weight: 800;">${dateStr}</div>
                        </div>
                    </div>
                    
                    <div style="text-align: center; margin: 20px 0;">
                        <div style="font-size: 3rem; font-weight: 800; background: var(--neo-gradient-primary); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
                            ${time}
                        </div>
                        <div style="font-size: 0.8rem; color: var(--neo-text-muted); margin-top: 4px;">
                            Pista ${match.numeroPista || '--'}
                        </div>
                    </div>
                    
                    <div style="display: flex; justify-content: center; gap: 12px; margin-top: 20px;">
                        <button class="neo-action-btn outline" onclick="window.openMatchModal('${match.id}', '${match.tipo}')">
                            <i class="fas fa-eye"></i> Ver
                        </button>
                        <button class="neo-action-btn" onclick="window.location.href='calendario.html'">
                            <i class="fas fa-calendar-alt"></i> Similar
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
        // Renderizar dots
        dotsContainer.innerHTML = this.upcomingMatches.map((_, index) => 
            `<div class="neo-carousel-dot ${index === 0 ? 'active' : ''}" data-index="${index}"></div>`
        ).join('');
        
        // Configurar eventos de dots
        dotsContainer.querySelectorAll('.neo-carousel-dot').forEach(dot => {
            dot.addEventListener('click', () => {
                const index = parseInt(dot.dataset.index);
                this.goToSlide(index);
            });
        });
    }

    renderMatchCarouselError() {
        const slider = document.getElementById('match-slider');
        if (slider) {
            slider.innerHTML = `
                <div class="neo-match-slide" style="text-align: center; padding: 40px 20px;">
                    <div style="font-size: 2rem; margin-bottom: 12px; color: var(--neo-danger);">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <div style="font-size: 0.9rem; color: var(--neo-text-muted);">
                        Error cargando partidos
                    </div>
                </div>
            `;
        }
    }

    async loadLibraryMatches() {
        try {
            const now = new Date();
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            
            // Cargar partidos de la última semana
            const [amistosos, retos] = await Promise.all([
                getCollection('partidosAmistosos', [
                    ['fecha', '>=', weekAgo]
                ]),
                getCollection('partidosReto', [
                    ['fecha', '>=', weekAgo]
                ])
            ]);
            
            this.libraryMatches = [...amistosos, ...retos]
                .map(match => ({
                    ...match,
                    fechaObj: match.fecha?.toDate ? match.fecha.toDate() : new Date(match.fecha),
                    tipo: match.tipo || 'amistoso'
                }))
                .filter(match => {
                    // Filtrar por participación del usuario
                    const isUserInMatch = match.jugadores?.includes(this.currentUser.uid);
                    return isUserInMatch || match.estado === 'abierto';
                });
            
            this.renderLibraryMatches();
            
        } catch (error) {
            console.error('Error cargando biblioteca:', error);
            this.renderLibraryMatchesError();
        }
    }

    renderLibraryMatches() {
        const container = document.getElementById('matches-container');
        if (!container) return;
        
        // Aplicar filtros
        let filteredMatches = [...this.libraryMatches];
        
        // Filtrar por estado
        if (this.activeFilters.status === 'today') {
            const today = new Date();
            filteredMatches = filteredMatches.filter(match => 
                match.fechaObj.toDateString() === today.toDateString()
            );
        } else if (this.activeFilters.status === 'upcoming') {
            const now = new Date();
            filteredMatches = filteredMatches.filter(match => 
                match.estado !== 'jugado' && match.fechaObj >= now
            );
        } else if (this.activeFilters.status === 'played') {
            filteredMatches = filteredMatches.filter(match => 
                match.estado === 'jugado'
            );
        }
        
        // Filtrar por tipo
        if (this.activeFilters.type === 'reto') {
            filteredMatches = filteredMatches.filter(match => match.tipo === 'reto');
        } else if (this.activeFilters.type === 'amistoso') {
            filteredMatches = filteredMatches.filter(match => match.tipo === 'amistoso');
        }
        
        // Ordenar: próximos primero, luego jugados recientes
        filteredMatches.sort((a, b) => {
            const now = new Date();
            const aIsFuture = a.fechaObj >= now;
            const bIsFuture = b.fechaObj >= now;
            
            if (aIsFuture && !bIsFuture) return -1;
            if (!aIsFuture && bIsFuture) return 1;
            return b.fechaObj - a.fechaObj; // Más recientes primero
        });
        
        if (filteredMatches.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px 20px;">
                    <div style="font-size: 2rem; margin-bottom: 12px; opacity: 0.3;">
                        <i class="fas fa-search"></i>
                    </div>
                    <div style="font-size: 0.9rem; color: var(--neo-text-muted);">
                        No se encontraron partidos
                    </div>
                </div>
            `;
            return;
        }
        
        container.innerHTML = filteredMatches.map(match => {
            const date = match.fechaObj;
            const time = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
            const dateStr = date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).toUpperCase();
            const isUserInMatch = match.jugadores?.includes(this.currentUser.uid);
            const isPlayed = match.estado === 'jugado';
            const isOpen = match.estado === 'abierto' && (match.jugadores?.length || 0) < 4;
            
            return `
                <div class="neo-match-item" onclick="window.openMatchModal('${match.id}', '${match.tipo}')">
                    <div class="neo-match-time">
                        <div class="neo-match-hour">${time}</div>
                        <div class="neo-match-date">${dateStr}</div>
                    </div>
                    
                    <div class="neo-match-info">
                        <span class="neo-match-type ${match.tipo}">${match.tipo.toUpperCase()}</span>
                        
                        <div class="neo-match-players">
                            ${[1, 2, 3, 4].map(i => {
                                if (i <= (match.jugadores?.length || 0)) {
                                    return `<div class="neo-player-dot filled">${i}</div>`;
                                } else if (isOpen) {
                                    return `<div class="neo-player-dot">+</div>`;
                                } else {
                                    return `<div class="neo-player-dot"></div>`;
                                }
                            }).join('')}
                        </div>
                    </div>
                    
                    <div class="neo-match-status">
                        ${isUserInMatch ? `
                            <div class="neo-match-badge ${isPlayed ? 'played' : 'open'}">
                                ${isPlayed ? 'JUGADO' : 'APUNTADO'}
                            </div>
                        ` : isOpen ? `
                            <div class="neo-match-badge open">
                                <i class="fas fa-door-open"></i> ABIERTO
                            </div>
                        ` : `
                            <div class="neo-match-badge ${isPlayed ? 'played' : 'cancelled'}">
                                ${isPlayed ? 'JUGADO' : 'CERRADO'}
                            </div>
                        `}
                        
                        <div style="font-size: 0.7rem; color: var(--neo-text-muted); margin-top: 2px;">
                            ${match.numeroPista ? `Pista ${match.numeroPista}` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderLibraryMatchesError() {
        const container = document.getElementById('matches-container');
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px 20px;">
                    <div style="font-size: 2rem; margin-bottom: 12px; color: var(--neo-danger);">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <div style="font-size: 0.9rem; color: var(--neo-text-muted);">
                        Error cargando partidos
                    </div>
                </div>
            `;
        }
    }

    setupEventListeners() {
        // Filtros
        document.querySelectorAll('.neo-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.neo-filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                this.activeFilters.status = btn.dataset.filter;
                this.renderLibraryMatches();
            });
        });
        
        // Chips de filtro
        document.querySelectorAll('.neo-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const type = chip.dataset.type;
                
                if (type === 'all') {
                    document.querySelectorAll('.neo-chip').forEach(c => c.classList.remove('active'));
                    chip.classList.add('active');
                    this.activeFilters.type = 'all';
                } else {
                    document.querySelectorAll('.neo-chip').forEach(c => {
                        if (c.dataset.type === type) {
                            c.classList.toggle('active');
                        } else if (c.dataset.type !== 'all') {
                            c.classList.remove('active');
                        }
                    });
                    
                    // Actualizar filtro
                    if (chip.classList.contains('active')) {
                        this.activeFilters.type = type;
                    } else {
                        this.activeFilters.type = 'all';
                        document.querySelector('.neo-chip[data-type="all"]').classList.add('active');
                    }
                }
                
                this.renderLibraryMatches();
            });
        });
        
        // Controles del carrusel
        document.getElementById('prev-match')?.addEventListener('click', () => {
            this.prevSlide();
        });
        
        document.getElementById('next-match')?.addEventListener('click', () => {
            this.nextSlide();
        });
        
        // Swipe para carrusel en móvil
        this.setupSwipe();
    }

    setupSwipe() {
        const slider = document.getElementById('match-slider');
        if (!slider) return;
        
        let startX = 0;
        let isDragging = false;
        
        slider.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            isDragging = true;
        }, { passive: true });
        
        slider.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            e.preventDefault();
        }, { passive: false });
        
        slider.addEventListener('touchend', (e) => {
            if (!isDragging) return;
            
            const endX = e.changedTouches[0].clientX;
            const diff = startX - endX;
            
            if (Math.abs(diff) > 50) { // Umbral de swipe
                if (diff > 0) {
                    this.nextSlide();
                } else {
                    this.prevSlide();
                }
            }
            
            isDragging = false;
        });
    }

    prevSlide() {
        if (this.upcomingMatches.length === 0) return;
        
        this.currentSlide = (this.currentSlide - 1 + this.upcomingMatches.length) % this.upcomingMatches.length;
        this.updateCarousel();
    }

    nextSlide() {
        if (this.upcomingMatches.length === 0) return;
        
        this.currentSlide = (this.currentSlide + 1) % this.upcomingMatches.length;
        this.updateCarousel();
    }

    goToSlide(index) {
        if (index >= 0 && index < this.upcomingMatches.length) {
            this.currentSlide = index;
            this.updateCarousel();
        }
    }

    updateCarousel() {
        const slider = document.getElementById('match-slider');
        const dots = document.querySelectorAll('.neo-carousel-dot');
        
        if (slider) {
            const slideWidth = slider.offsetWidth;
            slider.scrollTo({
                left: this.currentSlide * slideWidth,
                behavior: 'smooth'
            });
        }
        
        dots.forEach((dot, index) => {
            dot.classList.toggle('active', index === this.currentSlide);
        });
    }

    setupUI() {
        // Actualizar contador de notificaciones
        this.setupNotifications();
        
        // Configurar botones de acción rápida
        this.setupQuickActions();
        
        // Iniciar animaciones
        this.startAnimations();
    }

    setupNotifications() {
        // Suscribirse a notificaciones no leídas
        subscribeToCollection('notificaciones', 
            (notifs) => {
                const unread = notifs.filter(n => !n.read && n.uid === this.currentUser.uid);
                const badge = document.getElementById('notification-count');
                
                if (badge) {
                    const count = unread.length;
                    if (count > 0) {
                        badge.textContent = count > 9 ? '9+' : count;
                        badge.style.display = 'flex';
                    } else {
                        badge.style.display = 'none';
                    }
                }
            },
            [['uid', '==', this.currentUser.uid]]
        );
    }

    setupQuickActions() {
        // Añadir funcionalidad adicional a las acciones rápidas
        document.querySelectorAll('.neo-action-card').forEach(card => {
            card.addEventListener('click', (e) => {
                // Efecto visual
                card.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    card.style.transform = '';
                }, 150);
            });
        });
    }

    startAnimations() {
        // Animación de entrada escalonada
        const sections = document.querySelectorAll('.neo-hero-section, .neo-ai-section, .neo-next-match-section, .neo-library-section, .neo-quick-actions');
        
        sections.forEach((section, index) => {
            section.style.animationDelay = `${index * 0.1}s`;
        });
        
        // Actualización periódica de estadísticas
        setInterval(() => {
            this.updateDynamicGreeting();
        }, 60000); // Cada minuto
        
        // Actualizar datos cada 30 segundos
        setInterval(() => {
            if (this.currentUser) {
                this.loadUserData(this.currentUser.uid);
                this.loadUpcomingMatches();
            }
        }, 30000);
    }

    startLiveUpdates() {
        // Suscripciones en tiempo real para actualizaciones inmediatas
        const userId = this.currentUser.uid;
        
        // Suscribirse a cambios en el usuario
        // (Aquí iría la lógica de suscripción real a Firestore)
        
        console.log('Live updates activados para:', userId);
    }
}

// Inicializar aplicación
document.addEventListener('DOMContentLoaded', () => {
    window.neoHome = new NeoHome();
    
    // Función global para abrir modal de partido
    window.openMatchModal = async (matchId, matchType) => {
        // Aquí iría la lógica para abrir el modal con detalles del partido
        console.log('Abrir modal para:', matchId, matchType);
        
        // Por ahora, redirigir a la página de partidos
        window.location.href = `partidos.html?match=${matchId}&type=${matchType}`;
    };
    
    // Función global para cerrar modal
    window.closeMatchModal = () => {
        const modal = document.getElementById('match-modal');
        if (modal) modal.classList.remove('active');
    };
});

// Estilos para botones adicionales
const additionalStyles = document.createElement('style');
additionalStyles.textContent = `
    .neo-action-btn {
        padding: 8px 16px;
        background: var(--neo-gradient-primary);
        border: none;
        border-radius: var(--neo-radius-md);
        color: white;
        font-weight: 600;
        font-size: 0.8rem;
        cursor: pointer;
        transition: var(--neo-transition);
        display: inline-flex;
        align-items: center;
        gap: 6px;
    }
    
    .neo-action-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(138, 43, 226, 0.3);
    }
    
    .neo-action-btn.outline {
        background: transparent;
        border: 1px solid var(--neo-border);
        color: var(--neo-text-secondary);
    }
    
    .neo-action-btn.outline:hover {
        border-color: var(--neo-primary);
        color: var(--neo-primary);
    }
    
    .neo-quick-action-btn {
        padding: 10px 16px;
        background: var(--neo-gradient-primary);
        border: none;
        border-radius: var(--neo-radius-md);
        color: white;
        font-weight: 600;
        font-size: 0.85rem;
        cursor: pointer;
        transition: var(--neo-transition);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
    }
    
    .neo-quick-action-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(138, 43, 226, 0.3);
    }
`;
document.head.appendChild(additionalStyles);

export default NeoHome;