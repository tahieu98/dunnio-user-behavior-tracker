/**
 * Dunnio Behavior Tracker - Main Application
 */

const API_BASE = '/api';
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// State
let currentUser = null;
let pages = [];
let suggestions = [];
let selectedPage = null;
let heatmapChart = null;

// =============================================
// INITIALIZATION
// =============================================

document.addEventListener('DOMContentLoaded', () => {
    init();
});

async function init() {
    // Check authentication
    if (!checkAuth()) {
        window.location.href = '/login.html';
        return;
    }

    // Load user data
    loadUserData();

    // Initialize components
    initNavigation();
    initSidebar();
    initModals();
    initToasts();

    // Load initial data
    await loadDashboard();
    await loadPages();
    await checkClarityStatus();

    // Setup event listeners
    setupEventListeners();
}

// =============================================
// AUTHENTICATION
// =============================================

function checkAuth() {
    const token = (localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token'));
    if (!token) return false;

    // Check token validity
    fetch(`${API_BASE}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => {
        if (!res.ok) {
            logout();
        }
    })
    .catch(() => logout());

    return true;
}

function loadUserData() {
    const userData = (localStorage.getItem('user_data') || sessionStorage.getItem('user_data'));
    if (userData) {
        currentUser = JSON.parse(userData);
        document.getElementById('userName').textContent = currentUser.username;
        document.getElementById('userRole').textContent = currentUser.role;
    }
}

function logout() {
    localStorage.removeItem('auth_token'); sessionStorage.removeItem('auth_token');
    localStorage.removeItem('user_data'); sessionStorage.removeItem('user_data');
    window.location.href = '/login.html';
}

function getAuthHeaders() {
    return {
        'Authorization': `Bearer ${(localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token'))}`,
        'Content-Type': 'application/json'
    };
}

// =============================================
// NAVIGATION
// =============================================

function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const pages = document.querySelectorAll('.page');
    const pageTitle = document.getElementById('pageTitle');
    const breadcrumb = document.getElementById('breadcrumb');

    navItems.forEach(item => {
        if (!item.dataset.page) return;
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetPage = item.dataset.page;

            // Update nav
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            // Update pages
            pages.forEach(page => page.classList.remove('active'));
            document.getElementById(`${targetPage}Page`).classList.add('active');

            // Update header
            const titles = {
                dashboard: { title: 'Dashboard', breadcrumb: 'Home / Dashboard' },
                pages: { title: 'Pages', breadcrumb: 'Home / Pages' },
                'grid-view': { title: 'Grid View', breadcrumb: 'Home / Grid View' },
                heatmap: { title: 'Heatmap', breadcrumb: 'Home / Heatmap' },
                suggestions: { title: 'CTA Suggestions', breadcrumb: 'Home / Suggestions' },
                settings: { title: 'Settings', breadcrumb: 'Home / Settings' }
            };

            if (titles[targetPage]) {
                pageTitle.textContent = titles[targetPage].title;
                breadcrumb.textContent = titles[targetPage].breadcrumb;
            }
        });
    });
}

function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggle = document.getElementById('sidebarToggle');

    toggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
    });
}

// =============================================
// MODALS & TOASTS
// =============================================

function initModals() {
    const modal = document.getElementById('suggestionModal');
    const modalClose = document.getElementById('modalClose');

    modalClose.addEventListener('click', () => {
        modal.classList.remove('active');
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
}

function showModal(title, content, actions = []) {
    const modal = document.getElementById('suggestionModal');
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = content;

    const footer = document.getElementById('modalFooter');
    footer.innerHTML = actions.map(action =>
        `<button class="${action.class || 'btn-secondary'}" data-action="${action.action}">${action.label}</button>`
    ).join('');

    // Bind action handlers
    footer.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
            const actionName = btn.dataset.action;
            const action = actions.find(a => a.action === actionName);
            if (action && action.handler) {
                action.handler();
            }
        });
    });

    modal.classList.add('active');
}

function initToasts() {
    window.showToast = (message, type = 'success') => {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    };
}

// =============================================
// DATA LOADING
// =============================================

