import { db, auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";
import { doc, getDoc, collection, query, where, limit, onSnapshot } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";

/* =================================================================
   CORE UI UTILITIES (Shared across all pages)
   ================================================================= */

/**
 * Common Auth Guard for all premium pages.
 */
export function authGuard() {
    onAuthStateChanged(auth, (user) => {
        if (!user) {
            window.location.href = 'index.html';
        }
    });
}

/**
 * Toast Notifications System (Neon Style)
 */
export function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = `
            position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
            z-index: 9999; display: flex; flex-direction: column; gap: 10px;
            width: 90%; max-width: 400px; pointer-events: none;
        `;
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'custom-toast animate-slide-down';
    
    const colors = {
        success: '#00e676',
        error: '#ff1744',
        warning: '#ffc107',
        info: '#00c3ff'
    };

    const icon = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };

    toast.style.cssText = `
        background: rgba(15, 15, 20, 0.9);
        backdrop-filter: blur(10px);
        border: 1px solid ${colors[type] || colors.info};
        border-radius: 16px; padding: 12px 20px;
        color: #fff; font-family: 'Rajdhani', sans-serif;
        font-weight: 700; display: flex; align-items: center; gap: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5), 0 0 15px ${(colors[type] || colors.info)}44;
        pointer-events: auto;
    `;

    toast.innerHTML = `
        <i class="fas ${icon[type] || icon.info}" style="color: ${colors[type] || colors.info}; font-size: 1.1rem"></i>
        <span style="text-transform: uppercase; letter-spacing: 0.5px;">${message}</span>
    `;

    container.appendChild(toast);

    // Auto remove
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px) translateX(-0%)';
        toast.style.scale = '0.9';
        toast.style.transition = '0.5s cubic-bezier(0.19, 1, 0.22, 1)';
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}

/**
 * Initializes shared elements (Headers, Nav, Particles)
 */
export function initSharedUI(pageName) {
    console.log(`[UI] Initializing Shared Components for: ${pageName}`);
    
    // Auth logic & Header Sync
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            updateHeaderUI(user);
        } else if (pageName !== 'Login' && pageName !== 'Registro') {
            window.location.href = 'index.html';
        }
    });

    // Nav active state
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-link, .nav-fab');
    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href && currentPath.includes(href)) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    // Permissions & SW
    requestNotificationPermissions();
    registerServiceWorker();

    // Global Keyframes
    if (!document.getElementById('shared-ui-keyframes')) {
        const s = document.createElement('style');
        s.id = 'shared-ui-keyframes';
        s.textContent = `
            @keyframes slideDownToast {
                from { transform: translateY(-40px); opacity: 0; scale: 0.8; }
                to { transform: translateY(0); opacity: 1; scale: 1; }
            }
            .animate-slide-down { animation: slideDownToast 0.5s cubic-bezier(0.18, 0.89, 0.32, 1.28) forwards; }
        `;
        document.head.appendChild(s);
    }
}

async function updateHeaderUI(user) {
    const avatarContainer = document.getElementById('header-avatar-container');
    const bell = document.querySelector('.notification-bell');
    
    try {
        const snap = await getDoc(doc(db, 'usuarios', user.uid));
        if (snap.exists()) {
            const data = snap.data();
            
            // Avatar in Header
            if (avatarContainer) {
                avatarContainer.innerHTML = renderAvatarShared(user.uid, data, 'sm');
                avatarContainer.style.cursor = 'pointer';
                avatarContainer.onclick = () => window.location.href = 'perfil.html';
            }

            // Sync Notification Dot
            if (bell) {
                const q = query(collection(db, "notificaciones"), where("uid", "==", user.uid), where("read", "==", false), limit(1));
                onSnapshot(q, (snapshot) => {
                    const dot = bell.querySelector('.notification-dot');
                    if (dot) dot.style.display = snapshot.empty ? 'none' : 'block';
                });
            }
        }
    } catch(e) { console.error("Header Sync Error:", e); }
}

/**
 * Universal Avatar Renderer
 */
export function renderAvatarShared(uid, data, size = 'md') {
    const photoUrl = data?.fotoURL || data?.fotoPerfil;
    const name = data?.nombreUsuario || data?.nombre || 'Jugador';
    const initial = name.charAt(0).toUpperCase();
    const color = data?.colorRanking || getUserColor(uid);
    
    const sizeMap = {
        'sm': '34px',
        'md': '45px',
        'lg': '80px',
        'xl': '130px'
    };
    const s = sizeMap[size] || '45px';
    const fontSize = size === 'sm' ? '0.8rem' : size === 'lg' ? '1.8rem' : size === 'xl' ? '2.8rem' : '1.1rem';

    if (photoUrl) {
        return `<div class="p-avatar-shared ${size}" style="width:${s}; height:${s}; border-radius:50%; overflow:hidden; border:2px solid ${color}; box-shadow: 0 0 10px ${color}44;">
                    <img src="${photoUrl}" style="width:100%; height:100%; object-fit:cover;">
                </div>`;
    } else {
        return `<div class="p-avatar-shared ${size}" style="
                    width:${s}; height:${s}; border-radius:50%; background:${color}; 
                    display:flex; align-items:center; justify-content:center; 
                    color:#fff; font-weight:800; font-family:'Rajdhani', sans-serif; 
                    font-size:${fontSize}; text-shadow: 0 2px 4px rgba(0,0,0,0.3);
                    border: 2px solid rgba(255,255,255,0.1);
                    box-shadow: 0 0 10px ${color}44;
                ">${initial}</div>`;
    }
}

function getUserColor(uid) {
    if (!uid) return '#FF6B35';
    const colors = ['#FF6B35', '#00C3FF', '#8A2BE2', '#00FA9A', '#FF007F', '#FFD700', '#FF4500', '#1E90FF'];
    let hash = 0;
    for (let i = 0; i < uid.length; i++) hash = uid.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
}

export async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            await navigator.serviceWorker.register('./sw.js');
        } catch (e) {}
    }
}

export function requestNotificationPermissions() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}
