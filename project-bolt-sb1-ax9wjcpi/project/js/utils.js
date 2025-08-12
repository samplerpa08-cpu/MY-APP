/**
 * Utility functions for the Tour Plan Management App
 */

/**
 * computeWeekStartIST
 * @param {Date} date - optional, defaults to new Date()
 * @param {string|null} overrideDateISO - optional admin override date in ISO (null default)
 * @returns {
 *   weekStartId: "YYYYMMDD",
 *   headers: ["11/Aug/25", ...], // Mon->Sun display headers
 *   dayDates: ["2025-08-11", ...] // ISO dates for Mon->Sun in IST timezone
 * }
 */
function computeWeekStartIST(date = new Date(), overrideDateISO = null) {
    // Use override date if provided
    if (overrideDateISO) {
        date = new Date(overrideDateISO + 'T00:00:00.000Z');
    }
    
    // Convert to IST (UTC+5:30)
    const IST_OFFSET = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in milliseconds
    const istDate = new Date(date.getTime() + IST_OFFSET);
    
    // Find Monday of the current week
    const dayOfWeek = istDate.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
    const mondayOffset = dayOfWeek === 0 ? -6 : -(dayOfWeek - 1); // Calculate offset to Monday
    
    const mondayDate = new Date(istDate);
    mondayDate.setUTCDate(istDate.getUTCDate() + mondayOffset);
    
    // Generate week start ID (YYYYMMDD format)
    const year = mondayDate.getUTCFullYear();
    const month = String(mondayDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(mondayDate.getUTCDate()).padStart(2, '0');
    const weekStartId = `${year}${month}${day}`;
    
    // Generate headers and day dates for Mon->Sun
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const headers = [];
    const dayDates = [];
    
    for (let i = 0; i < 7; i++) {
        const currentDay = new Date(mondayDate);
        currentDay.setUTCDate(mondayDate.getUTCDate() + i);
        
        // Format: DD/Mon/YY (e.g., 11/Aug/25)
        const dayNum = String(currentDay.getUTCDate()).padStart(2, '0');
        const monthName = monthNames[currentDay.getUTCMonth()];
        const yearShort = String(currentDay.getUTCFullYear()).slice(-2);
        headers.push(`${dayNum}/${monthName}/${yearShort}`);
        
        // ISO date format for storage
        const isoYear = currentDay.getUTCFullYear();
        const isoMonth = String(currentDay.getUTCMonth() + 1).padStart(2, '0');
        const isoDay = String(currentDay.getUTCDate()).padStart(2, '0');
        dayDates.push(`${isoYear}-${isoMonth}-${isoDay}`);
    }
    
    return {
        weekStartId,
        headers,
        dayDates
    };
}

/**
 * Format date for display (DD/Mon/YY)
 */
function formatDateDisplay(date) {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = monthNames[date.getMonth()];
    const year = String(date.getFullYear()).slice(-2);
    
    return `${day}/${month}/${year}`;
}

/**
 * Generate strong random key for encryption
 */
function generateRandomKey(length = 32) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Debounce function to limit API calls
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Deep clone object
 */
function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => deepClone(item));
    if (typeof obj === 'object') {
        const clonedObj = {};
        Object.keys(obj).forEach(key => {
            clonedObj[key] = deepClone(obj[key]);
        });
        return clonedObj;
    }
}

/**
 * Validate 4-digit password
 */
function isValidPassword(password) {
    return /^[0-9]{4}$/.test(password);
}

/**
 * Sanitize string for safe display
 */
function sanitizeString(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[<>&"']/g, function(match) {
        const escape = {
            '<': '&lt;',
            '>': '&gt;',
            '&': '&amp;',
            '"': '&quot;',
            "'": '&#x27;'
        };
        return escape[match];
    });
}

/**
 * Format location list for copying
 */
function formatLocationList(locations, format = 'vertical') {
    if (!Array.isArray(locations)) return '';
    
    const separator = format === 'vertical' ? '\n' : '\t';
    return locations.join(separator);
}

/**
 * Check if user is online
 */
function isOnline() {
    return navigator.onLine;
}

/**
 * Show loading state on button
 */
function setButtonLoading(button, loading = true) {
    const spinner = button.querySelector('.btn-spinner');
    const text = button.querySelector('.btn-text');
    
    if (loading) {
        button.disabled = true;
        if (spinner) spinner.classList.remove('hidden');
        if (text) text.style.opacity = '0.7';
    } else {
        button.disabled = false;
        if (spinner) spinner.classList.add('hidden');
        if (text) text.style.opacity = '1';
    }
}

/**
 * Retry with exponential backoff
 */
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
    let lastError;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            
            if (attempt === maxRetries - 1) {
                throw lastError;
            }
            
            const delay = baseDelay * Math.pow(2, attempt);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    throw lastError;
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        computeWeekStartIST,
        formatDateDisplay,
        generateRandomKey,
        debounce,
        deepClone,
        isValidPassword,
        sanitizeString,
        formatLocationList,
        isOnline,
        setButtonLoading,
        retryWithBackoff
    };
}