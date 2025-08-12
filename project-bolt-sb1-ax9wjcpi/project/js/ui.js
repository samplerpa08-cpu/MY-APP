/**
 * UI management and interactions for Tour Plan Management App
 */

class UIManager {
    constructor() {
        this.masterLocations = [
            'Jammu', 'Jammu Local', 'Karan Bagh', 'Udhampur', 'Akhnoor', 'Arnia', 'Dayala Chak',
            'Janipur', 'Bhaderwah', 'Kishtewar', 'Samba', 'Talab Tillo', 'Rajouri', 'Poonch',
            'Kathua', 'Basoli', 'Ramban', 'Ramnagar', 'Chenani', 'Katra', 'Doda', 'Khour',
            'Kanak Mandi', 'Santra Morh', 'Ghomansa', 'R.S. Pura', 'Mendhar', 'Subhash Nagar',
            'Bhadrore', 'Shiv Nagar', 'Ramgarh', 'Kootahmorh', 'Thanamandi', 'Chadwal',
            'Jalandhar', 'Hoshiarpur', 'Amritsar', 'Buddal Bakori', 'Weekly Off', 'Holiday', 'Leave', 'Other'
        ];

        this.currentCustomLocationContext = null;
        this.initializeEventListeners();
        this.setupMobileOptimizations();
    }

    /**
     * Initialize all event listeners
     */
    initializeEventListeners() {
        // Login form
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', this.handleLogin.bind(this));
        }

        // Bottom navigation
        const navButtons = document.querySelectorAll('.nav-item');
        navButtons.forEach(button => {
            button.addEventListener('click', this.handleNavigation.bind(this));
        });

        // Logout buttons
        const logoutButtons = ['logout-btn', 'admin-logout-btn'];
        logoutButtons.forEach(id => {
            const button = document.getElementById(id);
            if (button) {
                button.addEventListener('click', () => {
                    authManager.logout();
                    this.showScreen('login');
                    this.updateNavigation();
                });
            }
        });

        // Save week button
        const saveWeekBtn = document.getElementById('save-week-btn');
        if (saveWeekBtn) {
            saveWeekBtn.addEventListener('click', this.handleSaveWeek.bind(this));
        }

        // Add participant button
        const addParticipantBtn = document.getElementById('add-participant-btn');
        if (addParticipantBtn) {
            addParticipantBtn.addEventListener('click', () => {
                this.showModal('add-participant-modal');
            });
        }

        // Add participant form
        const addParticipantForm = document.getElementById('add-participant-form');
        if (addParticipantForm) {
            addParticipantForm.addEventListener('submit', this.handleAddParticipant.bind(this));
        }

        // Custom location form
        const customLocationForm = document.getElementById('custom-location-form');
        if (customLocationForm) {
            customLocationForm.addEventListener('submit', this.handleAddCustomLocation.bind(this));
        }

        // Modal close buttons
        const closeButtons = ['close-modal', 'close-custom-modal', 'cancel-add-btn', 'cancel-custom-btn'];
        closeButtons.forEach(id => {
            const button = document.getElementById(id);
            if (button) {
                button.addEventListener('click', () => {
                    this.hideAllModals();
                });
            }
        });

        // Week override controls
        const weekOverride = document.getElementById('week-override');
        const resetWeekBtn = document.getElementById('reset-week-btn');

        if (weekOverride) {
            weekOverride.addEventListener('change', this.handleWeekOverride.bind(this));
        }

        if (resetWeekBtn) {
            resetWeekBtn.addEventListener('click', this.handleResetWeek.bind(this));
        }

        // Copy buttons
        const copyWeekDatesBtn = document.getElementById('copy-week-dates-btn');
        if (copyWeekDatesBtn) {
            copyWeekDatesBtn.addEventListener('click', this.handleCopyWeekDates.bind(this));
        }

        // Click outside modal to close
        window.addEventListener('click', (event) => {
            if (event.target.classList.contains('modal')) {
                this.hideAllModals();
            }
        });

