import { db, auth } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js';
import { 
    collection, query, where, orderBy, onSnapshot, 
    doc, updateDoc, writeBatch, getDocs 
} from 'https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js';
import { authGuard, initSharedUI } from './ui-core.js';

initSharedUI('NOTIFICACIONES');

authGuard();

document.addEventListener('DOMContentLoaded', () => {
    const list = document.getElementById('notifications-list');
    const markAllBtn = document.getElementById('mark-all-read');
    const clearHistoryBtn = document.getElementById('clear-history');
    const tabs = document.querySelectorAll('.filter-tab');
    let currentFilter = 'all';
    let allNotifications = [];

    onAuthStateChanged(auth, (user) => {
        if (user) {
            setupNotifications(user.uid);
        } else {
            window.location.href = 'index.html';
        }
    });

    function setupNotifications(uid) {
        if (list) list.innerHTML = '<div class="loader-ring-container"><div class="spinner-small"></div></div>';
        
        try {
            const q = query(
                collection(db, "notificaciones"),
                where("uid", "==", uid),
                orderBy("createdAt", "desc")
            );

            onSnapshot(q, (snapshot) => {
                renderNotifs(snapshot);
            }, async (error) => {
                console.warn("Notifications OrderBy Error (missing index?):", error);
                const qBasic = query(
                    collection(db, "notificaciones"),
                    where("uid", "==", uid)
                );
                const snap = await getDocs(qBasic);
                renderNotifs(snap, true);
            });
        } catch (error) {
            console.error("Setup Notifications Error:", error);
            if (list) list.innerHTML = '<div class="empty-state"><p>Error al cargar notificaciones</p></div>';
        }

        markAllBtn.onclick = async () => {
            if (!allNotifications.some(n => !n.read)) return;
            if (!confirm('¿Marcar todas como leídas?')) return;
            const batch = writeBatch(db);
            const unreadDocs = allNotifications.filter(n => !n.read);
            unreadDocs.forEach(n => batch.update(doc(db, "notificaciones", n.id), { read: true }));
            await batch.commit();
        };

        clearHistoryBtn.onclick = async () => {
            if (allNotifications.length === 0) return;
            if (!confirm('¿Borrar todo el historial de notificaciones? Esta acción no se puede deshacer.')) return;
            const batch = writeBatch(db);
            allNotifications.forEach(n => batch.delete(doc(db, "notificaciones", n.id)));
            await batch.commit();
        };

        tabs.forEach(tab => {
            tab.onclick = () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                currentFilter = tab.dataset.filter;
                renderNotifs(allNotifications, false, true);
            };
        });
    }

    function renderNotifs(snapshotOrArray, manualSort = false, isArray = false) {
        if (!list) return;
        
        if (!isArray) {
            allNotifications = [];
            snapshotOrArray.forEach(d => allNotifications.push({ id: d.id, ...d.data() }));
            
            if (manualSort) {
                allNotifications.sort((a, b) => {
                    const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
                    const db = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
                    return db - da;
                });
            }
        }

        const filtered = allNotifications.filter(n => {
            if (currentFilter === 'unread') return !n.read;
            if (currentFilter === 'read') return n.read;
            return true;
        });

        list.innerHTML = "";

        if (filtered.length === 0) {
            list.innerHTML = `
                <div class="empty-state animate-fade-in" style="text-align:center; padding: 50px 20px; opacity:0.5;">
                    <i class="fas fa-bell-slash" style="font-size:3rem; margin-bottom:15px;"></i>
                    <p>${currentFilter === 'all' ? 'No tienes notificaciones' : 'No hay notificaciones en esta categoría'}</p>
                </div>`;
            return;
        }

        filtered.forEach(notif => {
            list.appendChild(createNotificationItem(notif));
        });
    }

    function createNotificationItem(notif) {
        const div = document.createElement('div');
        div.className = `notif-item ${notif.read ? 'read' : 'unread'} type-${notif.type || 'info'} animate-fade-in`;
        
        const date = notif.createdAt?.toDate ? notif.createdAt.toDate() : new Date();
        const icon = getIcon(notif.type);

        div.innerHTML = `
            <div class="notif-icon-box">${icon}</div>
            <div class="notif-info">
                <div class="notif-title-row">
                    <span class="notif-title">${notif.title}</span>
                    <span class="notif-date">${timeAgo(date)}</span>
                </div>
                <div class="notif-body">${notif.message}</div>
            </div>
        `;

        div.onclick = async () => {
            if (!notif.read) {
                await updateDoc(doc(db, "notificaciones", notif.id), { read: true });
            }
            if (notif.link) {
                window.location.href = notif.link;
            } else {
                const fullDate = date.toLocaleString('es-ES', { 
                    weekday: 'long', day: 'numeric', month: 'long', 
                    year: 'numeric', hour: '2-digit', minute: '2-digit' 
                });
                alert(`DETALLES: ${notif.title}\n${fullDate}\n\n${notif.message}`);
            }
        };

        return div;
    }

    function getIcon(type) {
        switch(type) {
            case 'match_invite': return '<i class="fas fa-user-plus"></i>';
            case 'success': return '<i class="fas fa-check-circle"></i>';
            case 'warning': return '<i class="fas fa-exclamation-triangle"></i>';
            case 'info': return '<i class="fas fa-info-circle"></i>';
            default: return '<i class="fas fa-bell"></i>';
        }
    }

    function timeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + " años";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + " meses";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + " d";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + " h";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + " min";
        return "ahora";
    }
});