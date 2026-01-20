import { db } from './firebase-config.js';
import { 
    doc, getDoc, updateDoc, deleteDoc, collection, addDoc, serverTimestamp, 
    query, where, orderBy, limit, onSnapshot , Timestamp
} from 'https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js';
import { processMatchResults } from './ranking-service.js';
import { createNotification } from './notifications-service.js';
import { showToast } from './ui-core.js';

let chatUnsubscribe = null;

export async function getPlayerDisplayName(uid) {
    if (!uid) return '---';
    if (uid.startsWith('GUEST_')) return uid.replace('GUEST_', '');
    try {
        const snap = await getDoc(doc(db, 'usuarios', uid));
        return snap.exists() ? (snap.data().nombreUsuario || snap.data().nombre || 'Jugador') : 'Jugador';
    } catch { return 'Jugador'; }
}

export async function getPlayerDisplayData(uid) {
    if (!uid) return { name: '---', initials: '?', color: '#555', photo: null };
    if (uid.startsWith('GUEST_')) {
        const name = uid.replace('GUEST_', '');
        return { name, initials: name.charAt(0).toUpperCase(), color: '#888', photo: null };
    }
    try {
        const snap = await getDoc(doc(db, 'usuarios', uid));
        const data = snap.exists() ? snap.data() : {};
        const name = data.nombreUsuario || data.nombre || 'Jugador';
        return {
            name,
            initials: name.substring(0, 2).toUpperCase(),
            color: data.colorRanking || '#ff6b35',
            photo: data.fotoPerfil || data.fotoURL || null
        };
    } catch (e) {
        console.warn("Error loading user data for", uid, e);
        return { name: 'Jugador', initials: '??', color: '#555', photo: null };
    }
}