        // Auth state changes
        authManager.addListener(this.handleAuthStateChange.bind(this));
    }

    /**
     * Setup mobile-specific optimizations
     */
    setupMobileOptimizations() {
        // Prevent zoom on input focus for iOS
        const viewport = document.querySelector('meta[name="viewport"]');
        if (viewport && /iPhone|iPad|iPod/i.test(navigator.userAgent)) {
            const inputs = document.querySelectorAll('input, select, textarea');
            inputs.forEach(input => {
                input.addEventListener('focus', () => {
                    viewport.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
                });

                input.addEventListener('blur', () => {
                    viewport.setAttribute('content', 'width=device-width, initial-scale=1, user-scalable=yes');
                });
            });
        }

        // Add touch feedback
        const touchElements = document.querySelectorAll('button, .nav-item, .editable-cell');
        touchElements.forEach(element => {
            element.addEventListener('touchstart', () => {
                element.style.transform = 'scale(0.98)';
            }, { passive: true });

            element.addEventListener('touchend', () => {
                element.style.transform = 'scale(1)';
            }, { passive: true });
        });

        // Improve scrolling on mobile
        const scrollContainers = document.querySelectorAll('.admin-table-container, .week-list');
        scrollContainers.forEach(container => {
            container.style.webkitOverflowScrolling = 'touch';
        });
    }

    /**
     * Handle login form submission
     */
    async handleLogin(event) {
        event.preventDefault();

        const name = document.getElementById('name-select').value;
        const password = document.getElementById('password-input').value;
        const submitBtn = event.target.querySelector('button[type="submit"]');

        if (!name || !password) {
            this.showToast('Please select name and enter password', 'error');
            return;
        }

        setButtonLoading(submitBtn, true);

        try {
            const result = await authManager.login(name, password);

            if (result.success) {
                this.showToast('Login successful!', 'success');

                // Navigate to appropriate screen
                const targetScreen = result.isAdmin ? 'admin' : 'user';
                this.showScreen(targetScreen);
                this.updateNavigation();

                // Load user data
                if (result.isAdmin) {
                    await this.loadAdminDashboard();
                } else {
                    await this.loadUserWeek();
                }
            } else {
                this.showToast(result.message, 'error');
            }
        } catch (error) {
            this.showToast('Login failed. Please try again.', 'error');
            console.error('Login error:', error);
        } finally {
            setButtonLoading(submitBtn, false);
        }
    }

    /**
     * Handle navigation button clicks
     */
    handleNavigation(event) {
        const target = event.currentTarget;
        const targetScreen = target.id.replace('nav-', '');

        // Update active nav state
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        target.classList.add('active');

        // Show appropriate screen
        if (targetScreen === 'login') {
            authManager.logout();
        }

        this.showScreen(targetScreen);

        // Load screen data
        if (targetScreen === 'admin') {
            this.loadAdminDashboard();
        } else if (targetScreen === 'user') {
            this.loadUserWeek();
        }
    }

    /**
     * Handle auth state changes
     */
    handleAuthStateChange(authState) {
        if (authState.isLoggedIn) {
            this.updateUserDisplay(authState.currentUser);
            this.updateNavigation(authState.isAdmin);
        } else {
            this.showScreen('login');
            this.updateNavigation(false);
            this.loadAvailableUsers();
        }
    }

    /**
     * Show specific screen
     */
    showScreen(screenName) {
        const screens = document.querySelectorAll('.screen');
        screens.forEach(screen => {
            screen.classList.remove('active');
        });

        const targetScreen = document.getElementById(`${screenName}-screen`);
        if (targetScreen) {
            targetScreen.classList.add('active');
        }
    }

    /**
     * Update navigation visibility based on auth state
     */
    updateNavigation(isAdmin = false) {
        const bottomNav = document.getElementById('bottom-nav');
        const adminNav = document.getElementById('nav-admin');

        if (authManager.isLoggedIn) {
            bottomNav.classList.remove('hidden');

            if (isAdmin) {
                adminNav.classList.remove('hidden');
            } else {
                adminNav.classList.add('hidden');
            }
        } else {
            bottomNav.classList.add('hidden');
        }
    }

    /**
     * Update user display in headers
     */
    updateUserDisplay(userName) {
        const userNameElement = document.getElementById('current-user-name');
        if (userNameElement) {
            userNameElement.textContent = userName;
        }
    }

    /**
     * Load available users for login dropdown
     */
    async loadAvailableUsers() {
        try {
            const users = await authManager.getAvailableUsers();
            const select = document.getElementById('name-select');

            if (select) {
                // Clear existing options except first
                const firstOption = select.firstElementChild;
                select.innerHTML = '';
                select.appendChild(firstOption);

                // Add user options
                users.forEach(userName => {
                    const option = document.createElement('option');
                    option.value = userName;
                    option.textContent = userName;
                    select.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error loading users:', error);
            this.showToast('Error loading users', 'error');
        }
    }

    /**
     * Load user week view
     */
    async loadUserWeek() {
        try {
            const weekInfo = computeWeekStartIST();
            const override = localStorage.getAdminOverride();

            let actualWeekInfo = weekInfo;
            if (override && override.overrideWeekStart) {
                actualWeekInfo = computeWeekStartIST(new Date(), override.overrideWeekStart);
            }

            // Update title
            const titleElement = document.getElementById('user-week-title');
            if (titleElement) {
                titleElement.textContent = `My Week (${actualWeekInfo.headers[0]} - ${actualWeekInfo.headers[6]})`;
            }

            // Get user's plan
            const plans = await apiClient.getPlans(actualWeekInfo.weekStartId);
            const userPlan = plans.plans[authManager.currentUser] || Array(7).fill('');

            // Get custom locations
            const customLocations = localStorage.getCustomLocations(authManager.currentUser);
            const weekCustoms = customLocations[actualWeekInfo.weekStartId] || {};

            // Render week list
            const weekList = document.getElementById('user-week-list');
            if (weekList) {
                weekList.innerHTML = this.renderUserWeekList(actualWeekInfo, userPlan, weekCustoms);
                this.attachWeekListeners();
            }

        } catch (error) {
            console.error('Error loading user week:', error);
            this.showToast('Error loading week data', 'error');
        }
    }

    /**
     * Render user week list HTML
     */
    renderUserWeekList(weekInfo, userPlan, customLocations) {
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

        return days.map((day, index) => {
            const currentLocation = userPlan[index] || (index === 6 ? 'Weekly Off' : '');
            const customLocation = customLocations[weekInfo.dayDates[index]];

            let locationOptions = this.masterLocations.map(loc => {
                const selected = loc === currentLocation ? 'selected' : '';
                return `<option value="${loc}" ${selected}>${loc}</option>`;
            }).join('');

            // Add custom location if it exists
            if (customLocation && !this.masterLocations.includes(customLocation)) {
                const selected = customLocation === currentLocation ? 'selected' : '';
                locationOptions += `<option value="${customLocation}" ${selected}>${customLocation}</option>`;
            }

            return `
                <div class="week-item">
                    <div class="day-info">
                        <div class="day-name">${day}</div>
                        <div class="day-date">${weekInfo.headers[index]}</div>
                    </div>
                    <div class="location-control">
                        <select data-day-index="${index}" data-day-date="${weekInfo.dayDates[index]}">
                            ${locationOptions}
                        </select>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Attach listeners to week list elements
     */
    attachWeekListeners() {
        const selects = document.querySelectorAll('#user-week-list select');
        selects.forEach(select => {
            select.addEventListener('change', (event) => {
                if (event.target.value === 'Other') {
                    this.showCustomLocationModal(
                        event.target.dataset.dayIndex,
                        event.target.dataset.dayDate
                    );
                    // Reset to previous value temporarily
                    event.target.selectedIndex = 0;
                }
            });
        });
    }

    /**
     * Show custom location modal
     */
    showCustomLocationModal(dayIndex, dayDate) {
        this.currentCustomLocationContext = { dayIndex, dayDate };
        this.showModal('custom-location-modal');

        // Focus input
        setTimeout(() => {
            const input = document.getElementById('custom-location-input');
            if (input) input.focus();
        }, 100);
    }

    /**
     * Handle adding custom location
     */
    async handleAddCustomLocation(event) {
        event.preventDefault();

        if (!this.currentCustomLocationContext) return;

        const locationInput = document.getElementById('custom-location-input');
        const location = locationInput.value.trim();

        if (!location) {
            this.showToast('Please enter a location name', 'error');
            return;
        }

        try {
            const weekInfo = computeWeekStartIST();
            const override = localStorage.getAdminOverride();

            let actualWeekInfo = weekInfo;
            if (override && override.overrideWeekStart) {
                actualWeekInfo = computeWeekStartIST(new Date(), override.overrideWeekStart);
            }

            // Add custom location
            await apiClient.addCustomLocation(
                authManager.currentUser,
                actualWeekInfo.weekStartId,
                this.currentCustomLocationContext.dayDate,
                location
            );

            // Update the select dropdown
            const select = document.querySelector(`select[data-day-index="${this.currentCustomLocationContext.dayIndex}"]`);
            if (select) {
                // Add option and select it
                const option = document.createElement('option');
                option.value = location;
                option.textContent = location;
                option.selected = true;
                select.insertBefore(option, select.lastElementChild); // Insert before "Other"
            }

            this.hideAllModals();
            locationInput.value = '';
            this.showToast('Custom location added!', 'success');

        } catch (error) {
            console.error('Error adding custom location:', error);
            this.showToast('Error adding custom location', 'error');
        }
    }

    /**
     * Handle saving user week plan
     */
    async handleSaveWeek(event) {
        const button = event.target;
        setButtonLoading(button, true);

        try {
            const selects = document.querySelectorAll('#user-week-list select');
            const locations = Array.from(selects).map(select => select.value);

            const weekInfo = computeWeekStartIST();
            const override = localStorage.getAdminOverride();

            let actualWeekInfo = weekInfo;
            if (override && override.overrideWeekStart) {
                actualWeekInfo = computeWeekStartIST(new Date(), override.overrideWeekStart);
            }

            await apiClient.setPlan(actualWeekInfo.weekStartId, authManager.currentUser, locations);

            this.showToast('Week plan saved! Logging out...', 'success');

            // Auto logout after 2 seconds
            setTimeout(() => {
                authManager.logout();
                this.showScreen('login');
                this.updateNavigation();
            }, 2000);

        } catch (error) {
            console.error('Error saving week plan:', error);
            this.showToast('Error saving week plan', 'error');
        } finally {
            setButtonLoading(button, false);
        }
    }

    /**
     * Load admin dashboard
     */
    async loadAdminDashboard() {
        try {
            const weekInfo = computeWeekStartIST();
            const override = localStorage.getAdminOverride();

            let actualWeekInfo = weekInfo;
            if (override && override.overrideWeekStart) {
                actualWeekInfo = computeWeekStartIST(new Date(), override.overrideWeekStart);

                // Update override input
                const overrideInput = document.getElementById('week-override');
                if (overrideInput) {
                    overrideInput.value = override.overrideWeekStart;
                }
            }

            // Get all plans for the week
            const plansResponse = await apiClient.getPlans(actualWeekInfo.weekStartId);
            const plans = plansResponse.plans || {};

            // Get all users
            const usersResponse = await apiClient.getUsers();
            const users = usersResponse.users || [];

            // Render admin table
            const adminTable = document.getElementById('admin-table');
            if (adminTable) {
                adminTable.innerHTML = this.renderAdminTable(actualWeekInfo, users, plans);
                this.attachAdminListeners();
            }

        } catch (error) {
            console.error('Error loading admin dashboard:', error);
            this.showToast('Error loading admin dashboard', 'error');
        }
    }

    /**
     * Render admin table HTML
     */
    renderAdminTable(weekInfo, users, plans) {
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

        const headerRow = `
            <tr>
                <th>Participant</th>
                ${weekInfo.headers.map((header, index) =>
            `<th>${days[index]}<br><small>${header}</small></th>`
        ).join('')}
                <th>Actions</th>
            </tr>
        `;

        const userRows = users.map(user => {
            const userPlan = plans[user.name] || Array(7).fill('');
            const isCurrentUser = user.name === authManager.currentUser;

            return `
                <tr>
                    <td class="participant-name">${user.name}${user.isAdmin ? ' 👑' : ''}</td>
                    ${userPlan.map((location, index) => `
                        <td class="editable-cell" 
                            data-user="${user.name}" 
                            data-day-index="${index}"
                            data-day-date="${weekInfo.dayDates[index]}">
                            <input type="text" value="${location || ''}" placeholder="Location">
                        </td>
                    `).join('')}
                    <td class="actions">
                        <div class="action-buttons">
                            <button class="btn btn-outline copy-vertical" data-user="${user.name}">
                                Copy ↓
                            </button>
                            <button class="btn btn-outline copy-horizontal" data-user="${user.name}">
                                Copy →
                            </button>
                            <button class="btn btn-outline show-password" data-user="${user.name}">
                                Password
                            </button>
                            ${!isCurrentUser ? `
                                <button class="btn btn-danger remove-user" data-user="${user.name}">
                                    Remove
                                </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        return `
            <table>
                <thead>${headerRow}</thead>
                <tbody>${userRows}</tbody>
            </table>
        `;
    }

    /**
     * Attach admin dashboard listeners
     */
    attachAdminListeners() {
        // Editable cell inputs
        const editableCells = document.querySelectorAll('.editable-cell input');
        editableCells.forEach(input => {
            input.addEventListener('blur', debounce(this.handleCellEdit.bind(this), 500));
            input.addEventListener('keypress', (event) => {
                if (event.key === 'Enter') {
                    event.target.blur();
                }
            });
        });

        // Action buttons
        document.querySelectorAll('.copy-vertical').forEach(btn => {
            btn.addEventListener('click', this.handleCopyVertical.bind(this));
        });

        document.querySelectorAll('.copy-horizontal').forEach(btn => {
            btn.addEventListener('click', this.handleCopyHorizontal.bind(this));
        });

        document.querySelectorAll('.show-password').forEach(btn => {
            btn.addEventListener('click', this.handleShowPassword.bind(this));
        });

        document.querySelectorAll('.remove-user').forEach(btn => {
            btn.addEventListener('click', this.handleRemoveUser.bind(this));
        });
    }

    /**
     * Handle editing cell content
     */
    async handleCellEdit(event) {
        const input = event.target;
        const cell = input.closest('.editable-cell');
        const userName = cell.dataset.user;
        const dayIndex = parseInt(cell.dataset.dayIndex);
        const newLocation = input.value.trim();

        try {
            const weekInfo = computeWeekStartIST();
            const override = localStorage.getAdminOverride();

            let actualWeekInfo = weekInfo;
            if (override && override.overrideWeekStart) {
                actualWeekInfo = computeWeekStartIST(new Date(), override.overrideWeekStart);
            }

            // Get current plan
            const plansResponse = await apiClient.getPlans(actualWeekInfo.weekStartId);
            const currentPlan = plansResponse.plans[userName] || Array(7).fill('');

            // Update the specific day
            currentPlan[dayIndex] = newLocation;

            // Save updated plan
            await apiClient.setPlan(actualWeekInfo.weekStartId, userName, currentPlan);

            // Visual feedback
            cell.style.backgroundColor = '#dcfce7';
            setTimeout(() => {
                cell.style.backgroundColor = '';
            }, 1000);

        } catch (error) {
            console.error('Error updating plan:', error);
            this.showToast('Error updating plan', 'error');
        }
    }

    /**
     * Handle copying locations vertically
     */
    async handleCopyVertical(event) {
        const userName = event.target.dataset.user;
        const userRow = event.target.closest('tr');
        const inputs = userRow.querySelectorAll('.editable-cell input');
        const locations = Array.from(inputs).map(input => input.value.trim()).filter(loc => loc);

        if (locations.length === 0) {
            this.showToast('No locations to copy', 'warning');
            return;
        }

        try {
            await this.copyToClipboard(formatLocationList(locations, 'vertical'));
            this.showToast('Locations copied (vertical)', 'success');
        } catch (error) {
            this.showToast('Failed to copy to clipboard', 'error');
        }
    }

    /**
     * Handle copying locations horizontally
     */
    async handleCopyHorizontal(event) {
        const userName = event.target.dataset.user;
        const userRow = event.target.closest('tr');
        const inputs = userRow.querySelectorAll('.editable-cell input');
        const locations = Array.from(inputs).map(input => input.value.trim()).filter(loc => loc);

        if (locations.length === 0) {
            this.showToast('No locations to copy', 'warning');
            return;
        }

        try {
            await this.copyToClipboard(formatLocationList(locations, 'horizontal'));
            this.showToast('Locations copied (horizontal)', 'success');
        } catch (error) {
            this.showToast('Failed to copy to clipboard', 'error');
        }
    }

    /**
     * Handle showing user password
     */
    async handleShowPassword(event) {
        const userName = event.target.dataset.user;
        const button = event.target;

        setButtonLoading(button, true);

        try {
            const result = await authManager.getUserPassword(userName);
            if (result.success) {
                this.showToast(`${userName}: ${result.password}`, 'success');
            }
        } catch (error) {
            this.showToast(error.message, 'error');
        } finally {
            setButtonLoading(button, false);
        }
    }

    /**
     * Handle removing user
     */
    async handleRemoveUser(event) {
        const userName = event.target.dataset.user;

        if (!confirm(`Are you sure you want to remove ${userName}? This will delete all their data.`)) {
            return;
        }

        const button = event.target;
        setButtonLoading(button, true);

        try {
            await authManager.removeUser(userName);
            this.showToast(`${userName} removed successfully`, 'success');

            // Reload admin dashboard
            await this.loadAdminDashboard();

            // Reload user dropdown if on login screen
            await this.loadAvailableUsers();

        } catch (error) {
            this.showToast(error.message, 'error');
        } finally {
            setButtonLoading(button, false);
        }
    }

    /**
     * Handle adding new participant
     */
    async handleAddParticipant(event) {
        event.preventDefault();

        const name = document.getElementById('new-user-name').value.trim();
        const password = document.getElementById('new-user-password').value.trim();
        const isAdmin = document.getElementById('new-user-admin').checked;
        const submitBtn = event.target.querySelector('button[type="submit"]');

        if (!name || !password) {
            this.showToast('Name and password are required', 'error');
            return;
        }

        setButtonLoading(submitBtn, true);

        try {
            await authManager.addUser(name, password, isAdmin);
            this.showToast(`${name} added successfully`, 'success');

            // Clear form
            document.getElementById('new-user-name').value = '';
            document.getElementById('new-user-password').value = '';
            document.getElementById('new-user-admin').checked = false;

            this.hideAllModals();

            // Reload admin dashboard and user dropdown
            await this.loadAdminDashboard();
            await this.loadAvailableUsers();

        } catch (error) {
            this.showToast(error.message, 'error');
        } finally {
            setButtonLoading(submitBtn, false);
        }
    }

    /**
     * Handle week override
     */
    async handleWeekOverride(event) {
        const overrideDate = event.target.value;

        if (!overrideDate) return;

        try {
            await apiClient.setAdminOverride(authManager.currentUser, overrideDate);
            this.showToast('Week override set', 'success');

            // Reload admin dashboard with new week
            await this.loadAdminDashboard();

        } catch (error) {
            console.error('Error setting week override:', error);
            this.showToast('Error setting week override', 'error');
        }
    }

    /**
     * Handle reset week override
     */
    async handleResetWeek(event) {
        try {
            await apiClient.clearAdminOverride();

            const overrideInput = document.getElementById('week-override');
            if (overrideInput) {
                overrideInput.value = '';
            }

            this.showToast('Week override cleared', 'success');

            // Reload admin dashboard
            await this.loadAdminDashboard();

        } catch (error) {
            console.error('Error clearing week override:', error);
            this.showToast('Error clearing week override', 'error');
        }
    }

    /**
     * Handle copying week dates
     */
    async handleCopyWeekDates() {
        try {
            const weekInfo = computeWeekStartIST();
            const override = localStorage.getAdminOverride();

            let actualWeekInfo = weekInfo;
            if (override && override.overrideWeekStart) {
                actualWeekInfo = computeWeekStartIST(new Date(), override.overrideWeekStart);
            }

            const weekDates = formatLocationList(actualWeekInfo.headers, 'vertical');
            await this.copyToClipboard(weekDates);
            this.showToast('Week dates copied', 'success');

        } catch (error) {
            this.showToast('Failed to copy week dates', 'error');
        }
    }

    /**
     * Copy text to clipboard
     */
    async copyToClipboard(text) {
        if (navigator.clipboard) {
            await navigator.clipboard.writeText(text);
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            document.execCommand('copy');
            textArea.remove();
        }
    }

    /**
     * Show modal
     */
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
        }
    }

    /**
     * Hide all modals
     */
    hideAllModals() {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.classList.remove('active');
        });
        this.currentCustomLocationContext = null;
    }

    /**
     * Show toast notification
     */
    showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                ${sanitizeString(message)}
            </div>
        `;

        container.appendChild(toast);

        // Animate in
        setTimeout(() => toast.classList.add('show'), 100);

        // Remove after 4 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (container.contains(toast)) {
                    container.removeChild(toast);
                }
            }, 300);
        }, 4000);
    }
}

// Global toast function for easy access
function showToast(message, type = 'success') {
    if (window.uiManager) {
        window.uiManager.showToast(message, type);
    } else {
        console.log(`Toast (${type}): ${message}`);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIManager;
}