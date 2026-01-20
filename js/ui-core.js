import { initializeAuthObserver, getDocument, subscribeToCollection } from './firebase-service.js';
import { initPushNotifications, showFloatingNotification } from './push-notifications.js';

let toastContainer = null;

/**
 * UI Core Module
 * Handles shared UI elements like Header and Bottom Navigation across pages.
 */

export function initSharedUI(pageTitle) {
    document.addEventListener('DOMContentLoaded', () => {
        // Update Title if element exists
        const titleEl = document.querySelector('.header-title');
        if (titleEl) titleEl.textContent = pageTitle;

        initializeAuthObserver(async (user) => {
            if (!user) return;
            try {
                const userData = await getDocument('usuarios', user.uid);
                if (userData) {
                    updateHeader(user, userData);
                    setupNav();
                    listenToNotifications(user.uid);
                    
                    // Standardize Online Activity: Update lastActive on every page
                    updateActivity(user.uid);
                    
                    // Initialize Push Notifications with permission request
                    initPushNotifications().then(hasPermission => {
                        if (hasPermission) {
                            console.log('🔔 Notificaciones activas');
                        }
                    });
                    
                    // Set user data for AI Assistant
                    if (window.padeluminatisAI) {
                        window.padeluminatisAI.setUserData({ ...userData, uid: user.uid });
                    }
                }
            } catch (error) {
                console.error("Error initializing Shared UI:", error);
            }
        });
    });
}

/**
 * Universal Auth Guard
 * Redirects to index.html if no user is logged in.
 * Should be imported in all protected pages.
 */
export function authGuard() {
    initializeAuthObserver((user) => {
        const path = window.location.pathname;
        const isAuthPage = path.includes('index.html') || path.includes('registro.html') || path.includes('recuperar.html') || path === '/' || path === '';
        
        if (!user && !isAuthPage) {
            window.location.href = 'index.html';
        } else if (user && isAuthPage) {
            window.location.href = 'home.html';
        }
    });
}

