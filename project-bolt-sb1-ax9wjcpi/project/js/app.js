/**
 * Main application entry point for Tour Plan Management App
 */

class TourPlanApp {
    constructor() {
        this.isInitialized = false;
        this.syncInterval = null;
        this.initialize();
    }

    /**
     * Initialize the application
     */
    async initialize() {
        try {
            console.log('Initializing Tour Plan Management App...');

            // Initialize UI Manager
            window.uiManager = new UIManager();

            // Setup auto-logout
            authManager.setupAutoLogout(30); // 30 minutes

            // Check existing auth state
            const hasExistingSession = authManager.checkAuthState();
            
            if (hasExistingSession) {
                const authState = authManager.getCurrentUser();
                window.uiManager.handleAuthStateChange(authState);
                
                // Navigate to appropriate screen
                if (authState.isAdmin) {
                    window.uiManager.showScreen('admin');
                    await window.uiManager.loadAdminDashboard();
                } else {
                    window.uiManager.showScreen('user');
                    await window.uiManager.loadUserWeek();
                }
            } else {
                // Show login screen and load users
                window.uiManager.showScreen('login');
                await window.uiManager.loadAvailableUsers();
            }

            // Setup periodic sync
            this.setupPeriodicSync();

            // Setup service worker for offline functionality
            this.setupServiceWorker();

            // Mark as initialized
            this.isInitialized = true;
            console.log('Tour Plan Management App initialized successfully');

        } catch (error) {
            console.error('Error initializing app:', error);
            showToast('Error initializing app', 'error');
        }
    }

    /**
     * Setup periodic sync with server
     */
    setupPeriodicSync() {
        // Initial sync on app load
        if (isOnline()) {
            apiClient.processSyncQueue();
        }

        // Periodic sync every 5 minutes
        this.syncInterval = setInterval(() => {
            if (isOnline() && authManager.isLoggedIn) {
                apiClient.processSyncQueue();
            }
        }, 5 * 60 * 1000);

        // Sync when coming back online
        window.addEventListener('online', () => {
            console.log('Back online - starting sync...');
            apiClient.processSyncQueue();
            showToast('Back online - syncing data...', 'success');
        });

        // Notify when going offline
        window.addEventListener('offline', () => {
            console.log('Gone offline - changes will be queued');
            showToast('Offline - changes will sync when reconnected', 'warning');
        });

        // Sync before page unload
        window.addEventListener('beforeunload', () => {
            if (isOnline()) {
                // Try to sync immediately (best effort)
                navigator.sendBeacon && apiClient.processSyncQueue();
            }
        });
    }

