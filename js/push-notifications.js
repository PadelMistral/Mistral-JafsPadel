/**
 * Padeluminatis Push Notifications System v2.0
 * Handles browser/mobile push notifications with permission prompts
 */

import { db, auth } from './firebase-config.js';
import { doc, updateDoc, getDoc, onSnapshot, collection, query, where, orderBy, limit } from 'https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js';

const VAPID_PUBLIC_KEY = 'YOUR_VAPID_KEY_HERE'; // Replace with your Firebase VAPID

// --- PERMISSION & REGISTRATION ---
export async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.warn('Push notifications not supported');
        return false;
    }

    if (Notification.permission === 'granted') {
        return true;
    }

    if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    }
    return false;
}

export async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('Service Worker registered:', registration);
            return registration;
        } catch (error) {
            console.error('SW registration failed:', error);
        }
    }
    return null;
}

// --- SEND LOCAL NOTIFICATION ---
export function sendLocalNotification(title, body, icon = './imagenes/Logojafs.png', tag = 'padeluminatis', data = {}) {
    if (Notification.permission === 'granted') {
        const options = {
            body,
            icon,
            badge: './imagenes/Logojafs.png',
            tag,
            vibrate: [100, 50, 100],
            data,
            requireInteraction: false,
            actions: data.actions || []
        };

        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: 'SHOW_NOTIFICATION',
                title,
                options
            });
        } else {
            new Notification(title, options);
        }
    }
}

// --- FLOATING TOAST NOTIFICATIONS ---
let toastContainer = null;

function ensureToastContainer() {
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'floating-toast-container';
        toastContainer.style.cssText = `
            position: fixed;
            top: 70px;
            right: 15px;
            z-index: 100000;
            display: flex;
            flex-direction: column;
            gap: 10px;
            max-width: 350px;
            pointer-events: none;
        `;
        document.body.appendChild(toastContainer);
    }
    return toastContainer;
}

export function showFloatingNotification(title, message, type = 'info', actionLabel = null, actionCallback = null, duration = 5000) {
    const container = ensureToastContainer();

    const toast = document.createElement('div');
    toast.className = `floating-toast floating-toast-${type}`;
    toast.style.cssText = `
        background: linear-gradient(135deg, rgba(20,22,30,0.98) 0%, rgba(10,12,18,0.95) 100%);
        backdrop-filter: blur(20px);
        border-radius: 16px;
        padding: 16px 20px;
        border: 1px solid ${type === 'success' ? 'rgba(0,230,118,0.3)' : type === 'error' ? 'rgba(255,23,68,0.3)' : type === 'warning' ? 'rgba(255,234,0,0.3)' : 'rgba(0,195,255,0.3)'};
        box-shadow: 0 15px 40px rgba(0,0,0,0.5), 0 0 20px ${type === 'success' ? 'rgba(0,230,118,0.1)' : type === 'error' ? 'rgba(255,23,68,0.1)' : 'rgba(0,195,255,0.1)'};
        transform: translateX(120%);
        transition: transform 0.5s cubic-bezier(0.68, -0.6, 0.32, 1.6), opacity 0.3s;
        opacity: 0;
        pointer-events: auto;
        cursor: pointer;
    `;

    const iconMap = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-triangle',
        warning: 'fa-bell',
        info: 'fa-info-circle',
        match: 'fa-table-tennis-paddle-ball',
        rank: 'fa-medal',
        user: 'fa-user-plus'
    };

    const colorMap = {
        success: '#00e676',
        error: '#ff1744',
        warning: '#ffea00',
        info: '#00c3ff',
        match: '#ff6b35',
        rank: '#ffd700',
        user: '#8a2be2'
    };

    toast.innerHTML = `
        <div style="display:flex; align-items:flex-start; gap:12px;">
            <div style="width:40px; height:40px; border-radius:12px; background:${colorMap[type]}20; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                <i class="fas ${iconMap[type] || 'fa-bell'}" style="color:${colorMap[type]}; font-size:1.1rem;"></i>
            </div>
            <div style="flex:1; min-width:0;">
                <div style="font-weight:800; font-size:0.85rem; color:#fff; margin-bottom:4px; letter-spacing:0.5px;">${title.toUpperCase()}</div>
                <div style="font-size:0.75rem; color:#94a3b8; line-height:1.4;">${message}</div>
                ${actionLabel ? `<button class="toast-action-btn" style="margin-top:10px; background:${colorMap[type]}; color:#000; border:none; padding:6px 14px; border-radius:20px; font-size:0.7rem; font-weight:800; cursor:pointer; transition:0.3s;">${actionLabel}</button>` : ''}
            </div>
            <button class="toast-close" style="background:transparent; border:none; color:#64748b; cursor:pointer; padding:0; font-size:1rem; line-height:1;">×</button>
        </div>
    `;

    container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
        toast.style.transform = 'translateX(0)';
        toast.style.opacity = '1';
    });

    // Close button
    toast.querySelector('.toast-close').onclick = () => dismissToast(toast);

    // Action button
    if (actionLabel && actionCallback) {
        toast.querySelector('.toast-action-btn').onclick = (e) => {
            e.stopPropagation();
            actionCallback();
            dismissToast(toast);
        };
    }

    // Click to dismiss
    toast.onclick = () => dismissToast(toast);

    // Auto dismiss
    if (duration > 0) {
        setTimeout(() => dismissToast(toast), duration);
    }

    return toast;
}

