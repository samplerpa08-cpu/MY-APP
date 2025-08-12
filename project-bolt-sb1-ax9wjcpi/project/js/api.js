/**
 * API client for Tour Plan Management App
 * Handles all communication with Netlify serverless functions
 */

class APIClient {
    constructor() {
        this.baseURL = window.location.origin + '/.netlify/functions';
        this.isOnline = navigator.onLine;
        this.setupOnlineListeners();
    }

    /**
     * Setup online/offline event listeners
     */
    setupOnlineListeners() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.processSyncQueue();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
        });
    }

    /**
     * Generic fetch wrapper with error handling
     */
    async fetchWithRetry(url, options = {}, maxRetries = 3) {
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
            },
            ...options
        };

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const response = await fetch(url, defaultOptions);
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.message || `HTTP ${response.status}`);
                }

                return await response.json();
            } catch (error) {
                if (attempt === maxRetries - 1) {
                    throw error;
                }
                
                // Exponential backoff
                const delay = Math.pow(2, attempt) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    /**
     * Get users list
     */
    async getUsers() {
        if (!this.isOnline) {
            return { ok: true, users: Object.keys(localStorage.getUsers()).map(name => ({
                name,
                isAdmin: localStorage.getUsers()[name].isAdmin || false
            })) };
        }

        try {
            const response = await this.fetchWithRetry(`${this.baseURL}/users`);
            
            // Update local storage with server data
            if (response.users) {
                const currentUsers = localStorage.getUsers();
                response.users.forEach(user => {
                    if (currentUsers[user.name]) {
                        localStorage.setUser(user.name, {
                            ...currentUsers[user.name],
                            isAdmin: user.isAdmin
                        });
                    }
                });
            }
            
            return response;
        } catch (error) {
            console.error('Failed to fetch users:', error);
            // Return local data as fallback
            return { ok: true, users: Object.keys(localStorage.getUsers()).map(name => ({
                name,
                isAdmin: localStorage.getUsers()[name].isAdmin || false
            })) };
        }
    }

    /**
     * Login user
     */
    async login(name, password) {
        // Always check local storage first for immediate response
        const localUsers = localStorage.getUsers();
        const localUser = localUsers[name];
        
        if (!localUser || localUser.password !== password) {
            return { ok: false, message: 'Invalid name or password' };
        }

        // If online, verify with server
        if (this.isOnline) {
            try {
                const response = await this.fetchWithRetry(`${this.baseURL}/login`, {
                    method: 'POST',
                    body: JSON.stringify({ name, password })
                });

                if (response.ok && response.plansForCurrentWeek) {
                    // Update local storage with server plans
                    const weekInfo = computeWeekStartIST();
                    const currentPlans = localStorage.getPlansForWeek(weekInfo.weekStartId);
                    
                    Object.entries(response.plansForCurrentWeek).forEach(([userName, userPlans]) => {
                        if (userPlans) {
                            localStorage.setPlan(weekInfo.weekStartId, userName, userPlans);
                        }
                    });
                }

                return response;
            } catch (error) {
                console.error('Server login failed, using local auth:', error);
            }
        }

        // Return local authentication result
        return {
            ok: true,
            isAdmin: localUser.isAdmin || false,
            plansForCurrentWeek: this.getLocalPlansForCurrentWeek()
        };
    }

    /**
     * Get local plans for current week
     */
    getLocalPlansForCurrentWeek() {
        const weekInfo = computeWeekStartIST();
        return localStorage.getPlansForWeek(weekInfo.weekStartId);
    }

    /**
     * Get plans for specific week
     */
    async getPlans(weekStartId) {
        // Always return local data first
        const localPlans = localStorage.getPlansForWeek(weekStartId);
        
        if (!this.isOnline) {
            return { ok: true, plans: localPlans };
        }

        try {
            const response = await this.fetchWithRetry(`${this.baseURL}/plans/get`, {
                method: 'POST',
                body: JSON.stringify({ weekStart: weekStartId })
            });

            if (response.ok && response.plans) {
                // Update local storage with server data
                Object.entries(response.plans).forEach(([userName, userPlans]) => {
                    if (userPlans) {
                        localStorage.setPlan(weekStartId, userName, userPlans);
                    }
                });
            }

            return response;
        } catch (error) {
            console.error('Failed to fetch plans:', error);
            return { ok: true, plans: localPlans };
        }
    }

    /**
     * Set user plan for week
     */
    async setPlan(weekStartId, userName, locations) {
        // Update local storage immediately
        localStorage.setPlan(weekStartId, userName, locations);

        if (!this.isOnline) {
            return { ok: true, message: 'Saved locally. Will sync when online.' };
        }

        try {
            const response = await this.fetchWithRetry(`${this.baseURL}/plans/set`, {
                method: 'POST',
                body: JSON.stringify({
                    weekStart: weekStartId,
                    name: userName,
                    locationsArray: locations
                })
            });

            return response;
        } catch (error) {
            console.error('Failed to save plan to server:', error);
            return { ok: true, message: 'Saved locally. Will sync when online.' };
        }
    }

    /**
     * Add new user
     */
    async addUser(name, password, isAdmin = false) {
        // Update local storage immediately
        localStorage.setUser(name, { password, isAdmin });

        if (!this.isOnline) {
            return { ok: true, message: 'User added locally. Will sync when online.' };
        }

        try {
            const response = await this.fetchWithRetry(`${this.baseURL}/users/add`, {
                method: 'POST',
                body: JSON.stringify({ name, password, isAdmin })
            });

            return response;
        } catch (error) {
            console.error('Failed to add user to server:', error);
            return { ok: true, message: 'User added locally. Will sync when online.' };
        }
    }

    /**
     * Delete user
     */
    async deleteUser(name) {
        // Update local storage immediately
        localStorage.removeUser(name);

        if (!this.isOnline) {
            return { ok: true, message: 'User removed locally. Will sync when online.' };
        }

        try {
            const response = await this.fetchWithRetry(`${this.baseURL}/users/delete`, {
                method: 'POST',
                body: JSON.stringify({ name })
            });

            return response;
        } catch (error) {
            console.error('Failed to delete user from server:', error);
            return { ok: true, message: 'User removed locally. Will sync when online.' };
        }
    }

    /**
     * Decrypt user password (admin only)
     */
    async decryptPassword(name) {
        // Return local password if offline
        if (!this.isOnline) {
            const localUsers = localStorage.getUsers();
            if (localUsers[name]) {
                return { ok: true, password: localUsers[name].password };
            }
            return { ok: false, message: 'User not found' };
        }

        try {
            const response = await this.fetchWithRetry(`${this.baseURL}/users/decrypt`, {
                method: 'POST',
                body: JSON.stringify({ name })
            });

            return response;
        } catch (error) {
            console.error('Failed to decrypt password:', error);
            // Fallback to local data
            const localUsers = localStorage.getUsers();
            if (localUsers[name]) {
                return { ok: true, password: localUsers[name].password };
            }
            return { ok: false, message: 'Failed to decrypt password' };
        }
    }

    /**
     * Add custom location
     */
    async addCustomLocation(userName, weekStartId, dayDate, location) {
        // Update local storage immediately
        localStorage.addCustomLocation(userName, weekStartId, dayDate, location);

        if (!this.isOnline) {
            return { ok: true, message: 'Custom location added locally. Will sync when online.' };
        }

        try {
            const response = await this.fetchWithRetry(`${this.baseURL}/custom/add`, {
                method: 'POST',
                body: JSON.stringify({
                    name: userName,
                    weekStart: weekStartId,
                    dayDate,
                    location
                })
            });

            return response;
        } catch (error) {
            console.error('Failed to add custom location to server:', error);
            return { ok: true, message: 'Custom location added locally. Will sync when online.' };
        }
    }

    /**
     * Get admin override
     */
    async getAdminOverride() {
        // Return local data first
        const localOverride = localStorage.getAdminOverride();
        
        if (!this.isOnline) {
            return { ok: true, override: localOverride };
        }

        try {
            const response = await this.fetchWithRetry(`${this.baseURL}/override`);
            
            if (response.ok && response.override) {
                // Update local storage
                if (response.override.adminName && response.override.overrideWeekStart) {
                    localStorage.setAdminOverride(
                        response.override.adminName,
                        response.override.overrideWeekStart
                    );
                } else {
                    localStorage.clearAdminOverride();
                }
            }

            return response;
        } catch (error) {
            console.error('Failed to get admin override:', error);
            return { ok: true, override: localOverride };
        }
    }

    /**
     * Set admin override
     */
    async setAdminOverride(adminName, overrideWeekStart) {
        // Update local storage immediately
        localStorage.setAdminOverride(adminName, overrideWeekStart);

        if (!this.isOnline) {
            return { ok: true, message: 'Override set locally. Will sync when online.' };
        }

        try {
            const response = await this.fetchWithRetry(`${this.baseURL}/override`, {
                method: 'POST',
                body: JSON.stringify({
                    adminName,
                    overrideWeekStart
                })
            });

            return response;
        } catch (error) {
            console.error('Failed to set admin override on server:', error);
            return { ok: true, message: 'Override set locally. Will sync when online.' };
        }
    }

    /**
     * Clear admin override
     */
    async clearAdminOverride() {
        // Update local storage immediately
        localStorage.clearAdminOverride();

        if (!this.isOnline) {
            return { ok: true, message: 'Override cleared locally. Will sync when online.' };
        }

        try {
            const response = await this.fetchWithRetry(`${this.baseURL}/override`, {
                method: 'POST',
                body: JSON.stringify({
                    adminName: null,
                    overrideWeekStart: null
                })
            });

            return response;
        } catch (error) {
            console.error('Failed to clear admin override on server:', error);
            return { ok: true, message: 'Override cleared locally. Will sync when online.' };
        }
    }

    /**
     * Process sync queue when coming back online
     */
    async processSyncQueue() {
        if (!this.isOnline) return;

        const queue = localStorage.getSyncQueue();
        if (queue.length === 0) return;

        console.log(`Processing ${queue.length} queued operations...`);

        for (const item of queue) {
            try {
                let success = false;

                switch (item.action) {
                    case 'user_update':
                        const userResponse = await this.addUser(
                            item.payload.name,
                            item.payload.userData.password,
                            item.payload.userData.isAdmin
                        );
                        success = userResponse.ok;
                        break;

                    case 'user_delete':
                        const deleteResponse = await this.deleteUser(item.payload.name);
                        success = deleteResponse.ok;
                        break;

                    case 'plan_update':
                        const planResponse = await this.setPlan(
                            item.payload.weekStartId,
                            item.payload.userName,
                            item.payload.locations
                        );
                        success = planResponse.ok;
                        break;

                    case 'custom_location_add':
                        const customResponse = await this.addCustomLocation(
                            item.payload.userName,
                            item.payload.weekStartId,
                            item.payload.dayDate,
                            item.payload.location
                        );
                        success = customResponse.ok;
                        break;

                    case 'admin_override':
                        const overrideResponse = await this.setAdminOverride(
                            item.payload.adminName,
                            item.payload.overrideWeekStart
                        );
                        success = overrideResponse.ok;
                        break;

                    case 'admin_override_clear':
                        const clearResponse = await this.clearAdminOverride();
                        success = clearResponse.ok;
                        break;

                    default:
                        console.warn('Unknown sync action:', item.action);
                        success = true; // Remove unknown actions from queue
                }

                if (success) {
                    localStorage.removeSyncItem(item.id);
                } else {
                    localStorage.updateSyncAttempts(item.id, item.attempts + 1);
                    
                    // Remove items that have failed too many times
                    if (item.attempts >= 5) {
                        localStorage.removeSyncItem(item.id);
                        console.warn('Removing failed sync item after 5 attempts:', item);
                    }
                }
            } catch (error) {
                console.error('Error processing sync item:', error);
                localStorage.updateSyncAttempts(item.id, item.attempts + 1);
            }
        }

        localStorage.setLastSync();
        console.log('Sync queue processing complete');
    }
}

// Create global API client instance
const apiClient = new APIClient();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = APIClient;
}