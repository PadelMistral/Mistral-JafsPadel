// Service Worker para Padeluminatis (versión definitiva)
const CACHE_NAME = "padeluminatis-v7";
const BASE_PATH = "/padeluminatis/";

const ASSETS = [
  // Raíz y páginas HTML
  `${BASE_PATH}`,
  `${BASE_PATH}index.html`,
  `${BASE_PATH}home.html`,
  `${BASE_PATH}calendario.html`,
  `${BASE_PATH}eventos.html`,
  `${BASE_PATH}chat.html`,
  `${BASE_PATH}perfil.html`,
  `${BASE_PATH}admin.html`,
  `${BASE_PATH}puntosRanking.html`,
  `${BASE_PATH}normas.html`,
  `${BASE_PATH}notificaciones.html`,
  `${BASE_PATH}perfil-usuario.html`,

  // CSS
  `${BASE_PATH}css/app.css`,
  `${BASE_PATH}css/shared-utils.css`,
  `${BASE_PATH}css/calendar-view.css`,
  `${BASE_PATH}css/time-slots.css`,
  `${BASE_PATH}css/notifications.css`,
  `${BASE_PATH}css/bottom-nav.css`,
  `${BASE_PATH}css/modals.css`,
  `${BASE_PATH}css/loading.css`,
  `${BASE_PATH}css/calendario.css`,
  `${BASE_PATH}css/admin.css`,
  `${BASE_PATH}css/chat.css`,
  `${BASE_PATH}css/clasificacion.css`,
  `${BASE_PATH}css/perfil.css`,
  `${BASE_PATH}css/perfil-usuario.css`,
  `${BASE_PATH}css/puntosRanking.css`,

  // JavaScript
  `${BASE_PATH}js/admin.js`,
  `${BASE_PATH}js/auth.js`,
  `${BASE_PATH}js/calendario.js`,
  `${BASE_PATH}js/chat.js`,
  `${BASE_PATH}js/clasificacion.js`,
  `${BASE_PATH}js/elo-system.js`,
  `${BASE_PATH}js/enlaceAdmin.js`,
  `${BASE_PATH}js/notificaciones.js`,
  `${BASE_PATH}js/perfil.js`,
  `${BASE_PATH}js/perfil-usuario.js`,
  `${BASE_PATH}js/recuperar.js`,
  `${BASE_PATH}js/registro.js`,
  `${BASE_PATH}js/usuario.js`,

  // Imágenes (verifica nombres exactos)
  `${BASE_PATH}imagenes/158877-1920x1200-desktop-hd-tennis-wallpaper-image.jpg`,
  `${BASE_PATH}imagenes/5c0e4dc8-3bc6-4692-9e73-47d471dcd846.webp`,
  `${BASE_PATH}imagenes/Logojafs.png`,
  `${BASE_PATH}imagenes/Screenshot_20210512-180610_YouTube.jpg`,
  `${BASE_PATH}imagenes/casa.jpg`,
  `${BASE_PATH}imagenes/chevron-down-svgrepo-com.svg`,
];

// ===== Instalación =====
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ===== Estrategia de caché =====
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

// ===== Limpieza de caché antigua =====
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => (key !== CACHE_NAME ? caches.delete(key) : null))
        ).then(() => self.clients.claim())
      )
  );
});

// ===== Firebase Messaging (Notificaciones Push) =====

// Importar los scripts de Firebase
importScripts(
  "https://www.gstatic.com/firebasejs/11.7.3/firebase-app-compat.js"
);
importScripts(
  "https://www.gstatic.com/firebasejs/11.7.3/firebase-messaging-compat.js"
);

// Tu configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyA7Q90torM2Hvjidd5A3K2R90btsgt-d94",
  authDomain: "padeluminatis.firebaseapp.com",
  projectId: "padeluminatis",
  storageBucket: "padeluminatis.appspot.com",
  messagingSenderId: "40241508403",
  appId: "1:40241508403:web:c4d3bbd19370dcf3173346",
  measurementId: "G-079Q6DEQCG",
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Manejador para notificaciones en segundo plano
messaging.onBackgroundMessage(function (payload) {
  console.log("[service-worker.js] Received background message ", payload);

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: payload.notification.icon || "/padeluminatis/imagenes/Logojafs.png",
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Manejador de evento 'push' (opcional, onBackgroundMessage suele ser suficiente)
self.addEventListener("push", (event) => {
  console.log("[service-worker.js] Push Received.");
  // Aquí puedes personalizar aún más cómo se muestra la notificación si es necesario
});

// Manejador de clic en la notificación
self.addEventListener("notificationclick", (event) => {
  console.log("[service-worker.js] Notification click Received.");
  event.notification.close();
  event.waitUntil(clients.openWindow("/padeluminatis/notificaciones.html"));
});
