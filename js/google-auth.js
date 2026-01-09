/**
 * GOOGLE AUTHENTICATION
 * Maneja el login y registro con Google mediante Firebase
 */

import { auth } from './firebase-config.js';
import { signInWithPopup, GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js';
import { doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js';
import { db } from './firebase-config.js';

// Configurar el proveedor de Google
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account' // Siempre muestra selector de cuenta
});

/**
 * Inicia sesión o registra un usuario con Google
 */
export async function signInWithGoogle() {
  try {
    console.log('🔐 Iniciando autenticación con Google...');
    
    // Abrir popup de Google
    const result = await signInWithPopup(auth, googleProvider);
    
    // Usuario autenticado
    const user = result.user;
    console.log('✅ Usuario autenticado:', user.displayName);

    // Verificar si es un usuario nuevo
    const userRef = doc(db, 'usuarios', user.uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      // Usuario nuevo - Crear perfil
      console.log('🆕 Usuario nuevo, creando perfil...');
      
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        nombre: user.displayName || 'Usuario',
        fotoURL: user.photoURL || '',
        nivel: 1.0,
        puntos: 0,
        partidosJugados: 0,
        partidosGanados: 0,
        racha: 0,
        familyPoints: 100, // Puntos iniciales
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        provider: 'google',
        emailVerified: user.emailVerified
      });

      console.log('✅ Perfil de usuario creado exitosamente');
    } else {
      // Usuario existente - Actualizar última conexión
      console.log('👋 Usuario existente, bienvenido de nuevo');
      
      await setDoc(userRef, {
        updatedAt: serverTimestamp(),
        fotoURL: user.photoURL || userDoc.data().fotoURL || '',
        emailVerified: user.emailVerified
      }, { merge: true });
    }

    // Redirigir al home
    console.log('🏠 Redirigiendo a home...');
    window.location.href = 'home.html';
    
    return { success: true, user };
    
  } catch (error) {
    console.error('❌ Error en autenticación con Google:', error);
    
    // Manejar errores específicos
    let errorMessage = 'Error al iniciar sesión con Google';
    
    switch (error.code) {
      case 'auth/popup-closed-by-user':
        errorMessage = 'Has cerrado la ventana de autenticación';
        break;
      case 'auth/popup-blocked':
        errorMessage = 'El navegador ha bloqueado el popup. Por favor, permite los popups para este sitio';
        break;
      case 'auth/cancelled-popup-request':
        errorMessage = 'Solicitud de autenticación cancelada';
        break;
      case 'auth/network-request-failed':
        errorMessage = 'Error de conexión. Por favor, verifica tu internet';
        break;
      case 'auth/internal-error':
        errorMessage = 'Error interno. Por favor, intenta de nuevo';
        break;
      case 'auth/account-exists-with-different-credential':
        errorMessage = 'Ya existe una cuenta con este email usando otro método de inicio de sesión';
        break;
      default:
        errorMessage = error.message || 'Error desconocido';
    }
    
    return { success: false, error: errorMessage };
  }
}

/**
 * Configura el botón de Google en la página
 */
export function setupGoogleButton() {
  const googleButton = document.getElementById('googleSignIn');
  
  if (!googleButton) {
    console.warn('⚠️ Botón de Google no encontrado en el DOM');
    return;
  }

  googleButton.addEventListener('click', async (e) => {
    e.preventDefault();
    
    // Deshabilitar botón para evitar clicks múltiples
    googleButton.disabled = true;
    googleButton.style.opacity = '0.6';
    googleButton.innerHTML = `
      <div class="spinner" style="width: 20px; height: 20px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
      Conectando...
    `;
    
    try {
      const result = await signInWithGoogle();
      
      if (!result.success) {
        // Mostrar error
        const mensajeDiv = document.getElementById('mensaje');
        if (mensajeDiv) {
          mensajeDiv.textContent = result.error;
          mensajeDiv.style.color = '#ff1744';
          mensajeDiv.style.background = 'rgba(255, 23, 68, 0.1)';
        }
        
        // Restaurar botón
        restoreGoogleButton(googleButton);
      }
      // Si success es true, la página ya se redirigió
      
    } catch (err) {
      console.error('❌ Error inesperado:', err);
      restoreGoogleButton(googleButton);
    }
  });
  
  console.log('✅ Botón de Google configurado');
}

/**
 * Restaura el botón de Google a su estado original
 */
function restoreGoogleButton(button) {
  button.disabled = false;
  button.style.opacity = '1';
  button.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
      <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
      <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
      <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
    </svg>
    Continuar con Google
  `;
}

// Exportar funciones
export default {
  signInWithGoogle,
  setupGoogleButton
};
