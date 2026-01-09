import { db, auth } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js';
import { 
    collection, query, where, orderBy, onSnapshot, 
    doc, updateDoc, writeBatch, getDocs 
} from 'https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js';
import { authGuard } from './ui-core.js';

authGuard();

document.addEventListener('DOMContentLoaded', () => {
    const list = document.getElementById('notifications-list');
    const markAllBtn = document.getElementById('mark-all-read');

    onAuthStateChanged(auth, (user) => {
        if (user) {
            setupNotifications(user.uid);
        } else {
            window.location.href = 'index.html';
        }
    });

    function setupNotifications(uid) {
        if (list) list.innerHTML = '<div class="loader-spinner" style="margin-top:50px;"></div>';
        
        try {
            const q = query(
                collection(db, "notificaciones"),
                where("uid", "==", uid)
            );

            onSnapshot(q, (snapshot) => {
                if (!list) return;
                list.innerHTML = "";

                if (snapshot.empty) {
                    list.innerHTML = `
                        <div class="empty-state animate-fade-in">
                            <i class="fas fa-bell-slash"></i>
                            <p>No tienes notificaciones aún</p>
                        </div>`;
                    return;
                }

                let notifs = [];
                snapshot.forEach(docSnap => {
                    notifs.push({ id: docSnap.id, ...docSnap.data() });
                });

                // Client-side Sort
                notifs.sort((a, b) => {
                    const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
                    const db = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
                    return db - da;
                });

                notifs.forEach(notif => {
                    list.appendChild(createNotificationItem(notif));
                });
            }, (error) => {
                console.error("Notifications Sync Error:", error);
                if (list) list.innerHTML = '<div class="empty-state"><p>Error al sincronizar notificaciones</p></div>';
            });
        } catch (error) {
            console.error("Setup Notifications Error:", error);
            if (list) list.innerHTML = '<div class="empty-state"><p>Error al cargar notificaciones</p></div>';
        }

        markAllBtn.onclick = async () => {
            const batch = writeBatch(db);
            const unreadSnap = await getDocs(query(
                collection(db, "notificaciones"),
                where("uid", "==", uid),
                where("read", "==", false)
            ));
            unreadSnap.forEach(d => batch.update(d.ref, { read: true }));
            await batch.commit();
        };
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
            const fullDate = date.toLocaleString('es-ES', { 
                weekday: 'long', day: 'numeric', month: 'long', 
                year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' 
            });
            
            alert(`DETALLES DE NOTIFICACIÓN\nRecibida el: ${fullDate}\n\n${notif.message}`);

            if (!notif.read) {
                await updateDoc(doc(db, "notificaciones", notif.id), { read: true });
            }
            if (notif.link) {
                window.location.href = notif.link;
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
        if (interval > 1) return Math.floor(interval) + " días";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + " h";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + " min";
        return "ahora";
    }
});