export async function renderMatchDetailsShared(container, match, usuarioActual, userData, options = {}) {
    const isMine = match.jugadores?.includes(usuarioActual.uid);
    const isFull = match.jugadores?.length === 4;
    const isCreator = match.creador === usuarioActual.uid || userData?.esAdmin;
    const isClosed = (match.estado || '').toLowerCase() === 'cerrado' || isFull;
    const isPlayed = (match.estado || '').toLowerCase() === 'jugado';
    const matchDate = match.fecha.toDate ? match.fecha.toDate() : new Date(match.fecha);
    const endTime = new Date(matchDate.getTime() + 90*60000);
    
    // Get player names
    const playerNames = await Promise.all([0,1,2,3].map(async i => {
        if (!match.jugadores?.[i]) return null;
        return await getPlayerDisplayData(match.jugadores[i]);
    }));
    
    // Weather data (inline)
    let weatherHtml = '<div class="modal-weather-mini"><i class="fas fa-spinner fa-spin"></i></div>';
    
    // Status badge
    let statusBadge = '';
    if (isPlayed) {
        statusBadge = '<span class="modal-status-badge played"><i class="fas fa-check"></i> JUGADO</span>';
    } else if (isClosed || isFull) {
        statusBadge = '<span class="modal-status-badge closed"><i class="fas fa-lock"></i> COMPLETA</span>';
    } else {
        statusBadge = '<span class="modal-status-badge open"><i class="fas fa-door-open"></i> ABIERTA</span>';
    }
    
    container.innerHTML = `
        <div class="match-modal-v2">
            <!-- Header -->
            <div class="modal-header-v2">
                <div class="modal-type-badge ${match.tipo}">
                    <i class="fas ${match.tipo === 'reto' ? 'fa-fire' : 'fa-handshake'}"></i>
                    ${match.tipo?.toUpperCase()}
                </div>
                ${statusBadge}
            </div>
            
            <!-- Date & Weather Row -->
            <div class="modal-datetime-row">
                <div class="modal-datetime">
                    <div class="modal-day">${matchDate.toLocaleDateString('es-ES', {weekday:'long'}).toUpperCase()}</div>
                    <div class="modal-date">${matchDate.toLocaleDateString('es-ES', {day:'numeric', month:'short'}).toUpperCase()}</div>
                    <div class="modal-time">${matchDate.toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'})} - ${endTime.toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'})}</div>
                </div>
                <div id="modal-weather-box" class="modal-weather-box"></div>
            </div>
            
            <!-- Tennis Court VS Schema -->
            <div class="tennis-court-container">
                <div class="tennis-court">
                    <div class="court-net"></div>
                    <div class="court-team team-left">
                        <div class="court-player-slot" id="slot-0"></div>
                        <div class="court-player-slot" id="slot-1"></div>
                    </div>
                    <div class="court-vs">VS</div>
                    <div class="court-team team-right">
                        <div class="court-player-slot" id="slot-2"></div>
                        <div class="court-player-slot" id="slot-3"></div>
                    </div>
                </div>
            </div>
            
            ${isPlayed ? `
                <div class="modal-result-box">
                    <div class="result-label">RESULTADO</div>
                    <div class="result-score">${match.resultado?.sets || '0-0'}</div>
                </div>
            ` : ''}
            
            ${match.tipo === 'reto' ? `
                <div class="modal-challenge-info">
                    <i class="fas fa-coins"></i>
                    <span><strong>${match.familyPoints || 0}</strong> Family Points en juego</span>
                </div>
            ` : ''}
            
            <!-- Actions -->
            <div class="modal-actions-v2">
                ${renderMatchActionsV2(match, isMine, isCreator, isFull, isClosed, isPlayed, usuarioActual)}
            </div>
            
            <!-- Chat Toggle -->
            ${(isMine || isCreator) ? `
                <details class="modal-chat-section">
                    <summary><i class="fas fa-comments"></i> Chat del partido</summary>
                    <div class="chat-module-v2">
                        <div id="match-chat-messages" class="chat-messages-v2"></div>
                        <div class="chat-input-v2">
                            <input type="text" id="match-chat-input" placeholder="Escribe un mensaje...">
                            <button id="btn-send-chat"><i class="fas fa-paper-plane"></i></button>
                        </div>
                    </div>
                </details>
            ` : ''}
        </div>
    `;
    
    // Render player slots with tennis court style
    for (let i = 0; i < 4; i++) {
        const slotEl = document.getElementById(`slot-${i}`);
        if (slotEl) {
            slotEl.innerHTML = await renderCourtPlayerSlot(playerNames[i], i, isCreator, match, usuarioActual);
        }
    }
    
    // Load weather inline
    loadWeatherMini(document.getElementById('modal-weather-box'), matchDate);
    
    // Chat setup
    if (isMine || isCreator) {
        setupMatchChatShared(match.id, match.tipo, usuarioActual);
        const sendBtn = container.querySelector('#btn-send-chat');
        if (sendBtn) {
            sendBtn.onclick = () => sendChatMessageShared(match.id, match.tipo, usuarioActual.uid, userData?.nombreUsuario || 'Jugador');
        }
    }
}

async function renderCourtPlayerSlot(playerData, index, isCreator, match, usuarioActual) {
    if (!playerData) {
        // Empty slot
        const canJoin = !match.jugadores?.includes(usuarioActual.uid) && match.estado === 'abierto';
        return `
            <div class="court-player empty ${canJoin ? 'joinable' : ''}" ${canJoin ? `onclick="executeMatchAction('join', '${match.id}', '${match.tipo}')"` : ''}>
                <div class="player-avatar-slot empty">
                    <i class="fas ${canJoin ? 'fa-plus' : 'fa-user'}"></i>
                </div>
                <div class="player-name-slot">${canJoin ? 'UNIRME' : 'VACÍO'}</div>
            </div>
        `;
    }
    
    const shortName = (playerData.name || 'Jugador').split(' ')[0];
    const displayName = shortName.length > 8 ? shortName.substring(0, 7) + '.' : shortName;
    
    return `
        <div class="court-player filled">
            <div class="player-avatar-slot filled" style="background:linear-gradient(135deg, ${playerData.color || '#8b5cf6'}, ${adjustColor(playerData.color || '#8b5cf6', -30)});">
                ${playerData.photo ? `<img src="${playerData.photo}" alt="">` : playerData.initials}
            </div>
            <div class="player-name-slot">${displayName.toUpperCase()}</div>
            ${isCreator && match.jugadores[index] !== usuarioActual.uid ? `
                <button class="player-remove-btn" onclick="executeMatchAction('remove', '${match.id}', '${match.tipo}', null, null, ${index})">
                    <i class="fas fa-times"></i>
                </button>
            ` : ''}
        </div>
    `;
}

