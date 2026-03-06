/**
 * utils.js — Shared utility functions for FormsCosmo
 */

// ─── Toast Notifications ─────────────────────────────────
function showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const icons = { success: '✅', error: '❌', warning: '⚠️', info: '💬' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${icons[type] || '💬'}</span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('removing');
        toast.addEventListener('animationend', () => toast.remove());
    }, duration);
}

// ─── URL Parameters ──────────────────────────────────────
function getUrlParam(name) {
    return new URLSearchParams(window.location.search).get(name);
}

// ─── Format date ─────────────────────────────────────────
function formatDate(isoString) {
    if (!isoString) return '—';
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(isoString) {
    if (!isoString) return '—';
    const d = new Date(isoString);
    return d.toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function timeAgo(isoString) {
    if (!isoString) return '';
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return formatDate(isoString);
}

// ─── Question type helpers ───────────────────────────────
const QUESTION_TYPE_LABELS = {
    short_answer: 'Short Answer',
    paragraph: 'Paragraph',
    multiple_choice: 'Multiple Choice',
    checkboxes: 'Checkboxes',
    dropdown: 'Dropdown',
    linear_scale: 'Linear Scale',
    date: 'Date',
    section: 'Section'
};

const QUESTION_TYPE_ICONS = {
    short_answer: '📝',
    paragraph: '📄',
    multiple_choice: '🔘',
    checkboxes: '☑️',
    dropdown: '🔽',
    linear_scale: '📊',
    date: '📅',
    section: '📌'
};

function questionTypeLabel(type) {
    return QUESTION_TYPE_LABELS[type] || type;
}

// ─── Card color themes ───────────────────────────────────
const CARD_THEMES = [
    { class: 'theme-purple', color: '#7c3aed' },
    { class: 'theme-blue', color: '#3b82f6' },
    { class: 'theme-cyan', color: '#06b6d4' },
    { class: 'theme-green', color: '#10b981' },
    { class: 'theme-pink', color: '#ec4899' },
    { class: 'theme-orange', color: '#f97316' },
    { class: 'theme-red', color: '#ef4444' },
];

function getThemeClass(color) {
    const found = CARD_THEMES.find(t => t.color === color);
    return found ? found.class : 'theme-purple';
}

function getCardEmoji(index) {
    const emojis = ['📋', '📝', '📊', '📌', '🎯', '📎', '🗂️', '📰', '📑', '📃'];
    return emojis[index % emojis.length];
}

// ─── Show/Hide utilities ─────────────────────────────────
function show(el) { if (el) el.classList.remove('hidden'); }
function hide(el) { if (el) el.classList.add('hidden'); }

// ─── Modal helpers ───────────────────────────────────────
function openModal(id) { show(document.getElementById(id)); }
function closeModal(id) { hide(document.getElementById(id)); }

// ─── Generate UUID (fallback for older browsers) ─────────
function generateId() {
    return crypto.randomUUID ? crypto.randomUUID() :
        'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
}

// ─── CSV Export ──────────────────────────────────────────
function exportToCSV(form, responses) {
    if (!responses.length) {
        showToast('No responses to export', 'warning');
        return;
    }

    const questions = (form.questions || []).filter(q => q.type !== 'section');
    const headers = ['Submitted At', 'Respondent Email', ...questions.map(q => q.title || 'Question')];

    const rows = responses.map(r => {
        const submittedAt = formatDateTime(r.submittedAt);
        const email = r.respondentEmail || '';
        const answers = questions.map(q => {
            const ans = (r.answers || []).find(a => a.questionId === q.id);
            if (!ans) return '';
            const v = ans.value;
            if (Array.isArray(v)) return v.join(', ');
            return v || '';
        });
        return [submittedAt, email, ...answers];
    });

    const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(form.title || 'form').replace(/[^a-z0-9]/gi, '_')}_responses.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('CSV exported successfully!', 'success');
}
