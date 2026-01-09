import {
  getDocument,
  getCollection,
  initializeAuthObserver,
} from "./firebase-service.js";
import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  getCountFromServer
} from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";
import {
  renderMatchDetailsShared,
  executeMatchAction as executeMatchActionShared,
  showResultFormShared,
  executeSaveResultShared,
  closeChatSubscription,
  renderWeatherShared,
  sendChatMessageShared,
} from "./match-service.js";
import { authGuard, renderAvatarShared, showToast } from "./ui-core.js";

authGuard();

document.addEventListener("DOMContentLoaded", async () => {
  const usernameElement = document.getElementById("username");
  const welcomeAvatar = document.getElementById("welcome-avatar");
  const nextMatchContainer = document.getElementById("next-match-container");
  const pendingMatchesList = document.getElementById("pending-matches-list");

  let currentFilter = "mis";
  let currentUser = null;
  let userData = null;
  let allUsersCache = {}; 
  // Cache for user names to display "Juan, Pedro vs ..." properly

  // --- 1. Auth & Data Loading ---
  initializeAuthObserver(async (user) => {
    if (user) {
      currentUser = user;
      try {
        // Load All Users for Cache (Optimization: load once)
        const usersSnap = await getDocs(collection(db, "usuarios"));
        usersSnap.forEach(d => allUsersCache[d.id] = d.data());

        userData = allUsersCache[user.uid] || await getDocument("usuarios", user.uid);

        updateHeaderProfile(user, userData);

        await loadProfileStats(userData, user.uid);
        loadNextMatch(user.uid);
        loadPendingMatches(user.uid, currentFilter);
      } catch (error) {
        console.error("Error loading home data:", error);
      }
    } else {
      window.location.href = "index.html";
    }
  });

  function updateHeaderProfile(user, data) {
    const displayName = data?.nombreUsuario || data?.nombre || user.email.split("@")[0];

    // Update Greeting
    const horaActual = new Date().getHours();
    let saludo = "BUENAS NOCHES";
    if (horaActual >= 6 && horaActual < 14) saludo = "BUENOS DÍAS";
    else if (horaActual >= 14 && horaActual < 20) saludo = "BUENAS TARDES";

    const greetingEl = document.querySelector(".greeting-text");
    if (greetingEl) greetingEl.textContent = saludo;
    if (usernameElement) usernameElement.textContent = displayName.toUpperCase();

    // Use Shared Avatar logic
    const avatarHtml = renderAvatarShared(user.uid, data, 'lg');
    if (welcomeAvatar) welcomeAvatar.innerHTML = avatarHtml;

    const smallAvatarHtml = renderAvatarShared(user.uid, data, 'sm');
    const headerTriggers = document.querySelectorAll(".user-profile-trigger");
    headerTriggers.forEach(trigger => {
        trigger.innerHTML = smallAvatarHtml;
    });
  }

  // --- 2. Stats Logic ---
  async function loadProfileStats(data, uid) {
    if (!data) return;
    try {
      // Re-fetch fresh user doc to ensure latest stats
      const userRef = doc(db, 'usuarios', uid);
      const userSnap = await getDoc(userRef);
      const d = userSnap.exists() ? userSnap.data() : data;

      const puntosRanking = Math.round(d.puntosRankingTotal || d.puntosRanking || 0);
      const victorias = parseInt(d.victorias || 0);
      const pjTotal = parseInt(d.partidosJugados || 0);
      const winrate = pjTotal > 0 ? Math.round((victorias / pjTotal) * 100) : 0;
      const nivel = parseFloat(d.nivel || 2.0).toFixed(2);
      const rachaActual = parseInt(d.rachaActual || 0);
      const familyPoints = parseInt(d.familyPoints || 0);

      document.getElementById("stat-puntos-real").textContent = puntosRanking;
      document.getElementById("stats-winrate-real").textContent = `${winrate}%`;
      document.getElementById("stat-nivel-display").textContent = nivel;
      
      // Calculate Family Points if they are 0 (Participation Reward)
      let finalFP = familyPoints;
      if (finalFP === 0 && pjTotal > 0) {
          finalFP = pjTotal * 15; // 15 FP per match
          updateDoc(userRef, { familyPoints: finalFP });
      }
      document.getElementById("home-fp-total").textContent = finalFP;
      
      console.log(`📊 [Home] User Stats: Pts=${puntosRanking}, FP=${familyPoints}, PJ=${pjTotal}, Nivel=${nivel}`);
      
      const posBadge = document.getElementById("p-val-pos");
      if (posBadge) {
          posBadge.textContent = (d.posicion || 'DERECHA').toUpperCase();
          posBadge.onclick = async () => {
              const current = posBadge.textContent.trim().toUpperCase();
              const next = current === 'DERECHA' ? 'REVÉS' : 'DERECHA';
              showToast(`Cambiando lado a ${next}...`, 'info');
              try {
                  await updateDoc(userRef, { posicion: next.toLowerCase() });
                  posBadge.textContent = next;
                  showToast(`Ahora juegas en la ${next}`, 'success');
              } catch(e) { console.error("Error updating side:", e); }
          };
      }

      await calculateRankingPosition(uid, puntosRanking);

      // --- Match Count Calculations (Last 30 Days) ---
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const tsThreshold = Timestamp.fromDate(thirtyDaysAgo);
      
      const qAm = query(collection(db, "partidosAmistosos"), where("jugadores", "array-contains", uid), where("fecha", ">=", tsThreshold));
      const qRe = query(collection(db, "partidosReto"), where("jugadores", "array-contains", uid), where("fecha", ">=", tsThreshold));
      
      const [sAm, sRe] = await Promise.all([getDocs(qAm), getDocs(qRe)]);
      const totalLastMonth = sAm.size + sRe.size;
      document.getElementById("home-matches-week").textContent = totalLastMonth;

      const streakEl = document.getElementById("home-win-streak");
      if (streakEl) {
        streakEl.textContent = rachaActual;
        streakEl.style.color = rachaActual > 0 ? "#00e676" : rachaActual < 0 ? "#ff1744" : "#fff";
      }
    } catch (e) { console.error("Stats Error:", e); }
  }

  async function calculateRankingPosition(uid, userPoints) {
    try {
      console.log(`🔍 [Home] Calculating Rank for Pts: ${userPoints}`);
      
      const usersSnap = await getDocs(collection(db, "usuarios"));
      const allPlayers = usersSnap.docs.map(doc => {
          const d = doc.data();
          return {
              id: doc.id,
              puntos: parseFloat(d.puntosRankingTotal || d.puntosRanking || 0)
          };
      });

      // Sort like ranking.js
      allPlayers.sort((a, b) => b.puntos - a.puntos);
      
      const myRank = allPlayers.findIndex(p => p.id === uid) + 1;
      const pos = myRank || 0;
      
      console.log(`🏆 [Home] Position Result (Local Sort): #${pos} of ${allPlayers.length}`);
      
      const el = document.getElementById("home-rank-pos");
      if (el) {
          el.textContent = `#${pos}`;
          el.style.color = pos === 1 ? "#FFD700" : pos === 2 ? "#C0C0C0" : pos === 3 ? "#CD7F32" : "#fff";
      }
      
      const rankCard = document.querySelector('.premium-stat-card.primary');
      if (rankCard) {
          rankCard.style.cursor = 'pointer';
          rankCard.onclick = () => window.location.href = 'puntosRanking.html';
      }
    } catch (e) { console.error("Ranking Calculation Error:", e); }
  }

  // --- 3. Matches Logic (Optimized) ---
  async function loadNextMatch(uid) {
    if (nextMatchContainer) nextMatchContainer.innerHTML = '<div class="loader-ring-container py-4"><div class="loader-ring"></div></div>';
    try {
      const now = new Date();
      // Fetch all future matches for user, sort client side to find the CLOSEST one
      const matches = await fetchAllMatchesForUser(uid, true); // True = future only
      
      const sorted = matches.sort((a,b) => a.fechaObj - b.fechaObj);
      const nextMatch = sorted[0];

      if (nextMatch) {
          renderNextMatch(nextMatch);
      } else {
          nextMatchContainer.innerHTML = `<div class="empty-next-match animate-fade-in"><i class="fas fa-calendar-check"></i><p>No tienes partidos próximos</p></div>`;
      }

      // Check ALL matches for Today to send reminders
      const today = new Date().toDateString();
      const todayMatches = matches.filter(m => m.fechaObj.toDateString() === today);
      
      if (todayMatches.length > 0) {
          import('./notifications-service.js').then(notifRepo => {
              todayMatches.forEach(m => {
                  const timeStr = m.fechaObj.toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'});
                  notifRepo.createTodayReminder(uid, m.id, timeStr);
              });
          });
          
          const closestToday = todayMatches[0];
          const cTime = closestToday.fechaObj.toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'});
          showToast(`¡Tienes partido hoy a las ${cTime}! 🎾`, 'success');
      }
    } catch (error) {
      console.error("NextMatch Error:", error);
      nextMatchContainer.innerHTML = `<div class="empty-next-match"><i class="fas fa-exclamation-circle text-warning"></i><p>Error de carga</p></div>`;
    }
  }

  async function fetchAllMatchesForUser(uid, futureOnly = false) {
      const now = new Date();
      let qAmistoso = query(collection(db, "partidosAmistosos"), where("jugadores", "array-contains", uid), limit(50));
      let qReto = query(collection(db, "partidosReto"), where("jugadores", "array-contains", uid), limit(50));
      
      const [snapA, snapR] = await Promise.all([getDocs(qAmistoso), getDocs(qReto)]);
      let list = [];
      const process = (doc, type) => {
          const d = doc.data();
          const date = d.fecha?.toDate ? d.fecha.toDate() : new Date(d.fecha);
          if (futureOnly && date < now) return;
          list.push({ id: doc.id, tipo: type, fechaObj: date, ...d });
      };
      
      snapA.forEach(d => process(d, 'amistoso'));
      snapR.forEach(d => process(d, 'reto'));
      return list;
  }

  function renderNextMatch(match) {
    if (!nextMatchContainer) return;
    const fecha = match.fechaObj;
    const dia = fecha.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "short" }).toUpperCase();
    const hora = fecha.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    const creator = match.creadorNombre || "Organizador";

    // Use shared renderer for Next Match basically, or specific one
    nextMatchContainer.innerHTML = `
            <div class="next-match-card-premium glass-strong animate-fade-in" onclick="openMatchModalHome('${match.id}', '${match.tipo}')">
                <div class="nm-header">
                    <div class="flex-center gap-2">
                        <span class="badge ${match.tipo}">${match.tipo.toUpperCase()}</span>
                        <div class="text-xs opacity-70"><i class="fas fa-crown text-warning"></i> ${creator}</div>
                    </div>
                    <span class="nm-live"><i class="fas fa-circle animate-pulse text-danger"></i> PRÓXIMO</span>
                </div>
                <div class="nm-body">
                    <div class="nm-date-info">
                        <div class="nm-day">${dia}</div>
                        <div class="nm-hour">${hora}</div>
                    </div>
                     <div class="nm-vs-info">
                        <div class="nm-players-count">${match.jugadores?.length || 0}/4 JUGADORES</div>
                        <div class="btn-view-match">GESTIONAR <i class="fas fa-arrow-right ml-1"></i></div>
                    </div>
                </div>
            </div>
        `;
  }

  async function loadPendingMatches(uid, filter = "mis") {
    const pContainer = document.getElementById("pending-matches-list");
    if (!pContainer) return;
    pContainer.innerHTML = '<div class="text-center p-3"><div class="spinner-small"></div></div>';

    try {
      const now = new Date();
      let matches = [];

      if (filter === "mis") {
        // Future matches where I AM a player
        matches = await fetchAllMatchesForUser(uid, true);
        matches.sort((a,b) => a.fechaObj - b.fechaObj);
      } 
      else if (filter === "jugados") {
        // Past matches where I WAS a player
        // Fetch all (no future filter) then filter by date < now
        const all = await fetchAllMatchesForUser(uid, false);
        matches = all.filter(m => m.fechaObj < now);
        matches.sort((a,b) => b.fechaObj - a.fechaObj); // Desk sorting (newest first)
      } 
      else if (filter === "todos") {
        // Future matches where I am NOT a player (Discovery)
        // Fetch future matches generally (limit 20)
        // Note: Firestore array-contains-not-in doesn't exist efficiently. 
        // We fetch future matches and filter client side.
        const qA = query(collection(db, "partidosAmistosos"), where("fecha", ">=", Timestamp.fromDate(now)), limit(20));
        const qR = query(collection(db, "partidosReto"), where("fecha", ">=", Timestamp.fromDate(now)), limit(20));
        
        const [sA, sR] = await Promise.all([getDocs(qA), getDocs(qR)]);
        
        const process = (d, t) => {
            const data = d.data();
            const date = data.fecha?.toDate ? data.fecha.toDate() : new Date(data.fecha);
            if (!data.jugadores?.includes(uid)) { 
                matches.push({ id: d.id, tipo: t, fechaObj: date, ...data });
            }
        };
        sA.forEach(d => process(d, 'amistoso'));
        sR.forEach(d => process(d, 'reto'));
        
        matches.sort((a,b) => a.fechaObj - b.fechaObj);
        matches = matches.slice(0, 10); // Max 10
      }

      renderPendingMatches(matches, filter);

    } catch (error) {
      console.error("Matches Load Error:", error);
      pContainer.innerHTML = `<div class="empty-state-matches"><i class="fas fa-exclamation-triangle"></i><p>Error cargando partidos</p></div>`;
    }
  }

  async function renderPendingMatches(matches, filter) {
    const list = document.getElementById("pending-matches-list");
    if (!list) return;

    // Filter Logic for 'Jugados' (Last 48 hours only)
    let displayMatches = matches;
    if (filter === 'jugados') {
        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        displayMatches = matches.filter(m => m.fechaObj >= twoDaysAgo);
    }

    if (displayMatches.length === 0) {
      let msg = "No hay partidos disponibles";
      if (filter === "mis") msg = "No tienes partidos futuros";
      if (filter === "jugados") msg = "No hay resultados recientes (últimos 2 días)";
      list.innerHTML = `<div class="empty-state-matches animate-fade-in"><i class="fas fa-inbox"></i><p>${msg}</p></div>`;
      return;
    }

    list.innerHTML = "";

    for (const m of displayMatches) {
      const card = document.createElement("div");
      
      // Calculate missing Result status
      const isPast = m.fechaObj < new Date();
      const isCompleted = m.estado === 'jugado' || (m.resultado && m.resultado.sets);
      const isJoined = m.jugadores?.includes(currentUser.uid);
      
      // Gray out anulled matches (past but not completed)
      let grayStyle = '';
      if (filter === 'jugados' && !isCompleted && isPast) {
          grayStyle = 'style="filter: grayscale(1); opacity: 0.6;"';
      }
      
      card.className = "mini-match-card-premium animate-fade-in";
      if(grayStyle) card.setAttribute("style", "filter: grayscale(1); opacity: 0.6;");
      
      card.onclick = () => openMatchModalHome(m.id, m.tipo);

      // --- Data Prep ---
      const fecha = m.fechaObj;
      const dateStr = fecha.toLocaleDateString("es-ES", { day:'numeric', month:'short' }).toUpperCase();
      const timeStr = fecha.toLocaleTimeString("es-ES", { hour:'2-digit', minute:'2-digit' });

      // Players Naming
      const pNames = (m.jugadores || []).map(pid => {
          const u = allUsersCache[pid];
          const n = u ? (u.nombreUsuario || u.nombre) : 'Jugador';
          return n.split(' ')[0]; // First name only
      });
      // Fill empty slots
      for(let i=pNames.length; i<4; i++) pNames.push('<span style="opacity:0.3">LIBRE</span>');

      const team1Str = `${pNames[0]}, ${pNames[1]}`;
      const team2Str = `${pNames[2]}, ${pNames[3]}`;

      // Logic for Status Display
      let statusHtml = '';
      let isGray = false;

      if (filter === 'jugados') {
          if (!isCompleted) {
            isGray = true;
            statusHtml = `<div class="status-badge anulled">SIN RESULTADO</div>`;
          } else {
             statusHtml = `<div class="status-badge played">FINALIZADO</div>`; 
          }
      } else {
          // Future
          const spots = 4 - (m.jugadores?.length || 0);
          statusHtml = spots > 0 
            ? `<div class="status-badge open">${spots} LIBRES</div>`
            : `<div class="status-badge closed">COMPLETO</div>`;
      }

      // Level
      const lvl = parseFloat(m.nivelPromedio || 4.2).toFixed(1); // Default adjusted or could be calc
      let lvlClass = 'lvl-mid';
      if (lvl < 3) lvlClass = 'lvl-low';
      if (lvl > 5) lvlClass = 'lvl-high';
      
      // --- Weather Integration ---
      let weatherHtml = `<i class="fas fa-sun text-weather"></i> <span style="font-size:0.7rem; color:#fff;">--°</span>`;
      try {
          const lat = 39.4938; const lon = -0.3957;
          const hIdx = fecha.getHours();
          const fDate = fecha.toISOString().split('T')[0];
          const wResp = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,weather_code&start_date=${fDate}&end_date=${fDate}`);
          const wData = await wResp.json();
          if (wData?.hourly) {
              const temp = Math.round(wData.hourly.temperature_2m[hIdx]);
              const code = wData.hourly.weather_code[hIdx];
              let icon = 'fa-sun';
              if(code > 3) icon = 'fa-cloud-sun';
              if(code > 50) icon = 'fa-cloud-rain';
              weatherHtml = `<i class="fas ${icon} text-weather"></i> <span style="font-size:0.7rem; color:#fff;">${temp}°</span>`;
          }
      } catch(e) {}

      // Action Button (Add Result)
      let actionButton = "";
      if (filter === 'jugados' && !isCompleted && isJoined) {
          // User needs to add result!
          actionButton = `<button class="btn-result-action mt-2" onclick="event.stopPropagation(); showResultFormShared('${m.id}', '${m.tipo}')"><i class="fas fa-pen"></i> AÑADIR RESULTADO</button>`;
          statusHtml = ''; // Hide status badge if button is shown
      }
      else if (!m.estado || m.estado !== "jugado") {
        // Future match actions if needed
      }

      // Result Display
      let resultDisplay = "";
      if (m.estado === "jugado" && m.resultado?.sets) {
        resultDisplay = `
            <div class="result-display-premium">
                <span class="text-2xs opacity-50 font-bold mr-2">RESULTADO</span>
                <span class="result-score" style="font-size:1.1rem; color:#fff;">${m.resultado.sets}</span>
            </div>
        `;
        statusHtml = resultDisplay; // Replace status badge with score
      }

      card.innerHTML = `
         <div class="mmc-top">
            <div class="mmc-date-weather">
                <span class="mmc-dw-date">${dateStr}</span>
                <span class="mmc-dw-sep">|</span>
                <span class="text-time">${timeStr}</span>
                <span class="mmc-dw-sep">|</span>
                ${weatherHtml}
            </div>
            <div class="badge-mini-lvl ${lvlClass}">NIVEL ${lvl}</div>
         </div>

         <div class="mmc-vs-area">
            <div class="mmc-team t1">${team1Str}</div>
            <div class="mmc-vs-badge">VS</div>
            <div class="mmc-team t2">${team2Str}</div>
         </div>

         <div class="mmc-bottom" style="align-items: center;">
            <div class="mmc-creator">
                <span class="creator-label">ORGANIZA</span>
                <span class="creator-name">${m.creadorNombre || 'Admin'}</span>
            </div>
            <div style="display:flex; flex-direction:column; align-items:flex-end;">
                 ${statusHtml}
                 ${actionButton}
            </div>
         </div>
         ${isGray ? '<div class="anulled-overlay">NO COMPLETADA</div>' : ''}
      `;
      
      list.appendChild(card);
    }
  }

  // --- Modal Logic ---
  window.openMatchModalHome = async (id, type) => {
    const modal = document.getElementById("modal-partido-universal");
    const container = document.getElementById("modal-cuerpo");
    const title = document.getElementById("modal-titulo");
    const colName = (type || "").toLowerCase().includes("reto") ? "partidosReto" : "partidosAmistosos";

    if (title) title.textContent = "DETALLES";
    modal.classList.add("active");
    modal.style.visibility = "visible"; // Ensure visibility
    container.innerHTML = '<div class="p-5 text-center"><div class="loader-ring mx-auto"></div></div>';

    try {
      const snap = await getDocument(colName, id);
      if (snap) {
        const match = { id, ...snap };
        await renderMatchDetailsShared(container, match, currentUser, userData);
      } else {
        container.innerHTML = '<div class="p-4 text-center"><i class="fas fa-ghost mb-2"></i><p>El partido ya no existe.</p></div>';
      }
    } catch (error) {
      container.innerHTML = '<div class="p-4 text-center"><p>Error al cargar detalles.</p></div>';
    }
  };

  window.closeMatchModal = () => {
    const modal = document.getElementById("modal-partido-universal");
    if (modal) {
        modal.classList.remove("active");
        setTimeout(() => modal.style.visibility = "hidden", 300); // Wait for transition
    }
    closeChatSubscription();
  };

  // --- Global Expose ---
  window.executeMatchAction = async (action, id, type, extra = null) => {
    const success = await executeMatchActionShared(action, id, type, currentUser, userData, extra);
    if (success) {
      if (action === "delete") window.closeMatchModal();
      else {
        const colName = type.toLowerCase().includes("reto") ? "partidosReto" : "partidosAmistosos";
        const snap = await getDocument(colName, id);
        if (snap) await renderMatchDetailsShared(document.getElementById("modal-cuerpo"), { id, ...snap }, currentUser, userData);
        else window.closeMatchModal();
      }
      loadNextMatch(currentUser.uid);
      loadPendingMatches(currentUser.uid, currentFilter);
    }
  };

  window.showResultFormShared = showResultFormShared;
  window.executeSaveResultShared = async (id, type) => {
    await executeSaveResultShared(id, type);
    window.closeMatchModal();
    loadNextMatch(currentUser.uid);
    loadPendingMatches(currentUser.uid, currentFilter);
  };
  window.sendChatMessageShared = sendChatMessageShared;
  window.openSelectorShared = () => (window.location.href = "calendario.html");

  // --- Event Listeners ---
  const filterButtons = document.querySelectorAll(".toggle-btn-premium");
  if (filterButtons) {
    filterButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        filterButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        currentFilter = btn.dataset.filter;
        if (currentUser) loadPendingMatches(currentUser.uid, currentFilter);
      });
    });
  }
});
