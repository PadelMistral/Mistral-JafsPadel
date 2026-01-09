// Importar las dependencias necesarias
import {
  initializeAuthObserver,
  getCurrentUser,
  setAuthPersistence,
  signOutUser,
  getDocument,
  getCollection,
  addDocument,
  updateDocument,
  deleteDocument,
  getTimestamp,
  subscribeToCollection,
  uploadFile,
  getFileDownloadURL
} from './firebase-service.js';
import { authGuard } from './ui-core.js';

authGuard();

// Variables globales
let usuarioActual = null;
let equipoUsuario = null;

// Función para obtener parámetros de la URL
function obtenerParametrosURL() {
    const params = new URLSearchParams(window.location.search);
    return {
        uid: params.get('uid'),
        nombre: params.get('nombre')
    };
}

// Función para actualizar elementos del DOM
function actualizarElemento(id, valor) {
    const elemento = document.getElementById(id);
    if (elemento) {
        elemento.textContent = valor;
    }
}

// Función para actualizar el título del header
function actualizarTituloHeader(nombre) {
    const headerTitle = document.querySelector('.app-title');
    if (headerTitle) {
        headerTitle.textContent = `Perfil de ${nombre}`;
        console.log(`=> Título del header actualizado: Perfil de ${nombre}`);
    }
}

// Función para inicializar el perfil del usuario seleccionado
async function inicializarPerfil() {
    console.log('🚀 Inicializando perfil de usuario seleccionado...');
    
    return new Promise(async (resolve, reject) => {
        try {
            // Obtener parámetros de la URL
            const { uid, nombre } = obtenerParametrosURL();
            
            if (!uid) {
                console.error('⚠️ No se proporcionó UID del usuario');
                reject(new Error("UID de usuario no proporcionado"));
                return;
            }
            
            console.log(`=> Cargando perfil del usuario: ${nombre} (${uid})`);
            
            // Cargar datos del usuario seleccionado
            await cargarPerfilUsuarioSeleccionado(uid, nombre);
            resolve();
            
        } catch (error) {
            console.error("⚠️ Error al cargar el perfil del usuario:", error);
            await cargarEstadisticasBasicas();
            reject(error);
        }
    });
}

// Nueva función para cargar perfil del usuario seleccionado
async function cargarPerfilUsuarioSeleccionado(uid, nombre) {
    console.log('=> Cargando datos del usuario seleccionado...');
    console.log('=> UID del usuario seleccionado:', uid);
    console.log('=> Nombre del usuario seleccionado:', nombre);
    
    // Actualizar título del header
    actualizarTituloHeader(nombre);
    
    // Obtener datos del usuario desde Firestore usando el UID proporcionado
    const userDoc = await getDocument("usuarios", uid);
    if (!userDoc.exists()) {
        console.error('⚠️ Usuario no encontrado en Firestore');
        throw new Error("Usuario no encontrado");
    }
    
    // Establecer usuarioActual con el UID del usuario seleccionado
    usuarioActual = { uid: uid, ...userDoc.data() };
    console.log('=> Datos del usuario cargados:', usuarioActual);
    
    await actualizarInformacionBasica();
    await obtenerEquipoUsuario();
    
    if (equipoUsuario) {
        console.log('=> Equipo encontrado:', equipoUsuario.nombre);
        await cargarEstadisticasPerfil();
        await cargarHistorialPartidosPerfil();
        await cargarEstadisticasPala();
        await cargarCompañeroYRivales();
        await cargarRivales();
        await cargarInformacionClasificacion();
    } else {
        console.warn('⚠️ No se encontró equipo para el usuario');
        await cargarEstadisticasBasicas();
    }
    
    // Funcionalidades extra
    cargarFamilyPoints();
    cargarLogros();
    await cargarInformacionLiga();
    await actualizarLigaExtendida();
    await cargarTorneosActuales();
    await cargarEstadisticasAmistosos();
    await cargarRetos();
    actualizarRetosJugados();
    
    console.log('=> Perfil del usuario seleccionado cargado completamente');
}

// Función para actualizar el header
function actualizarHeaderPerfilUsuario(nombre) {
    const pageTitle = document.getElementById('page-title');
    if (pageTitle) {
        pageTitle.textContent = `Perfil de ${nombre}`;
    }
    
    document.title = `Perfil de ${nombre} - Padeluminatis`;
}

// Función para actualizar información básica
async function actualizarInformacionBasica() {
    if (!usuarioActual) return;
    actualizarElemento('user-name', usuarioActual.nombreUsuario || usuarioActual.nombre || usuarioActual.email.split('@')[0]);
    const userLevelElement = document.getElementById('user-level');
    if (userLevelElement) {
        const nivel = usuarioActual.nivel || '1.5';
        userLevelElement.textContent = nivel;
        const nivelNum = parseFloat(nivel);
        let nivelClass = 'level-1';
        if (nivelNum >= 1 && nivelNum < 1.5) nivelClass = 'level-1';
        else if (nivelNum >= 1.5 && nivelNum < 2) nivelClass = 'level-1-5';
        else if (nivelNum >= 2 && nivelNum < 2.5) nivelClass = 'level-2';
        else if (nivelNum >= 2.5 && nivelNum < 3) nivelClass = 'level-2-5';
        else if (nivelNum >= 3 && nivelNum < 3.5) nivelClass = 'level-3';
        else if (nivelNum >= 3.5 && nivelNum < 4) nivelClass = 'level-3-5';
        else if (nivelNum >= 4 && nivelNum < 4.5) nivelClass = 'level-4';
        else if (nivelNum >= 4.5 && nivelNum < 5) nivelClass = 'level-4-5';
        else if (nivelNum >= 5) nivelClass = 'level-5';
        userLevelElement.className = `level-badge ${nivelClass}`;
    }
    const profilePic = document.getElementById('profile-pic');
    if (profilePic && usuarioActual.fotoPerfil) {
        profilePic.src = usuarioActual.fotoPerfil;
    }
    const paddlePic = document.getElementById('paddle-pic');
    if (paddlePic && usuarioActual.pala?.imagen) {
        paddlePic.src = usuarioActual.pala.imagen;
    }
    const paddleNameElement = document.getElementById('paddle-name');
    if (paddleNameElement) {
        paddleNameElement.textContent = usuarioActual.pala?.nombre || 'Mi Pala';
    }
}

// Función para obtener equipo del usuario seleccionado
async function obtenerEquipoUsuario() {
    console.log('=> Buscando equipo del usuario...');
    console.log('=> UID del usuario actual:', usuarioActual.uid);
    
    const equiposSnap = await getDocs(collection(db, "equipos"));
    for (const docu of equiposSnap.docs) {
        const data = docu.data();
        if (data.jugadores && data.jugadores.includes(usuarioActual.uid)) {
            equipoUsuario = { id: docu.id, ...data };
            console.log('=> Equipo encontrado:', equipoUsuario.nombre);
            return;
        }
    }
    console.warn('⚠️ No se encontró equipo para el usuario');
    equipoUsuario = null;
}

