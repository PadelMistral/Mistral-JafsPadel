// js/time-slots-system.js - Sistema de Franjas Horarias
import { db } from './firebase-service.js';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, deleteDoc } from 'https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js';
import { crearNotificacion } from './notification-system.js';

const TIME_SLOTS = [
    '08:00 - 09:30',
    '09:30 - 11:00',
    '11:00 - 12:30',
    '12:30 - 14:00',
    '14:00 - 15:30',
    '15:30 - 17:00',
    '17:00 - 18:30',
    '18:30 - 20:00',
    '20:00 - 21:30',
    '21:30 - 23:00'
];

let currentCourt = 1;
let currentSlotDate = null;
let userInfo = null;

export function initializeTimeSlotsSystem(user) {
    userInfo = user;
    setupCourtButtons();
}

function setupCourtButtons() {
    const courtBtns = document.querySelectorAll('.court-btn');
    courtBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            courtBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentCourt = parseInt(btn.dataset.court);
            if (currentSlotDate) {
                renderTimeSlots(currentSlotDate, currentCourt);
            }
        });
    });
}

export async function showTimeSlotsForDate(date) {
    currentSlotDate = date;
    
    // Mostrar container de slots
    const slotsContainer = document.getElementById('time-slots-container');
    const jornadasContainer = document.getElementById('lista-jornadas');
    
    if (slotsContainer) {
        slotsContainer.style.display = 'block';
    }
    if (jornadasContainer) {
        jornadasContainer.style.display = 'none';
    }

    // Actualizar fecha mostrada
    const dateDisplay = document.getElementById('slots-date-display');
    if (dateDisplay) {
        const dateStr = date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
        dateDisplay.textContent = dateStr;
    }

    // Renderizar slots
    await renderTimeSlots(date, currentCourt);
}

async function renderTimeSlots(date, court) {
    const grid = document.getElementById('time-slots-grid');
    if (!grid) return;

    grid.innerHTML = '';

    // Obtener reservas existentes para este día y pista
    const reservations = await getReservationsForDate(date, court);

    TIME_SLOTS.forEach((timeSlot, index) => {
        // Time label
        const label = document.createElement('div');
        label.className = 'time-label';
        label.textContent = timeSlot;
        grid.appendChild(label);

        // Time slot
        const slot = createTimeSlot(timeSlot, date, court, reservations, index);
        grid.appendChild(slot);
    });
}

async function getReservationsForDate(date, court) {
    try {
        const dateStr = date.toISOString().split('T')[0];
        const q = query(
            collection(db, 'reservas'),
            where('fecha', '==', dateStr),
            where('pista', '==', court)
        );
        const snapshot = await getDocs(q);
        const reservations = {};
        
        snapshot.forEach(doc => {
            const data = doc.data();
            reservations[data.horario] = {
                id: doc.id,
                ...data
            };
        });
        
        return reservations;
    } catch (error) {
        console.error('Error getting reservations:', error);
        return {};
    }
}

