/**
 * Admin Panel - Complete Management System
 * Allows full CRUD operations on users, matches, and ranking
 */

import { db, auth } from './firebase-config.js';
import { 
    collection, getDocs, doc, getDoc, updateDoc, deleteDoc, 
    query, where, orderBy, onSnapshot 
} from 'https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js';

// State
let allUsers = [];
let allMatches = [];
let currentUserFilter = '';

// --- AUTH CHECK ---
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    
    const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
    const userData = userDoc.data();
    
    if (!userData?.esAdmin && user.email !== 'Juanan221091@gmail.com') {
        alert('Acceso denegado. Solo administradores.');
        window.location.href = 'home.html';
        return;
    }
    
    // Load all data
    loadAllData();
});

// --- TAB NAVIGATION ---
document.querySelectorAll('.admin-tab[data-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
        const targetTab = tab.dataset.tab;
        
        // Update tabs
        document.querySelectorAll('.admin-tab[data-tab]').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Update sections
        document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
        document.getElementById(`section-${targetTab}`).classList.add('active');
    });
});

// --- FILTER CHIPS ---
document.querySelectorAll('.admin-tab[data-filter]').forEach(chip => {
    chip.addEventListener('click', () => {
        document.querySelectorAll('.admin-tab[data-filter]').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        filterMatches(chip.dataset.filter);
    });
});

// --- LOAD ALL DATA ---
async function loadAllData() {
    await Promise.all([
        loadUsers(),
        loadMatches()
    ]);
}

// --- USERS ---
async function loadUsers() {
    try {
        const snapshot = await getDocs(collection(db, 'usuarios'));
        allUsers = [];
        
        snapshot.forEach(doc => {
            allUsers.push({ id: doc.id, ...doc.data() });
        });
        
        // Sort by name
        allUsers.sort((a, b) => (a.nombreUsuario || '').localeCompare(b.nombreUsuario || ''));
        
        // Update counter
        document.getElementById('count-users').textContent = allUsers.length;
        
        renderUsers();
        renderRankingAdmin();
    } catch (e) {
        console.error('Error loading users:', e);
    }
}