function updateHeader(user, userData) {
    const avatarContainer = document.querySelector('.user-profile-trigger');
    if (!avatarContainer) return;

    const photoUrl = userData.fotoPerfil || userData.fotoURL || user.photoURL;
    const name = userData.nombreUsuario || userData.nombre || user.email.split('@')[0];

    avatarContainer.classList.add('avatar-circle');
    
    if (photoUrl) {
        avatarContainer.innerHTML = `<img src="${photoUrl}" alt="Profile" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
    } else {
        const initials = getInitials(name);
        const color = getVibrantColor(name);
        avatarContainer.style.background = `linear-gradient(135deg, ${color}, ${adjustColor(color, -20)})`;
        avatarContainer.innerHTML = `<span class="user-initials" style="color:white; font-weight:700; font-family:'Rajdhani';">${initials}</span>`;
    }

    // Admin Link in Header (Universal)
    // Check if there is already an admin link (e.g. static in Home)
    const existingAdminLink = document.getElementById('admin-link') || document.getElementById('admin-link-icon');
    
    if (userData.esAdmin || user.email === 'Juanan221091@gmail.com') {
        // If it exists (like in home.html), just ensure it's visible if hidden
        if (existingAdminLink) {
             existingAdminLink.style.display = 'flex';
             // Force consistent icon
             existingAdminLink.innerHTML = '<i class="fas fa-shield-alt"></i>';
        } else {
             // Inject if missing (for other pages)
             const headerActions = document.querySelector('.header-right') || document.querySelector('.flex-center.gap-md');
             if (headerActions) {
                const adminLink = document.createElement('a');
                adminLink.href = 'admin.html';
                adminLink.id = 'admin-link-icon';
                adminLink.className = 'btn-icon animate-pulse';
                adminLink.style.color = 'var(--accent)';
                adminLink.innerHTML = '<i class="fas fa-shield-alt"></i>';
                headerActions.insertBefore(adminLink, headerActions.firstChild);
             }
        }
    }

    // Navegar al perfil al pinchar
    avatarContainer.style.cursor = 'pointer';
    avatarContainer.onclick = () => window.location.href = 'perfil.html';
}

function getInitials(name) {
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

function getVibrantColor(str) {
    const colors = ['#FF6B35', '#00C3FF', '#00E676', '#FFEA00', '#FF1744', '#7C4DFF', '#F06292', '#4DB6AC'];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash % colors.length)];
}

function adjustColor(color, amount) {
    return color; // Simplificado para el ejemplo
}

function setupNav() {
    const currentPath = window.location.pathname.split('/').pop() || 'home.html';
    const navLinks = document.querySelectorAll('.nav-link, .nav-fab');
    
    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPath) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

function listenToNotifications(uid) {
    const dot = document.querySelector('.notification-dot');
    if (!dot) return;

    subscribeToCollection('notificaciones', (notifs) => {
        const unreadNotifs = notifs.filter(n => !n.read);
        const count = unreadNotifs.length;
        
        if (count > 0) {
            dot.classList.add('active');
            dot.textContent = count > 9 ? '9+' : count;
            dot.style.display = 'flex';
        } else {
            dot.classList.remove('active');
            dot.style.display = 'none';
        }
    }, [['uid', '==', uid]]);
}

/**
 * Shows a floating toast notification
 * @param {string} title - The title of the toast
 * @param {string} message - The message body
 * @param {string} type - 'success', 'info', 'warning', 'error'
 * @param {number} duration - Duration in ms
 */
export function showToast(title, message, type = 'info', duration = 3000) {
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = `toast-notification`;
    
    // Choose icon
    let iconClass = 'fa-info-circle';
    if (type === 'success') iconClass = 'fa-check-circle';
    if (type === 'warning') iconClass = 'fa-exclamation-triangle';
    if (type === 'error') iconClass = 'fa-times-circle';

    // Simplified content: Icon + Title/Message combo
    // If message is short, just show title + message inline
    // If we want it "spectacular & animated", simpler is better
    toast.innerHTML = `
        <i class="fas ${iconClass}"></i>
        <div style="display:flex; flex-direction:column;">
             <span>${title}</span>
             ${message && message !== title ? `<span style="font-size:0.75em; opacity:0.8; font-weight:400; text-transform:none;">${message}</span>` : ''}
        </div>
    `;

    toastContainer.appendChild(toast);

    // Remove after duration
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px) scale(0.9)';
        toast.style.transition = 'all 0.4s ease';
        setTimeout(() => toast.remove(), 400);
    }, duration);
}

/**
 * Smoothly animates a numeric value
 */
export function countUp(element, end, duration = 1500) {
    if (!element) return;
    let start = 0;
    const startTime = performance.now();
    
    // Check if start can be parsed from current text
    const currentText = element.textContent.replace(/[^0-9.-]/g, '');
    if (currentText && !isNaN(currentText)) start = parseFloat(currentText);

    const step = (currentTime) => {
        const progress = Math.min((currentTime - startTime) / duration, 1);
        const value = Math.floor(progress * (end - start) + start);
        element.textContent = value;
        if (progress < 1) {
            requestAnimationFrame(step);
        } else {
            element.textContent = end;
        }
    };
    requestAnimationFrame(step);
}

window.countUp = countUp;

// --- DYNAMIC INJECTION OF AI & ADMIN TOOLS ---
function injectAIAssistant() {
    // 1. Check if AI Styles exist
    if (!document.querySelector('link[href*="ai-assistant.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = './css/ai-assistant.css';
        document.head.appendChild(link);
    }
    
    // 2. Check if AI Script exists
    if (!document.querySelector('script[src*="ai-assistant.js"]')) {
        const script = document.createElement('script');
        script.type = 'module';
        script.src = './js/ai-assistant.js';
        document.body.appendChild(script);
    }
}

// Inject immediately when UI Core loads
injectAIAssistant();

/**
 * Updates the user's lastActive timestamp in Firestore.
 */
async function updateActivity(uid) {
    try {
        const { updateDocument } = await import('./firebase-service.js');
        await updateDocument('usuarios', uid, { lastActive: new Date() });
    } catch (e) {
        console.warn("Activity Update Failed:", e);
    }
}
