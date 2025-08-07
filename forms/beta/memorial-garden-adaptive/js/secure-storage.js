/**
 * Secure Storage Utility for Memorial Garden Forms
 * Provides encrypted localStorage/sessionStorage with automatic cleanup
 * 
 * Security Features:
 * - XOR encryption for sensitive data
 * - Automatic expiration of stored data
 * - Sanitized keys to prevent injection
 * - Secure deletion of expired data
 */

class SecureStorage {
    constructor() {
        // Simple encryption key derived from session
        this.encryptionKey = this.generateSessionKey();
        
        // Auto-cleanup on initialization
        this.cleanupExpiredData();
    }
    
    /**
     * Generate a session-based encryption key
     * @returns {string} Encryption key
     */
    generateSessionKey() {
        // Use session start time and navigator properties for key
        const sessionStart = Date.now().toString();
        const navigator_info = (navigator.userAgent + navigator.language).slice(0, 32);
        return btoa(sessionStart + navigator_info).slice(0, 32);
    }
    
    /**
     * Simple XOR encryption for sensitive data
     * @param {string} text - Text to encrypt
     * @param {string} key - Encryption key
     * @returns {string} Encrypted text
     */
    encrypt(text, key) {
        let result = '';
        for (let i = 0; i < text.length; i++) {
            result += String.fromCharCode(
                text.charCodeAt(i) ^ key.charCodeAt(i % key.length)
            );
        }
        return btoa(result);
    }
    
    /**
     * Decrypt XOR encrypted data
     * @param {string} encrypted - Encrypted text
     * @param {string} key - Encryption key
     * @returns {string} Decrypted text
     */
    decrypt(encrypted, key) {
        try {
            const text = atob(encrypted);
            let result = '';
            for (let i = 0; i < text.length; i++) {
                result += String.fromCharCode(
                    text.charCodeAt(i) ^ key.charCodeAt(i % key.length)
                );
            }
            return result;
        } catch (e) {
            console.warn('Failed to decrypt data:', e.message);
            return null;
        }
    }
    
    /**
     * Sanitize storage key to prevent injection
     * @param {string} key - Original key
     * @returns {string} Sanitized key
     */
    sanitizeKey(key) {
        return key.replace(/[^a-zA-Z0-9_-]/g, '_');
    }
    
    /**
     * Store encrypted data with expiration
     * @param {string} key - Storage key
     * @param {any} value - Value to store
     * @param {Object} options - Storage options
     * @param {number} options.expiryMinutes - Minutes until expiration (default: 60)
     * @param {boolean} options.session - Use sessionStorage instead of localStorage
     * @param {boolean} options.sensitive - Encrypt sensitive data (default: true)
     */
    setItem(key, value, options = {}) {
        const {
            expiryMinutes = 60,
            session = true, // Default to session storage for security
            sensitive = true
        } = options;
        
        const sanitizedKey = this.sanitizeKey(key);
        const storage = session ? sessionStorage : localStorage;
        
        try {
            // Create storage object with metadata
            const storageObject = {
                value: value,
                timestamp: Date.now(),
                expiry: Date.now() + (expiryMinutes * 60 * 1000),
                encrypted: sensitive
            };
            
            let dataToStore;
            if (sensitive) {
                // Encrypt sensitive data
                const jsonString = JSON.stringify(storageObject);
                dataToStore = this.encrypt(jsonString, this.encryptionKey);
            } else {
                // Store non-sensitive data as-is
                dataToStore = JSON.stringify(storageObject);
            }
            
            storage.setItem(sanitizedKey, dataToStore);
            
        } catch (error) {
            console.warn('SecureStorage: Failed to store data:', error.message);
        }
    }
    
    /**
     * Retrieve and decrypt stored data
     * @param {string} key - Storage key
     * @param {boolean} session - Use sessionStorage instead of localStorage
     * @returns {any} Retrieved value or null if not found/expired
     */
    getItem(key, session = true) {
        const sanitizedKey = this.sanitizeKey(key);
        const storage = session ? sessionStorage : localStorage;
        
        try {
            const storedData = storage.getItem(sanitizedKey);
            if (!storedData) return null;
            
            let storageObject;
            
            // Try to decrypt if it looks encrypted (base64)
            if (this.isBase64(storedData)) {
                const decrypted = this.decrypt(storedData, this.encryptionKey);
                if (!decrypted) return null;
                storageObject = JSON.parse(decrypted);
            } else {
                // Plain JSON data
                storageObject = JSON.parse(storedData);
            }
            
            // Check expiration
            if (Date.now() > storageObject.expiry) {
                storage.removeItem(sanitizedKey);
                return null;
            }
            
            return storageObject.value;
            
        } catch (error) {
            console.warn('SecureStorage: Failed to retrieve data:', error.message);
            storage.removeItem(sanitizedKey); // Clean up corrupted data
            return null;
        }
    }
    
    /**
     * Remove item from storage
     * @param {string} key - Storage key
     * @param {boolean} session - Use sessionStorage instead of localStorage
     */
    removeItem(key, session = true) {
        const sanitizedKey = this.sanitizeKey(key);
        const storage = session ? sessionStorage : localStorage;
        storage.removeItem(sanitizedKey);
    }
    
    /**
     * Check if string is base64 encoded
     * @param {string} str - String to check
     * @returns {boolean} True if base64
     */
    isBase64(str) {
        try {
            return btoa(atob(str)) === str;
        } catch (err) {
            return false;
        }
    }
    
    /**
     * Clean up expired data from both storage types
     */
    cleanupExpiredData() {
        [localStorage, sessionStorage].forEach(storage => {
            const keysToRemove = [];
            
            for (let i = 0; i < storage.length; i++) {
                const key = storage.key(i);
                if (!key) continue;
                
                try {
                    const storedData = storage.getItem(key);
                    if (!storedData) continue;
                    
                    let storageObject;
                    if (this.isBase64(storedData)) {
                        const decrypted = this.decrypt(storedData, this.encryptionKey);
                        if (!decrypted) {
                            keysToRemove.push(key);
                            continue;
                        }
                        storageObject = JSON.parse(decrypted);
                    } else {
                        storageObject = JSON.parse(storedData);
                    }
                    
                    // Mark expired items for removal
                    if (storageObject.expiry && Date.now() > storageObject.expiry) {
                        keysToRemove.push(key);
                    }
                    
                } catch (error) {
                    // Remove corrupted data
                    keysToRemove.push(key);
                }
            }
            
            // Remove expired/corrupted items
            keysToRemove.forEach(key => storage.removeItem(key));
        });
    }
    
    /**
     * Clear all memorial garden related data
     */
    clearAllMemorialData() {
        const memorialKeys = [
            'memorialGardenJourney',
            'journeyStartTime', 
            'informationReadiness',
            'helperRelationship',
            'callbackRequested',
            'collaborativeSetup',
            'familyFormData',
            'prepaymentSearch',
            'assistedRequest',
            'assistedFormData',
            'futurePlanningData',
            'guidedRelationship',
            'memorialGardenFuture',
            'memorialGardenState',
            'discoveryTiming',
            'discoveryConnection',
            'helperRequest',
            'spouseFormData',
            'callbackRequest'
        ];
        
        memorialKeys.forEach(key => {
            this.removeItem(key, true);  // sessionStorage
            this.removeItem(key, false); // localStorage
        });
        
        console.log('SecureStorage: Cleared all memorial garden data');
    }
}

// Create global instance
window.SecureStorage = window.SecureStorage || new SecureStorage();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SecureStorage;
}