function renderUsers(filter = '') {
    const container = document.getElementById('users-list');
    
    let filtered = allUsers;
    if (filter) {
        const q = filter.toLowerCase();
        filtered = allUsers.filter(u => 
            (u.nombreUsuario || '').toLowerCase().includes(q) ||
            (u.email || '').toLowerCase().includes(q)
        );
    }
    
    if (filtered.length === 0) {
        container.innerHTML = `<div class="admin-empty"><i class="fas fa-user-slash"></i><p>No hay usuarios</p></div>`;
        return;
    }
    
    container.innerHTML = filtered.map(user => {
        const initials = (user.nombreUsuario || 'U').substring(0, 2).toUpperCase();
        const level = (user.nivel || 2).toFixed(2);
        const points = Math.round(user.puntosRanking || user.puntosRankingTotal || 0);
        
        return `
            <div class="admin-user-item">
                <div class="admin-user-avatar" style="background:linear-gradient(135deg, ${getColor(user.nombreUsuario)}, ${getColor(user.email || '')});">
                    ${user.fotoPerfil ? `<img src="${user.fotoPerfil}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` : initials}
                </div>
                <div class="admin-user-info">
                    <div class="admin-user-name">${user.nombreUsuario || 'Sin nombre'}</div>
                    <div class="admin-user-meta">
                        <span><i class="fas fa-layer-group"></i> ${level}</span>
                        <span><i class="fas fa-star"></i> ${points} pts</span>
                        ${user.esAdmin ? '<span style="color:#00e5ff;"><i class="fas fa-shield-alt"></i> Admin</span>' : ''}
                    </div>
                </div>
                <div class="admin-user-actions">
                    <button class="admin-btn-icon edit" onclick="openEditUser('${user.id}')" title="Editar">
                        <i class="fas fa-pen"></i>
                    </button>
                    <button class="admin-btn-icon delete" onclick="confirmDeleteUser('${user.id}')" title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

window.filterUsers = function(query) {
    currentUserFilter = query;
    renderUsers(query);
};

window.refreshUsers = loadUsers;

window.openEditUser = function(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;
    
    document.getElementById('edit-user-id').value = userId;
    document.getElementById('edit-user-name').value = user.nombreUsuario || '';
    document.getElementById('edit-user-level').value = user.nivel || 2;
    document.getElementById('edit-user-points').value = Math.round(user.puntosRanking || user.puntosRankingTotal || 0);
    document.getElementById('edit-user-fp').value = user.familyPoints || 100;
    document.getElementById('edit-user-matches').value = user.partidosJugados || 0;
    document.getElementById('edit-user-admin').value = user.esAdmin ? 'true' : 'false';
    
    openModal('modal-edit-user');
};

window.saveUserChanges = async function() {
    const userId = document.getElementById('edit-user-id').value;
    if (!userId) return;
    
    const updates = {
        nombreUsuario: document.getElementById('edit-user-name').value,
        nivel: parseFloat(document.getElementById('edit-user-level').value) || 2,
        puntosRanking: parseInt(document.getElementById('edit-user-points').value) || 0,
        puntosRankingTotal: parseInt(document.getElementById('edit-user-points').value) || 0,
        familyPoints: parseInt(document.getElementById('edit-user-fp').value) || 100,
        partidosJugados: parseInt(document.getElementById('edit-user-matches').value) || 0,
        esAdmin: document.getElementById('edit-user-admin').value === 'true'
    };
    
    try {
        await updateDoc(doc(db, 'usuarios', userId), updates);
        closeModal('modal-edit-user');
        showToast('Usuario actualizado correctamente', 'success');
        loadUsers();
    } catch (e) {
        console.error('Error updating user:', e);
        showToast('Error al actualizar usuario', 'error');
    }
};

window.confirmDeleteUser = async function(userId) {
    if (!confirm('¿Seguro que quieres eliminar este usuario? Esta acción no se puede deshacer.')) return;
    
    try {
        await deleteDoc(doc(db, 'usuarios', userId));
        showToast('Usuario eliminado', 'success');
        loadUsers();
    } catch (e) {
        console.error('Error deleting user:', e);
        showToast('Error al eliminar usuario', 'error');
    }
};

// --- MATCHES ---
async function loadMatches() {
    try {
        const amistosos = await getDocs(collection(db, 'partidosAmistosos'));
        const retos = await getDocs(collection(db, 'partidosReto'));
        
        allMatches = [];
        
        amistosos.forEach(doc => {
            allMatches.push({ id: doc.id, collection: 'partidosAmistosos', tipo: 'amistoso', ...doc.data() });
        });
        
        retos.forEach(doc => {
            allMatches.push({ id: doc.id, collection: 'partidosReto', tipo: 'reto', ...doc.data() });
        });
        
        // Sort by date descending
        allMatches.sort((a, b) => {
            const dateA = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha);
            const dateB = b.fecha?.toDate ? b.fecha.toDate() : new Date(b.fecha);
            return dateB - dateA;
        });
        
        // Update counters
        document.getElementById('count-matches').textContent = allMatches.length;
        document.getElementById('count-pending').textContent = allMatches.filter(m => m.estado !== 'jugado' && m.estado !== 'anulado').length;
        document.getElementById('count-played').textContent = allMatches.filter(m => m.estado === 'jugado').length;
        
        renderMatches();
    } catch (e) {
        console.error('Error loading matches:', e);
    }
}

function renderMatches(filter = 'all') {
    const container = document.getElementById('matches-list');
    
    let filtered = allMatches;
    if (filter === 'pending') {
        filtered = allMatches.filter(m => m.estado !== 'jugado' && m.estado !== 'anulado');
    } else if (filter === 'played') {
        filtered = allMatches.filter(m => m.estado === 'jugado');
    }
    
    if (filtered.length === 0) {
        container.innerHTML = `<div class="admin-empty"><i class="fas fa-calendar-xmark"></i><p>No hay partidos</p></div>`;
        return;
    }
    
    container.innerHTML = filtered.map(match => {
        const fecha = match.fecha?.toDate ? match.fecha.toDate() : new Date(match.fecha);
        const dateStr = fecha.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase();
        const timeStr = fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        const players = match.jugadores || [];
        const isFull = players.length === 4;
        
        let statusClass = 'open';
        let statusText = 'ABIERTO';
        let statusIcon = 'fa-door-open';
        
        if (match.estado === 'jugado') {
            statusClass = 'played';
            statusText = 'JUGADO';
            statusIcon = 'fa-check';
        } else if (match.estado === 'anulado') {
            statusClass = 'played';
            statusText = 'ANULADO';
            statusIcon = 'fa-ban';
        } else if (isFull) {
            statusClass = 'closed';
            statusText = 'COMPLETO';
            statusIcon = 'fa-lock';
        }
        
        // Get player names
        const playerSlots = [];
        for (let i = 0; i < 4; i++) {
            if (players[i]) {
                const u = allUsers.find(u => u.id === players[i]);
                playerSlots.push(u ? (u.nombreUsuario || 'Jugador').substring(0, 2).toUpperCase() : '??');
            } else {
                playerSlots.push(null);
            }
        }
        
        return `
            <div class="admin-match-item">
                <div class="admin-match-header">
                    <span class="admin-match-type ${match.tipo}">${match.tipo.toUpperCase()}</span>
                    <div class="admin-match-status ${statusClass}">
                        <i class="fas ${statusIcon}"></i> ${statusText}
                    </div>
                </div>
                <div class="admin-match-date">${dateStr} · ${timeStr}</div>
                <div class="admin-match-players">
                    ${playerSlots.map((p, i) => 
                        p ? `<div class="admin-match-player">${p}</div>` 
                          : `<div class="admin-match-player empty"><i class="fas fa-user-plus"></i></div>`
                    ).join('')}
                    <span style="font-size:0.7rem; color:rgba(255,255,255,0.4); margin-left:6px;">${players.length}/4</span>
                </div>
                ${match.resultado?.sets ? `<div style="font-size:0.8rem; color:#00f5a0;"><i class="fas fa-trophy"></i> ${match.resultado.sets}</div>` : ''}
                <div class="admin-match-actions">
                    <button class="admin-action-btn edit" onclick="openEditMatch('${match.id}', '${match.collection}')">
                        <i class="fas fa-pen"></i> Editar
                    </button>
                    <button class="admin-action-btn result" onclick="openEditMatch('${match.id}', '${match.collection}')">
                        <i class="fas fa-trophy"></i> Resultado
                    </button>
                    <button class="admin-action-btn delete" onclick="confirmDeleteMatch('${match.id}', '${match.collection}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function filterMatches(filter) {
    renderMatches(filter);
}

window.refreshMatches = loadMatches;

window.openEditMatch = async function(matchId, collectionName) {
    const match = allMatches.find(m => m.id === matchId && m.collection === collectionName);
    if (!match) return;
    
    document.getElementById('edit-match-id').value = matchId;
    document.getElementById('edit-match-collection').value = collectionName;
    document.getElementById('edit-match-status').value = match.estado || 'abierto';
    document.getElementById('edit-match-result').value = match.resultado?.sets || '';
    document.getElementById('edit-match-winner').value = match.resultado?.ganador || '';
    
    // Show players
    const playersDiv = document.getElementById('edit-match-players');
    const players = match.jugadores || [];
    let playersHtml = '';
    for (let i = 0; i < 4; i++) {
        const uid = players[i];
        if (uid) {
            const u = allUsers.find(u => u.id === uid);
            playersHtml += `<div style="margin:4px 0;">Pos ${i+1}: <strong>${u?.nombreUsuario || uid}</strong></div>`;
        } else {
            playersHtml += `<div style="margin:4px 0; color:rgba(255,255,255,0.3);">Pos ${i+1}: Vacía</div>`;
        }
    }
    playersDiv.innerHTML = playersHtml;
    
    openModal('modal-edit-match');
};

window.saveMatchChanges = async function() {
    const matchId = document.getElementById('edit-match-id').value;
    const collectionName = document.getElementById('edit-match-collection').value;
    if (!matchId || !collectionName) return;
    
    const estado = document.getElementById('edit-match-status').value;
    const sets = document.getElementById('edit-match-result').value;
    const ganador = document.getElementById('edit-match-winner').value;
    
    const updates = {
        estado: estado
    };
    
    if (sets) {
        updates.resultado = {
            sets: sets,
            ganador: ganador || null
        };
    }
    
    try {
        await updateDoc(doc(db, collectionName, matchId), updates);
        closeModal('modal-edit-match');
        showToast('Partido actualizado', 'success');
        loadMatches();
    } catch (e) {
        console.error('Error updating match:', e);
        showToast('Error al actualizar partido', 'error');
    }
};

window.confirmDeleteMatch = async function(matchId, collectionName) {
    if (!confirm('¿Seguro que quieres eliminar este partido?')) return;
    
    try {
        await deleteDoc(doc(db, collectionName, matchId));
        showToast('Partido eliminado', 'success');
        loadMatches();
    } catch (e) {
        console.error('Error deleting match:', e);
        showToast('Error al eliminar partido', 'error');
    }
};

// --- RANKING ADMIN ---
function renderRankingAdmin() {
    const container = document.getElementById('ranking-admin-list');
    
    // Sort by points
    const sorted = [...allUsers].sort((a, b) => 
        (b.puntosRanking || b.puntosRankingTotal || 0) - (a.puntosRanking || a.puntosRankingTotal || 0)
    );
    
    container.innerHTML = sorted.map((user, index) => {
        const initials = (user.nombreUsuario || 'U').substring(0, 2).toUpperCase();
        const level = (user.nivel || 2).toFixed(2);
        const points = Math.round(user.puntosRanking || user.puntosRankingTotal || 0);
        
        return `
            <div class="admin-user-item" style="border-left:3px solid ${index < 3 ? '#ffd700' : index < 10 ? '#00e5ff' : 'transparent'};">
                <div style="width:28px; text-align:center; font-weight:900; color:${index < 3 ? '#ffd700' : 'rgba(255,255,255,0.5)'}; font-size:0.85rem;">
                    #${index + 1}
                </div>
                <div class="admin-user-avatar" style="width:36px; height:36px; font-size:0.7rem; background:linear-gradient(135deg, ${getColor(user.nombreUsuario)}, ${getColor(user.email || '')});">
                    ${initials}
                </div>
                <div class="admin-user-info">
                    <div class="admin-user-name" style="font-size:0.85rem;">${user.nombreUsuario || 'Sin nombre'}</div>
                    <div class="admin-user-meta">
                        <span><i class="fas fa-layer-group"></i> ${level}</span>
                        <span style="color:#00f5a0;"><i class="fas fa-star"></i> ${points}</span>
                    </div>
                </div>
                <button class="admin-btn-icon level" onclick="openEditUser('${user.id}')" title="Editar Nivel/Puntos">
                    <i class="fas fa-sliders-h"></i>
                </button>
            </div>
        `;
    }).join('');
}

window.recalculateRanking = async function() {
    if (!confirm('¿Seguro? Esto borrará los puntos actuales y recalculará TODAS las partidas desde el inicio. Esta operación no se puede deshacer.')) return;
    
    showToast('Iniciando recalculado global...', 'warning');
    const logs = [];
    
    try {
        const { getCollection, updateDocument } = await import('./firebase-service.js');
        const { processMatchResults } = await import('./ranking-service.js');
        const { db } = await import('./firebase-config.js');
        const { collection, getDocs, orderBy, query, where, writeBatch, doc } = await import('https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js');

        // 1. Reset all users to baseline
        showToast('Restableciendo usuarios...', 'info');
        const usersSnap = await getDocs(collection(db, "usuarios"));
        const batch = writeBatch(db);
        
        const initialUsersData = {};
        usersSnap.forEach(uDoc => {
            const data = uDoc.data();
            // Start everyone at Level 2.0 or their current level as "Base" (but 4.0 pts)
            // For a clean slate, Level 2.0 and 4.0 points is the standard.
            batch.update(uDoc.ref, {
                puntosRankingTotal: 4.0,
                puntosRanking: 4.0,
                nivel: 2.0,
                partidosJugados: 0,
                victorias: 0,
                derrotas: 0,
                rachaActual: 0,
                mejorRacha: 0
            });
            initialUsersData[uDoc.id] = { ...data, level: 2.0, points: 4.0 };
        });
        await batch.commit();

        // 2. Fetch all played matches sorted by date
        showToast('Analizando historial de combate...', 'info');
        const amQuery = query(collection(db, 'partidosAmistosos'), where('estado', '==', 'jugado'), orderBy('fecha', 'asc'));
        const reQuery = query(collection(db, 'partidosReto'), where('estado', '==', 'jugado'), orderBy('fecha', 'asc'));
        
        const [snapAm, snapRe] = await Promise.all([getDocs(amQuery), getDocs(reQuery)]);
        const allMatches = [];
        snapAm.forEach(d => allMatches.push({ id: d.id, ...d.data(), tipo: 'amistoso' }));
        snapRe.forEach(d => allMatches.push({ id: d.id, ...d.data(), tipo: 'reto' }));
        
        allMatches.sort((a,b) => (a.fecha?.toDate?.() || 0) - (b.fecha?.toDate?.() || 0));
        
        // 3. Sequential Processing (Must be sequential to maintain ELO flow)
        let count = 0;
        for (const match of allMatches) {
            count++;
            const pct = Math.round((count / allMatches.length) * 100);
            showToast(`Procesando match ${count}/${allMatches.length} (${pct}%)`, 'info');
            
            if (match.resultado?.sets) {
                await processMatchResults(match.id, match.tipo, match.resultado.sets);
            }
        }

        showToast('✅ RECALCULADO COMPLETADO CON ÉXITO', 'success');
        location.reload(); // Refresh to show new ranking
        
    } catch (e) {
        console.error("Recalc Error:", e);
        showToast('Error crítico durante el recalculado: ' + e.message, 'error');
    }
};

// --- UTILITIES ---
function openModal(id) {
    document.getElementById(id).classList.add('active');
}

window.closeModal = function(id) {
    document.getElementById(id).classList.remove('active');
};

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 100px;
        left: 50%;
        transform: translateX(-50%);
        padding: 12px 24px;
        background: ${type === 'success' ? 'rgba(0,245,160,0.9)' : type === 'error' ? 'rgba(255,51,102,0.9)' : 'rgba(0,229,255,0.9)'};
        color: ${type === 'success' || type === 'info' ? '#000' : '#fff'};
        border-radius: 30px;
        font-size: 0.85rem;
        font-weight: 700;
        z-index: 99999;
        animation: slideUp 0.4s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function getColor(str) {
    const colors = ['#ff6b35', '#00e5ff', '#8b5cf6', '#00f5a0', '#ffc107', '#ff3366', '#00bcd4', '#e91e63'];
    let hash = 0;
    for (let i = 0; i < (str || '').length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
}
