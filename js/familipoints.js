// Variables globales
let familipoints = 200;
let cartasDisponibles = [];
let cartasUsuario = [];

// Tipos de cartas y sus probabilidades
const tiposCartas = {
    normal: { probabilidad: 0.7, color: '#ffffff' },
    epica: { probabilidad: 0.25, color: '#9b59b6' },
    legendaria: { probabilidad: 0.05, color: '#e74c3c' }
};

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    inicializarSistemaCartas();
    actualizarFamilipoints();
});

// Inicializar sistema de cartas
function inicializarSistemaCartas() {
    const chest = document.getElementById('chest');
    const cardsGrid = document.getElementById('cards-grid');
    const cardModal = document.getElementById('card-modal');
    
    // Evento para abrir el cofre
    chest.addEventListener('click', () => {
        if (puedeAbrirCofre()) {
            abrirCofre();
        } else {
            mostrarMensaje('No tienes suficientes Familipoints o no es el momento de la tirada gratis');
        }
    });
    
    // Eventos para el modal de cartas
    document.getElementById('add-to-collection').addEventListener('click', () => {
        añadirCartaAColeccion();
        cerrarModal();
    });
    
    document.getElementById('convert-points').addEventListener('click', () => {
        convertirAPuntos();
        cerrarModal();
    });
}

// Verificar si puede abrir el cofre
function puedeAbrirCofre() {
    const ahora = new Date();
    const dia = ahora.getDay();
    const hora = ahora.getHours();
    
    // Verificar tirada gratis (lunes 18:00 - 00:00)
    if (dia === 1 && hora >= 18) {
        return true;
    }
    
    // Verificar Familipoints
    return familipoints >= 50;
}

// Abrir cofre
function abrirCofre() {
    const chest = document.getElementById('chest');
    const chestLid = chest.querySelector('.chest-lid');
    
    // Animación de apertura
    chestLid.style.transform = 'rotateX(-110deg)';
    
    setTimeout(() => {
        const carta = generarCarta();
        mostrarCarta(carta);
        chestLid.style.transform = 'rotateX(0deg)';
    }, 1000);
}

// Generar carta aleatoria
function generarCarta() {
    const random = Math.random();
    let tipo;
    
    if (random < tiposCartas.normal.probabilidad) {
        tipo = 'normal';
    } else if (random < tiposCartas.normal.probabilidad + tiposCartas.epica.probabilidad) {
        tipo = 'epica';
    } else {
        tipo = 'legendaria';
    }
    
    return {
        id: Date.now(),
        tipo: tipo,
        nombre: `Carta ${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`,
        descripcion: `Una carta ${tipo} única`,
        valor: calcularValorCarta(tipo)
    };
}

// Calcular valor de la carta
function calcularValorCarta(tipo) {
    switch (tipo) {
        case 'normal':
            return 10;
        case 'epica':
            return 25;
        case 'legendaria':
            return 50;
        default:
            return 0;
    }
}

// Mostrar carta en el modal
function mostrarCarta(carta) {
    const modal = document.getElementById('card-modal');
    const modalImg = document.getElementById('modal-card-img');
    const modalName = document.getElementById('modal-card-name');
    const modalRarity = document.getElementById('modal-card-rarity');
    const modalDescription = document.getElementById('modal-card-description');
    
    modalImg.src = `img/cards/${carta.tipo}.png`;
    modalName.textContent = carta.nombre;
    modalRarity.textContent = carta.tipo.toUpperCase();
    modalDescription.textContent = carta.descripcion;
    
    modal.style.display = 'block';
}

// Añadir carta a la colección
function añadirCartaAColeccion() {
    const carta = obtenerCartaActual();
    cartasUsuario.push(carta);
    actualizarGridCartas();
}

// Convertir carta a Familipoints
function convertirAPuntos() {
    const carta = obtenerCartaActual();
    familipoints += carta.valor;
    actualizarFamilipoints();
}

// Actualizar Familipoints en la UI
function actualizarFamilipoints() {
    document.getElementById('familipoints').textContent = familipoints;
}

// Actualizar grid de cartas
function actualizarGridCartas() {
    const grid = document.getElementById('cards-grid');
    grid.innerHTML = '';
    
    cartasUsuario.forEach(carta => {
        const cardElement = document.createElement('div');
        cardElement.className = 'card';
        cardElement.style.backgroundColor = tiposCartas[carta.tipo].color;
        
        cardElement.innerHTML = `
            <img src="img/cards/${carta.tipo}.png" alt="${carta.nombre}">
            <h3>${carta.nombre}</h3>
            <p>${carta.descripcion}</p>
        `;
        
        grid.appendChild(cardElement);
    });
}

// Cerrar modal
function cerrarModal() {
    document.getElementById('card-modal').style.display = 'none';
}

// Mostrar mensaje
function mostrarMensaje(mensaje) {
    // Implementar sistema de notificaciones
    alert(mensaje);
}

// Obtener carta actual del modal
function obtenerCartaActual() {
    const modal = document.getElementById('card-modal');
    return {
        id: Date.now(),
        tipo: modal.querySelector('#modal-card-rarity').textContent.toLowerCase(),
        nombre: modal.querySelector('#modal-card-name').textContent,
        descripcion: modal.querySelector('#modal-card-description').textContent,
        valor: calcularValorCarta(modal.querySelector('#modal-card-rarity').textContent.toLowerCase())
    };
} 