async function loadDashboard() {
    try {
        // Load stats
        const [pagesRes, suggestionsRes] = await Promise.all([
            fetch(`${API_BASE}/pages`, { headers: getAuthHeaders() }),
            fetch(`${API_BASE}/cta/stats`, { headers: getAuthHeaders() })
        ]);

        const pagesData = await pagesRes.json();
        const suggestionsData = await suggestionsRes.json();

        document.getElementById('totalPages').textContent = pagesData.data?.total || 0;
        document.getElementById('totalSuggestions').textContent = suggestionsData.data?.total || 0;
        document.getElementById('implementedCount').textContent = suggestionsData.data?.implemented || 0;

        // Load recent suggestions
        const recentRes = await fetch(`${API_BASE}/cta?limit=5`, { headers: getAuthHeaders() });
        const recentData = await recentRes.json();
        renderRecentSuggestions(recentData.data || []);

    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

function renderRecentSuggestions(suggestions) {
    const container = document.getElementById('recentSuggestions');

    if (suggestions.length === 0) {
        container.innerHTML = '<div class="empty-state">No suggestions yet</div>';
        return;
    }

    container.innerHTML = suggestions.map(s => `
        <div class="suggestion-item" onclick="showSuggestionDetail(${s.id})">
            <div class="suggestion-info">
                <div class="suggestion-title">${escapeHtml(s.suggestion_title)}</div>
                <div class="suggestion-meta">
                    <span>${escapeHtml(s.page_title || 'Unknown Page')}</span>
                    <span class="suggestion-badge badge-${s.status}">${s.status}</span>
                </div>
            </div>
        </div>
    `).join('');
}

async function loadPages() {
    try {
        const res = await fetch(`${API_BASE}/pages`, { headers: getAuthHeaders() });
        const data = await res.json();
        pages = data.data?.pages || [];

        renderPages(pages);
        populatePageSelectors(pages);
        loadCategories(pages);

    } catch (error) {
        console.error('Error loading pages:', error);
    }
}

function renderPages(pagesToRender) {
    const grid = document.getElementById('pagesGrid');

    if (pagesToRender.length === 0) {
        grid.innerHTML = '<div class="empty-state">No pages found</div>';
        return;
    }

    grid.innerHTML = pagesToRender.map(page => `
        <div class="page-card" onclick="selectPage(${page.id})">
            <div class="page-card-header">
                <div>
                    <div class="page-card-title">${escapeHtml(page.title)}</div>
                    <div class="page-card-url">${escapeHtml(page.url)}</div>
                </div>
                <span class="page-card-badge ${page.is_3d_demo ? 'badge-3d' : 'badge-product'}">
                    ${page.is_3d_demo ? '3D Demo' : 'Product'}
                </span>
            </div>
            <div class="page-card-stats">
                <div class="page-card-stat">📊 ${escapeHtml(page.category)}</div>
                <div class="page-card-stat">🔗 Row/Col tracking enabled</div>
            </div>
        </div>
    `).join('');
}

function populatePageSelectors(pages) {
    const selectors = [
        document.getElementById('gridPageSelect'),
        document.getElementById('heatmapPageSelect')
    ];

    const options = '<option value="">Choose a page...</option>' +
        pages.map(p => `<option value="${p.id}">${escapeHtml(p.title)}</option>`).join('');

    selectors.forEach(sel => {
        if (sel) sel.innerHTML = options;
    });
}

function loadCategories(pages) {
    const categories = [...new Set(pages.map(p => p.category))];
    const select = document.getElementById('categoryFilter');

    select.innerHTML = '<option value="">All Categories</option>' +
        categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
}

async function checkClarityStatus() {
    try {
        const res = await fetch(`${API_BASE}/clarity/status`, { headers: getAuthHeaders() });
        const data = await res.json();

        const statusEl = document.getElementById('clarityStatus');
        const dot = statusEl.querySelector('.status-dot');
        const text = statusEl.querySelector('.status-text');

        if (data.data?.configured) {
            dot.classList.add('connected');
            text.textContent = `Clarity: ${data.data.projectName || data.data.projectId}`;
        } else {
            text.textContent = 'Clarity: Not Connected';
        }
    } catch (error) {
        console.error('Error checking Clarity status:', error);
    }
}

// =============================================
// GRID VISUALIZATION
// =============================================

async function selectPage(pageId) {
    selectedPage = pages.find(p => p.id === pageId);
    if (!selectedPage) return;

    // Switch to grid view
    document.querySelector('[data-page="grid-view"]').click();

    // Load grid data
    await loadGridData(pageId);
}

async function loadGridData(pageId) {
    const days = parseInt(document.getElementById('timeRange').value) || 7;

    try {
        const res = await fetch(`${API_BASE}/pages/${pageId}/analytics?days=${days}`, {
            headers: getAuthHeaders()
        });
        const data = await res.json();

        if (data.success) {
            renderGrid(data.data);
        }
    } catch (error) {
        console.error('Error loading grid data:', error);
    }
}

function renderGrid(analyticsData) {
    const container = document.getElementById('gridOverlay');
    const placeholder = container.parentElement.querySelector('.grid-placeholder');

    if (!analyticsData || !analyticsData.page) {
        placeholder.style.display = 'flex';
        return;
    }

    placeholder.style.display = 'none';

    const page = analyticsData.page;
    const hotspots = analyticsData.hotspots || [];
    const deadZones = analyticsData.deadZones || [];
    const clickData = analyticsData.clickData || [];

    // Create grid
    const cols = page.grid_columns || 12;
    const rows = Math.min(page.grid_max_rows || 50, 30);
    const rowHeight = page.grid_row_height || 50;

    container.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    container.style.width = '100%';
    container.innerHTML = '';

    // Create cells
    for (let row = 1; row <= rows; row++) {
        for (let col = 1; col <= cols; col++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.dataset.col = col;
            cell.dataset.row = row;

            // Calculate heat level
            const hotspot = hotspots.find(h =>
                col >= h.grid_col_start && col <= h.grid_col_end &&
                row >= h.grid_row_start && row <= h.grid_row_end
            );

            const isDead = deadZones.some(d => d.grid_col === col && d.grid_row === row);
            const clicks = hotspot ? hotspot.total_clicks : 0;

            // Apply heat class
            if (isDead) {
                cell.classList.add('dead');
            } else if (clicks > 50) {
                cell.classList.add('hot');
            } else if (clicks > 10) {
                cell.classList.add('warm');
            } else if (clicks > 0) {
                cell.classList.add('cold');
            }

            // Add content
            const showLabels = document.getElementById('showLabels')?.checked;
            const showElements = document.getElementById('showElements')?.checked;

            if (showLabels) {
                cell.innerHTML = `<span class="cell-label">${col},${row}</span>`;
            }

            if (clicks > 0 && showElements) {
                cell.innerHTML += `<span class="cell-content">${clicks}</span>`;
            }

            // Add tooltip
            cell.innerHTML += `
                <div class="cell-tooltip">
                    <div class="tooltip-stat"><span>Position:</span> <span>Col ${col}, Row ${row}</span></div>
                    <div class="tooltip-stat"><span>Clicks:</span> <span>${clicks}</span></div>
                    ${hotspot ? `<div class="tooltip-stat"><span>Element:</span> <span>${escapeHtml(hotspot.element_selector?.substring(0, 30) || 'Unknown')}...</span></div>` : ''}
                </div>
            `;

            // Click handler
            cell.addEventListener('click', () => showCellInfo(col, row, clicks, hotspot));

            container.appendChild(cell);
        }
    }
}

function showCellInfo(col, row, clicks, hotspot) {
    const panel = document.querySelector('.cell-info-panel') || createCellInfoPanel();
    panel.classList.add('visible');

    panel.innerHTML = `
        <div class="cell-info-header">
            <h4>Cell (${col}, ${row})</h4>
            <button class="cell-info-close" onclick="this.parentElement.parentElement.classList.remove('visible')">×</button>
        </div>
        <div class="cell-info-body">
            <div class="cell-info-stats">
                <div class="cell-stat">
                    <div class="cell-stat-label">Clicks</div>
                    <div class="cell-stat-value">${clicks}</div>
                </div>
                <div class="cell-stat">
                    <div class="cell-stat-label">Status</div>
                    <div class="cell-stat-value">${clicks === 0 ? 'Dead' : clicks > 10 ? 'Hot' : 'Active'}</div>
                </div>
            </div>
            ${hotspot ? `
                <div class="form-group">
                    <label>Element</label>
                    <code>${escapeHtml(hotspot.element_selector || 'Unknown')}</code>
                </div>
            ` : ''}
            <div class="cell-info-actions">
                <button class="btn-primary btn-sm" onclick="createSuggestionForCell(${col}, ${row})">
                    💡 Create Suggestion
                </button>
            </div>
        </div>
    `;
}

function createCellInfoPanel() {
    const panel = document.createElement('div');
    panel.className = 'cell-info-panel';
    document.body.appendChild(panel);
    return panel;
}

// =============================================
// CTA SUGGESTIONS
// =============================================

async function loadSuggestions() {
    const status = document.getElementById('statusFilter').value;
    const type = document.getElementById('typeFilter').value;

    let url = `${API_BASE}/cta?limit=50`;
    if (status) url += `&status=${status}`;
    if (type) url += `&suggestion_type=${type}`;

    try {
        const res = await fetch(url, { headers: getAuthHeaders() });
        const data = await res.json();
        suggestions = data.data || [];
        renderSuggestions(suggestions);
    } catch (error) {
        console.error('Error loading suggestions:', error);
    }
}

function renderSuggestions(suggestionsToRender) {
    const container = document.getElementById('suggestionsList');

    if (suggestionsToRender.length === 0) {
        container.innerHTML = '<div class="empty-state">No suggestions found</div>';
        return;
    }

    container.innerHTML = suggestionsToRender.map(s => `
        <div class="suggestion-item">
            <div class="suggestion-info">
                <div class="suggestion-title">${escapeHtml(s.suggestion_title)}</div>
                <div class="suggestion-meta">
                    <span>📄 ${escapeHtml(s.page_title || 'Unknown')}</span>
                    <span>📍 (${s.grid_col}, ${s.grid_row})</span>
                    <span>🎯 ${s.suggestion_type?.replace('_', ' ')}</span>
                </div>
            </div>
            <span class="suggestion-badge badge-${s.status}">${s.status}</span>
            <div class="suggestion-actions">
                <button class="btn-sm btn-secondary" onclick="showSuggestionDetail(${s.id})">View</button>
            </div>
        </div>
    `).join('');
}

async function showSuggestionDetail(id) {
    try {
        const res = await fetch(`${API_BASE}/cta/${id}`, { headers: getAuthHeaders() });
        const data = await res.json();

        if (data.success) {
            const s = data.data;
            showModal(s.suggestion_title, `
                <div class="form-group">
                    <label>Page</label>
                    <p>${escapeHtml(s.page_title)}</p>
                </div>
                <div class="form-group">
                    <label>Position</label>
                    <p>Column ${s.grid_col}, Row ${s.grid_row}</p>
                </div>
                <div class="form-group">
                    <label>Type</label>
                    <p>${s.suggestion_type?.replace('_', ' ')}</p>
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <p>${escapeHtml(s.suggestion_text || 'No description')}</p>
                </div>
                <div class="form-group">
                    <label>Suggested Code</label>
                    <pre style="background: var(--bg-color); padding: 12px; border-radius: 8px; overflow-x: auto;">${escapeHtml(s.suggestion_code || 'No code provided')}</pre>
                </div>
                <div class="form-group">
                    <label>Priority</label>
                    <p>${s.priority}/10</p>
                </div>
                <div class="form-group">
                    <label>Status</label>
                    <select id="suggestionStatus" class="filter-select">
                        <option value="pending" ${s.status === 'pending' ? 'selected' : ''}>Pending</option>
                        <option value="approved" ${s.status === 'approved' ? 'selected' : ''}>Approved</option>
                        <option value="implemented" ${s.status === 'implemented' ? 'selected' : ''}>Implemented</option>
                        <option value="rejected" ${s.status === 'rejected' ? 'selected' : ''}>Rejected</option>
                    </select>
                </div>
            `, [
                { label: 'Close', action: 'close', class: 'btn-secondary' },
                { label: 'Save', action: 'save', class: 'btn-primary', handler: () => updateSuggestionStatus(id) }
            ]);
        }
    } catch (error) {
        console.error('Error loading suggestion:', error);
    }
}

async function updateSuggestionStatus(id) {
    const status = document.getElementById('suggestionStatus').value;

    try {
        const res = await fetch(`${API_BASE}/cta/${id}/status`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify({ status })
        });

        if (res.ok) {
            showToast('Status updated', 'success');
            document.getElementById('suggestionModal').classList.remove('active');
            loadSuggestions();
        }
    } catch (error) {
        showToast('Error updating status', 'error');
    }
}

async function createSuggestionForCell(col, row) {
    if (!selectedPage) {
        showToast('Please select a page first', 'warning');
        return;
    }

    showModal('Create Suggestion', `
        <form id="createSuggestionForm">
            <div class="form-group">
                <label>Page</label>
                <p>${escapeHtml(selectedPage.title)}</p>
            </div>
            <div class="form-group">
                <label>Position</label>
                <p>Column ${col}, Row ${row}</p>
            </div>
            <div class="form-group">
                <label>Type</label>
                <select id="suggestionType" class="filter-select" required>
                    <option value="cta_button">CTA Button</option>
                    <option value="internal_link">Internal Link</option>
                    <option value="promo_banner">Promo Banner</option>
                    <option value="product_feature">Product Feature</option>
                </select>
            </div>
            <div class="form-group">
                <label>Title</label>
                <input type="text" id="suggestionTitle" required placeholder="e.g., Add Book Now button">
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea id="suggestionText" rows="3" placeholder="Describe the suggestion..."></textarea>
            </div>
        </form>
    `, [
        { label: 'Cancel', action: 'cancel', class: 'btn-secondary' },
        { label: 'Create', action: 'create', class: 'btn-primary', handler: () => submitSuggestion(col, row) }
    ]);
}

async function submitSuggestion(col, row) {
    const data = {
        page_id: selectedPage.id,
        grid_col: col,
        grid_row: row,
        suggestion_type: document.getElementById('suggestionType').value,
        suggestion_title: document.getElementById('suggestionTitle').value,
        suggestion_text: document.getElementById('suggestionText').value
    };

    try {
        const res = await fetch(`${API_BASE}/cta`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        });

        if (res.ok) {
            showToast('Suggestion created', 'success');
            document.getElementById('suggestionModal').classList.remove('active');
        }
    } catch (error) {
        showToast('Error creating suggestion', 'error');
    }
}

