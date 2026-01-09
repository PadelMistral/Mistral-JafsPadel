/**
 * Menú Hamburguesa - Padeluminatis
 * Maneja la apertura y cierre del menú lateral en dispositivos móviles.
 */

document.addEventListener('DOMContentLoaded', () => {
    const burgerBtn = document.querySelector('.burger-menu-btn');
    const sideMenu = document.querySelector('.side-menu-overlay');
    const closeMenuBtn = document.querySelector('.close-side-menu');

    if (burgerBtn && sideMenu) {
        burgerBtn.addEventListener('click', () => {
            sideMenu.classList.add('active');
            document.body.style.overflow = 'hidden'; // Evita scroll de fondo
        });
    }

    if (closeMenuBtn && sideMenu) {
        closeMenuBtn.addEventListener('click', () => {
            sideMenu.classList.remove('active');
            document.body.style.overflow = '';
        });
    }

    // Cerrar al hacer click fuera del menú
    if (sideMenu) {
        sideMenu.addEventListener('click', (e) => {
            if (e.target === sideMenu) {
                sideMenu.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    }
});
