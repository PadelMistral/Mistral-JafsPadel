import { 
    getCollection, 
    updateDocument, 
    deleteDocument, 
    initializeAuthObserver,
    getDocument
} from './firebase-service.js';
import { authGuard, initSharedUI, showToast } from './ui-core.js';

authGuard();
initSharedUI('ADMIN PANEL');

document.addEventListener('DOMContentLoaded', () => {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const sections = document.querySelectorAll('.section-content');

    // Tab Navigation
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const sectionId = btn.getAttribute('data-section');
            tabBtns.forEach(b => b.classList.remove('active'));
            sections.forEach(s => {
                s.style.display = s.id === sectionId ? 'block' : 'none';
                s.classList.toggle('active', s.id === sectionId);
            });
            btn.classList.add('active');
        });
    });

    // Check Admin Role
    initializeAuthObserver(async (user) => {
        if (!user) return;
        const userData = await getDocument('usuarios', user.uid);
        if (userData?.rol !== 'Admin' && user.email !== 'Juanan221091@gmail.com') {
            showToast('ACCESO DENEGADO', 'Solo administradores.', 'error');
            setTimeout(() => window.location.href = 'home.html', 2000);
            return;
        }
        loadAdminStats();
        loadUsersList();
    });
});

async function loadAdminStats() {
    try {
        const users = await getCollection('usuarios');
        const pendingUsers = users.filter(u => !u.aprobado).length;
        document.getElementById('cuenta-usuarios').textContent = pendingUsers;
        document.getElementById('total-users').textContent = users.length;
        
        // Similarly for matches, teams etc.
        const matchesAmistosos = await getCollection('partidosAmistosos');
        const matchesReto = await getCollection('partidosReto');
        const totalMatches = matchesAmistosos.length + matchesReto.length;
        document.getElementById('total-matches').textContent = totalMatches;
        
    } catch (error) {
        console.error("Error loading admin stats:", error);
    }
}

async function loadUsersList() {
    const container = document.getElementById('lista-usuarios');
    if (!container) return;
    
    container.innerHTML = '<div class="loader-ring-container"><div class="spinner-small"></div></div>';
    
    try {
        const users = await getCollection('usuarios');
        // Sort by points descending
        users.sort((a, b) => (b.puntosRankingTotal || 0) - (a.puntosRankingTotal || 0));
        
        container.innerHTML = users.map((u, idx) => {
            const nivel = parseFloat(u.nivel || 2.0).toFixed(1);
            const puntos = Math.round(u.puntosRankingTotal || u.puntosRanking || 0);
            return `
            <div class="user-admin-card glass-strong mb-2 p-3 rounded-lg flex-between animate-fade-in">
                <div class="user-info flex-1">
                    <div class="flex-between mb-1">
                        <span class="font-bold text-white">${(u.nombreUsuario || u.nombre || 'Sin nombre').toUpperCase()}</span>
                        <span class="text-xs opacity-40">#${idx + 1}</span>
                    </div>
                    <div class="text-xs opacity-50 mb-1">${u.email || u.id}</div>
                    <div class="flex gap-2">
                        <span class="badge ${u.aprobado ? 'bg-success' : 'bg-warning'}" style="font-size:0.55rem">
                            ${u.aprobado ? 'APROBADO' : 'PENDIENTE'}
                        </span>
                        <span class="badge" style="background:rgba(0,195,255,0.2); color:var(--accent); font-size:0.55rem">
                            LVL ${nivel}
                        </span>
                        <span class="badge" style="background:rgba(255,107,53,0.2); color:var(--primary); font-size:0.55rem">
                            ${puntos} PTS
                        </span>
                    </div>
                </div>
                <div class="user-actions flex gap-2">
                    ${!u.aprobado ? `
                        <button onclick="approveUser('${u.id}')" class="btn-icon bg-success text-white rounded-md" style="width:32px;height:32px">
                            <i class="fas fa-check"></i>
                        </button>
                    ` : ''}
                    <button onclick="editUser('${u.id}')" class="btn-icon bg-accent text-white rounded-md" style="width:32px;height:32px">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteUser('${u.id}')" class="btn-icon bg-danger text-white rounded-md" style="width:32px;height:32px">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `}).join('') || '<p class="text-center opacity-50">No hay usuarios.</p>';
    } catch (e) {
        container.innerHTML = '<p class="text-danger">Error al cargar listado.</p>';
    }
}

window.approveUser = async (uid) => {
    if (!confirm('¿Aprobar este usuario?')) return;
    try {
        await updateDocument('usuarios', uid, { aprobado: true });
        showToast('USUARIO APROBADO', 'Ya puede acceder a la App.', 'success');
        loadUsersList();
        loadAdminStats();
    } catch (e) { showToast('ERROR', 'No se pudo aprobar.', 'error'); }
};

window.deleteUser = async (uid) => {
    if (!confirm('¿ELIMINAR ESTE USUARIO? Esta acción es irreversible.')) return;
    try {
        await deleteDocument('usuarios', uid);
        showToast('USUARIO ELIMINADO', 'Se ha borrado el registro.', 'info');
        loadUsersList();
        loadAdminStats();
    } catch (e) { showToast('ERROR', 'No se pudo eliminar.', 'error'); }
};

window.editUser = (uid) => {
    // Basic redirect to firebase console or a prompt for now
    const newLevel = prompt("Nuevo Nivel (Ej: 3.5):");
    if (newLevel && !isNaN(newLevel)) {
        updateDocument('usuarios', uid, { nivel: parseFloat(newLevel) })
            .then(() => {
                showToast('NIVEL ACTUALIZADO', `Nuevo nivel: ${newLevel}`, 'success');
                loadUsersList();
            });
    }
};