function adjustColor(color, amount) {
    // Simple color adjustment
    return color;
}

async function loadWeatherMini(container, date) {
    if (!container) return;
    try {
        const lat = 39.4938; const lon = -0.3957;
        const formattedDate = date.toISOString().split('T')[0];
        const hIdx = date.getHours();
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation_probability,weather_code&start_date=${formattedDate}&end_date=${formattedDate}`);
        const data = await response.json();
        
        if (data?.hourly) {
            const temp = Math.round(data.hourly.temperature_2m[hIdx] || 0);
            const rain = data.hourly.precipitation_probability[hIdx] || 0;
            const code = data.hourly.weather_code[hIdx] || 0;
            
            let icon = 'fa-sun'; let color = '#ffc107';
            if(code >= 1 && code <= 3) { icon = 'fa-cloud-sun'; }
            if(code >= 51) { icon = 'fa-cloud-rain'; color = '#4fc3f7'; }
            
            container.innerHTML = `
                <div class="weather-mini">
                    <i class="fas ${icon}" style="color:${color}"></i>
                    <span>${temp}°</span>
                    ${rain > 30 ? `<span class="rain-chance"><i class="fas fa-droplet"></i>${rain}%</span>` : ''}
                </div>
            `;
        }
    } catch {
        container.innerHTML = '<div class="weather-mini"><i class="fas fa-cloud"></i> --°</div>';
    }
}

function renderMatchActionsV2(match, isMine, isCreator, isFull, isClosed, isPlayed, usuarioActual) {
    if (match.invitacionesPendientes?.includes(usuarioActual.uid)) {
        return `
            <div class="action-row">
                <button onclick="executeMatchAction('reject', '${match.id}', '${match.tipo}')" class="modal-btn danger">
                    <i class="fas fa-times"></i> RECHAZAR
                </button>
                <button onclick="executeMatchAction('accept', '${match.id}', '${match.tipo}')" class="modal-btn success">
                    <i class="fas fa-check"></i> ACEPTAR
                </button>
            </div>
        `;
    }
    
    let html = '<div class="action-row">';
    
    if (!isPlayed && !isClosed) {
        if (!isMine && !isFull && match.estado === 'abierto') {
            html += `<button onclick="executeMatchAction('join', '${match.id}', '${match.tipo}')" class="modal-btn primary full">
                <i class="fas fa-user-plus"></i> UNIRME
            </button>`;
        } else if (isMine) {
            html += `<button onclick="executeMatchAction('leave', '${match.id}', '${match.tipo}')" class="modal-btn ghost">
                <i class="fas fa-sign-out-alt"></i> SALIR
            </button>`;
        }
    }
    
    if (isCreator && !isPlayed) {
        html += `<button onclick="executeMatchAction('delete', '${match.id}', '${match.tipo}')" class="modal-btn danger-outline">
            <i class="fas fa-trash"></i> CANCELAR
        </button>`;
    }
    
    if ((isMine || isCreator) && (isClosed || isFull) && !isPlayed) {
        html += `<button onclick="showResultFormShared('${match.id}', '${match.tipo}')" class="modal-btn accent">
            <i class="fas fa-trophy"></i> RESULTADO
        </button>`;
    }
    
    html += '</div>';
    return html;
}

function renderMatchActions(match, isMine, isCreator, isFull, isClosed, isPlayed, usuarioActual) {
    if (match.invitacionesPendientes?.includes(usuarioActual.uid)) {
        return `
            <div class="flex-center gap-2">
                <button onclick="executeMatchAction('reject', '${match.id}', '${match.tipo}')" class="btn-premium btn-danger flex-1">RECHAZAR</button>
                <button onclick="executeMatchAction('accept', '${match.id}', '${match.tipo}')" class="btn-premium btn-success flex-1">ACEPTAR</button>
            </div>
        `;
    }
    
    let html = '';
    
    // Join/Leave
    if (!isPlayed && !isClosed) {
        if (!isMine && !isFull && (match.estado === 'abierto')) {
            html += `<button onclick="executeMatchAction('join', '${match.id}', '${match.tipo}')" class="btn-premium btn-primary w-100 mb-2">UNIRME AHORA</button>`;
        } else if (isMine) {
            html += `<button onclick="executeMatchAction('leave', '${match.id}', '${match.tipo}')" class="btn-premium btn-ghost w-100 mb-2">SALIR</button>`;
        }
    }

    // Creator / Admin Actions
    if (isCreator && !isPlayed) {
         html += `<div class="grid-2-col gap-2 mt-2">`;
         if (isFull && !isClosed) {
             html += `<button onclick="executeMatchAction('close', '${match.id}', '${match.tipo}')" class="btn-premium btn-outline-success">CERRAR</button>`;
         }
         html += `<button onclick="executeMatchAction('delete', '${match.id}', '${match.tipo}')" class="btn-premium btn-outline-danger">CANCELAR</button>`;
         html += `</div>`;
    }
    
    // Add Result
    if ((isMine || isCreator) && (isClosed || isFull) && !isPlayed) {
        html += `<button onclick="showResultFormShared('${match.id}', '${match.tipo}')" class="btn-premium btn-accent w-100 mt-2">ANOTAR RESULTADO</button>`;
    }
    
    return html;
}

export async function renderWeatherInPlace(container, date) {
    try {
        const lat = 39.4938; const lon = -0.3957; // Benicalap, Valencia
        const formattedDate = date.toISOString().split('T')[0];
        const hIdx = date.getHours(); 
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m&start_date=${formattedDate}&end_date=${formattedDate}`);
        const data = await response.json();
        
        if (data && data.hourly) {
            const temp = Math.round(data.hourly.temperature_2m[hIdx] || 0);
            const rain = data.hourly.precipitation_probability[hIdx] || 0;
            const code = data.hourly.weather_code[hIdx] || 0;
            const wind = Math.round(data.hourly.wind_speed_10m?.[hIdx] || 0);
            
            // Map codes to icons
            let icon = 'fa-sun'; let color = '#ffeb3b'; let label = 'Soleado';
            if(code >= 1 && code <= 3) { icon = 'fa-cloud-sun'; color='#ffc107'; label = 'Parcial'; }
            if(code >= 45 && code <= 48) { icon = 'fa-smog'; color='#9e9e9e'; label = 'Niebla'; }
            if(code >= 51 && code <= 67) { icon = 'fa-cloud-rain'; color='#4fc3f7'; label = 'Lluvia'; }
            if(code >= 80) { icon = 'fa-cloud-showers-heavy'; color='#1e88e5'; label = 'Tormentas'; }

            container.innerHTML = `
                <div class="weather-widget-premium glass-strong p-4 rounded-xl animate-fade-in">
                    <div class="weather-header mb-3">
                        <span class="weather-date">${date.toLocaleDateString('es-ES', {weekday:'long', day:'numeric', month:'short'}).toUpperCase()}</span>
                        <span class="weather-time">${date.toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'})}</span>
                    </div>
                    <div class="weather-main flex-between">
                        <div class="weather-icon-box" style="color:${color}">
                            <i class="fas ${icon}"></i>
                        </div>
                        <div class="weather-details">
                            <div class="weather-temp">${temp}°C</div>
                            <div class="weather-label">${label}</div>
                        </div>
                    </div>
                    <div class="weather-stats mt-3 flex-between">
                        <div class="w-stat"><i class="fas fa-droplet"></i> ${rain}%</div>
                        <div class="w-stat"><i class="fas fa-wind"></i> ${wind} km/h</div>
                    </div>
                </div>
            `;
        }
    } catch (e) {
        container.innerHTML = '<div class="glass-strong p-3 text-center opacity-50 rounded-lg"><i class="fas fa-cloud-slash"></i> Clima no disponible</div>';
    }
}

