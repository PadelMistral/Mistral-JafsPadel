import { particlesConfig, particlesConfigPerfil } from './particles-config.js';
 
window.addEventListener('DOMContentLoaded', () => {
  if (window.particlesJS) {
    // Detectar si estamos en perfil-usuario.html
    const isPerfilUsuario = window.location.pathname.includes('perfil-usuario.html');
    const config = isPerfilUsuario ? particlesConfigPerfil : particlesConfig;
    
    // Verificar que el elemento particles-js existe antes de inicializar
    const particlesElement = document.getElementById('particles-js');
    if (particlesElement) {
      particlesJS('particles-js', config);
    }
  }
}); 