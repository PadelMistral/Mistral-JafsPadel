import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyA7Q90torM2Hvjidd5A3K2R90btsgt-d94",
  authDomain: "padeluminatis.firebaseapp.com",
  projectId: "padeluminatis",
  storageBucket: "padeluminatis.appspot.com",
  messagingSenderId: "40241508403",
  appId: "1:40241508403:web:c4d3bbd19370dcf3173346",
  measurementId: "G-079Q6DEQCG"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Hacer Firebase disponible globalmente
window.firebase = { app, auth, db, storage };
window.db = db;
window.getDocs = getDocs;
window.collection = collection;
window.doc = doc;
window.getDoc = getDoc;

// Exportar para módulos ES6
export { auth, db, app, storage };

console.log('✅ Firebase configurado correctamente desde js/firebase-config.js');