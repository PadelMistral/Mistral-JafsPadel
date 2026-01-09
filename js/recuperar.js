import { auth } from './firebase-config.js';
import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";
import { authGuard } from './ui-core.js';

authGuard();

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('recuperarForm');
    const mensajeDiv = document.getElementById('mensaje');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;

        mostrarMensaje("Enviando...", "info");

        try {
            await sendPasswordResetEmail(auth, email);
            mostrarMensaje("Correo enviado. Revisa tu bandeja de entrada.", "success");
        } catch (error) {
            console.error(error);
            if (error.code === 'auth/user-not-found') {
                mostrarMensaje("No se encontró una cuenta con ese email.", "error");
            } else {
                mostrarMensaje("Error al enviar el correo.", "error");
            }
        }
    });

    function mostrarMensaje(texto, tipo) {
        mensajeDiv.textContent = texto;
        mensajeDiv.className = `auth-message show ${tipo}`;
    }
});
