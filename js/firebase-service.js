// js/firebase-service.js
import { auth, db, app } from './firebase-config.js';
import { 
    onAuthStateChanged,
    signOut,
    setPersistence,
    browserLocalPersistence,
    signInWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithPopup,
    createUserWithEmailAndPassword,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";
import {
    collection,
    doc,
    getDocs,
    getDoc,
    setDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    serverTimestamp,
    writeBatch,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-storage.js";

/**
 * Signs in a user with email and password.
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<Object>}
 */
export async function loginUser(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return userCredential.user;
    } catch (error) {
        console.error("Error signing in:", error);
        throw error;
    }
}

/**
 * Signs in a user with Google.
 * @returns {Promise<Object>}
 */
export async function loginWithGoogle() {
    try {
        const provider = new GoogleAuthProvider();
        const userCredential = await signInWithPopup(auth, provider);
        return userCredential.user;
    } catch (error) {
        console.error("Error signing in with Google:", error);
        throw error;
    }
}

/**
 * Registers a new user and creates their profile in Firestore.
 * @param {string} email 
 * @param {string} password 
 * @param {Object} userData 
 * @returns {Promise<Object>}
 */
export async function registerUser(email, password, userData) {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Save user data to Firestore
        await setDoc(doc(db, "usuarios", user.uid), {
            uid: user.uid,
            email: user.email,
            rol: 'Jugador', // Default role
            aprobado: false, // Wait for admin approval
            fechaRegistro: serverTimestamp(),
            ...userData
        });
        
        return user;
    } catch (error) {
        console.error("Error registering user:", error);
        throw error;
    }
}

/**
 * Sends a password reset email.
 * @param {string} email 
 */
export async function resetPassword(email) {
    try {
        await sendPasswordResetEmail(auth, email);
    } catch (error) {
        console.error("Error sending password reset email:", error);
        throw error;
    }
}

/**
 * Initializes Firebase authentication state observer.
 * @param {Function} callback - The callback function to be called with the user object or null.
 * @returns {Function} An unsubscribe function.
 */
export function initializeAuthObserver(callback) {
    return onAuthStateChanged(auth, callback);
}

/**
 * Gets the current authenticated user.
 * @returns {Object|null} The current user object or null if not authenticated.
 */
export function getCurrentUser() {
    return auth.currentUser;
}

/**
 * Sets Firebase authentication persistence.
 * @param {string} persistenceType - The persistence type (e.g., 'local', 'session', 'none').
 * @returns {Promise<void>} A promise that resolves when persistence is set.
 */
export async function setAuthPersistence(persistenceType) {
    let persistence;
    switch (persistenceType) {
        case 'local':
            persistence = browserLocalPersistence;
            break;
        // Add other persistence types if needed
        default:
            persistence = browserLocalPersistence; // Default to local
    }
    return setPersistence(auth, persistence);
}

// Set local persistence by default to keep session active
setPersistence(auth, browserLocalPersistence).catch(e => console.error("Persistence error:", e));

/**
 * Signs out the current user.
 * @returns {Promise<void>} A promise that resolves when the user is signed out.
 */
export function signOutUser() {
    return signOut(auth);
}

/**
 * Gets a document from a Firestore collection.
 * @param {string} collectionName - The name of the collection.
 * @param {string} documentId - The ID of the document.
 * @returns {Promise<Object|null>} A promise that resolves with the document data or null if not found.
 */
export async function getDocument(collectionName, documentId) {
    try {
        const docRef = doc(db, collectionName, documentId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() };
        }
        return null;
    } catch (error) {
        console.error(`Error getting document ${documentId} from ${collectionName}:`, error);
        throw error;
    }
}

/**
 * Gets all documents from a Firestore collection.
 * @param {string} collectionName - The name of the collection.
 * @param {Array} conditions - Optional array of query conditions (e.g., [['field', '==', 'value']]).
 * @param {Array} orders - Optional array of order by clauses (e.g., [['field', 'asc']]).
 * @param {number} limitCount - Optional limit for the number of documents.
 * @returns {Promise<Array>} A promise that resolves with an array of document data.
 */
export async function getCollection(collectionName, conditions = [], orders = [], limitCount = null) {
    try {
        let q = collection(db, collectionName);
        conditions.forEach(cond => {
            q = query(q, where(cond[0], cond[1], cond[2]));
        });
        orders.forEach(order => {
            q = query(q, orderBy(order[0], order[1]));
        });
        if (limitCount) {
            q = query(q, limit(limitCount));
        }
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error(`Error getting collection ${collectionName}:`, error);
        throw error;
    }
}

/**
 * Adds a new document to a Firestore collection.
 * @param {string} collectionName - The name of the collection.
 * @param {Object} data - The data for the new document.
 * @returns {Promise<string>} A promise that resolves with the ID of the new document.
 */