export async function executeMatchAction(action, id, type, usuarioActual, userData, extraData = null) {
    const colName = type.toLowerCase().includes('reto') ? 'partidosReto' : 'partidosAmistosos';
    const ref = doc(db, colName, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    let jugadores = data.jugadores || [];
    if (action === 'join') {
        const userLevel = parseFloat(userData?.nivel || 2.0);
        const restriction = data.restriccionNivel || { min: 2.0, max: 5.0 };
        
        if (userLevel < restriction.min || userLevel > restriction.max) {
            showToast('NIVEL NO PERMITIDO', `Tu nivel (${userLevel.toFixed(1)}) no está en el rango (${restriction.min.toFixed(1)}-${restriction.max.toFixed(1)})`, 'warning');
            return false;
        }

        if (!jugadores.includes(usuarioActual.uid) && jugadores.length < 4) {
            jugadores.push(usuarioActual.uid);
            await updateDoc(ref, { jugadores, estado: jugadores.length === 4 ? 'cerrado' : 'abierto' });
            createNotification(data.creador, "¡Nuevo Jugador!", `${userData?.nombreUsuario || 'Alguien'} se ha unido a tu partido`, 'match_invite', 'calendario.html');
            showToast('¡PARTIDA RESERVADA!', `Te has unido al partido del ${new Date(data.fecha.seconds*1000).toLocaleDateString()}`, 'success');
        }
    } else if (action === 'leave') {
        const isCreator = data.creador === usuarioActual.uid;
        jugadores = jugadores.filter(u => u !== usuarioActual.uid);
        if (jugadores.length === 0) {
            await deleteDoc(ref);
            // Notify other players if needed (none left in this case)
        } else {
            let updateData = { jugadores, estado: 'abierto' };
            if (isCreator) {
                const nextId = jugadores.find(id => !id.startsWith('GUEST_')) || jugadores[0];
                updateData.creador = nextId;
                updateData.creadorNombre = await getPlayerDisplayName(nextId);
            }
            await updateDoc(ref, updateData);
            createNotification(jugadores, "Jugador ha salido", `${userData?.nombreUsuario || 'Alguien'} ha dejado la partida`, 'info', 'calendario.html');
            showToast('HAS SALIDO', 'Te has retirado de la partida con éxito', 'info');
        }
    } else if (action === 'delete') {
        if (confirm('¿BORRAR PARTIDA?')) {
            await deleteDoc(ref);
            createNotification(jugadores.filter(u => u !== usuarioActual.uid), "Partida cancelada", "Un partido al que asistías ha sido borrado", 'warning', 'home.html');
            showToast('PARTIDA BORRADA', 'El partido ha sido cancelado correctamente', 'error');
        }
    } else if (action === 'close') {
        await updateDoc(ref, { estado: 'cerrado' });
        createNotification(jugadores, "Partida Cerrada", "¡Listos para jugar!", 'success', 'home.html');
        showToast('PARTIDA CERRADA', 'Ya no se admiten más jugadores. ¡A jugar! 🎾', 'success');
    } else if (action === 'remove') {
        const removedUid = jugadores[extraData];
        jugadores.splice(extraData, 1);
        await updateDoc(ref, { jugadores, estado: 'abierto' });
        if (removedUid) createNotification(removedUid, "Eliminado del partido", "El administrador te ha retirado del partido", 'warning', 'calendario.html');
        showToast('JUGADOR UPDATE', 'Jugador eliminado correctamente', 'info');
    } else if (action === 'accept') {
        const inv = (data.invitacionesPendientes || []).filter(u => u !== usuarioActual.uid);
        await updateDoc(ref, { invitacionesPendientes: inv });
        createNotification(data.creador, "Invitación Aceptada", `${userData?.nombreUsuario || 'Alguien'} ha aceptado tu reto`, 'success', 'calendario.html');
        showToast('RETO ACEPTADO', 'Has aceptado el desafío. ¡Dalo todo!', 'success');
    } else if (action === 'reject') {
        const inv = (data.invitacionesPendientes || []).filter(u => u !== usuarioActual.uid);
        jugadores = jugadores.filter(u => u !== usuarioActual.uid);
        await updateDoc(ref, { jugadores, invitacionesPendientes: inv, estado: 'abierto' });
        createNotification(data.creador, "Invitación Rechazada", `${userData?.nombreUsuario || 'Alguien'} no puede asistir al reto`, 'warning', 'calendario.html');
        showToast('RETO RECHAZADO', 'Has declinado la invitación', 'info');
    } else if (action === 'addPlayer') {
        // extraData contains { uid, guestInfo (optional) }
        const { uid, guestInfo } = extraData;
        if (!jugadores.includes(uid)) {
            // Find first empty slot or just push? We use index?
            // Actually jugadores is array.
            if (jugadores.length < 4) {
               jugadores.push(uid);
               let updatePayload = { jugadores, estado: jugadores.length === 4 ? 'cerrado' : 'abierto' };
               if (guestInfo) {
                   updatePayload[`invitadosInfo.${uid}`] = guestInfo;
               }
               await updateDoc(ref, updatePayload);
               if (!uid.startsWith('GUEST_')) {
                   createNotification(uid, "Añadido al partido", `Te han añadido a un partido el ${new Date(data.fecha.seconds*1000).toLocaleDateString()}`, 'match_invite', 'calendario.html');
               }
               showToast('JUGADOR AÑADIDO', 'Has añadido un nuevo jugador a la pista', 'success');
            }
        }
    }
    return true;
}

export async function renderWeatherShared(container, date) {
    if (!container) return;
    container.innerHTML = `<div class="text-xs opacity-50 flex-center gap-2 p-3"><div class="spinner-small" style="width:12px; height:12px"></div> CARGANDO CLIMA...</div>`;
    
    try {
        const lat = 39.4938; 
        const lon = -0.3957;
        if (!date || isNaN(date.getTime())) {
             container.innerHTML = '<div class="glass-strong p-3 text-center opacity-50 rounded-lg">Fecha inválida</div>';
             return;
        }
        const formattedDate = date.toISOString().split('T')[0];
        const hIdx = date.getHours(); 
        
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,precipitation_probability&start_date=${formattedDate}&end_date=${formattedDate}`);
        const data = await response.json();
        
        if (data && data.hourly) {
            const temp = Math.round(data.hourly.temperature_2m[hIdx] || 0);
            const wind = Math.round(data.hourly.wind_speed_10m[hIdx] || 0);
            const code = data.hourly.weather_code[hIdx] || 0;
            const rainProb = data.hourly.precipitation_probability[hIdx] || 0;
            
            const weatherMap = {
                0: { icon: 'fa-sun', desc: 'Soleado', color: '#FFD700' },
                1: { icon: 'fa-cloud-sun', desc: 'Casi Despejado', color: '#FFB300' },
                2: { icon: 'fa-cloud-sun', desc: 'Nublado Parcial', color: '#90A4AE' },
                3: { icon: 'fa-cloud', desc: 'Nublado', color: '#78909C' },
                45: { icon: 'fa-smog', desc: 'Niebla', color: '#B0BEC5' },
                48: { icon: 'fa-smog', desc: 'Niebla de Escarcha', color: '#B0BEC5' },
                51: { icon: 'fa-cloud-rain', desc: 'Llovizna ligera', color: '#4FC3F7' },
                53: { icon: 'fa-cloud-rain', desc: 'Llovizna moderada', color: '#29B6F6' },
                55: { icon: 'fa-cloud-rain', desc: 'Llovizna densa', color: '#039BE5' },
                61: { icon: 'fa-cloud-showers-heavy', desc: 'Lluvia ligera', color: '#42A5F5' },
                63: { icon: 'fa-cloud-showers-heavy', desc: 'Lluvia moderada', color: '#1E88E5' },
                65: { icon: 'fa-cloud-showers-heavy', desc: 'Lluvia fuerte', color: '#1565C0' },
                71: { icon: 'fa-snowflake', desc: 'Nieve ligera', color: '#FFFFFF' },
                73: { icon: 'fa-snowflake', desc: 'Nieve moderada', color: '#FFFFFF' },
                75: { icon: 'fa-snowflake', desc: 'Nieve fuerte', color: '#FFFFFF' },
                80: { icon: 'fa-cloud-rain', desc: 'Chubascos ligeros', color: '#29B6F6' },
                81: { icon: 'fa-cloud-rain', desc: 'Chubascos moderados', color: '#039BE5' },
                82: { icon: 'fa-cloud-showers-heavy', desc: 'Lluvia Violenta', color: '#01579B' },
                95: { icon: 'fa-bolt-lightning', desc: 'Tormenta Eléctrica', color: '#FFD700' }
            };

            const info = weatherMap[code] || { icon: 'fa-cloud', desc: 'Variable', color: '#90A4AE' };

            container.innerHTML = `
                <div class="flex-between align-center">
                    <div class="flex-start gap-3">
                        <div class="weather-icon-circle animate-pulse" style="background: ${info.color}22; color: ${info.color}; text-shadow: 0 0 10px ${info.color}">
                            <i class="fas ${info.icon}" style="font-size: 1.4rem;"></i>
                        </div>
                        <div>
                            <div class="font-bold text-lg" style="color: #fff; line-height: 1.2; font-family:'Rajdhani'">${info.desc.toUpperCase()}</div>
                            <div class="text-xs opacity-50 uppercase tracking-tighter" style="font-weight:700">BENICALAP • ${temp}°C • LLUVIA: ${rainProb}%</div>
                        </div>
                    </div>
                    <div class="weather-extra text-right">
                        <div class="text-xs opacity-50 mb-1" style="font-weight:800"><i class="fas fa-wind"></i> VIENTO</div>
                        <div class="font-bold text-sm" style="color:var(--accent)">${wind} <small>km/h</small></div>
                    </div>
                </div>
            `;
        }
    } catch (e) {
        container.innerHTML = `<div class="text-xs opacity-50"><i class="fas fa-exclamation-triangle mr-1"></i> Previsión no disponible</div>`;
    }
}

export function showResultFormShared(id, type) {
    document.getElementById('modal-titulo').textContent = 'ANOTAR RESULTADO';
    document.getElementById('modal-cuerpo').innerHTML = `
        <div class="sets-input-grid">${[1,2,3].map(i => `<div class="set-box"><div class="set-title">SET ${i}</div><div class="set-inputs"><input type="number" id="s${i}-t1" class="set-input" placeholder="0"><input type="number" id="s${i}-t2" class="set-input" placeholder="0"></div></div>`).join('')}</div>
        <div class="modal-footer"><button onclick="executeSaveResultShared('${id}', '${type}')" class="btn btn-success w-100">GUARDAR RESULTADO FINAL <i class="fas fa-trophy ms-1"></i></button></div>
    `;
}

export async function executeSaveResultShared(id, type) {
    const res = [1,2,3].map(i => `${document.getElementById('s'+i+'-t1').value || 0}-${document.getElementById('s'+i+'-t2').value || 0}`).join(' ');
    const colName = type === 'reto' ? 'partidosReto' : 'partidosAmistosos';
    await updateDoc(doc(db, colName, id), { resultado: { sets: res }, estado: 'jugado' });
    await processMatchResults(id, type, res);
    showToast('RESULTADO GUARDADO', 'Los puntos de ranking han sido actualizados', 'success');
    return true;
}

async function renderSlotInDetails(uid, index, isCreator, match, usuarioActual) {
    const data = await getPlayerDisplayData(uid);
    if (!uid) {
        if (isCreator && (match.estado === 'abierto' || match.estado === 'cerrado') && match.estado !== 'jugado') {
            return `<div class="player-slot" onclick="if(window.openSelectorForMatch) window.openSelectorForMatch('${match.id}', '${match.tipo}', ${index}); else alert('Función no disponible aquí.');"><i class="fas fa-user-plus opacity-40"></i></div>`;
        }
        return `<div class="player-slot">---</div>`;
    }
    const showRemove = isCreator && match.estado !== 'jugado';
    const isInvited = match.invitacionesPendientes?.includes(uid) && !match.jugadores.includes(uid);
    // If uid is in jugadores, they are joined.
    // The previous logic for isInvited was match.invitacionesPendientes?.includes(uid). If they are in jugadores they are not pending.
    
    let slotClass = "player-slot filled";
    if (isInvited) slotClass += " invited";

    // Guest Level Logic
    let guestLevel = '';
    if (uid.startsWith('GUEST_') && match.invitadosInfo && match.invitadosInfo[uid]) {
        guestLevel = `<span class="badge text-xs ml-1" style="background:#444; color:#fff">${match.invitadosInfo[uid].nivel}</span>`;
    } else if (data.name !== '---' && !uid.startsWith('GUEST_')) {
         // Maybe show real user level? Not requested but nice.
    }

    const avatar = data.photo 
        ? `<img src="${data.photo}" style="width:28px; height:28px; border-radius:50%; object-fit:cover; margin-right:8px; border:2px solid ${data.color}">` 
        : `<span class="slot-initials" style="color:${data.color}; font-size:0.7rem; font-weight:900; margin-right:5px">${data.initials}</span>`;

    return `<div class="${slotClass}" style="border-left: 3px solid ${data.color}; justify-content: space-between; padding-right:8px;">
        <div style="display:flex; align-items:center; overflow:hidden;">
            ${isInvited ? '<i class="fas fa-clock-rotate-left mr-1 opacity-50" title="Pendiente"></i>' : ''}
            ${avatar}
            <span class="slot-name-trim" style="flex:1">${data.name} ${guestLevel}</span>
        </div>
        ${showRemove ? `<button class="player-remove-btn" style="background:rgba(255,0,0,0.2); width:20px; height:20px; border-radius:50%; display:flex; align-items:center; justify-content:center; border:none; color:#ff4d4d; font-size:12px;" onclick="executeMatchAction('remove', '${match.id}', '${match.tipo}', ${index})">&times;</button>` : ''}
    </div>`;
}

export function setupMatchChatShared(matchId, matchType, usuarioActual) {
    if (chatUnsubscribe) chatUnsubscribe();
    const container = document.getElementById('match-chat-messages');
    if (!container) return;

    const colName = matchType.includes('reto') ? 'partidosReto' : 'partidosAmistosos';
    const q = query(collection(db, `${colName}/${matchId}/mensajes`), orderBy('timestamp', 'asc'), limit(50));

    chatUnsubscribe = onSnapshot(q, (snapshot) => {
        container.innerHTML = snapshot.empty ? '<div class="no-messages">No hay mensajes aún. ¡Saluda! 👋</div>' : '';
        snapshot.forEach(doc => {
            const msg = doc.data();
            const isMe = msg.uid === usuarioActual.uid;
            const messageEl = document.createElement('div');
            messageEl.className = `match-msg ${isMe ? 'msg-me' : 'msg-other'}`;
            messageEl.innerHTML = `<div class="msg-sender">${msg.nombre}</div><div class="msg-text">${msg.texto}</div>`;
            container.appendChild(messageEl);
        });
        container.scrollTop = container.scrollHeight;
    });
}

export async function sendChatMessageShared(matchId, matchType, uid, name) {
    const input = document.getElementById('match-chat-input');
    const text = input.value.trim();
    if (!text) return;
    const colName = matchType.includes('reto') ? 'partidosReto' : 'partidosAmistosos';
    input.value = '';
    try {
        await addDoc(collection(db, `${colName}/${matchId}/mensajes`), { uid, nombre: name, texto: text, timestamp: serverTimestamp() });
        const matchDoc = await getDoc(doc(db, colName, matchId));
        if (matchDoc.exists()) {
            const recipients = (matchDoc.data().jugadores || []).filter(id => id !== uid && !id.startsWith('GUEST_'));
            if (recipients.length > 0) createNotification(recipients, "Nuevo mensaje", `${name}: ${text.substring(0, 30)}`, 'info', 'calendario.html');
        }
    } catch (e) { console.error("Chat Error:", e); }
}

export function closeChatSubscription() {
    if (chatUnsubscribe) chatUnsubscribe();
    chatUnsubscribe = null;
}