function dismissToast(toast) {
    toast.style.transform = 'translateX(120%)';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 500);
}

// --- NOTIFICATION TYPES ---
export function notifyNewUser(userName) {
    showFloatingNotification('Nuevo Miembro', `${userName} se ha unido a Padeluminatis. ¡Bienvenido al nexo!`, 'user');
    sendLocalNotification('Nuevo Jugador', `${userName} se ha unido a la familia.`);
}

export function notifyMatchCreated(creatorName, time, date) {
    showFloatingNotification('Partida Abierta', `${creatorName} ha reservado una pista para las ${time} del ${date}. ¡Únete!`, 'match', 'VER PARTIDA', () => window.location.href = 'calendario.html');
    sendLocalNotification('Nueva Partida', `${creatorName} ha abierto una partida.`, undefined, 'match-created');
}

export function notifyMatchReminder(matchTime, matchDate) {
    showFloatingNotification('Recordatorio', `Tu partido de las ${matchTime} del ${matchDate} es pronto. ¡Prepárate!`, 'warning');
    sendLocalNotification('Partido Próximo', `Tienes un partido a las ${matchTime}.`, undefined, 'reminder');
}

export function notifyLevelChange(newLevel, direction) {
    const msg = direction === 'up' ? `¡Enhorabuena! Has subido al nivel ${newLevel.toFixed(2)}. ¡Sigue así!` : `Has bajado al nivel ${newLevel.toFixed(2)}. ¡A por la remontada!`;
    showFloatingNotification(direction === 'up' ? 'Ascenso' : 'Descenso', msg, direction === 'up' ? 'success' : 'error');
    sendLocalNotification('Cambio de Nivel', msg);
}

export function notifyRankChange(newRank, oldRank) {
    if (newRank < oldRank) {
        showFloatingNotification('Subida de Puesto', `¡Has pasado del #${oldRank} al #${newRank}! Cada vez más arriba.`, 'rank');
    } else {
        showFloatingNotification('Cambio de Ranking', `Tu nueva posición es #${newRank}.`, 'info');
    }
}

export function notifyMatchResult(isWin, score, ptsChange) {
    const msg = isWin ? `¡Victoria ${score}! +${ptsChange} puntos añadidos.` : `Derrota ${score}. ${ptsChange} puntos.`;
    showFloatingNotification(isWin ? 'Victoria' : 'Derrota', msg, isWin ? 'success' : 'error');
}

export function notifyMatchCancelled(matchInfo) {
    showFloatingNotification('Partida Anulada', `La partida de las ${matchInfo} ha sido cancelada.`, 'error');
}

// --- INIT ---
export async function initPushNotifications() {
    const hasPermission = await requestNotificationPermission();
    if (hasPermission) {
        await registerServiceWorker();
        console.log('Push Notifications ready');
    }
    return hasPermission;
}
