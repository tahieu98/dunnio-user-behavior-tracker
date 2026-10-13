/**
 * Auth Module - Login handling
 */

const API_BASE = '/api';

// DOM Elements
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const rememberCheckbox = document.getElementById('remember');
const errorMessage = document.getElementById('errorMessage');
const loginBtn = document.getElementById('loginBtn');

// Check if already logged in
function checkAuth() {
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    if (token) {
        // Verify token is still valid
        fetch(`${API_BASE}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(res => {
            if (res.ok) {
                window.location.href = '/touch.html';
            } else {
                localStorage.removeItem('auth_token');
                localStorage.removeItem('user_data');
                sessionStorage.removeItem('auth_token');
                sessionStorage.removeItem('user_data');
            }
        })
        .catch(() => {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_data');
            sessionStorage.removeItem('auth_token');
            sessionStorage.removeItem('user_data');
        });
    }
}

// Show error
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
}

// Hide error
function hideError() {
    errorMessage.style.display = 'none';
}

// Set loading state
function setLoading(loading) {
    const btnText = loginBtn.querySelector('.btn-text');
    const btnLoader = loginBtn.querySelector('.btn-loader');

    loginBtn.disabled = loading;
    btnText.style.display = loading ? 'none' : 'inline';
    btnLoader.style.display = loading ? 'inline-block' : 'none';
}

// Handle form submission
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
        showError('Vui lòng nhập tên đăng nhập và mật khẩu');
        return;
    }

    setLoading(true);

    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Login failed');
        }

        // Store token and user data
        const storage = rememberCheckbox.checked ? localStorage : sessionStorage;
        storage.setItem('auth_token', data.data.token);
        storage.setItem('user_data', JSON.stringify(data.data.user));

        // Redirect to dashboard
        window.location.href = '/touch.html';

    } catch (error) {
        showError(error.message || 'An error occurred. Please try again.');
        setLoading(false);
    }
});

// Clear error on input
usernameInput.addEventListener('input', hideError);
passwordInput.addEventListener('input', hideError);

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});
