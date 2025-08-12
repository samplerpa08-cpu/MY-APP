/**
 * Authentication management for Tour Plan Management App
 */

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.isLoggedIn = false;
        this.isAdmin = false;
        this.listeners = [];
    }

    /**
     * Add authentication state change listener
     */
    addListener(callback) {
        this.listeners.push(callback);
    }

    /**
     * Remove authentication state change listener
     */
    removeListener(callback) {
        this.listeners = this.listeners.filter(listener => listener !== callback);
    }

    /**
     * Notify all listeners of auth state change
     */
    notifyListeners() {
        this.listeners.forEach(callback => {
            callback({
                isLoggedIn: this.isLoggedIn,
                currentUser: this.currentUser,
                isAdmin: this.isAdmin
            });
        });
    }

    /**
     * Attempt to login with credentials
     */
    async login(name, password) {
        try {
            if (!name || !password) {
                throw new Error('Name and password are required');
            }

            if (!isValidPassword(password)) {
                throw new Error('Password must be 4 digits');
            }

            const response = await apiClient.login(name, password);

            if (!response.ok) {
                throw new Error(response.message || 'Login failed');
            }

            // Set authentication state
            this.currentUser = name;
            this.isLoggedIn = true;
            this.isAdmin = response.isAdmin || false;

            // Store session info
            sessionStorage.setItem('currentUser', name);
            sessionStorage.setItem('isAdmin', String(this.isAdmin));

            this.notifyListeners();

            return {
                success: true,
                isAdmin: this.isAdmin,
                plans: response.plansForCurrentWeek || {}
            };

        } catch (error) {
            console.error('Login error:', error);
            return {
                success: false,
                message: error.message || 'Login failed'
            };
        }
    }

    /**
     * Logout current user
     */
    logout() {
        this.currentUser = null;
        this.isLoggedIn = false;
        this.isAdmin = false;

        // Clear session
        sessionStorage.removeItem('currentUser');
        sessionStorage.removeItem('isAdmin');

        this.notifyListeners();
    }

    /**
     * Check if user is currently logged in
     */
    checkAuthState() {
        const storedUser = sessionStorage.getItem('currentUser');
        const storedAdmin = sessionStorage.getItem('isAdmin');

        if (storedUser) {
            this.currentUser = storedUser;
            this.isLoggedIn = true;
            this.isAdmin = storedAdmin === 'true';
            return true;
        }

        return false;
    }

    /**
     * Get current user info
     */
    getCurrentUser() {
        return {
            name: this.currentUser,
            isLoggedIn: this.isLoggedIn,
            isAdmin: this.isAdmin
        };
    }

    /**
     * Check if current user has admin privileges
     */
    hasAdminAccess() {
        return this.isLoggedIn && this.isAdmin;
    }

    /**
     * Validate user access to specific data
     */
    canAccessUserData(targetUser) {
        if (!this.isLoggedIn) return false;
        if (this.isAdmin) return true;
        return this.currentUser === targetUser;
    }

    /**
     * Get available users for login dropdown
     */
    async getAvailableUsers() {
        try {
            const response = await apiClient.getUsers();
            if (response.ok && response.users) {
                return response.users.map(user => user.name).sort();
            }
            
            // Fallback to local storage
            const localUsers = localStorage.getUsers();
            return Object.keys(localUsers).sort();
            
        } catch (error) {
            console.error('Error fetching users:', error);
            
            // Fallback to local storage
            const localUsers = localStorage.getUsers();
            return Object.keys(localUsers).sort();
        }
    }

    /**
     * Add new user (admin only)
     */
    async addUser(name, password, isAdmin = false) {
        if (!this.hasAdminAccess()) {
            throw new Error('Admin access required');
        }

        if (!name || !password) {
            throw new Error('Name and password are required');
        }

        if (!isValidPassword(password)) {
            throw new Error('Password must be 4 digits');
        }

        // Check if user already exists
        const users = localStorage.getUsers();
        if (users[name]) {
            throw new Error('User already exists');
        }

        try {
            const response = await apiClient.addUser(name, password, isAdmin);
            
            if (!response.ok) {
                throw new Error(response.message || 'Failed to add user');
            }

            return {
                success: true,
                message: response.message || 'User added successfully'
            };

        } catch (error) {
            console.error('Error adding user:', error);
            throw error;
        }
    }

    /**
     * Remove user (admin only)
     */
    async removeUser(name) {
        if (!this.hasAdminAccess()) {
            throw new Error('Admin access required');
        }

        if (!name) {
            throw new Error('User name is required');
        }

        if (name === this.currentUser) {
            throw new Error('Cannot delete currently logged in user');
        }

        try {
            const response = await apiClient.deleteUser(name);
            
            if (!response.ok) {
                throw new Error(response.message || 'Failed to remove user');
            }

            return {
                success: true,
                message: response.message || 'User removed successfully'
            };

        } catch (error) {
            console.error('Error removing user:', error);
            throw error;
        }
    }

    /**
     * Get decrypted password for user (admin only)
     */
    async getUserPassword(name) {
        if (!this.hasAdminAccess()) {
            throw new Error('Admin access required');
        }

        if (!name) {
            throw new Error('User name is required');
        }

        try {
            const response = await apiClient.decryptPassword(name);
            
            if (!response.ok) {
                throw new Error(response.message || 'Failed to get password');
            }

            return {
                success: true,
                password: response.password
            };

        } catch (error) {
            console.error('Error getting password:', error);
            throw error;
        }
    }

    /**
     * Validate session and refresh if needed
     */
    async validateSession() {
        if (!this.isLoggedIn) return false;

        try {
            // Verify user still exists
            const users = await this.getAvailableUsers();
            if (!users.includes(this.currentUser)) {
                this.logout();
                return false;
            }

            return true;
        } catch (error) {
            console.error('Session validation error:', error);
            return false;
        }
    }

    /**
     * Auto-logout after inactivity
     */
    setupAutoLogout(timeoutMinutes = 30) {
        let timeoutId;

        const resetTimeout = () => {
            clearTimeout(timeoutId);
            if (this.isLoggedIn) {
                timeoutId = setTimeout(() => {
                    this.logout();
                    showToast('Session expired due to inactivity', 'warning');
                }, timeoutMinutes * 60 * 1000);
            }
        };

        // Reset timeout on user activity
        ['mousedown', 'touchstart', 'keypress', 'scroll'].forEach(event => {
            document.addEventListener(event, resetTimeout, { passive: true });
        });

        // Initial timeout setup
        this.addListener(({ isLoggedIn }) => {
            if (isLoggedIn) {
                resetTimeout();
            } else {
                clearTimeout(timeoutId);
            }
        });
    }
}

// Create global auth manager instance
const authManager = new AuthManager();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthManager;
}