// Función para cargar estadísticas básicas
async function cargarEstadisticasBasicas() {
    console.log('=> Cargando estadísticas básicas...');
    
    try {
        actualizarElemento('total-matches', '0');
        actualizarElemento('total-wins', '0');
        actualizarElemento('total-losses', '0');
        actualizarElemento('win-rate', '0%');
        actualizarElemento('current-streak', '0');
        actualizarElemento('best-streak', '0');
        actualizarElemento('total-sets-won', '0');
        actualizarElemento('total-sets-lost', '0');
        actualizarElemento('total-points-won', '0');
        actualizarElemento('total-points-lost', '0');
        
        console.log('✅ Estadísticas básicas cargadas');
    } catch (error) {
        console.error('❌ Error al cargar estadísticas básicas:', error);
    }
}

// Función para cargar estadísticas del perfil
async function cargarEstadisticasPerfil() {
    console.log('=> Cargando estadísticas del perfil...');
    
    try {
        if (!equipoUsuario) return;
        
        let partidosJugados = 0;
        let victorias = 0;
        let derrotas = 0;
        let mejorRacha = 0;
        let rachaActual = 0;
        let setsGanados = 0;
        let setsPerdidos = 0;
        let puntosGanados = 0;
        let puntosPerdidos = 0;
        let victoriasLiga = 0, victoriasAmistoso = 0, victoriasEvento = 0;
        let derrotasLiga = 0, derrotasAmistoso = 0, derrotasEvento = 0;
        let partidosConsecutivos = 0;
        let partidos = [];
        
        // Obtener todos los partidos del equipo
        const calendarioSnap = await getDocs(collection(db, "calendario"));
        for (const jornadaDoc of calendarioSnap.docs) {
            const partidosSnap = await getDocs(collection(db, `calendario/${jornadaDoc.id}/partidos`));
            
            for (const partidoDoc of partidosSnap.docs) {
                const partido = partidoDoc.data();
                if (!partido.resultado) continue;
                
                const esLocal = partido.equipoLocal === equipoUsuario.id;
                const esVisitante = partido.equipoVisitante === equipoUsuario.id;
                if (!esLocal && !esVisitante) continue;
                
                partidosJugados++;
                
                let setsMiEquipo = 0;
                let setsRival = 0;
                let puntosMiEquipo = 0;
                let puntosRival = 0;
                
                Object.values(partido.resultado).forEach(set => {
                    const puntos1 = set.puntos1 || 0;
                    const puntos2 = set.puntos2 || 0;
                    if (puntos1 === 0 && puntos2 === 0) return; // REGLA: sets 0-0 no cuentan
                    
                    if (esLocal) {
                        if (puntos1 > puntos2) setsMiEquipo++;
                        else setsRival++;
                        puntosMiEquipo += puntos1;
                        puntosRival += puntos2;
                    } else {
                        if (puntos2 > puntos1) setsMiEquipo++;
                        else setsRival++;
                        puntosMiEquipo += puntos2;
                        puntosRival += puntos1;
                    }
                });
                
                const victoria = setsMiEquipo > setsRival;
                if (victoria) {
                    victorias++;
                    rachaActual++;
                    if (rachaActual > mejorRacha) mejorRacha = rachaActual;
                } else {
                    derrotas++;
                    rachaActual = 0;
                }
                
                setsGanados += setsMiEquipo;
                setsPerdidos += setsRival;
                puntosGanados += puntosMiEquipo;
                puntosPerdidos += puntosRival;
                
                // Clasificar por tipo de partido
                const tipo = partido.tipo || 'liga';
                if (victoria) {
                    if (tipo === 'liga') victoriasLiga++;
                    else if (tipo === 'amistoso') victoriasAmistoso++;
                    else if (tipo === 'evento') victoriasEvento++;
                } else {
                    if (tipo === 'liga') derrotasLiga++;
                    else if (tipo === 'amistoso') derrotasAmistoso++;
                    else if (tipo === 'evento') derrotasEvento++;
                }
                
                partidos.push({
                    ...partido,
                    victoria,
                    setsMiEquipo,
                    setsRival,
                    puntosMiEquipo,
                    puntosRival,
                    esLocal,
                    tipo
                });
            }
        }
        
        // Actualizar estadísticas básicas
        actualizarElemento('total-matches', partidosJugados);
        actualizarElemento('total-wins', victorias);
        actualizarElemento('total-losses', derrotas);
        
        const winRate = partidosJugados > 0 ? 
            ((victorias / partidosJugados) * 100).toFixed(1) : 0;
        actualizarElemento('win-rate', `${winRate}%`);
        
        // Actualizar estadísticas detalladas
        actualizarElemento('total-sets-won', setsGanados);
        actualizarElemento('total-sets-lost', setsPerdidos);
        actualizarElemento('total-points-won', puntosGanados);
        actualizarElemento('total-points-lost', puntosPerdidos);
        
        // Actualizar victorias por tipo
        actualizarElemento('league-wins', victoriasLiga);
        actualizarElemento('friendly-wins-tipos', victoriasAmistoso);
        actualizarElemento('event-wins', victoriasEvento);
        actualizarElemento('challenge-wins', 0); // Por defecto 0, se puede actualizar después
        
        // Calcular partidos restantes
        const clasificacionSnap = await getDocs(collection(db, "clasificacion"));
        const totalEquipos = clasificacionSnap.size;
        const partidosTotales = totalEquipos > 1 ? (totalEquipos - 1) * 2 : 0;
        const partidosRestantes = Math.max(0, partidosTotales - partidosJugados);
        actualizarElemento('league-finished-left-text', `${partidosRestantes} partidos restantes`);
        const porcentajeCompletado = partidosTotales > 0 ? Math.round((partidosJugados / partidosTotales) * 100) : 0;
        const leagueFinishedBar = document.getElementById('league-finished-bar');
        if (leagueFinishedBar) {
            leagueFinishedBar.style.width = `${porcentajeCompletado}%`;
        }
        actualizarElemento('league-finished-percent', `${porcentajeCompletado}%`);
        
        // Calcular rachas
        await calcularRachas();
        
        console.log('✅ Estadísticas del perfil cargadas');
        console.log(`📊 Resumen: ${partidosJugados} partidos, ${victorias} victorias, ${derrotas} derrotas, ${winRate}% win rate`);
        console.log(`🎯 Sets: ${setsGanados}-${setsPerdidos}, Puntos: ${puntosGanados}-${puntosPerdidos}`);
        
        // Guardar partidos para uso en otras funciones
        window._partidosPerfil = partidos;
        
    } catch (error) {
        console.error('❌ Error al cargar estadísticas del perfil:', error);
    }
}