// =============================================
// EVENT LISTENERS
// =============================================

function setupEventListeners() {
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // Page filters
    document.getElementById('categoryFilter')?.addEventListener('change', filterPages);
    document.getElementById('pageTypeFilter')?.addEventListener('change', filterPages);
    document.getElementById('searchPages')?.addEventListener('input', filterPages);

    // Grid controls
    document.getElementById('gridPageSelect')?.addEventListener('change', (e) => {
        if (e.target.value) {
            selectedPage = pages.find(p => p.id === parseInt(e.target.value));
            loadGridData(e.target.value);
        }
    });

    document.getElementById('showLabels')?.addEventListener('change', () => {
        if (selectedPage) loadGridData(selectedPage.id);
    });

    document.getElementById('timeRange')?.addEventListener('change', () => {
        if (selectedPage) loadGridData(selectedPage.id);
    });

    // Heatmap
    document.getElementById('heatmapPageSelect')?.addEventListener('change', (e) => {
        if (e.target.value) loadHeatmap(e.target.value);
    });

    // Suggestion filters
    document.getElementById('statusFilter')?.addEventListener('change', loadSuggestions);
    document.getElementById('typeFilter')?.addEventListener('change', loadSuggestions);

    // Settings
    document.getElementById('clarityConfigForm')?.addEventListener('submit', saveClarityConfig);
}

