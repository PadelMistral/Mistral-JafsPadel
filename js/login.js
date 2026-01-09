import { loginUser, loginWithGoogle, getDocument, addDocument, setDocument } from './firebase-service.js';
import { authGuard, showToast, initSharedUI } from './ui-core.js';
import { db } from './firebase-config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";

authGuard();
initSharedUI('Login');

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const googleLoginBtn = document.getElementById('googleLogin');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const togglePassword = document.getElementById('togglePassword');

    if (togglePassword) {
        togglePassword.onclick = () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            togglePassword.classList.toggle('fa-eye');
            togglePassword.classList.toggle('fa-eye-slash');
        };
    }

    if (loginForm) {
        loginForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = emailInput.value.trim();
            const password = passwordInput.value;

            try {
                const user = await loginUser(email, password);
                await checkUserAndRedirect(user);
            } catch (err) {
                console.error(err);
                if (err.code === 'auth/user-not-found') showToast('Usuario no registrado.', 'error');
                else if (err.code === 'auth/wrong-password') showToast('Contraseña incorrecta.', 'error');
                else showToast('Error de acceso. Inténtalo más tarde.', 'error');
            }
        };
    }

    if (googleLoginBtn) {
        googleLoginBtn.onclick = async () => {
            try {
                const user = await loginWithGoogle();
                await checkUserAndRedirect(user);
            } catch (err) {
                console.error(err);
                showToast('Cancelado o error con Google.', 'warning');
            }
        };
    }

    async function checkUserAndRedirect(user) {
        const snap = await getDoc(doc(db, "usuarios", user.uid));
        
        if (!snap.exists()) {
            // New Google User - Needs profile setup
            showToast('¡Bienvenido! Completa tu perfil para continuar.', 'info');
            // Redirect to registration but flagging as Google? 
            // Better: Simple prompt for missing info, but let's redirect to a modified registration or just show warning
            // For now, let's create a minimal doc and redirect to perfil.html to complete it
            await setDocument('usuarios', user.uid, {
                uid: user.uid,
                email: user.email,
                nombreUsuario: user.displayName || user.email.split('@')[0],
                nombre: user.displayName || '',
                fotoURL: user.photoURL || '',
                rol: 'Jugador',
                puntosRankingTotal: 1000,
                nivel: 2.0,
                victorias: 0,
                partidosJugados: 0,
                familyPoints: 0,
                posicion: 'Derecha',
                aprobado: true // Google accounts auto-approved for simplicity? or false?
            });
            setTimeout(() => window.location.href = 'perfil.html', 1500);
        } else {
            const data = snap.data();
            if (data.aprobado === false) {
                showToast('Tu cuenta aún no ha sido aprobada por un administrador.', 'warning');
            } else {
                showToast('Acceso concedido. Cargando club...', 'success');
                setTimeout(() => window.location.href = 'home.html', 1200);
            }
        }
    }
});
