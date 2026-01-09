import { db } from './firebase-config.js';
import { collection, addDoc, updateDoc, doc, query, where, orderBy, limit, getDocs, Timestamp } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";

/* =================================================================
   NOTIFICATIONS SERVICE
   Gestión centralizada de notificaciones en Firestore.
   ================================================================= */

/**
 * Crea una notificación para un usuario (o varios si uid es array).
 * @param {string|string[]} targetUid - UID del destinatario (o array de UIDs).
 * @param {string} title - Título breve (ej: "Nuevo Partido").
 * @param {string} message - Mensaje descriptivo.
 * @param {string} type - 'info', 'success', 'warning', 'error', 'match_invite', 'rank_up'.
 * @param {string} link - (Opcional) URL a donde redirigir al hacer click.
 */
export async function createNotification(targetUid, title, message, type = 'info', link = null) {
    try {
        const targets = Array.isArray(targetUid) ? targetUid : [targetUid];
        const promises = targets.map(uid => {
            return addDoc(collection(db, "notificaciones"), {
                uid: uid,
                title: title,
                message: message,
                type: type,
                link: link,
                read: false,
                createdAt: Timestamp.now()
            });
        });
        await Promise.all(promises);
        console.log("Notificaciones enviadas a:", targets);
    } catch (e) {
        console.error("Error enviando notificaciones:", e);
    }
}

/**
 * Marca una notificación como leída.
 */
export async function markAsRead(notifId) {
    try {
        await updateDoc(doc(db, "notificaciones", notifId), { read: true });
    } catch (e) {
        console.error(e);
    }
}

/**
 * Elimina una notificación específica.
 */
export async function deleteNotification(notifId) {
    try {
        const { deleteDoc } = await import("https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js");
        await deleteDoc(doc(db, "notificaciones", notifId));
    } catch (e) {
        console.error("Error deleting notification:", e);
    }
}

/**
 * Crea un recordatorio para un partido de hoy, evitando duplicados.
 */
export async function createTodayReminder(uid, matchId, timeStr) {
    try {
        const q = query(
            collection(db, "notificaciones"), 
            where("uid", "==", uid), 
            where("type", "==", "match_today"),
            where("matchId", "==", matchId)
        );
        const snap = await getDocs(q);
        if (snap.empty) {
            await addDoc(collection(db, "notificaciones"), {
                uid: uid,
                title: "¡HOY TIENES PARTIDO!",
                message: `Recordatorio: Tienes una partida hoy a las ${timeStr}.`,
                type: 'match_today',
                matchId: matchId,
                read: false,
                createdAt: Timestamp.now()
            });
        }
    } catch (e) {
        console.error("Error creating today reminder:", e);
    }
}

/**
 * Elimina notificaciones antiguas (limpieza).
 */
export async function cleanOldNotifications(uid) {
    // Implementación futura server-side o limpieza manual
}