    /**
     * Setup service worker for offline functionality
     */
    setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/service-worker.js')
                    .then((registration) => {
                        console.log('ServiceWorker registration successful');
                        
                        // Listen for updates
                        registration.addEventListener('updatefound', () => {
                            const newWorker = registration.installing;
                            newWorker.addEventListener('statechange', () => {
                                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    showToast('App updated! Refresh to get the latest version.', 'success');
                                }
                            });
                        });
                    })
                    .catch((error) => {
                        console.log('ServiceWorker registration failed:', error);
                    });
            });
        }
    }

    /**
     * Get app status and diagnostic info
     */
    getAppStatus() {
        const syncQueue = localStorage.getSyncQueue();
        const storageInfo = localStorage.getStorageInfo();
        const authState = authManager.getCurrentUser();

        return {
            version: '1.0.0',
            initialized: this.isInitialized,
            online: isOnline(),
            authenticated: authState.isLoggedIn,
            currentUser: authState.name,
            isAdmin: authState.isAdmin,
            pendingSyncItems: syncQueue.length,
            storageUsed: storageInfo ? `${storageInfo.sizeInKB} KB` : 'Unknown',
            lastSync: localStorage.getLastSync()
        };
    }

    /**
     * Force sync with server
     */
    async forcSync() {
        if (!isOnline()) {
            showToast('Cannot sync while offline', 'error');
            return false;
        }

        try {
            showToast('Starting sync...', 'success');
            await apiClient.processSyncQueue();
            showToast('Sync completed successfully', 'success');
            return true;
        } catch (error) {
            console.error('Force sync failed:', error);
            showToast('Sync failed', 'error');
            return false;
        }
    }

    /**
     * Clear all app data (for testing/reset)
     */
    clearAllData() {
        if (!confirm('This will clear all local data and log you out. Are you sure?')) {
            return false;
        }

        try {
            // Clear localStorage
            localStorage.clearAll();
            
            // Clear sessionStorage
            sessionStorage.clear();
            
            // Logout
            authManager.logout();
            
            // Reinitialize
            this.initialize();
            
            showToast('All data cleared', 'success');
            return true;
        } catch (error) {
            console.error('Error clearing data:', error);
            showToast('Error clearing data', 'error');
            return false;
        }
    }

    /**
     * Export app data for backup
     */
    exportData() {
        try {
            const data = {
                version: '1.0.0',
                exportDate: new Date().toISOString(),
                localStorage: localStorage.exportData(),
                appStatus: this.getAppStatus()
            };

            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `tour-plan-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            showToast('Data exported successfully', 'success');
            return true;
        } catch (error) {
            console.error('Export failed:', error);
            showToast('Export failed', 'error');
            return false;
        }
    }

    /**
     * Import app data from backup
     */
    importData(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    
                    if (!data.localStorage) {
                        throw new Error('Invalid backup file format');
                    }

                    // Import data
                    const success = localStorage.importData(data.localStorage);
                    
                    if (success) {
                        // Logout and reinitialize
                        authManager.logout();
                        this.initialize();
                        
                        showToast('Data imported successfully', 'success');
                        resolve(true);
                    } else {
                        throw new Error('Failed to import data');
                    }
                } catch (error) {
                    console.error('Import failed:', error);
                    showToast('Import failed: ' + error.message, 'error');
                    reject(error);
                }
            };

            reader.onerror = () => {
                showToast('File read error', 'error');
                reject(new Error('File read error'));
            };

            reader.readAsText(file);
        });
    }

    /**
     * Handle app errors
     */
    handleError(error, context = 'Unknown') {
        console.error(`App Error (${context}):`, error);
        
        // Show user-friendly error message
        const userMessage = this.getFriendlyErrorMessage(error);
        showToast(userMessage, 'error');

        // Log error details for debugging
        const errorDetails = {
            message: error.message,
            stack: error.stack,
            context,
            timestamp: new Date().toISOString(),
            appStatus: this.getAppStatus()
        };

        console.log('Error Details:', errorDetails);
    }

    /**
     * Get user-friendly error message
     */
    getFriendlyErrorMessage(error) {
        if (error.message.includes('fetch')) {
            return 'Network error - please check your connection';
        }
        
        if (error.message.includes('storage')) {
            return 'Storage error - try clearing browser cache';
        }
        
        if (error.message.includes('permission')) {
            return 'Permission error - please refresh and try again';
        }

        return 'An unexpected error occurred';
    }

    /**
     * Cleanup resources
     */
    destroy() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }

        // Remove event listeners
        window.removeEventListener('online', apiClient.processSyncQueue);
        window.removeEventListener('offline', () => {});
        
        console.log('Tour Plan App destroyed');
    }
}

// Global error handler
window.addEventListener('error', (event) => {
    if (window.app) {
        window.app.handleError(event.error, 'Global Error Handler');
    }
});

// Global unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
    if (window.app) {
        window.app.handleError(event.reason, 'Unhandled Promise Rejection');
    }
    event.preventDefault(); // Prevent console error
});

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.app = new TourPlanApp();
    });
} else {
    window.app = new TourPlanApp();
}

// Expose app globally for debugging
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TourPlanApp;
}

// Development helpers (only available in development)
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.devHelpers = {
        getAppStatus: () => window.app?.getAppStatus(),
        forceSync: () => window.app?.forcSync(),
        clearData: () => window.app?.clearAllData(),
        exportData: () => window.app?.exportData(),
        computeWeek: computeWeekStartIST,
        localStorage: localStorage,
        apiClient: apiClient,
        authManager: authManager
    };

    console.log('Development helpers available at window.devHelpers');
}