// Función para calcular rachas
async function calcularRachas() {
    try {
        const partidosQuery = query(
            collection(db, "partidos"),
            where("jugadores", "array-contains", usuarioActual.uid),
            orderBy("fecha", "desc")
        );
        
        const partidosSnap = await getDocs(partidosQuery);
        const partidos = partidosSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        let rachaActual = 0;
        let mejorRacha = 0;
        let rachaTemp = 0;
        
        for (const partido of partidos) {
            if (partido.ganador === usuarioActual.uid) {
                rachaTemp++;
                if (rachaActual === 0) {
                    rachaActual = rachaTemp;
                }
                mejorRacha = Math.max(mejorRacha, rachaTemp);
            } else {
                rachaTemp = 0;
            }
        }
        
        actualizarElemento('current-streak', rachaActual);
        actualizarElemento('best-streak', mejorRacha);
        
    } catch (error) {
        console.error('❌ Error al calcular rachas:', error);
    }
}

// Función para cargar historial de partidos
async function cargarHistorialPartidosPerfil() {
    console.log('=> Cargando histórico de partidos...');
    const matchesList = document.getElementById('matches-list');
    if (!matchesList) {
        console.warn('⚠️ Elemento matches-list no encontrado');
        return;
    }
    matchesList.innerHTML = '';
    const partidos = window._partidosPerfil || [];
    partidos.sort((a, b) => (b.fecha?.toDate?.() || 0) - (a.fecha?.toDate?.() || 0));
    for (const partido of partidos) {
        const matchElement = document.createElement('div');
        matchElement.className = 'match-item';
        const esLocal = partido.equipoLocal === equipoUsuario.id;
        const rivalId = esLocal ? partido.equipoVisitante : partido.equipoLocal;
        let nombreRival = 'Rival';
        try {
            const rivalDoc = await getDoc(doc(db, "equipos", rivalId));
            if (rivalDoc.exists()) {
                nombreRival = rivalDoc.data().nombre || 'Rival';
            }
        } catch (error) {
            console.error("Error al obtener nombre del rival:", error);
        }
        const fecha = partido.fecha?.toDate?.() ? 
            new Date(partido.fecha.toDate()).toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            }) : 'Fecha no disponible';
        let setsDetallados = '';
        if (partido.resultado) {
            const sets = Object.values(partido.resultado);
            setsDetallados = sets.map((set, index) => {
                const puntos1 = set.puntos1 || 0;
                const puntos2 = set.puntos2 || 0;
                return `${puntos1}-${puntos2}`;
            }).join(' | ');
        }
        const resultadoClase = partido.victoria ? 'victory' : 'defeat';
        const resultadoTexto = partido.victoria ? 'Victoria' : 'Derrota';
        matchElement.innerHTML = `
            <div class="match-header">
                <div class="match-type-badge">${partido.tipo || 'Partido'}</div>
                <div class="match-result-badge ${resultadoClase}">${resultadoTexto}</div>
            </div>
            <div class="match-content">
                <div class="match-rival">
                    <i class="fas fa-user-friends"></i>
                    <span>vs ${nombreRival}</span>
                </div>
                <div class="match-date">
                    <i class="fas fa-calendar-alt"></i>
                    <span>${fecha}</span>
                </div>
                <div class="match-score">
                    <i class="fas fa-trophy"></i>
                    <span>${partido.setsMiEquipo} - ${partido.setsRival} sets</span>
                </div>
                <div class="match-sets-detail">
                    <i class="fas fa-list-ol"></i>
                    <span>${setsDetallados || 'Sets no disponibles'}</span>
                </div>
            </div>
        `;
        matchesList.appendChild(matchElement);
    }
    console.log(`=> Histórico cargado: ${partidos.length} partidos`);
    window._victoriasPerfil = partidos.filter(p => p.victoria);
    window._derrotasPerfil = partidos.filter(p => !p.victoria);
}

// Función para cargar estadísticas de la pala
async function cargarEstadisticasPala() {
    console.log('=> Cargando estadísticas de la pala...');
    const partidos = window._partidosPerfil || [];
    const partidosConPala = partidos.length;
    const victoriasConPala = partidos.filter(p => p.victoria).length;
    const winRatePala = partidosConPala > 0 ? ((victoriasConPala / partidosConPala) * 100).toFixed(1) : 0;
    actualizarElemento('paddle-matches', partidosConPala);
    actualizarElemento('paddle-wins', victoriasConPala);
    actualizarElemento('paddle-win-rate', `${winRatePala}%`);
    const powerStat = document.getElementById('power-stat');
    const controlStat = document.getElementById('control-stat');
    const handlingStat = document.getElementById('handling-stat');
    if (powerStat) powerStat.style.width = `${Math.min(winRatePala, 100)}%`;
    if (controlStat) controlStat.style.width = `${Math.min(partidosConPala * 2, 100)}%`;
    if (handlingStat) handlingStat.style.width = `${Math.min(partidosConPala * 5, 100)}%`;
    console.log('=> Estadísticas de pala actualizadas');
}