function createTimeSlot(timeSlot, date, court, reservations, index) {
    const slot = document.createElement('div');
    slot.className = 'time-slot';

    const now = new Date();
    const slotDateTime = new Date(date);
    const [startHour] = timeSlot.split(' - ')[0].split(':');
    slotDateTime.setHours(parseInt(startHour), 0, 0, 0);

    const isPast = slotDateTime < now;
    const reservation = reservations[timeSlot];
    const isMine = reservation && reservation.jugadores?.some(j => j.uid === userInfo?.uid);

    // Clases de estado
    if (isPast) {
        slot.classList.add('past');
    } else if (isMine) {
        slot.classList.add('mine');
    } else if (reservation) {
        slot.classList.add('reserved');
    } else {
        slot.classList.add('available');
    }

    // Contenido del slot
    let statusHTML = '';
    if (isPast) {
        statusHTML = '<div class="slot-status"><i class="fas fa-clock"></i> Pasado</div>';
    } else if (isMine) {
        statusHTML = '<div class="slot-status mine"><i class="fas fa-check-circle"></i> Tu Reserva</div>';
    } else if (reservation) {
        statusHTML = '<div class="slot-status reserved"><i class="fas fa-lock"></i> Reservado</div>';
    } else {
        statusHTML = '<div class="slot-status available"><i class="fas fa-circle-check"></i> Disponible</div>';
    }

    slot.innerHTML = statusHTML;

    // Mostrar jugadores si hay reserva
    if (reservation && reservation.jugadores) {
        const playersHTML = `
            <div class="slot-players">
                ${reservation.jugadores.map(j => `
                    <img src="${j.foto || 'https://ui-avatars.com/api/?name=' + j.nombre}" 
                         class="slot-player-avatar" 
                         title="${j.nombre}">
                `).join('')}
                ${Array(4 - reservation.jugadores.length).fill(0).map(() => `
                    <div style="width: 24px; height: 24px; border-radius: 50%; border: 2px dashed var(--text-muted); display: flex; align-items: center; justify-content: center;">
                        <i class="fas fa-plus" style="font-size: 10px; color: var(--text-muted);"></i>
                    </div>
                `).join('')}
            </div>
        `;
        slot.innerHTML += playersHTML;
    }

    // Botón de acción
    if (!isPast) {
        if (isMine) {
            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'slot-action-btn cancel';
            cancelBtn.textContent = 'Cancelar';
            cancelBtn.onclick = () => cancelReservation(reservation.id);
            slot.appendChild(cancelBtn);
        } else if (!reservation) {
            const reserveBtn = document.createElement('button');
            reserveBtn.className = 'slot-action-btn';
            reserveBtn.textContent = 'Reservar';
            reserveBtn.onclick = () => makeReservation(timeSlot, date, court);
            slot.appendChild(reserveBtn);
        } else if (reservation.jugadores.length < 4) {
            const joinBtn = document.createElement('button');
            joinBtn.className = 'slot-action-btn';
            joinBtn.textContent = `Unirse (${reservation.jugadores.length}/4)`;
            joinBtn.onclick = () => joinReservation(reservation.id, timeSlot, date, court);
            slot.appendChild(joinBtn);
        }
    }

    return slot;
}

async function makeReservation(timeSlot, date, court) {
    try {
        const dateStr = date.toISOString().split('T')[0];
        
        const reservationData = {
            fecha: dateStr,
            horario: timeSlot,
            pista: court,
            jugadores: [{
                uid: userInfo.uid,
                nombre: userInfo.nombre || userInfo.email,
                foto: userInfo.fotoPerfil || null
            }],
            creador: userInfo.uid,
            fechaCreacion: new Date(),
            estado: 'pendiente'
        };

        await addDoc(collection(db, 'reservas'), reservationData);

        // Notificación
        await crearNotificacion(userInfo.uid, 'reserva_creada', `Reserva confirmada para ${timeSlot} en Pista ${court}`);

        alert(`¡Reserva confirmada!\n${timeSlot} - Pista ${court}`);

        // Recargar slots
        await renderTimeSlots(date, court);

    } catch (error) {
        console.error('Error making reservation:', error);
        alert('Error al crear la reserva. Intenta de nuevo.');
    }
}

async function joinReservation(reservationId, timeSlot, date, court) {
    try {
        const jugador = {
            uid: userInfo.uid,
            nombre: userInfo.nombre || userInfo.email,
            foto: userInfo.fotoPerfil || null
        };

        const reservationRef = doc(db, 'reservas', reservationId);
        const reservationDoc = await getDoc(reservationRef);
        const currentJugadores = reservationDoc.data().jugadores || [];

        await updateDoc(reservationRef, {
            jugadores: [...currentJugadores, jugador]
        });

        // Notificar al creador y otros jugadores
        for (const j of currentJugadores) {
            await crearNotificacion(j.uid, 'unirse_partido', `${jugador.nombre} se unió a tu reserva de ${timeSlot}`);
        }

        alert(`¡Te has unido a la reserva!`);

        // Recargar slots
        await renderTimeSlots(date, court);

    } catch (error) {
        console.error('Error joining reservation:', error);
        alert('Error al unirse. Intenta de nuevo.');
    }
}

async function cancelReservation(reservationId) {
    if (!confirm('¿Seguro que quieres cancelar esta reserva?')) return;

    try {
        await deleteDoc(doc(db, 'reservas', reservationId));

        alert('Reserva cancelada.');

        // Recargar slots
        await renderTimeSlots(currentSlotDate, currentCourt);

    } catch (error) {
        console.error('Error canceling reservation:', error);
        alert('Error al cancelar. Intenta de nuevo.');
    }
}

// Importar getDoc
import { getDoc } from 'https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js';
