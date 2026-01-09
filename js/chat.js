import { db, auth } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js';
import { 
    collection, query, orderBy, onSnapshot, addDoc, serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js';
import { getDocument } from './firebase-service.js';
import { authGuard } from './ui-core.js';

authGuard();

document.addEventListener('DOMContentLoaded', () => {
    const list = document.getElementById("mensajes");
    const form = document.getElementById("form-chat");
    const input = document.getElementById("mensaje-input");

    let usuarioActual = null;
    let userData = null;

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            usuarioActual = user;
            userData = await getDocument("usuarios", user.uid);
            setupChat();
        } else {
            window.location.href = 'index.html';
        }
    });

    function setupChat() {
        const q = query(collection(db, "chat_publico"), orderBy("timestamp", "asc"));

        onSnapshot(q, (snapshot) => {
            if (!list) return;
            list.innerHTML = "";
            snapshot.forEach(docSnap => {
                const msg = docSnap.data();
                const isMe = msg.from === usuarioActual.uid;
                const div = document.createElement("div");
                div.className = `mensaje ${isMe ? 'yo' : 'otro'} animate-fade-in`;
                
                const hora = msg.timestamp ? msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                
                div.innerHTML = `
                    <div class="mensaje-contenido">
                        <span class="sender-name">${isMe ? 'Tú' : (msg.nombreUsuarioFrom || 'Jugador')}</span>
                        <div class="mensaje-texto">${msg.texto || ''}</div>
                        <span class="mensaje-hora">${hora}</span>
                    </div>
                `;
                list.appendChild(div);
            });
            list.scrollTop = list.scrollHeight;
        });
    }

    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const text = input.value.trim();
            if (!text) return;
            input.value = "";
            
            try {
                await addDoc(collection(db, "chat_publico"), {
                    from: usuarioActual.uid,
                    nombreUsuarioFrom: userData?.nombreUsuario || 'Jugador',
                    texto: text,
                    timestamp: serverTimestamp(),
                    tipo: 'texto'
                });
            } catch (err) { console.error(err); }
        };
    }
});