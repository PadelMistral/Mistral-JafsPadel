/**
 * USER VISUAL HIGHLIGHTER
 * Sistema automático para resaltar visualmente al usuario actual vs otros
 */

import { getCurrentUser } from './firebase-service.js';

class UserVisualHighlighter {
  constructor() {
    this.currentUserId = null;
    this.currentUserEmail = null;
    this.currentUserName = null;
  }

  /**
   * Inicializa el highlighter con el usuario actual
   */
  async initialize(user) {
    if (!user) {
      const currentUser = getCurrentUser();
      if (!currentUser) return;
      user = currentUser;
    }

    this.currentUserId = user.uid;
    this.currentUserEmail = user.email;
    this.currentUserName = user.displayName || user.email?.split('@')[0] || 'Usuario';

    console.log('🎨 User Highlighter inicializado:', {
      uid: this.currentUserId,
      name: this.currentUserName
    });
  }

  /**
   * Verifica si un UID es del usuario actual
   */
  isCurrentUser(userId) {
    return userId === this.currentUserId;
  }

  /**
   * Añade badge "TÚ" a un elemento
   */
  addCurrentUserBadge(element, position = 'after') {
    if (!element) return;

    // Evitar duplicados
    if (element.querySelector('.user-current-badge')) return;

    const badge = document.createElement('span');
    badge.className = 'user-current-badge';
    badge.innerHTML = '<i class="fas fa-user"></i> TÚ';

    if (position === 'after') {
      element.appendChild(badge);
    } else {
      element.insertBefore(badge, element.firstChild);
    }
  }

  /**
   * Añade badge "YO" inline a un texto
   */
  addYouIndicator(element) {
    if (!element) return;
    if (element.querySelector('.you-indicator')) return;

    const indicator = document.createElement('span');
    indicator.className = 'you-indicator';
    indicator.innerHTML = 'YO';
    element.appendChild(indicator);
  }

  /**
   * Resalta el nombre de usuario con clase especial
   */
  highlightUserName(element, userId) {
    if (!element) return;

    if (this.isCurrentUser(userId)) {
      element.classList.add('user-name', 'current-user');
      this.addYouIndicator(element);
    } else {
      element.classList.add('user-name', 'other-user');
    }
  }

  /**
   * Resalta avatar de usuario
   */
  highlightAvatar(imgElement, userId) {
    if (!imgElement) return;

    imgElement.classList.add('avatar');
    
    if (this.isCurrentUser(userId)) {
      imgElement.classList.add('current-user', 'current-user-avatar');
    } else {
      imgElement.classList.add('other-user');
    }
  }

  /**
   * Resalta una tarjeta de partido
   */
  highlightMatchCard(cardElement, matchData) {
    if (!cardElement) return;

    // Verificar si el usuario participa
    const userParticipates = this.checkUserParticipation(matchData);

    if (userParticipates) {
      cardElement.classList.add('match-card', 'my-match');
    } else {
      cardElement.classList.add('match-card', 'other-match');
    }

    // Añadir estado (ganado/perdido/pendiente)
    this.addMatchStatus(cardElement, matchData);
  }

  /**
   * Verifica si el usuario participa en un partido
   */
  checkUserParticipation(matchData) {
    if (!matchData) return false;

    // Partido de liga (equipos)
    if (matchData.equipoLocal || matchData.equipoVisitante) {
      // Aquí deberías verificar si el usuario está en alguno de estos equipos
      // Por ahora, verificamos por ID simple
      return matchData.equipoLocalId === this.currentUserId ||
             matchData.equipoVisitanteId === this.currentUserId;
    }

    // Partido amistoso/reto (jugadores)
    if (matchData.jugadores && Array.isArray(matchData.jugadores)) {
      return matchData.jugadores.includes(this.currentUserId);
    }

    // Verificar creador
    if (matchData.creador === this.currentUserId) {
      return true;
    }

    return false;
  }

  /**
   * Añade estado visual al partido
   */
  addMatchStatus(cardElement, matchData) {
    if (!matchData.resultado) {
      cardElement.classList.add('pending');
      this.addStatusBadge(cardElement, 'pending', 'Pendiente');
      return;
    }

    // Determinar si ganó o perdió
    const userWon = this.didUserWin(matchData);
    
    if (userWon === true) {
      cardElement.classList.add('won');
      this.addStatusBadge(cardElement, 'won', 'Victoria');
    } else if (userWon === false) {
      cardElement.classList.add('lost');
      this.addStatusBadge(cardElement, 'lost', 'Derrota');
    }
  }

