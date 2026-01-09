import { registerUser, getCollection } from './firebase-service.js';
import { authGuard, showToast } from './ui-core.js';
import { db } from './firebase-config.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";

authGuard();

document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('registerForm');
    const posBtns = document.querySelectorAll('.pos-btn');
    const posInput = document.getElementById('posicion');
    const regTogglePassword = document.getElementById('regTogglePassword');
    const passwordInput = document.getElementById('password');

    // Toggle Posición
    posBtns.forEach(btn => {
        btn.onclick = () => {
            posBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            posInput.value = btn.dataset.pos;
        };
    });

    if (regTogglePassword) {
        regTogglePassword.onclick = () => {
             const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
             passwordInput.setAttribute('type', type);
             regTogglePassword.classList.toggle('fa-eye');
             regTogglePassword.classList.toggle('fa-eye-slash');
        };
    }

    if (registerForm) {
        registerForm.onsubmit = async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('username').value.trim();
            const email = document.getElementById('email').value.trim();
            const password = passwordInput.value;
            const bloque = document.getElementById('bloque').value;
            const piso = document.getElementById('piso').value;
            const puerta = document.getElementById('puerta').value;
            const posicion = posInput.value;

            // 1. Validations
            if (!username || !email || !password || !bloque || !piso || !puerta) {
                showToast('Completa todos los campos obligatorios.', 'warning');
                return;
            }

            if (password.length < 6) {
                showToast('La contraseña debe tener al menos 6 caracteres.', 'error');
                return;
            }

            try {
                // 2. Check unique username
                const q = query(collection(db, "usuarios"), where("nombreUsuario", "==", username));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    showToast('Ese nombre de usuario ya existe. Prueba otro.', 'error');
                    return;
                }

                // 3. Register
                showToast('Tramitando alta de socio...', 'info');
                
                await registerUser(email, password, {
                    nombreUsuario: username,
                    nombre: username, // Initially same
                    rol: 'Jugador',
                    aprobado: true, // Let's set to true for easier testing as requested, but keep field
                    posicion: posicion,
                    direccion: { bloque, piso, puerta },
                    puntosRankingTotal: 1000,
                    nivel: 2.0,
                    victorias: 0,
                    partidosJugados: 0,
                    familyPoints: 1000,
                    creadoEn: new Date()
                });

                showToast('¡Bienvenido al club! Registro completado.', 'success');
                setTimeout(() => window.location.href = 'index.html', 2000);

            } catch (err) {
                console.error(err);
                if (err.code === 'auth/email-already-in-use') showToast('El email ya está registrado.', 'error');
                else showToast('Error en el registro. Prueba más tarde.', 'error');
            }
        };
    }
});
