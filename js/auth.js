// ─────────────────────────────────────────────
// GhostMail — Authentication & User Profile Engine
// Author: Suraj Kumar
// ─────────────────────────────────────────────

const USERS_STORAGE_KEY = 'ghostmail_users_db';
const SESSION_STORAGE_KEY = 'ghostmail_active_session';

// Helper: Get all registered users
function getUsers() {
    try {
        const raw = localStorage.getItem(USERS_STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (e) {
        return {};
    }
}

// Helper: Save users dictionary
function saveUsers(users) {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
}

// Get currently logged-in user
export function getCurrentUser() {
    try {
        const session = localStorage.getItem(SESSION_STORAGE_KEY);
        if (!session) return null;
        const data = JSON.parse(session);
        return data.user || null;
    } catch (e) {
        return null;
    }
}

// Save active session
function setSession(user) {
    const sessionData = {
        user: {
            username: user.username,
            email: user.email || '',
            tier: user.tier || 'PRO',
            createdAt: user.createdAt || Date.now()
        },
        token: 'gm_' + Math.random().toString(36).substring(2) + Date.now().toString(36)
    };
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
    updateAuthUI();
}

// Clear session (Logout)
export function logoutUser() {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    updateAuthUI();
    closeUserDropdown();
    
    // Show toast if available
    if (window.showToast) {
        window.showToast('Signed out of TempX', 'info');
    }
}

// Update header UI depending on login state
export function updateAuthUI() {
    const user = getCurrentUser();
    const openBtn = document.getElementById('auth-open-btn');
    const userMenu = document.getElementById('user-profile-menu');
    const userDisplayName = document.getElementById('user-display-name');
    const dropdownUsername = document.getElementById('dropdown-username');

    if (user) {
        if (openBtn) openBtn.style.display = 'none';
        if (userMenu) userMenu.style.display = 'block';
        if (userDisplayName) userDisplayName.textContent = user.username;
        if (dropdownUsername) dropdownUsername.textContent = '@' + user.username;
    } else {
        if (openBtn) openBtn.style.display = 'inline-flex';
        if (userMenu) userMenu.style.display = 'none';
    }
}

// Modal controls
export function openAuthModal(tab = 'login') {
    const modal = document.getElementById('auth-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    document.body.classList.add('modal-open');
    switchAuthTab(tab);
    clearAuthAlert();
    
    setTimeout(() => {
        const firstInput = tab === 'login' 
            ? document.getElementById('login-username') 
            : document.getElementById('reg-username');
        if (firstInput) firstInput.focus();
    }, 100);
}

export function closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (!modal) return;
    modal.style.display = 'none';
    document.body.classList.remove('modal-open');
    clearAuthAlert();
}

export function switchAuthTab(tab) {
    const loginTabBtn = document.getElementById('auth-tab-login');
    const regTabBtn = document.getElementById('auth-tab-register');
    const loginForm = document.getElementById('login-form');
    const regForm = document.getElementById('register-form');
    const title = document.getElementById('auth-title');

    clearAuthAlert();

    if (tab === 'login') {
        if (loginTabBtn) loginTabBtn.classList.add('active');
        if (regTabBtn) regTabBtn.classList.remove('active');
        if (loginForm) loginForm.style.display = 'flex';
        if (regForm) regForm.style.display = 'none';
        if (title) title.textContent = 'Welcome Back, Agent';
    } else {
        if (loginTabBtn) loginTabBtn.classList.remove('active');
        if (regTabBtn) regTabBtn.classList.add('active');
        if (loginForm) loginForm.style.display = 'none';
        if (regForm) regForm.style.display = 'flex';
        if (title) title.textContent = 'Initialize Ghost Identity';
    }
}

function showAuthAlert(msg, type = 'error') {
    const alertBox = document.getElementById('auth-alert');
    if (!alertBox) return;
    alertBox.textContent = msg;
    alertBox.className = `auth-alert ${type}`;
    alertBox.style.display = 'block';
}

function clearAuthAlert() {
    const alertBox = document.getElementById('auth-alert');
    if (alertBox) {
        alertBox.style.display = 'none';
        alertBox.textContent = '';
    }
}

export function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const btn = input.nextElementSibling;
    if (input.type === 'password') {
        input.type = 'text';
        if (btn) btn.innerHTML = '<i class="fa-regular fa-eye-slash"></i>';
    } else {
        input.type = 'password';
        if (btn) btn.innerHTML = '<i class="fa-regular fa-eye"></i>';
    }
}

// Handle Login submission
export function handleLogin(e) {
    e.preventDefault();
    const usernameInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');

    const username = usernameInput ? usernameInput.value.trim().toLowerCase() : '';
    const password = passwordInput ? passwordInput.value : '';

    if (!username || !password) {
        showAuthAlert('Please enter both username and password.');
        return;
    }

    const users = getUsers();
    const user = users[username];

    if (!user || user.password !== btoa(password)) {
        showAuthAlert('Invalid credentials. Check secret key or register new identity.');
        return;
    }

    // Success!
    setSession(user);
    closeAuthModal();

    if (typeof confetti === 'function') {
        confetti({
            particleCount: 80,
            spread: 100,
            origin: { y: 0.6 },
            colors: ['#00F0FF', '#D946EF', '#00FF9D']
        });
    }

    if (window.showToast) {
        window.showToast(`Welcome back, ${user.username}!`, 'success');
    }
}

// Handle Register submission
export function handleRegister(e) {
    e.preventDefault();
    const usernameInput = document.getElementById('reg-username');
    const emailInput = document.getElementById('reg-email');
    const passwordInput = document.getElementById('reg-password');

    const username = usernameInput ? usernameInput.value.trim().toLowerCase() : '';
    const email = emailInput ? emailInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';

    if (!username || username.length < 3) {
        showAuthAlert('Username must be at least 3 characters.');
        return;
    }

    if (!/^[a-z0-9_]+$/.test(username)) {
        showAuthAlert('Username can only contain letters, numbers, and underscore (_).');
        return;
    }

    if (!password || password.length < 4) {
        showAuthAlert('Secret key must be at least 4 characters.');
        return;
    }

    const users = getUsers();
    if (users[username]) {
        showAuthAlert('This username is already taken. Choose another stealth handle.');
        return;
    }

    // Save user (btoa encoded for client storage obfuscation)
    const newUser = {
        username: username,
        email: email,
        password: btoa(password),
        tier: 'PRO',
        createdAt: Date.now()
    };

    users[username] = newUser;
    saveUsers(users);

    setSession(newUser);
    closeAuthModal();

    if (typeof confetti === 'function') {
        confetti({
            particleCount: 120,
            spread: 140,
            origin: { y: 0.6 },
            colors: ['#00F0FF', '#D946EF', '#00FF9D', '#FF007F']
        });
    }

    if (window.showToast) {
        window.showToast(`Identity created! Welcome, ${newUser.username}.`, 'success');
    }
}

export function toggleUserDropdown() {
    const dropdown = document.getElementById('user-dropdown-panel');
    if (!dropdown) return;
    const isShowing = dropdown.style.display === 'block';
    dropdown.style.display = isShowing ? 'none' : 'block';
}

export function closeUserDropdown() {
    const dropdown = document.getElementById('user-dropdown-panel');
    if (dropdown) dropdown.style.display = 'none';
}

// Window global bindings for inline onclick attributes
window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;
window.switchAuthTab = switchAuthTab;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.logoutUser = logoutUser;
window.toggleUserDropdown = toggleUserDropdown;
window.togglePasswordVisibility = togglePasswordVisibility;

// Close dropdown or modal on external click
document.addEventListener('click', (e) => {
    const userMenu = document.getElementById('user-profile-menu');
    const dropdown = document.getElementById('user-dropdown-panel');
    if (userMenu && dropdown && !userMenu.contains(e.target)) {
        dropdown.style.display = 'none';
    }

    const modal = document.getElementById('auth-modal');
    if (modal && e.target === modal) {
        closeAuthModal();
    }
});

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeAuthModal();
        closeUserDropdown();
    }
});

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    updateAuthUI();
});