  /**
   * Determina si el usuario ganó el partido
   */
  didUserWin(matchData) {
    if (!matchData.resultado) return null;

    // Para partidos de liga (por sets)
    if (matchData.equipoLocal && matchData.equipoVisitante) {
      const resultado = matchData.resultado;
      let setsLocal = 0;
      let setsVisitante = 0;

      // Contar sets ganados
      Object.values(resultado).forEach(set => {
        if (set && typeof set.puntos1 === 'number' && typeof set.puntos2 === 'number') {
          if (set.puntos1 > set.puntos2) setsLocal++;
          else if (set.puntos2 > set.puntos1) setsVisitante++;
        }
      });

      // Verificar si el usuario está en el equipo local o visitante
      const isLocal = this.isInTeam(matchData.equipoLocal);
      const isVisitante = this.isInTeam(matchData.equipoVisitante);

      if (isLocal) return setsLocal > setsVisitante;
      if (isVisitante) return setsVisitante > setsLocal;
    }

    // Para partidos con ganador directo
    if (matchData.resultado.ganador) {
      return matchData.resultado.ganador === this.currentUserId;
    }

    return null;
  }

  /**
   * Verifica si el usuario está en un equipo (placeholder)
   */
  isInTeam(teamId) {
    // Esta función debería verificar en la base de datos
    // Por ahora retorna false como placeholder
    return false;
  }

  /**
   * Añade badge de estado al partido
   */
  addStatusBadge(cardElement, status, text) {
    // Evitar duplicados
    if (cardElement.querySelector('.match-status')) return;

    const badge = document.createElement('span');
    badge.className = `match-status ${status}`;
    badge.textContent = text;

    // Insertar al inicio de la tarjeta
    cardElement.insertBefore(badge, cardElement.firstChild);
  }

  /**
   * Resalta un bloque de equipo
   */
  highlightTeamBlock(teamElement, teamData, isMyTeam = false) {
    if (!teamElement) return;

    teamElement.classList.add('team-block');
    
    if (isMyTeam) {
      teamElement.classList.add('my-team');
    } else {
      teamElement.classList.add('rival-team');
    }
  }

  /**
   * Resalta una fila de tabla con el usuario
   */
  highlightTableRow(rowElement, userId) {
    if (!rowElement) return;

    if (this.isCurrentUser(userId)) {
      rowElement.classList.add('current-user-row');
    }
  }

  /**
   * Resalta un item de lista con el usuario
   */
  highlightListItem(itemElement, userId) {
    if (!itemElement) return;

    if (this.isCurrentUser(userId)) {
      itemElement.classList.add('current-user-item');
    }
  }

  /**
   * Procesa automáticamente todos los elementos con data-user-id
   */
  autoHighlightElements() {
    if (!this.currentUserId) {
      console.warn('⚠️ User Highlighter no inicializado');
      return;
    }

    // Resaltar nombres de usuario
    document.querySelectorAll('[data-user-id]').forEach(element => {
      const userId = element.getAttribute('data-user-id');
      this.highlightUserName(element, userId);
    });

    // Resaltar avatares
    document.querySelectorAll('img[data-user-id]').forEach(img => {
      const userId = img.getAttribute('data-user-id');
      this.highlightAvatar(img, userId);
    });

    // Resaltar filas de tabla
    document.querySelectorAll('tr[data-user-id]').forEach(row => {
      const userId = row.getAttribute('data-user-id');
      this.highlightTableRow(row, userId);
    });

    // Resaltar items de lista
    document.querySelectorAll('li[data-user-id]').forEach(item => {
      const userId = item.getAttribute('data-user-id');
      this.highlightListItem(item, userId);
    });

    console.log('✅ Elementos resaltados automáticamente');
  }

  /**
   * Crea un elemento de jugador con highlighting automático
   */
  createPlayerElement(playerData) {
    const div = document.createElement('div');
    div.className = 'player-item';
    div.setAttribute('data-user-id', playerData.uid || playerData.id);

    const isCurrentUser = this.isCurrentUser(playerData.uid || playerData.id);

    if (isCurrentUser) {
      div.classList.add('current-user-item');
    }

    div.innerHTML = `
      <img src="${playerData.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(playerData.name || 'Usuario')}" 
           alt="${playerData.name || 'Usuario'}"
           class="avatar ${isCurrentUser ? 'current-user' : 'other-user'}"
           data-user-id="${playerData.uid || playerData.id}">
      <span class="user-name ${isCurrentUser ? 'current-user' : 'other-user'}" 
            data-user-id="${playerData.uid || playerData.id}">
        ${playerData.name || 'Usuario'}
      </span>
      ${isCurrentUser ? '<span class="you-indicator">YO</span>' : ''}
    `;

    return div;
  }
}

// Exportar instancia singleton
const userHighlighter = new UserVisualHighlighter();

export default userHighlighter;
export { UserVisualHighlighter };
