import { loginUser, loginWithGoogle, getDocument } from './firebase-service.js';
import { authGuard } from './ui-core.js';

authGuard();

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const googleLoginBtn = document.getElementById('googleLogin');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const togglePassword = document.getElementById('togglePassword');
    const mensajeDiv = document.getElementById('mensaje');

    // Toggle password visibility
    if (togglePassword) {
        togglePassword.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            togglePassword.classList.toggle('fa-eye');
            togglePassword.classList.toggle('fa-eye-slash');
        });
    }

    // Email/Password Login
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = emailInput.value;
            const password = passwordInput.value;

            mostrarMensaje('Iniciando sesión...', 'info');

            try {
                const user = await loginUser(email, password);
                await verifyUserAndRedirect(user);
            } catch (error) {
                console.error(error);
                mostrarMensaje('Error: Credenciales incorrectas o usuario no existe.', 'error');
            }
        });
    }

    // Google Login
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', async () => {
            mostrarMensaje('Conectando con Google...', 'info');
            try {
                const user = await loginWithGoogle();
                await verifyUserAndRedirect(user);
            } catch (error) {
                console.error(error);
                mostrarMensaje('Error al iniciar sesión con Google.', 'error');
            }
        });
    }

    async function verifyUserAndRedirect(user) {
        try {
            const userData = await getDocument('usuarios', user.uid);
            if (!userData) {
                mostrarMensaje('Usuario no registrado en la base de datos.', 'error');
                return;
            }

            if (userData.aprobado) {
                mostrarMensaje('¡Bienvenido! Redirigiendo...', 'success');
                setTimeout(() => {
                    window.location.href = 'home.html';
                }, 1500);
            } else {
                mostrarMensaje('Tu cuenta está pendiente de aprobación por el administrador.', 'info');
            }
        } catch (error) {
            console.error(error);
            mostrarMensaje('Error al verificar el estado del usuario.', 'error');
        }
    }

    function mostrarMensaje(texto, tipo) {
        mensajeDiv.textContent = texto;
        mensajeDiv.className = `login-message show ${tipo}`;
    }
});
