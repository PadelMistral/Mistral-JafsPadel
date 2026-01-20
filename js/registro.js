import { registerUser } from './firebase-service.js';
import { db } from './firebase-config.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";
import { createNotification } from './notifications-service.js';
import { authGuard } from './ui-core.js';

authGuard();

document.addEventListener('DOMContentLoaded', () => {
    const registroForm = document.getElementById('registroForm');
    const mensajeDiv = document.getElementById('mensaje');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const togglePassword = document.getElementById('togglePassword');
    const toggleConfirmPassword = document.getElementById('toggleConfirmPassword');

    // Toggle password visibility
    if (togglePassword) {
        togglePassword.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            togglePassword.classList.toggle('fa-eye');
            togglePassword.classList.toggle('fa-eye-slash');
        });
    }

    if (toggleConfirmPassword) {
        toggleConfirmPassword.addEventListener('click', () => {
            const type = confirmPasswordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            confirmPasswordInput.setAttribute('type', type);
            toggleConfirmPassword.classList.toggle('fa-eye');
            toggleConfirmPassword.classList.toggle('fa-eye-slash');
        });
    }

    if (registroForm) {
        registroForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const nombre = document.getElementById('nombre').value;
            const email = document.getElementById('email').value;
            const password = passwordInput.value;
            const confirmPassword = confirmPasswordInput.value;
            const nivel = parseFloat(document.getElementById('nivel').value) || 1.5;
            const bloque = document.getElementById('reg-bloque').value;
            const piso = document.getElementById('reg-piso').value;
            const puerta = document.getElementById('reg-puerta').value;
            const fotoFile = document.getElementById('fotoPerfil').files[0];

            if (password !== confirmPassword) {
                mostrarMensaje('Las contraseñas no coinciden.', 'error');
                return;
            }

            if (password.length < 6) {
                mostrarMensaje('La contraseña debe tener al menos 6 caracteres.', 'error');
                return;
            }

            mostrarMensaje('Creando cuenta...', 'info');

            try {
                // 1. Create User Auth & Doc
                const user = await registerUser(email, password, {
                    nombre: nombre,
                    aprobado: false,
                    rol: 'Jugador',
                    partidosJugados: 0,
                    victorias: 0,
                    derrotas: 0,
                    puntosRanking: 0,
                    nivel: nivel,
                    direccion: { bloque, piso, puerta },
                    fcmToken: '',
                    fotoPerfil: null 
                });

                // 2. Upload Photo if exists
                if (fotoFile) {
                    mostrarMensaje('Subiendo foto...', 'info');
                    try {
                        const { uploadFile, getFileDownloadURL, updateDocument } = await import('./firebase-service.js');
                        const path = `profile_photos/${user.uid}/profile_${Date.now()}.jpg`;
                        await uploadFile(path, fotoFile);
                        const url = await getFileDownloadURL(path);
                        await updateDocument('usuarios', user.uid, { fotoPerfil: url, fotoURL: url });
                    } catch (uploadErr) {
                        console.warn('Error subiendo foto:', uploadErr);
                    }
                }

                // Notify Admins
                const adminQ = query(collection(db, 'usuarios'), where('rol', '==', 'Admin'));
                const adminSnaps = await getDocs(adminQ);
                const adminIds = adminSnaps.docs.map(d => d.id);
                if (adminIds.length > 0) {
                   await createNotification(adminIds, "Nuevo Usuario", `${nombre} se ha registrado y espera aprobación.`, 'info', 'admin.html');
                }

                mostrarMensaje('¡Registro exitoso! Tu cuenta está pendiente de aprobación por el admin.', 'success');
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 3000);
            } catch (error) {
                console.error(error);
                let msg = 'Error al registrar el usuario.';
                if (error.code === 'auth/email-already-in-use') {
                    msg = 'El correo ya está en uso.';
                }
                mostrarMensaje(msg, 'error');
            }
        });
    }

    function mostrarMensaje(texto, tipo) {
        mensajeDiv.textContent = texto;
        mensajeDiv.className = `auth-message show ${tipo}`;
    }
});
