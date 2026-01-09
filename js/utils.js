// js/utils.js

/**
 * Formats a date string or Date object into a localized string.
 * @param {string | Date | {toDate: Function}} dateInput - The date input. Can be a string, Date object, or Firestore Timestamp object.
 * @returns {string} The formatted date string.
 */
export function formatDate(dateInput) {
    let date;
    if (dateInput && typeof dateInput.toDate === 'function') {
        // Firestore Timestamp
        date = dateInput.toDate();
    } else if (typeof dateInput === 'string' || dateInput instanceof Date) {
        // ISO string or Date object
        date = new Date(dateInput);
    } else {
        return 'Fecha inválida';
    }

    const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return date.toLocaleDateString('es-ES', options);
}
