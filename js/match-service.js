import { db } from './firebase-config.js';
import { 
    doc, getDoc, updateDoc, deleteDoc, collection, addDoc, serverTimestamp, 
    query, where, orderBy, limit, onSnapshot , Timestamp
} from 'https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js';
import { processMatchResults } from './ranking-service.js';
import { createNotification } from './notifications-service.js';

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
    // Basic Data
    const isMine = match.jugadores?.includes(usuarioActual.uid);
    const isFull = match.jugadores?.length === 4;
    const isCreator = match.creador === usuarioActual.uid || userData?.esAdmin;
    const isClosed = (match.estado || '').toLowerCase() === 'cerrado';
    const isPlayed = (match.estado || '').toLowerCase() === 'jugado';
    const matchDate = match.fecha.toDate ? match.fecha.toDate() : new Date(match.fecha);
    const endTime = new Date(matchDate.getTime() + 90*60000); // +1h 30m

    // --- Container Reset for consistency ---
    // This ensures we don't have double padding or displacement
    container.style.padding = '0';
    container.parentElement.style.padding = '0'; 

    let content = `
        <div class="match-setup-premium animate-fade-in" style="padding: 16px;">
            
            <!-- 1. Hero Card (Unified Style with Creation) -->
             <div id="weather-placeholder-${match.id}"></div>
             
             <div class="in-modal-card mt-2">
                 <div class="mmc-top" style="border-bottom:1px dashed rgba(255,255,255,0.1); padding-bottom:10px;">
                    <div class="mmc-date-weather">
                        <span style="font-size:0.9rem; color:#fff; font-weight:700;">${matchDate.toLocaleDateString('es-ES', {day:'numeric', month:'short'}).toUpperCase()}</span>
                        <span class="mmc-dw-sep">|</span>
                        <span class="text-time" style="font-size:1rem">${matchDate.toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'})}</span>
                    </div>
                </div>
                 <div class="flex-between align-center mt-2">
                    <span class="match-type-badge ${match.tipo}">
                        <i class="fas ${match.tipo === 'reto' ? 'fa-fire' : 'fa-handshake'}"></i> ${match.tipo?.toUpperCase()}
                    </span>
                     ${match.restriccionPuntos ? 
                        `<span class="badge" style="background:rgba(255,255,255,0.1); font-size:0.6rem">NIVEL ${match.restriccionPuntos.min}-${match.restriccionPuntos.max}</span>` 
                        : '<span class="badge">OPEN</span>'}
                 </div>
            </div>

            <!-- 2. Proposal (Reto only) -->
            ${match.tipo === 'reto' ? `
                <div class="challenge-proposal glass-gradient-warning p-3 mb-3 rounded-lg text-center" style="border:1px dashed #ffd54f; margin-top:8px;">
                    <div class="label-xs text-warning mb-1"><i class="fas fa-trophy"></i> FAMILY POINTS: <span style="font-size:1.1em; font-weight:800">${match.familyPoints || 0}</span></div>
                    <div class="proposal-text" style="font-style:italic; font-size:0.8rem">"${match.propuesta || 'Sin condiciones especiales'}"</div>
                </div>
            ` : ''}

            <!-- 3. Players Arena -->
            <div class="vs-schema-container mt-2 mb-3">
                 <div class="vs-schema-title text-center text-xs opacity-50 mb-2 font-bold tracking-widest">ALINEACIÓN</div>
                 <div class="vs-box">
                    <div class="team-box">
                        ${(await Promise.all([0, 1].map(index => renderSlotInDetails(match.jugadores[index], index, isCreator, match, usuarioActual)))).join('')}
                    </div>
                    <div class="vs-circle">VS</div>
                    <div class="team-box">
                        ${(await Promise.all([2, 3].map(index => renderSlotInDetails(match.jugadores[index], index, isCreator, match, usuarioActual)))).join('')}
                    </div>
                 </div>
            </div>

            <!-- 4. Result (if played) -->
            ${isPlayed ? `
                <div class="result-box-final bg-gradient-to-r from-green-900 to-green-800 p-3 text-center mb-3 rounded-lg border border-green-500">
                    <span class="label-xs text-success-light block mb-1">RESULTADO FINAL</span>
                    <div class="final-score text-2xl font-bold font-rajdhani text-white tracking-widest">${match.resultado?.sets || '0-0'}</div>
                </div>
            ` : ''}

            <!-- 5. Actions Area -->
            <div class="actions-area mb-4">
                ${renderMatchActions(match, isMine, isCreator, isFull, isClosed, isPlayed, usuarioActual)}
            </div>

            <!-- 6. Integrated Chat (Public for motivation) -->
            <div class="chat-module glass-strong rounded-lg overflow-hidden border-glass mt-2">
                <div class="chat-header p-2 border-b border-white/10 flex-between bg-white/5">
                    <span class="label-xs font-bold ml-2"><i class="fas fa-comments text-accent"></i> CHAT DE PARTIDO</span>
                    <span class="online-dot bg-green-500 w-2 h-2 rounded-full mr-2"></span>
                </div>
                <div id="match-chat-messages" class="chat-messages-area p-3 bg-black/20" style="height:180px; overflow-y:auto;">
                    <div class="loading-chat flex-center h-full"><div class="spinner-small"></div></div>
                </div>
                <div class="chat-input-area p-2 bg-white/5">
                    <div class="input-group-premium flex gap-2">
                        <input type="text" id="match-chat-input" class="form-input-pro flex-1" placeholder="${isMine || isCreator ? 'Escribe algo...' : 'Únete para chatear'}" autocomplete="off" ${!(isMine || isCreator) ? 'disabled' : ''}>
                        <button onclick="sendChatMessageShared('${match.id}', '${match.tipo}', '${usuarioActual.uid}', '${userData?.nombreUsuario || 'Jugador'}')" class="btn-icon bg-primary text-white rounded-lg w-10 h-10 flex-center" ${!(isMine || isCreator) ? 'disabled' : ''}>
                            <i class="fas fa-paper-plane"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    container.innerHTML = content;
    
    // Init Weather properly
    setTimeout(() => {
        const wPlaceholder = document.getElementById(`weather-placeholder-${match.id}`);
        if(wPlaceholder) renderWeatherShared(wPlaceholder, matchDate);
    }, 100);

    // Init Chat (Always for public view)
    setTimeout(() => setupMatchChatShared(match.id, match.tipo, usuarioActual), 200);
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
    
    if (!isPlayed && !isClosed) {
        if (!isMine && !isFull && (match.estado === 'abierto')) {
            html += `<button onclick="executeMatchAction('join', '${match.id}', '${match.tipo}')" class="btn-premium btn-primary w-100 mb-2">UNIRME AHORA <i class="fas fa-plus-circle ms-1"></i></button>`;
        } else if (isMine) {
            if (isCreator) {
                html += `
                <div class="flex flex-col gap-2">
                    <button onclick="executeMatchAction('leave', '${match.id}', '${match.tipo}')" class="btn-premium btn-ghost" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);">
                        SALIR Y CEDER RESERVA <i class="fas fa-sign-out-alt ms-1"></i>
                    </button>
                    <button onclick="executeMatchAction('delete', '${match.id}', '${match.tipo}')" class="btn-premium btn-danger" style="box-shadow: 0 0 15px rgba(255,0,0,0.3);">
                        ANULAR RESERVA DEFINITIVAMENTE <i class="fas fa-trash-alt ms-1"></i>
                    </button>
                </div>`;
            } else {
                html += `<button onclick="executeMatchAction('leave', '${match.id}', '${match.tipo}')" class="btn-premium btn-ghost w-100 mb-2">SALIR DE LA PARTIDA <i class="fas fa-walking ms-1"></i></button>`;
            }
        }
    }

    // Admin/Creator Tools
    if (isCreator && !isPlayed && isFull && !isClosed) {
        html += `<button onclick="executeMatchAction('close', '${match.id}', '${match.tipo}')" class="btn-premium btn-accent w-100 mt-2">CERRAR LISTA Y CONFIRMAR <i class="fas fa-lock ms-1"></i></button>`;
    }
    
    if ((isMine || isCreator) && (isClosed || isFull) && !isPlayed) {
        html += `<button onclick="showResultFormShared('${match.id}', '${match.tipo}')" class="btn-premium btn-success w-100 mt-2">ANOTAR RESULTADO <i class="fas fa-trophy ms-1"></i></button>`;
    }
    
    return html;
}

export async function renderWeatherInPlace(container, date) {
    try {
        const lat = 39.4938; const lon = -0.3957;
        const formattedDate = date.toISOString().split('T')[0];
        const hIdx = date.getHours(); 
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation_probability,weather_code&start_date=${formattedDate}&end_date=${formattedDate}`);
        const data = await response.json();
        
        if (data && data.hourly) {
            const temp = Math.round(data.hourly.temperature_2m[hIdx] || 0);
            const rain = data.hourly.precipitation_probability[hIdx] || 0;
            const code = data.hourly.weather_code[hIdx] || 0;
            
            // Map codes to icons (Simplified)
            let icon = 'fa-sun'; let color = '#ffeb3b';
            if(code > 3) { icon = 'fa-cloud-sun'; color='#ccc'; }
            if(code > 50) { icon = 'fa-cloud-rain'; color='#4fc3f7'; }

            container.innerHTML = `
                <div class="w-icon" style="color:${color}"><i class="fas ${icon}"></i></div>
                <div class="w-temp">${temp}°</div>
                <div class="w-rain"><i class="fas fa-droplet"></i> ${rain}%</div>
            `;
        }
    } catch (e) {
        container.innerHTML = '<span class="text-xs opacity-50">Clima no disp.</span>';
    }
}