// Función para cargar compañero y rivales
async function cargarCompañeroYRivales() {
    console.log('=> Cargando compañero y rivales...');
    if (equipoUsuario && equipoUsuario.jugadores.length > 1) {
        const compañeroId = equipoUsuario.jugadores.find(id => id !== usuarioActual.uid);
        if (compañeroId) {
            try {
                const compañeroDoc = await getDoc(doc(db, "usuarios", compañeroId));
                if (compañeroDoc.exists()) {
                    const compañeroData = compañeroDoc.data();
                    actualizarElemento('partner-name', compañeroData.nombreUsuario || compañeroData.nombre || 'Compañero');
                    const partnerPic = document.getElementById('partner-pic');
                    if (partnerPic) {
                        const nombreCompañero = compañeroData.nombreUsuario || compañeroData.nombre || 'Compañero';
                        partnerPic.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(nombreCompañero)}&background=128C7E&color=fff&size=100`;
                    }
                    await cargarEstadisticasCompañero(compañeroId);
                }
            } catch (error) {
                console.error("Error al cargar datos del compañero:", error);
            }
        }
    }
    await calcularRivalesReales();
    console.log('=> Compañero y rivales cargados');
}

// Función para cargar estadísticas del compañero
async function cargarEstadisticasCompañero(compañeroId) {
    console.log('=> Cargando estadísticas reales del compañero...');
    const equiposSnap = await getDocs(collection(db, "equipos"));
    let equipoCompañero = null;
    for (const docu of equiposSnap.docs) {
        const data = docu.data();
        if (data.jugadores && data.jugadores.includes(compañeroId)) {
            equipoCompañero = { id: docu.id, ...data };
            break;
        }
    }
    if (!equipoCompañero) {
        console.warn('⚠️ No se encontró equipo para el compañero');
        return;
    }
    let partidosCompañero = 0;
    let victoriasCompañero = 0;
    let derrotasCompañero = 0;
    const calendarioSnap = await getDocs(collection(db, "calendario"));
    for (const jornadaDoc of calendarioSnap.docs) {
        const partidosSnap = await getDocs(collection(db, `calendario/${jornadaDoc.id}/partidos`));
        for (const partidoDoc of partidosSnap.docs) {
            const partido = partidoDoc.data();
            if (!partido.resultado) continue;
            const esLocal = partido.equipoLocal === equipoCompañero.id;
            const esVisitante = partido.equipoVisitante === equipoCompañero.id;
            if (!esLocal && !esVisitante) continue;
            partidosCompañero++;
            let setsMiEquipo = 0, setsRival = 0;
            Object.values(partido.resultado).forEach(set => {
                const puntos1 = set.puntos1 || 0;
                const puntos2 = set.puntos2 || 0;
                if (puntos1 === 0 && puntos2 === 0) return;
                if (esLocal) {
                    if (puntos1 > puntos2) setsMiEquipo++;
                    else setsRival++;
                } else {
                    if (puntos2 > puntos1) setsMiEquipo++;
                    else setsRival++;
                }
            });
            const victoria = setsMiEquipo > setsRival;
            if (victoria) {
                victoriasCompañero++;
            } else {
                derrotasCompañero++;
            }
        }
    }
    const winRateCompañero = partidosCompañero > 0 ? ((victoriasCompañero / partidosCompañero) * 100).toFixed(1) : 0;
    actualizarElemento('partner-matches', partidosCompañero);
    actualizarElemento('partner-wins', victoriasCompañero);
    actualizarElemento('partner-win-rate', `${winRateCompañero}%`);
    console.log(`=> Estadísticas del compañero: ${partidosCompañero} partidos, ${victoriasCompañero} victorias, ${winRateCompañero}% win rate`);
}

// Función para calcular rivales reales
async function calcularRivalesReales() {
    console.log('=> Calculando rivales reales...');
    try {
        const partidos = window._partidosPerfil || [];
        const rivales = new Map();
        for (const partido of partidos) {
            if (!partido.resultado) continue;
            
            const esLocal = partido.equipoLocal === equipoUsuario?.id;
            const rivalId = esLocal ? partido.equipoVisitante : partido.equipoLocal;
            
            if (!rivales.has(rivalId)) {
                rivales.set(rivalId, {
                    id: rivalId,
                    nombre: 'Rival',
                    victorias: 0,
                    derrotas: 0,
                    setsGanados: 0,
                    setsPerdidos: 0,
                    puntosGanados: 0,
                    puntosPerdidos: 0,
                    partidos: []
                });
            }
            
            const rival = rivales.get(rivalId);
            rival.partidos.push(partido);
            
            let setsMiEquipo = 0, setsRival = 0;
            let puntosMiEquipo = 0, puntosRival = 0;
            
            Object.values(partido.resultado).forEach(set => {
                const puntos1 = set.puntos1 || 0;
                const puntos2 = set.puntos2 || 0;
                if (puntos1 === 0 && puntos2 === 0) return; // REGLA: sets 0-0 no cuentan
                
                if (esLocal) {
                    if (puntos1 > puntos2) setsMiEquipo++;
                    else setsRival++;
                    puntosMiEquipo += puntos1;
                    puntosRival += puntos2;
                } else {
                    if (puntos2 > puntos1) setsMiEquipo++;
                    else setsRival++;
                    puntosMiEquipo += puntos2;
                    puntosRival += puntos1;
                }
            });
            
            if (setsMiEquipo > setsRival) {
                rival.derrotas++; // El rival pierde contra mí
            } else {
                rival.victorias++; // El rival gana contra mí
            }
            
            rival.setsGanados += setsRival;
            rival.setsPerdidos += setsMiEquipo;
            rival.puntosGanados += puntosRival;
            rival.puntosPerdidos += puntosMiEquipo;
        }
        
        // Obtener nombres de equipos
        const equiposSnap = await getDocs(collection(db, "equipos"));
        const equiposMap = {};
        equiposSnap.forEach(doc => {
            equiposMap[doc.id] = doc.data().nombre;
        });
        
        const rivalesArray = Array.from(rivales.values()).map(rival => {
            rival.nombre = equiposMap[rival.id] || 'Rival';
            rival.diferenciaVictorias = rival.victorias - rival.derrotas;
            rival.diferenciaSets = rival.setsGanados - rival.setsPerdidos;
            rival.diferenciaPuntos = rival.puntosGanados - rival.puntosPerdidos;
            return rival;
        });
        
        // Encontrar el peor rival (más victorias contra mí)
        const peorRival = rivalesArray
            .filter(r => r.victorias > 0)
            .sort((a, b) => {
                if (b.victorias !== a.victorias) return b.victorias - a.victorias;
                return b.diferenciaPuntos - a.diferenciaPuntos;
            })[0];
        
        // Encontrar el mejor rival (más derrotas contra mí)
        const mejorRival = rivalesArray
            .filter(r => r.derrotas > 0)
            .sort((a, b) => {
                if (b.derrotas !== a.derrotas) return b.derrotas - a.derrotas;
                return a.diferenciaPuntos - b.diferenciaPuntos;
            })[0];
        
        // Actualizar UI con el peor rival
        if (peorRival) {
            actualizarElemento('worst-rival-name', peorRival.nombre);
            actualizarElemento('worst-rival-losses', peorRival.victorias);
            actualizarElemento('worst-rival-wins', peorRival.derrotas);
            
            const worstRivalPic = document.getElementById('worst-rival-pic');
            if (worstRivalPic) {
                worstRivalPic.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(peorRival.nombre)}&background=f44336&color=fff`;
            }
            
            const worstRivalDetails = document.getElementById('worst-rival-details');
            if (worstRivalDetails) {
                worstRivalDetails.innerHTML = `
                    <div class="rival-detail">
                        <i class="fas fa-trophy"></i>
                        <span>${peorRival.victorias} victorias contra ti</span>
                    </div>
                    <div class="rival-detail">
                        <i class="fas fa-times-circle"></i>
                        <span>${peorRival.derrotas} derrotas contra ti</span>
                    </div>
                    <div class="rival-detail">
                        <i class="fas fa-chart-line"></i>
                        <span>Sets: ${peorRival.setsGanados}-${peorRival.setsPerdidos}</span>
                    </div>
                    <div class="rival-detail">
                        <i class="fas fa-bullseye"></i>
                        <span>Puntos: ${peorRival.puntosGanados}-${peorRival.puntosPerdidos}</span>
                    </div>
                `;
            }
            console.log(`😈 Peor rival: ${peorRival.nombre} (${peorRival.victorias} victorias contra ti)`);
        } else {
            actualizarElemento('worst-rival-name', 'Sin datos');
            actualizarElemento('worst-rival-losses', '0');
            actualizarElemento('worst-rival-wins', '0');
        }
        
        // Actualizar UI con el mejor rival
        if (mejorRival) {
            actualizarElemento('top-wins-name', mejorRival.nombre);
            actualizarElemento('top-wins-count', mejorRival.derrotas);
            actualizarElemento('top-wins-losses', mejorRival.victorias);
            
            const topWinsPic = document.getElementById('top-wins-pic');
            if (topWinsPic) {
                topWinsPic.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(mejorRival.nombre)}&background=4CAF50&color=fff`;
            }
            
            const topWinsDetails = document.getElementById('top-wins-details');
            if (topWinsDetails) {
                topWinsDetails.innerHTML = `
                    <div class="rival-detail">
                        <i class="fas fa-trophy"></i>
                        <span>${mejorRival.derrotas} victorias contra él</span>
                    </div>
                    <div class="rival-detail">
                        <i class="fas fa-times-circle"></i>
                        <span>${mejorRival.victorias} derrotas contra él</span>
                    </div>
                    <div class="rival-detail">
                        <i class="fas fa-chart-line"></i>
                        <span>Sets: ${mejorRival.setsPerdidos}-${mejorRival.setsGanados}</span>
                    </div>
                    <div class="rival-detail">
                        <i class="fas fa-bullseye"></i>
                        <span>Puntos: ${mejorRival.puntosPerdidos}-${mejorRival.puntosGanados}</span>
                    </div>
                `;
            }
            console.log(`😇 Mejor rival: ${mejorRival.nombre} (${mejorRival.derrotas} victorias contra él)`);
        } else {
            actualizarElemento('top-wins-name', 'Sin datos');
            actualizarElemento('top-wins-count', '0');
            actualizarElemento('top-wins-losses', '0');
        }
        
        console.log(`✅ Rivales calculados: ${rivalesArray.length} rivales encontrados`);
        
    } catch (error) {
        console.error('⚠️ Error al calcular rivales:', error);
    }
}

// Función para cargar Family Points
function cargarFamilyPoints() {
    console.log('=> Cargando Family Points...');
    const familyPoints = usuarioActual.familyPoints || 500;
    actualizarElemento('family-points', familyPoints);
    console.log(`=> Family Points: ${familyPoints}`);
}

// Función para cargar logros
function cargarLogros() {
    console.log('=> Cargando logros...');
    const logros = usuarioActual.logros || [];
    actualizarElemento('achievements-unlocked', logros.length);
    console.log(`=> Logros desbloqueados: ${logros.length}`);
}

// Función para cargar información de la liga
async function cargarInformacionLiga() {
    console.log('=> Cargando información de liga...');
    try {
        const ligasSnap = await getDocs(collection(db, "ligas"));
        let ligaActual = null;
        
        for (const ligaDoc of ligasSnap.docs) {
            const liga = ligaDoc.data();
            if (liga.equipos && liga.equipos.includes(equipoUsuario.id)) {
                ligaActual = { id: ligaDoc.id, ...liga };
                break;
            }
        }
        
        if (!ligaActual) {
            console.log('=> No se encontró liga actual');
            return;
        }
        
        console.log(`=> Liga actual encontrada: ${ligaActual.nombre}`);
        
        // Cargar clasificación
        const clasificacionSnap = await getDocs(collection(db, `ligas/${ligaActual.id}/clasificacion`));
        const clasificacion = [];
        
        for (const posDoc of clasificacionSnap.docs) {
            clasificacion.push(posDoc.data());
        }
        
        // Ordenar por posición
        clasificacion.sort((a, b) => (a.posicion || 999) - (b.posicion || 999));
        
        // Encontrar posición del equipo actual
        const posicionEquipo = clasificacion.find(pos => pos.equipoId === equipoUsuario.id);
        if (posicionEquipo) {
            const posicionActual = posicionEquipo.posicion || '-';
            const puntosActuales = posicionEquipo.puntos || 0;
            const puntosMaximos = posicionEquipo.puntosMaximos || 0;
            
            actualizarElemento('league-position', posicionActual);
            actualizarElemento('league-points', `${puntosActuales}/${puntosMaximos}`);
            
            console.log(`=> Posición en liga: ${posicionActual}, Puntos: ${puntosActuales}/${puntosMaximos}`);
        }
        
        // Contar equipos en la liga
        const totalEquipos = ligaActual.equipos ? ligaActual.equipos.length : 0;
        actualizarElemento('league-teams', totalEquipos);
        
        if (clasificacion.length > 0) {
            // Líder de la liga
            const lider = clasificacion[0];
            actualizarElemento('league-leader', lider.nombreEquipo || 'N/A');
            
            // Último de la liga
            const ultimo = clasificacion[clasificacion.length - 1];
            actualizarElemento('league-last', ultimo.nombreEquipo || 'N/A');
            
            console.log(`=> Líder: ${lider.nombreEquipo}, Último: ${ultimo.nombreEquipo}`);
        }
        
        console.log(`=> Total equipos en liga: ${totalEquipos}`);
        
    } catch (error) {
        console.error('⚠️ Error al cargar información de liga:', error);
    }
}

// Función para cargar torneos actuales
async function cargarTorneosActuales() {
    console.log('=> Cargando torneos actuales...');
    try {
        const torneosSnap = await getDocs(collection(db, "torneos"));
        const torneosUsuario = [];
        
        for (const torneoDoc of torneosSnap.docs) {
            const torneo = torneoDoc.data();
            if (torneo.equipos && torneo.equipos.includes(equipoUsuario.id)) {
                torneosUsuario.push({ id: torneoDoc.id, ...torneo });
            }
        }
        
        const tournamentsList = document.getElementById('tournaments-list');
        if (tournamentsList) {
            if (torneosUsuario.length === 0) {
                tournamentsList.innerHTML = `
                    <div class="no-tournaments">
                        <i class="fas fa-info-circle"></i>
                        <span>No estás registrado en ningún torneo</span>
                    </div>
                `;
            } else {
                tournamentsList.innerHTML = '';
                torneosUsuario.forEach(torneo => {
                    const torneoElement = document.createElement('div');
                    torneoElement.className = 'tournament-item';
                    torneoElement.innerHTML = `
                        <h4>${torneo.nombre}</h4>
                        <p>Estado: ${torneo.estado || 'En curso'}</p>
                    `;
                    tournamentsList.appendChild(torneoElement);
                });
            }
        }
        
        console.log(`=> Torneos cargados: ${torneosUsuario.length} torneos`);
        
    } catch (error) {
        console.error('⚠️ Error al cargar torneos:', error);
    }
}

// Función para cargar estadísticas de amistosos
async function cargarEstadisticasAmistosos() {
    console.log('=> Cargando estadísticas de amistosos...');
    try {
        let totalAmistosos = 0;
        let victoriasAmistosos = 0;
        let derrotasAmistosos = 0;
        
        const calendarioSnap = await getDocs(collection(db, "calendario"));
        for (const jornadaDoc of calendarioSnap.docs) {
            const partidosSnap = await getDocs(collection(db, `calendario/${jornadaDoc.id}/partidos`));
            for (const partidoDoc of partidosSnap.docs) {
                const partido = partidoDoc.data();
                if (!partido.resultado || partido.tipo !== 'amistoso') continue;
                
                const esLocal = partido.equipoLocal === equipoUsuario.id;
                const esVisitante = partido.equipoVisitante === equipoUsuario.id;
                if (!esLocal && !esVisitante) continue;
                
                totalAmistosos++;
                
                let setsMiEquipo = 0, setsRival = 0;
                Object.values(partido.resultado).forEach(set => {
                    const puntos1 = set.puntos1 || 0;
                    const puntos2 = set.puntos2 || 0;
                    if (puntos1 === 0 && puntos2 === 0) return;
                    if (esLocal) {
                        if (puntos1 > puntos2) setsMiEquipo++;
                        else setsRival++;
                    } else {
                        if (puntos2 > puntos1) setsMiEquipo++;
                        else setsRival++;
                    }
                });
                
                if (setsMiEquipo > setsRival) {
                    victoriasAmistosos++;
                } else {
                    derrotasAmistosos++;
                }
            }
        }
        
        actualizarElemento('friendly-total', totalAmistosos);
        actualizarElemento('friendly-wins', victoriasAmistosos);
        actualizarElemento('friendly-losses', derrotasAmistosos);
        
        console.log(`=> Estadísticas amistosos: ${totalAmistosos} partidos, ${victoriasAmistosos} victorias, ${derrotasAmistosos} derrotas`);
        
    } catch (error) {
        console.error('⚠️ Error al cargar estadísticas de amistosos:', error);
    }
}

// Función para cargar retos
async function cargarRetos() {
    console.log('=> Cargando retos...');
    try {
        const partidos = window._partidosPerfil || [];
        const retos = partidos.filter(p => p.tipo === 'reto' && p.resultado);
        const retosList = document.getElementById('retos-list');
        if (retosList) {
            retosList.innerHTML = retos.map(reto => {
                const fecha = reto.fecha?.toDate?.() ? 
                    new Date(reto.fecha.toDate()).toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                    }) : 'Fecha no disponible';
                return `
                    <div class="reto-item">
                        <span class="reto-date">${fecha}</span>
                        <span class="reto-result ${reto.victoria ? 'victory' : 'defeat'}">${reto.victoria ? 'Victoria' : 'Derrota'}</span>
                    </div>
                `;
            }).join('');
        }
        console.log(`✅ Retos cargados: ${retos.length} retos jugados`);
    } catch (error) {
        console.error('⚠️ Error al cargar retos:', error);
    }
}

// Función para actualizar retos jugados
function actualizarRetosJugados() {
    console.log('=> Actualizando retos jugados...');
    // Esta función se llama desde cargarRetos()
}

// Función para actualizar liga extendida
async function actualizarLigaExtendida() {
    console.log('=> Actualizando información extendida de liga...');
    try {
        const ligasSnap = await getDocs(collection(db, "ligas"));
        let ligaActual = null;
        
        for (const ligaDoc of ligasSnap.docs) {
            const liga = ligaDoc.data();
            if (liga.equipos && liga.equipos.includes(equipoUsuario.id)) {
                ligaActual = { id: ligaDoc.id, ...liga };
                break;
            }
        }
        
        if (!ligaActual) {
            console.log('=> No se encontró liga para actualizar información extendida');
            return;
        }
        
        // Cargar clasificación completa
        const clasificacionSnap = await getDocs(collection(db, `ligas/${ligaActual.id}/clasificacion`));
        const clasificacion = [];
        
        for (const posDoc of clasificacionSnap.docs) {
            clasificacion.push(posDoc.data());
        }
        
        // Ordenar por posición
        clasificacion.sort((a, b) => (a.posicion || 999) - (b.posicion || 999));
        
        if (clasificacion.length > 0) {
            // Líder de la liga
            const lider = clasificacion[0];
            actualizarElemento('league-leader', lider.nombreEquipo || 'N/A');
            
            // Último de la liga
            const ultimo = clasificacion[clasificacion.length - 1];
            actualizarElemento('league-last', ultimo.nombreEquipo || 'N/A');
            
            console.log(`=> Líder: ${lider.nombreEquipo}, Último: ${ultimo.nombreEquipo}`);
        }
        
        // Calcular progreso de la liga
        await actualizarAcabarPartidos(0, clasificacion.length);
        
    } catch (error) {
        console.error('⚠️ Error al actualizar información extendida de liga:', error);
    }
}

function actualizarAcabarPartidos(partidosJugadosUsuario, totalEquipos) {
    console.log('=> Actualizando progreso de partidos...');
    const totalPartidos = totalEquipos * (totalEquipos - 1) / 2; // Fórmula para partidos de liga
    const porcentajeCompletado = totalPartidos > 0 ? (partidosJugadosUsuario / totalPartidos) * 100 : 0;
    
    const finishedBar = document.getElementById('league-finished-bar');
    const finishedPercent = document.getElementById('league-finished-percent');
    const finishedLeftText = document.getElementById('league-finished-left-text');
    
    if (finishedBar) finishedBar.style.width = `${porcentajeCompletado}%`;
    if (finishedPercent) finishedPercent.textContent = `${porcentajeCompletado.toFixed(1)}%`;
    if (finishedLeftText) finishedLeftText.textContent = `${totalPartidos - partidosJugadosUsuario} partidos restantes`;
    
    console.log(`=> Progreso de partidos: ${porcentajeCompletado.toFixed(1)}% completado`);
}

async function contarPartidosLigaRestantes(clasificacion) {
    console.log('=> Contando partidos restantes de liga...');
    try {
        const calendarioSnap = await getDocs(collection(db, "calendario"));
        let partidosJugados = 0;
        let partidosTotal = 0;
        
        for (const jornadaDoc of calendarioSnap.docs) {
            const partidosSnap = await getDocs(collection(db, `calendario/${jornadaDoc.id}/partidos`));
            for (const partidoDoc of partidosSnap.docs) {
                const partido = partidoDoc.data();
                if (partido.tipo !== 'liga') continue;
                
                const esLocal = partido.equipoLocal === equipoUsuario.id;
                const esVisitante = partido.equipoVisitante === equipoUsuario.id;
                if (!esLocal && !esVisitante) continue;
                
                partidosTotal++;
                if (partido.resultado) {
                    partidosJugados++;
                }
            }
        }
        
        const partidosRestantes = partidosTotal - partidosJugados;
        const porcentajeProgreso = partidosTotal > 0 ? (partidosJugados / partidosTotal) * 100 : 0;
        
        const progressBar = document.getElementById('league-progress');
        const matchesLeftText = document.getElementById('league-matches-left-text');
        
        if (progressBar) progressBar.style.width = `${porcentajeProgreso}%`;
        if (matchesLeftText) matchesLeftText.textContent = `${partidosRestantes} partidos restantes`;
        
        console.log(`=> Partidos de liga: ${partidosJugados}/${partidosTotal} jugados, ${partidosRestantes} restantes`);
        
    } catch (error) {
        console.error('⚠️ Error al contar partidos restantes:', error);
    }
}

// Función para cargar información de clasificación del equipo del usuario seleccionado
async function cargarInformacionClasificacion() {
    console.log('=> Cargando información de clasificación del equipo...');
    try {
        // Obtener clasificación completa
        const clasificacionSnap = await getDocs(collection(db, "clasificacion"));
        const clasificacion = [];
        clasificacionSnap.forEach(doc => {
            clasificacion.push({ ...doc.data(), id: doc.id });
        });
        
        // Ordenar por posición
        clasificacion.sort((a, b) => a.posicion - b.posicion);
        
        const totalEquipos = clasificacion.length;
        
        // Encontrar el equipo del usuario seleccionado
        const equipoUsuarioSeleccionado = clasificacion.find(eq => eq.id === equipoUsuario.id);
        
        if (equipoUsuarioSeleccionado) {
            // Información básica del equipo
            const posicion = equipoUsuarioSeleccionado.posicion;
            const puntos = equipoUsuarioSeleccionado.puntos || 0;
            const partidosJugados = equipoUsuarioSeleccionado.partidosJugados || 0;
            const partidosGanados = equipoUsuarioSeleccionado.partidosGanados || 0;
            const partidosPerdidos = equipoUsuarioSeleccionado.partidosPerdidos || 0;
            
            // Información del líder y último
            const lider = clasificacion.length > 0 ? clasificacion[0].nombre : 'N/A';
            const ultimo = clasificacion.length > 0 ? clasificacion[clasificacion.length - 1].nombre : 'N/A';
            
            // Calcular partidos restantes del equipo
            const partidosTotalesEquipo = totalEquipos - 1; // No juega contra sí mismo
            const partidosRestantesEquipo = Math.max(0, partidosTotalesEquipo - partidosJugados);
            const porcentajeCompletadoEquipo = partidosTotalesEquipo > 0 ? 
                Math.round((partidosJugados / partidosTotalesEquipo) * 100) : 0;
            
            // Calcular partidos restantes de toda la liga
            const partidosTotalesLiga = (totalEquipos * (totalEquipos - 1)) / 2; // Fórmula para partidos totales
            let partidosJugadosLiga = 0;
            
            // Contar partidos jugados en toda la liga
            const calendarioSnap = await getDocs(collection(db, "calendario"));
            for (const jornadaDoc of calendarioSnap.docs) {
                const partidosSnap = await getDocs(collection(db, `calendario/${jornadaDoc.id}/partidos`));
                partidosSnap.forEach(partidoDoc => {
                    const partido = partidoDoc.data();
                    if (partido.resultado) {
                        partidosJugadosLiga++;
                    }
                });
            }
            
            const partidosRestantesLiga = Math.max(0, partidosTotalesLiga - partidosJugadosLiga);
            const porcentajeCompletadoLiga = partidosTotalesLiga > 0 ? 
                Math.round((partidosJugadosLiga / partidosTotalesLiga) * 100) : 0;
            
            // Actualizar elementos en el HTML
            actualizarElemento('league-teams', totalEquipos);
            actualizarElemento('league-leader', lider);
            actualizarElemento('league-last', ultimo);
            actualizarElemento('league-position', posicion);
            actualizarElemento('league-points', `${puntos} pts`);
            actualizarElemento('league-matches-played', partidosJugados);
            actualizarElemento('league-matches-won', partidosGanados);
            actualizarElemento('league-matches-lost', partidosPerdidos);
            
            // Actualizar barras de progreso del equipo
            const leagueFinishedBar = document.getElementById('league-finished-bar');
            if (leagueFinishedBar) {
                leagueFinishedBar.style.width = `${porcentajeCompletadoEquipo}%`;
            }
            actualizarElemento('league-finished-percent', `${porcentajeCompletadoEquipo}%`);
            actualizarElemento('league-finished-left-text', `${partidosRestantesEquipo} partidos restantes`);
            
            // Actualizar barras de progreso de la liga
            const leagueProgressBar = document.getElementById('league-progress');
            if (leagueProgressBar) {
                leagueProgressBar.style.width = `${porcentajeCompletadoLiga}%`;
            }
            actualizarElemento('league-matches-left-text', `${partidosRestantesLiga} partidos restantes`);
            
            console.log(`=> Información de clasificación cargada: Posición ${posicion}, ${partidosJugados}/${partidosTotalesEquipo} partidos jugados`);
        } else {
            console.warn('=> No se encontró el equipo en la clasificación');
            // Establecer valores por defecto
            actualizarElemento('league-teams', totalEquipos);
            actualizarElemento('league-leader', 'N/A');
            actualizarElemento('league-last', 'N/A');
            actualizarElemento('league-position', '-');
            actualizarElemento('league-points', '0 pts');
            actualizarElemento('league-matches-played', '0');
            actualizarElemento('league-matches-won', '0');
            actualizarElemento('league-matches-lost', '0');
        }
        
    } catch (error) {
        console.error('❌ Error al cargar información de clasificación:', error);
    }
}

// Función para calcular y mostrar los rivales del usuario seleccionado
async function cargarRivales() {
    console.log('=> Calculando rivales reales...');
    try {
        if (!equipoUsuario) {
            console.warn('=> No hay equipo para calcular rivales');
            return;
        }

        const partidos = window._partidosPerfil || [];
        const rivales = new Map();
        
        for (const partido of partidos) {
            if (!partido.resultado) continue;
            
            const esLocal = partido.equipoLocal === equipoUsuario.id;
            const rivalId = esLocal ? partido.equipoVisitante : partido.equipoLocal;
            
            if (!rivales.has(rivalId)) {
                rivales.set(rivalId, {
                    id: rivalId,
                    nombre: 'Rival',
                    victorias: 0,
                    derrotas: 0,
                    setsGanados: 0,
                    setsPerdidos: 0,
                    puntosGanados: 0,
                    puntosPerdidos: 0,
                    partidos: []
                });
            }
            
            const rival = rivales.get(rivalId);
            rival.partidos.push(partido);
            
            let setsMiEquipo = 0, setsRival = 0;
            let puntosMiEquipo = 0, puntosRival = 0;
            
            Object.values(partido.resultado).forEach(set => {
                const puntos1 = set.puntos1 || 0;
                const puntos2 = set.puntos2 || 0;
                if (puntos1 === 0 && puntos2 === 0) return; // REGLA: sets 0-0 no cuentan
                
                if (esLocal) {
                    if (puntos1 > puntos2) setsMiEquipo++;
                    else setsRival++;
                    puntosMiEquipo += puntos1;
                    puntosRival += puntos2;
                } else {
                    if (puntos2 > puntos1) setsMiEquipo++;
                    else setsRival++;
                    puntosMiEquipo += puntos2;
                    puntosRival += puntos1;
                }
            });
            
            if (setsMiEquipo > setsRival) {
                rival.derrotas++; // El rival pierde contra mí
            } else {
                rival.victorias++; // El rival gana contra mí
            }
            
            rival.setsGanados += setsRival;
            rival.setsPerdidos += setsMiEquipo;
            rival.puntosGanados += puntosRival;
            rival.puntosPerdidos += puntosMiEquipo;
        }
        
        // Obtener nombres de equipos
        const equiposSnap = await getDocs(collection(db, "equipos"));
        const equiposMap = {};
        equiposSnap.forEach(doc => {
            equiposMap[doc.id] = doc.data().nombre;
        });
        
        const rivalesArray = Array.from(rivales.values()).map(rival => {
            rival.nombre = equiposMap[rival.id] || 'Rival';
            rival.diferenciaVictorias = rival.victorias - rival.derrotas;
            rival.diferenciaSets = rival.setsGanados - rival.setsPerdidos;
            rival.diferenciaPuntos = rival.puntosGanados - rival.puntosPerdidos;
            return rival;
        });
        
        // Encontrar el peor rival (más victorias contra mí)
        const peorRival = rivalesArray
            .filter(r => r.victorias > 0)
            .sort((a, b) => {
                if (b.victorias !== a.victorias) return b.victorias - a.victorias;
                return b.diferenciaPuntos - a.diferenciaPuntos;
            })[0];
        
        // Encontrar el mejor rival (más derrotas contra mí)
        const mejorRival = rivalesArray
            .filter(r => r.derrotas > 0)
            .sort((a, b) => {
                if (b.derrotas !== a.derrotas) return b.derrotas - a.derrotas;
                return a.diferenciaPuntos - b.diferenciaPuntos;
            })[0];
        
        // Actualizar UI con el peor rival
        if (peorRival) {
            actualizarElemento('worst-rival-name', peorRival.nombre);
            actualizarElemento('worst-rival-losses', peorRival.victorias);
            actualizarElemento('worst-rival-wins', peorRival.derrotas);
            
            const worstRivalPic = document.getElementById('worst-rival-pic');
            if (worstRivalPic) {
                worstRivalPic.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(peorRival.nombre)}&background=f44336&color=fff`;
            }
            
            const worstRivalDetails = document.getElementById('worst-rival-details');
            if (worstRivalDetails) {
                worstRivalDetails.innerHTML = `
                    <div class="rival-detail">
                        <i class="fas fa-trophy"></i>
                        <span>${peorRival.victorias} victorias contra ti</span>
                    </div>
                    <div class="rival-detail">
                        <i class="fas fa-times-circle"></i>
                        <span>${peorRival.derrotas} derrotas contra ti</span>
                    </div>
                    <div class="rival-detail">
                        <i class="fas fa-chart-line"></i>
                        <span>Sets: ${peorRival.setsGanados}-${peorRival.setsPerdidos}</span>
                    </div>
                    <div class="rival-detail">
                        <i class="fas fa-bullseye"></i>
                        <span>Puntos: ${peorRival.puntosGanados}-${peorRival.puntosPerdidos}</span>
                    </div>
                `;
            }
            console.log(`😈 Peor rival: ${peorRival.nombre} (${peorRival.victorias} victorias contra ti)`);
        } else {
            actualizarElemento('worst-rival-name', 'Sin datos');
            actualizarElemento('worst-rival-losses', '0');
            actualizarElemento('worst-rival-wins', '0');
        }
        
        // Actualizar UI con el mejor rival
        if (mejorRival) {
            actualizarElemento('top-wins-name', mejorRival.nombre);
            actualizarElemento('top-wins-count', mejorRival.derrotas);
            actualizarElemento('top-wins-losses', mejorRival.victorias);
            
            const topWinsPic = document.getElementById('top-wins-pic');
            if (topWinsPic) {
                topWinsPic.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(mejorRival.nombre)}&background=4CAF50&color=fff`;
            }
            
            const topWinsDetails = document.getElementById('top-wins-details');
            if (topWinsDetails) {
                topWinsDetails.innerHTML = `
                    <div class="rival-detail">
                        <i class="fas fa-trophy"></i>
                        <span>${mejorRival.derrotas} victorias contra él</span>
                    </div>
                    <div class="rival-detail">
                        <i class="fas fa-times-circle"></i>
                        <span>${mejorRival.victorias} derrotas contra él</span>
                    </div>
                    <div class="rival-detail">
                        <i class="fas fa-chart-line"></i>
                        <span>Sets: ${mejorRival.setsPerdidos}-${mejorRival.setsGanados}</span>
                    </div>
                    <div class="rival-detail">
                        <i class="fas fa-bullseye"></i>
                        <span>Puntos: ${mejorRival.puntosPerdidos}-${mejorRival.puntosGanados}</span>
                    </div>
                `;
            }
            console.log(`😇 Mejor rival: ${mejorRival.nombre} (${mejorRival.derrotas} victorias contra él)`);
        } else {
            actualizarElemento('top-wins-name', 'Sin datos');
            actualizarElemento('top-wins-count', '0');
            actualizarElemento('top-wins-losses', '0');
        }
        
        console.log(`✅ Rivales calculados: ${rivalesArray.length} rivales encontrados`);
        
    } catch (error) {
        console.error('⚠️ Error al calcular rivales:', error);
    }
}

// Inicialización cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 DOM cargado, iniciando aplicación...');
    
    try {
        await inicializarPerfil();
        console.log('✅ Aplicación inicializada correctamente');
        
        // Inicializar funcionalidades adicionales
        inicializarRetoAmigos();
        inicializarEfectoScroll();
        
    } catch (error) {
        console.error('❌ Error al inicializar la aplicación:', error);
    }
});

function inicializarRetoAmigos() {
    console.log('=> Inicializando reto de amigos...');
    const challengeFriendBtn = document.getElementById('challenge-friend');
    if (challengeFriendBtn) {
        challengeFriendBtn.addEventListener('click', () => {
            console.log('=> Botón de retar amigo clickeado');
            // Aquí iría la lógica para retar a un amigo
        });
    }
}

// Función para inicializar el efecto de scroll en el header
function inicializarEfectoScroll() {
    console.log('=> Inicializando efecto de scroll en header...');
    
    const header = document.querySelector('.app-header');
    if (!header) return;
    
    window.addEventListener('scroll', () => {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        if (scrollTop > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });
} 