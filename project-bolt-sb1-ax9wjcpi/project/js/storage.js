/**
 * Local Storage Management for Tour Plan App
 */

class LocalStorage {
    constructor() {
        this.STORAGE_KEY = 'tour_plan_app';
        this.initializeStorage();
    }

    /**
     * Initialize storage with default structure
     */
    initializeStorage() {
        const defaultData = {
            users: {
                "Sahil Sharma": { password: "8371", isAdmin: false },
                "Vijay Kumar": { password: "4926", isAdmin: false },
                "Pawan Gupta": { password: "7149", isAdmin: false },
                "Sunil Suri": { password: "3652", isAdmin: false },
                "Sudhir Kumar": { password: "9211", isAdmin: true }
            },
            plans: {},
            customLocations: {},
            adminOverride: null,
            syncQueue: [],
            lastSync: null
        };

        const existing = this.getData();
        if (!existing || Object.keys(existing).length === 0) {
            this.saveData(defaultData);
        } else {
            // Merge with defaults to ensure all keys exist
            const merged = { ...defaultData, ...existing };
            this.saveData(merged);
        }
    }

    /**
     * Get all data from localStorage
     */
    getData() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : {};
        } catch (error) {
            console.error('Error reading from localStorage:', error);
            return {};
        }
    }

    /**
     * Save all data to localStorage
     */
    saveData(data) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Error saving to localStorage:', error);
            return false;
        }
    }

    /**
     * Get users list
     */
    getUsers() {
        const data = this.getData();
        return data.users || {};
    }

    /**
     * Add or update user
     */
    setUser(name, userData) {
        const data = this.getData();
        if (!data.users) data.users = {};
        data.users[name] = userData;
        this.saveData(data);
        
        // Add to sync queue
        this.addToSyncQueue('user_update', { name, userData });
    }

    /**
     * Remove user and all their data
     */
    removeUser(name) {
        const data = this.getData();
        
        // Remove from users
        if (data.users) {
            delete data.users[name];
        }
        
        // Remove all plans for this user
        if (data.plans) {
            Object.keys(data.plans).forEach(weekId => {
                if (data.plans[weekId][name]) {
                    delete data.plans[weekId][name];
                }
            });
        }
        
        // Remove all custom locations for this user
        if (data.customLocations && data.customLocations[name]) {
            delete data.customLocations[name];
        }
        
        this.saveData(data);
        
        // Add to sync queue
        this.addToSyncQueue('user_delete', { name });
    }

    /**
     * Get plans for a specific week
     */
    getPlansForWeek(weekStartId) {
        const data = this.getData();
        return data.plans[weekStartId] || {};
    }

    /**
     * Set plan for user and week
     */
    setPlan(weekStartId, userName, locations) {
        const data = this.getData();
        if (!data.plans) data.plans = {};
        if (!data.plans[weekStartId]) data.plans[weekStartId] = {};
        
        data.plans[weekStartId][userName] = locations;
        this.saveData(data);
        
        // Add to sync queue
        this.addToSyncQueue('plan_update', {
            weekStartId,
            userName,
            locations
        });
    }

    /**
     * Get custom locations for user
     */
    getCustomLocations(userName) {
        const data = this.getData();
        return data.customLocations[userName] || {};
    }

    /**
     * Add custom location
     */
    addCustomLocation(userName, weekStartId, dayDate, location) {
        const data = this.getData();
        if (!data.customLocations) data.customLocations = {};
        if (!data.customLocations[userName]) data.customLocations[userName] = {};
        if (!data.customLocations[userName][weekStartId]) {
            data.customLocations[userName][weekStartId] = {};
        }
        
        data.customLocations[userName][weekStartId][dayDate] = location;
        this.saveData(data);
        
        // Add to sync queue
        this.addToSyncQueue('custom_location_add', {
            userName,
            weekStartId,
            dayDate,
            location
        });
    }

    /**
     * Get admin override settings
     */
    getAdminOverride() {
        const data = this.getData();
        return data.adminOverride;
    }

    /**
     * Set admin override
     */
    setAdminOverride(adminName, overrideWeekStart) {
        const data = this.getData();
        data.adminOverride = {
            adminName,
            overrideWeekStart,
            timestamp: new Date().toISOString()
        };
        this.saveData(data);
        
        // Add to sync queue
        this.addToSyncQueue('admin_override', {
            adminName,
            overrideWeekStart
        });
    }

    /**
     * Clear admin override
     */
    clearAdminOverride() {
        const data = this.getData();
        data.adminOverride = null;
        this.saveData(data);
        
        // Add to sync queue
        this.addToSyncQueue('admin_override_clear', {});
    }

    /**
     * Add item to sync queue
     */
    addToSyncQueue(action, payload) {
        const data = this.getData();
        if (!data.syncQueue) data.syncQueue = [];
        
        data.syncQueue.push({
            id: Date.now() + Math.random(),
            action,
            payload,
            timestamp: new Date().toISOString(),
            attempts: 0
        });
        
        this.saveData(data);
    }

    /**
     * Get sync queue items
     */
    getSyncQueue() {
        const data = this.getData();
        return data.syncQueue || [];
    }

    /**
     * Remove item from sync queue
     */
    removeSyncItem(itemId) {
        const data = this.getData();
        if (data.syncQueue) {
            data.syncQueue = data.syncQueue.filter(item => item.id !== itemId);
            this.saveData(data);
        }
    }

    /**
     * Update sync item attempts
     */
    updateSyncAttempts(itemId, attempts) {
        const data = this.getData();
        if (data.syncQueue) {
            const item = data.syncQueue.find(item => item.id === itemId);
            if (item) {
                item.attempts = attempts;
                this.saveData(data);
            }
        }
    }

    /**
     * Mark last sync time
     */
    setLastSync(timestamp = new Date().toISOString()) {
        const data = this.getData();
        data.lastSync = timestamp;
        this.saveData(data);
    }

    /**
     * Get last sync time
     */
    getLastSync() {
        const data = this.getData();
        return data.lastSync;
    }

    /**
     * Clear all data (for testing/reset)
     */
    clearAll() {
        try {
            localStorage.removeItem(this.STORAGE_KEY);
            this.initializeStorage();
            return true;
        } catch (error) {
            console.error('Error clearing localStorage:', error);
            return false;
        }
    }

    /**
     * Export data for backup
     */
    exportData() {
        return this.getData();
    }

    /**
     * Import data from backup
     */
    importData(data) {
        try {
            this.saveData(data);
            return true;
        } catch (error) {
            console.error('Error importing data:', error);
            return false;
        }
    }

    /**
     * Get storage usage info
     */
    getStorageInfo() {
        try {
            const data = JSON.stringify(this.getData());
            const sizeInBytes = new Blob([data]).size;
            const sizeInKB = (sizeInBytes / 1024).toFixed(2);
            
            return {
                sizeInBytes,
                sizeInKB,
                itemCount: Object.keys(this.getData()).length
            };
        } catch (error) {
            console.error('Error getting storage info:', error);
            return null;
        }
    }
}

// Create global instance
const localStorage = new LocalStorage();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LocalStorage;
}