function filterPages() {
    const category = document.getElementById('categoryFilter')?.value;
    const type = document.getElementById('pageTypeFilter')?.value;
    const search = document.getElementById('searchPages')?.value.toLowerCase();

    let filtered = pages;

    if (category) {
        filtered = filtered.filter(p => p.category === category);
    }

    if (type === 'product') {
        filtered = filtered.filter(p => !p.is_3d_demo);
    } else if (type === '3d-demo') {
        filtered = filtered.filter(p => p.is_3d_demo);
    }

    if (search) {
        filtered = filtered.filter(p =>
            p.title.toLowerCase().includes(search) ||
            p.url.toLowerCase().includes(search)
        );
    }

    renderPages(filtered);
}

async function loadHeatmap(pageId) {
    // Placeholder for heatmap visualization
    const container = document.getElementById('heatmapContainer');
    container.innerHTML = '<div class="empty-state">Heatmap visualization for page ' + pageId + '</div>';
}

async function saveClarityConfig(e) {
    e.preventDefault();

    const data = {
        project_id: document.getElementById('clarityProjectId').value,
        jwt_token: document.getElementById('clarityToken').value,
        project_name: document.getElementById('clarityProjectName').value
    };

    try {
        const res = await fetch(`${API_BASE}/clarity/token`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        });

        if (res.ok) {
            showToast('Clarity configuration saved', 'success');
            checkClarityStatus();
        } else {
            showToast('Error saving configuration', 'error');
        }
    } catch (error) {
        showToast('Error saving configuration', 'error');
    }
}

// =============================================
// EXPORTS
// =============================================

window.selectPage = selectPage;
window.showSuggestionDetail = showSuggestionDetail;
window.createSuggestionForCell = createSuggestionForCell;