export async function addDocument(collectionName, data) {
    try {
        const docRef = await addDoc(collection(db, collectionName), {
            ...data,
            createdAt: serverTimestamp()
        });
        return docRef.id;
    } catch (error) {
        console.error(`Error adding document to ${collectionName}:`, error);
        throw error;
    }
}

/**
 * Sets a document in a Firestore collection (creates or overwrites).
 * @param {string} collectionName - The name of the collection.
 * @param {string} documentId - The ID of the document to set.
 * @param {Object} data - The data for the document.
 * @returns {Promise<void>} A promise that resolves when the document is set.
 */
export function setDocument(collectionName, documentId, data) {
    try {
        return setDoc(doc(db, collectionName, documentId), data);
    } catch (error) {
        console.error(`Error setting document ${documentId} in ${collectionName}:`, error);
        throw error;
    }
}

/**
 * Updates an existing document in a Firestore collection.
 * @param {string} collectionName - The name of the collection.
 * @param {string} documentId - The ID of the document to update.
 * @param {Object} data - The data to update.
 * @returns {Promise<void>} A promise that resolves when the document is updated.
 */
export function updateDocument(collectionName, documentId, data) {
    try {
        return updateDoc(doc(db, collectionName, documentId), data);
    } catch (error) {
        console.error(`Error updating document ${documentId} in ${collectionName}:`, error);
        throw error;
    }
}

/**
 * Deletes a document from a Firestore collection.
 * @param {string} collectionName - The name of the collection.
 * @param {string} documentId - The ID of the document to delete.
 * @returns {Promise<void>} A promise that resolves when the document is deleted.
 */
export function deleteDocument(collectionName, documentId) {
    try {
        return deleteDoc(doc(db, collectionName, documentId));
    } catch (error) {
        console.error(`Error deleting document ${documentId} from ${collectionName}:`, error);
        throw error;
    }
}

/**
 * Returns a Firestore Timestamp object for the current server time.
 * @returns {Object} A Firestore Timestamp object.
 */
export function getTimestamp() {
    return serverTimestamp();
}

/**
 * Executes a batch of Firestore write operations.
 * @param {Array<Object>} operations - An array of operations, each with type ('set', 'update', 'delete') and data.
 *   Example: [{ type: 'set', collection: 'users', id: 'user1', data: { name: 'Test' } }]
 * @returns {Promise<void>} A promise that resolves when the batch is committed.
 */
export async function executeBatch(operations) {
    const batch = writeBatch(db);
    operations.forEach(op => {
        const docRef = doc(db, op.collection, op.id);
        if (op.type === 'set') {
            batch.set(docRef, op.data);
        } else if (op.type === 'update') {
            batch.update(docRef, op.data);
        } else if (op.type === 'delete') {
            batch.delete(docRef);
        }
    });
    return batch.commit();
}

/**
 * Subscribes to real-time updates from a Firestore collection or document.
 * @param {string} collectionName - The name of the collection.
 * @param {string} documentId - Optional. The ID of the document to listen to. If not provided, listens to the entire collection.
 * @param {Function} callback - The callback function to be called with the data.
 * @param {Array} conditions - Optional array of query conditions.
 * @param {Array} orders - Optional array of order by clauses.
 * @returns {Function} An unsubscribe function to stop listening for updates.
 */
export function subscribeToCollection(collectionName, callback, conditions = [], orders = []) {
    let q = collection(db, collectionName);
    conditions.forEach(cond => {
        q = query(q, where(cond[0], cond[1], cond[2]));
    });
    orders.forEach(order => {
        q = query(q, orderBy(order[0], order[1]));
    });
    return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(data);
    }, (error) => {
        console.error(`Error subscribing to collection ${collectionName}:`, error);
    });
}

export function subscribeToDocument(collectionName, documentId, callback) {
    const docRef = doc(db, collectionName, documentId);
    return onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            callback({ id: docSnap.id, ...docSnap.data() });
        } else {
            callback(null);
        }
    }, (error) => {
        console.error(`Error subscribing to document ${documentId} in ${collectionName}:`, error);
    });
}


// Storage Functions (Imports moved to top)
import { storage } from './firebase-config.js';

/**
 * Uploads a file to Firebase Storage.
 * @param {string} path - The path where the file should be saved (e.g., 'users/uid/profile.jpg').
 * @param {File} file - The file object to upload.
 * @returns {Promise<Object>} A promise that resolves with the upload snapshot.
 */
export async function uploadFile(path, file) {
    try {
        const storageRef = ref(storage, path);
        const snapshot = await uploadBytes(storageRef, file);
        return snapshot;
    } catch (error) {
        console.error("Error uploading file:", error);
        throw error;
    }
}

/**
 * Gets the download URL for a file in Firebase Storage.
 * @param {string} path - The path of the file.
 * @returns {Promise<string>} A promise that resolves with the download URL.
 */
export async function getFileDownloadURL(path) {
    try {
        const storageRef = ref(storage, path);
        const url = await getDownloadURL(storageRef);
        return url;
    } catch (error) {
        console.error("Error getting download URL:", error);
        throw error;
    }
}