export async function executeMatchAction(action, id, type, usuarioActual, userData, extraData = null) {
    const colName = type.toLowerCase().includes('reto') ? 'partidosReto' : 'partidosAmistosos';
    const ref = doc(db, colName, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    
    // Normalize to 4-slot array for fixed positions
    let jugadores = data.jugadores || [];
    if (jugadores.length < 4) {
        while(jugadores.length < 4) jugadores.push(null);
    }

    if (action === 'join') {
        const matchDate = data.fecha?.toDate ? data.fecha.toDate() : new Date(data.fecha);
        if (matchDate < new Date()) {
            import('./ui-core.js').then(m => m.showToast("NO PUEDES UNIRTE A UN PARTIDO PASADO", "warning"));
            return false;
        }
        const userPoints = Math.round(userData?.puntosRankingTotal || userData?.puntosRanking || 0);
        const restriction = data.restriccionPuntos || { min: 0, max: 5000 };
        
        if (userPoints < restriction.min || userPoints > restriction.max) {
            import('./ui-core.js').then(m => {
                m.showToast(`NIVEL NO PERMITIDO: ${userPoints} (RANGO: ${restriction.min}-${restriction.max})`, 'warning');
            });
            return false;
        }

        if (!jugadores.includes(usuarioActual.uid)) {
            // Find first free slot
            const freeIdx = jugadores.indexOf(null);
            if (freeIdx !== -1) {
                jugadores[freeIdx] = usuarioActual.uid;
                const activeCount = jugadores.filter(p => !!p).length;
                const isFull = activeCount === 4;
                await updateDoc(ref, { jugadores, estado: isFull ? 'cerrado' : 'abierto' });
                
                createNotification(data.creador, "¡Nuevo Jugador!", `${userData?.nombreUsuario || 'Alguien'} se ha unido a tu partido`, 'info', 'calendario.html');
                if (isFull) {
                    createNotification(jugadores.filter(p => !!p && !p.startsWith('GUEST_')), "✓ PARTIDA COMPLETADA", "El partido está lleno y listo para jugar.", 'success', 'calendario.html');
                }
            }
        }
    } else if (action === 'leave' || action === 'remove') {
        const uidToRemove = action === 'leave' ? usuarioActual.uid : jugadores[extraData];
        const isCreator = data.creador === uidToRemove;
        
        // Clear the specific slot
        const playerIdx = jugadores.indexOf(uidToRemove);
        if (playerIdx !== -1) jugadores[playerIdx] = null;

        const remaining = jugadores.filter(p => !!p);
        
        if (remaining.length === 0) {
            await deleteDoc(ref);
        } else {
            let updateData = { jugadores, estado: 'abierto' };
            if (isCreator) {
                const nextId = remaining.find(id => !id.startsWith('GUEST_')) || remaining[0];
                updateData.creador = nextId;
                updateData.creadorNombre = await getPlayerDisplayName(nextId);
                createNotification(remaining.filter(p => !p.startsWith('GUEST_')), "NUEVO ADMINISTRADOR", "El creador ha salido y ahora tú o un compañero gestionáis la reserva.", 'info', 'calendario.html');
            }
            await updateDoc(ref, updateData);
            
            if (action === 'leave') {
                 createNotification(remaining.filter(p => !p.startsWith('GUEST_')), "¡HUECO LIBRE!", `${userData?.nombreUsuario || 'Un jugador'} ha salido. Una plaza está disponible.`, 'warning', 'calendario.html');
            } else {
                 createNotification(uidToRemove, "Retirado del partido", "El administrador te ha retirado de esta partida.", 'warning', 'calendario.html');
            }
        }
    } else if (action === 'move') {
        const destSlot = extraData;
        const myCurrentSlot = jugadores.indexOf(usuarioActual.uid);
        if (myCurrentSlot !== -1 && !jugadores[destSlot]) {
            jugadores[myCurrentSlot] = null;
            jugadores[destSlot] = usuarioActual.uid;
            await updateDoc(ref, { jugadores });
        }
    } else if (action === 'delete') {
        if (confirm('¿ANULAR RESERVA DEFINITIVAMENTE? Se notificará a todos y el hueco quedará libre.')) {
            const participants = jugadores.filter(p => !!p && p !== usuarioActual.uid && !p.startsWith('GUEST_'));
            const matchDateStr = data.fecha?.toDate ? data.fecha.toDate().toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'}) : '';
            
            await deleteDoc(ref);
            
            if (participants.length > 0) {
                createNotification(participants, "Partida Cancelada", `La reserva de las ${matchDateStr} ha sido anulada.`, 'danger', 'home.html');
            }
            
            // Broadcast to EVERYONE
            const usersSnap = await getDocs(query(collection(db, "usuarios"), limit(40)));
            let allUids = [];
            usersSnap.forEach(u => { if(u.id !== usuarioActual.uid) allUids.push(u.id); });
            if (allUids.length > 0) {
                createNotification(allUids, "¡HORARIO LIBRE!", `¡Atención! Se ha liberado la pista de las ${matchDateStr}. ¡Resérvala ya!`, 'info', 'calendario.html');
            }
        }
    } else if (action === 'close') {
        await updateDoc(ref, { estado: 'cerrado' });
        createNotification(jugadores.filter(p => !!p && !p.startsWith('GUEST_')), "Partida Cerrada", "¡Listos para jugar!", 'success', 'home.html');
    } else if (action === 'accept') {
        const inv = (data.invitacionesPendientes || []).filter(u => u !== usuarioActual.uid);
        await updateDoc(ref, { invitacionesPendientes: inv });
        createNotification(data.creador, "Invitación Aceptada", `${userData?.nombreUsuario || 'Alguien'} ha aceptado tu reto`, 'success', 'calendario.html');
    } else if (action === 'reject') {
        const inv = (data.invitacionesPendientes || []).filter(u => u !== usuarioActual.uid);
        const playerIdx = jugadores.indexOf(usuarioActual.uid);
        if (playerIdx !== -1) jugadores[playerIdx] = null;
        await updateDoc(ref, { jugadores, invitacionesPendientes: inv, estado: 'abierto' });
        createNotification(data.creador, "Invitación Rechazada", `${userData?.nombreUsuario || 'Alguien'} no puede asistir al reto`, 'warning', 'calendario.html');
    }
    return true;
}

export async function renderWeatherShared(container, date) {
    const weatherContainer = document.createElement('div');
    weatherContainer.className = 'weather-forecast-premium glass-strong p-3 mb-4 animate-fade-in';
    weatherContainer.style.borderRadius = 'var(--radius-lg)';
    weatherContainer.style.border = '1px solid rgba(var(--primary-rgb), 0.2)';
    weatherContainer.innerHTML = `<div class="text-xs opacity-50 flex-center gap-2"><div class="spinner-small" style="width:12px; height:12px"></div> CLIMA EN BENICALAP (VALENCIA)...</div>`;
    container.prepend(weatherContainer);

    try {
        const lat = 39.4938; 
        const lon = -0.3957;
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

            weatherContainer.innerHTML = `
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
        weatherContainer.innerHTML = `<div class="text-xs opacity-50"><i class="fas fa-exclamation-triangle mr-1"></i> Previsión no disponible</div>`;
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
    const ref = doc(db, colName, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return false;
    
    await updateDoc(ref, { resultado: { sets: res }, estado: 'jugado' });
    
    // Notify Participants
    const jugadores = snap.data().jugadores || [];
    createNotification(jugadores, "Resultado Publicado", `Se ha anotado el resultado del partido (${res})`, 'success', 'partidos.html');
    
    await processMatchResults(id, type, res);
    return true;
}

async function renderSlotInDetails(uid, index, isCreator, match, usuarioActual) {
    const data = await getPlayerDisplayData(uid);
    const isMine = match.jugadores?.includes(usuarioActual.uid);

    if (!uid) {
        // If empty and I am in the match, allow moving here
        if (isMine && match.estado !== 'jugado' && match.estado !== 'cerrado') {
            return `<div class="player-slot animate-pulse" style="border: 1px dashed var(--primary); color: var(--primary); cursor:pointer;" onclick="executeMatchAction('move', '${match.id}', '${match.tipo}', ${index})">
                <span class="text-2xs font-bold"><i class="fas fa-arrows-alt me-1"></i>CAMBIAR AQUÍ</span>
            </div>`;
        }
        // If empty and creator and not played, allow inviting (opens selector handled in calendario.js usually)
        if (isCreator && match.estado !== 'jugado') {
            return `<div class="player-slot" style="opacity: 0.5"><i class="fas fa-user-plus"></i></div>`;
        }
        return `<div class="player-slot">---</div>`;
    }
    
    const canRemove = (isCreator || uid === usuarioActual.uid) && match.estado !== 'jugado';
    const isInvited = match.invitacionesPendientes?.includes(uid);
    
    let slotClass = "player-slot filled";
    if (isInvited) slotClass += " invited";

    const avatar = data.photo 
        ? `<img src="${data.photo}" style="width:28px; height:28px; border-radius:50%; object-fit:cover; margin-right:8px; border:2px solid ${data.color}">` 
        : `<span class="slot-initials" style="color:${data.color}; font-size:0.7rem; font-weight:900; margin-right:5px">${data.initials}</span>`;

    const action = uid === usuarioActual.uid ? 'leave' : 'remove';

    return `<div class="${slotClass}" style="border-left: 3px solid ${data.color}; justify-content: space-between; padding-right:8px;">
        <div style="display:flex; align-items:center; overflow:hidden;">
            ${isInvited ? '<i class="fas fa-clock-rotate-left mr-1 opacity-50" title="Pendiente"></i>' : ''}
            ${avatar}
            <span class="slot-name-trim" style="flex:1">${data.name}</span>
        </div>
        ${canRemove ? `<button class="player-remove-btn" title="${action === 'leave' ? 'Salirse' : 'Expulsar'}" style="background:rgba(255,0,0,0.2); width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; border:none; color:#ff4d4d; font-size:12px; cursor:pointer;" onclick="executeMatchAction('${action}', '${match.id}', '${match.tipo}', ${index})">&times;</button>` : ''}
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
