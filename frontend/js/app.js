// API Configuration - Uses config.js for environment-based URL
const API_BASE = typeof CONFIG !== 'undefined' ? CONFIG.API_BASE_URL : 'http://localhost:3000/api';

// Get auth token
function getToken() {
    return localStorage.getItem('token');
}

// Fetch with auth
async function fetchAPI(endpoint, options = {}) {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
    };

    return fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: { ...headers, ...options.headers }
    });
}

// Check authentication
function checkAuth() {
    const token = getToken();
    if (!token && !window.location.pathname.includes('index.html') && window.location.pathname !== '/') {
        window.location.href = 'index.html';
        return false;
    }

    // Show admin links if admin
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.role === 'admin') {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
    }

    // Logout handler
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = 'index.html';
        });
    }

    return true;
}

// Show alert
function showAlert(element, message, type) {
    element.className = `alert alert-${type}`;
    element.textContent = type === 'success' ? '✓ ' + message : type === 'danger' ? '✕ ' + message : '⚠ ' + message;
    element.classList.remove('hidden');

    if (type === 'success') {
        setTimeout(() => element.classList.add('hidden'), 3000);
    }
}

// Format date
function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}
