/**
 * app.js — Dashboard logic for FormsCosmo
 */

let allForms = [];
let formToDelete = null;
let shareFormId = null;
let currentView = 'grid';

// ─── Init ─────────────────────────────────────────────────
async function init() {
    await loadForms();
    setupEventListeners();
}

// ─── Fetch and render forms ───────────────────────────────
async function loadForms() {
    try {
        const data = await Api.getForms();
        if (!data.success) throw new Error(data.error || 'Failed to load forms');

        allForms = data.data || [];
        renderForms(allForms);
        updateStats(allForms);
    } catch (err) {
        console.error(err);
        hide(document.getElementById('loadingState'));
        showToast('Could not connect to server. Is the backend running?', 'error', 6000);
        show(document.getElementById('emptyState'));
    }
}

function updateStats(forms) {
    document.getElementById('totalForms').textContent = forms.length;
    // Responses count loaded per form is expensive; just show forms count summary
    document.getElementById('totalResponses').textContent = '...';
}

function renderForms(forms) {
    hide(document.getElementById('loadingState'));
    const grid = document.getElementById('formsGrid');
    const empty = document.getElementById('emptyState');

    if (!forms.length) {
        hide(grid);
        show(empty);
        return;
    }

    hide(empty);
    show(grid);

    grid.innerHTML = forms.map((form, i) => {
        const themeColor = form.theme?.color || '#7c3aed';
        const themeClass = getThemeClass(themeColor);
        const emoji = getCardEmoji(i);
        const date = timeAgo(form.updatedAt || form.createdAt);
        const qCount = form.questionCount || 0;

        return `
      <div class="form-card" data-id="${form.id}">
        <div class="form-card-header ${themeClass}">
          <span class="form-card-emoji">${emoji}</span>
        </div>
        <div class="form-card-body">
          <div class="form-card-title">${escapeHtml(form.title || 'Untitled Form')}</div>
          <div class="form-card-meta">
            <span class="badge badge-purple">${qCount} question${qCount !== 1 ? 's' : ''}</span>
            <span class="form-card-date">${date}</span>
          </div>
          <div class="form-card-actions">
            <a href="form-builder.html?id=${form.id}" class="action-btn edit">
              <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Edit
            </a>
            <button class="action-btn share" onclick="openShare('${form.id}')">
              <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
              Share
            </button>
            <a href="responses.html?id=${form.id}" class="action-btn responses">
              <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
              Responses
            </a>
            <button class="action-btn delete" onclick="confirmDelete('${form.id}', '${escapeHtml(form.title).replace(/'/g, "\\'")}')">
              <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              Delete
            </button>
          </div>
        </div>
      </div>
    `;
    }).join('');
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ─── Search ───────────────────────────────────────────────
function filterForms(query) {
    const q = query.toLowerCase().trim();
    if (!q) return renderForms(allForms);
    renderForms(allForms.filter(f =>
        (f.title || '').toLowerCase().includes(q) ||
        (f.description || '').toLowerCase().includes(q)
    ));
}

// ─── View Toggle ──────────────────────────────────────────
function setView(view) {
    currentView = view;
    const grid = document.getElementById('formsGrid');
    document.getElementById('gridViewBtn').classList.toggle('active', view === 'grid');
    document.getElementById('listViewBtn').classList.toggle('active', view === 'list');
    grid.classList.toggle('list-view', view === 'list');
}

// ─── Delete ───────────────────────────────────────────────
function confirmDelete(id, title) {
    formToDelete = id;
    document.getElementById('deleteFormTitle').textContent = `"${title}"`;
    openModal('deleteModal');
}

async function deleteForm() {
    if (!formToDelete) return;
    try {
        document.getElementById('confirmDeleteBtn').textContent = 'Deleting...';
        document.getElementById('confirmDeleteBtn').disabled = true;

        const data = await Api.deleteForm(formToDelete);
        if (!data.success) throw new Error(data.error);

        closeModal('deleteModal');
        showToast('Form deleted successfully', 'success');
        allForms = allForms.filter(f => f.id !== formToDelete);
        renderForms(allForms);
        updateStats(allForms);
        formToDelete = null;
    } catch (err) {
        showToast('Failed to delete form: ' + err.message, 'error');
    } finally {
        document.getElementById('confirmDeleteBtn').textContent = 'Delete Form';
        document.getElementById('confirmDeleteBtn').disabled = false;
    }
}

// ─── Share ────────────────────────────────────────────────
function openShare(formId) {
    shareFormId = formId;
    const url = `${window.location.origin}${window.location.pathname.replace('index.html', '')}form-view.html?id=${formId}`;
    document.getElementById('shareUrlInput').value = url;
    openModal('shareModal');
}

function copyShareLink() {
    const input = document.getElementById('shareUrlInput');
    input.select();
    navigator.clipboard.writeText(input.value).then(() => {
        showToast('Link copied to clipboard!', 'success');
    }).catch(() => {
        document.execCommand('copy');
        showToast('Link copied!', 'success');
    });
}

// ─── Event Listeners ─────────────────────────────────────
function setupEventListeners() {
    document.getElementById('createFormBtn')?.addEventListener('click', () => {
        window.location.href = 'form-builder.html';
    });
    document.getElementById('createFormEmptyBtn')?.addEventListener('click', () => {
        window.location.href = 'form-builder.html';
    });

    document.getElementById('searchInput')?.addEventListener('input', e => filterForms(e.target.value));

    document.getElementById('gridViewBtn')?.addEventListener('click', () => setView('grid'));
    document.getElementById('listViewBtn')?.addEventListener('click', () => setView('list'));

    document.getElementById('confirmDeleteBtn')?.addEventListener('click', deleteForm);
    document.getElementById('cancelDeleteBtn')?.addEventListener('click', () => closeModal('deleteModal'));
    document.getElementById('closeDeleteModal')?.addEventListener('click', () => closeModal('deleteModal'));

    document.getElementById('closeShareModal')?.addEventListener('click', () => closeModal('shareModal'));
    document.getElementById('copyLinkBtn')?.addEventListener('click', copyShareLink);

    // Close modals on overlay click
    document.getElementById('deleteModal')?.addEventListener('click', e => {
        if (e.target === e.currentTarget) closeModal('deleteModal');
    });
    document.getElementById('shareModal')?.addEventListener('click', e => {
        if (e.target === e.currentTarget) closeModal('shareModal');
    });
}

// ─── Boot ─────────────────────────────────────────────────
init();
