/**
 * responses.js — Responses analytics for FormsCosmo
 */

let form = null;
let responses = [];
let currentResponseIndex = 0;
let currentTab = 'summary';

// ─── Init ─────────────────────────────────────────────────
async function init() {
    const formId = getUrlParam('id');
    if (!formId) {
        showToast('No form ID specified', 'error');
        return;
    }

    try {
        const [formResult, respResult] = await Promise.all([
            Api.getForm(formId),
            Api.getResponses(formId)
        ]);

        if (!formResult.success) throw new Error(formResult.error || 'Form not found');

        form = formResult.data;
        responses = respResult.success ? (respResult.data || []) : [];

        renderPage();
        setupEventListeners();
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
        document.getElementById('loadingState').innerHTML = `<p style="color:var(--danger);">Failed to load form: ${err.message}</p>`;
    }
}

function renderPage() {
    hide(document.getElementById('loadingState'));
    show(document.getElementById('mainContent'));

    // Navbar
    document.getElementById('formTitleNav').textContent = form.title || 'Untitled Form';
    const viewLink = document.getElementById('viewFormLink');
    viewLink.href = `form-view.html?id=${form.id}`;

    // Stats
    document.getElementById('totalResponseCount').textContent = responses.length;
    document.getElementById('totalQuestions').textContent =
        (form.questions || []).filter(q => q.type !== 'section').length;

    if (responses.length) {
        const latest = responses[0];
        document.getElementById('lastResponseDate').textContent = timeAgo(latest.submittedAt);
    } else {
        document.getElementById('lastResponseDate').textContent = '—';
    }

    renderSummaryTab();
    renderIndividualNav();
}

// ─── Summary Tab ──────────────────────────────────────────
function renderSummaryTab() {
    const container = document.getElementById('questionSummaryContainer');
    const noMsg = document.getElementById('noResponsesMsg');
    const questions = (form.questions || []).filter(q => q.type !== 'section');

    if (!responses.length) {
        container.innerHTML = '';
        show(noMsg);
        return;
    }

    hide(noMsg);
    container.innerHTML = questions.map((q, i) => buildQuestionSummary(q, i)).join('');

    // Animate bars after render
    requestAnimationFrame(() => {
        document.querySelectorAll('.choice-bar-fill').forEach(el => {
            el.style.width = el.dataset.pct + '%';
        });
        document.querySelectorAll('.scale-dist-bar').forEach(el => {
            el.style.height = el.dataset.h + 'px';
        });
    });
}

function buildQuestionSummary(q, index) {
    const answers = responses.map(r => {
        const ans = (r.answers || []).find(a => a.questionId === q.id);
        return ans ? ans.value : null;
    }).filter(a => a !== null && a !== '' && a !== undefined);

    const responseCount = answers.length;

    let bodyHtml = '';

    if (['multiple_choice', 'checkboxes', 'dropdown'].includes(q.type)) {
        // Count options
        const counts = {};
        (q.options || []).forEach(opt => counts[opt] = 0);
        answers.forEach(v => {
            if (Array.isArray(v)) v.forEach(s => { if (counts[s] !== undefined) counts[s]++; else counts[s] = 1; });
            else if (v && counts[v] !== undefined) counts[v]++;
            else if (v) counts[v] = (counts[v] || 0) + 1;
        });

        const total = Object.values(counts).reduce((s, c) => s + c, 0) || 1;
        bodyHtml = `
      <div class="choice-bar-list">
        ${Object.entries(counts).map(([opt, cnt]) => {
            const pct = Math.round((cnt / total) * 100);
            return `
            <div class="choice-bar-item">
              <div class="choice-bar-label">
                <span>${escHtml(opt)}</span>
                <span>${cnt} (${pct}%)</span>
              </div>
              <div class="choice-bar-track">
                <div class="choice-bar-fill" style="width:0%" data-pct="${pct}"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    } else if (q.type === 'linear_scale') {
        const min = q.scaleMin ?? 1;
        const max = q.scaleMax ?? 5;
        const counts = {};
        for (let i = min; i <= max; i++) counts[i] = 0;
        answers.forEach(v => {
            const n = parseInt(v);
            if (!isNaN(n) && counts[n] !== undefined) counts[n]++;
        });

        const maxCount = Math.max(...Object.values(counts), 1);
        const avg = answers.length
            ? (answers.reduce((s, v) => s + (parseFloat(v) || 0), 0) / answers.length).toFixed(1)
            : '—';

        bodyHtml = `
      <p style="margin-bottom:12px;font-size:0.9rem;color:var(--text-muted);">Average: <strong style="color:var(--primary);">${avg}</strong></p>
      <div class="scale-distribution">
        ${Object.entries(counts).map(([val, cnt]) => {
            const barH = Math.max(4, Math.round((cnt / maxCount) * 60));
            return `
            <div class="scale-dist-col">
              <div class="scale-dist-bar" style="height:0px" data-h="${barH}"></div>
              <span class="scale-dist-label">${val}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;

    } else {
        // Short answer / paragraph / date — list answers
        const displayAnswers = answers.slice(0, 8);
        const remaining = answers.length - displayAnswers.length;
        bodyHtml = `
      <div class="text-answers-list">
        ${displayAnswers.map(a => `<div class="text-answer-item">${escHtml(String(a))}</div>`).join('')}
        ${remaining > 0 ? `<div class="text-muted text-sm">...and ${remaining} more</div>` : ''}
      </div>
    `;
    }

    return `
    <div class="q-summary-card">
      <div class="q-summary-header">
        <div style="display:flex;align-items:center;gap:12px;flex:1;">
          <span class="q-summary-number">Q${index + 1}</span>
          <span class="q-summary-title">${escHtml(q.title || 'Question')}</span>
        </div>
        <span class="q-response-count">${responseCount} response${responseCount !== 1 ? 's' : ''}</span>
      </div>
      ${bodyHtml}
    </div>
  `;
}

// ─── Individual Tab ───────────────────────────────────────
function renderIndividualNav() {
    const prev = document.getElementById('prevResponseBtn');
    const next = document.getElementById('nextResponseBtn');
    const counter = document.getElementById('responseCounter');

    if (!responses.length) {
        counter.textContent = 'No responses';
        return;
    }

    counter.textContent = `Response ${currentResponseIndex + 1} of ${responses.length}`;
    prev.disabled = currentResponseIndex === 0;
    next.disabled = currentResponseIndex === responses.length - 1;

    renderIndividualResponse();
}

function renderIndividualResponse() {
    const container = document.getElementById('individualResponseContainer');
    if (!responses.length) {
        container.innerHTML = '<div class="empty-state"><span class="empty-icon">📭</span><h3>No responses yet</h3></div>';
        return;
    }

    const r = responses[currentResponseIndex];
    const questions = (form.questions || []).filter(q => q.type !== 'section');

    container.innerHTML = `
    <div class="individual-response-card">
      <div class="individual-response-header">
        <h4>Response #${currentResponseIndex + 1}</h4>
        <div>
          ${r.respondentEmail ? `<div class="response-meta">📧 ${escHtml(r.respondentEmail)}</div>` : ''}
          <div class="response-meta">🕐 ${formatDateTime(r.submittedAt)}</div>
        </div>
      </div>
      <div class="individual-answer-list">
        ${questions.map(q => {
        const ans = (r.answers || []).find(a => a.questionId === q.id);
        let displayValue = '—';
        if (ans && ans.value !== null && ans.value !== undefined && ans.value !== '') {
            if (Array.isArray(ans.value)) displayValue = ans.value.join(', ');
            else displayValue = String(ans.value);
        }
        return `
            <div class="individual-answer">
              <div class="individual-answer-question">${escHtml(q.title || 'Question')}</div>
              <div class="individual-answer-value ${!ans || !ans.value ? 'individual-answer-empty' : ''}">${escHtml(displayValue)}</div>
            </div>
          `;
    }).join('')}
      </div>
    </div>
  `;
}

// ─── Tab Switching ────────────────────────────────────────
function switchTab(tab) {
    currentTab = tab;
    document.getElementById('summaryTabBtn').classList.toggle('active', tab === 'summary');
    document.getElementById('individualTabBtn').classList.toggle('active', tab === 'individual');

    const summaryTab = document.getElementById('summaryTab');
    const individualTab = document.getElementById('individualTab');

    if (tab === 'summary') { show(summaryTab); hide(individualTab); }
    else { hide(summaryTab); show(individualTab); }
}

// ─── Event Listeners ─────────────────────────────────────
function setupEventListeners() {
    document.getElementById('summaryTabBtn')?.addEventListener('click', () => switchTab('summary'));
    document.getElementById('individualTabBtn')?.addEventListener('click', () => switchTab('individual'));

    document.getElementById('prevResponseBtn')?.addEventListener('click', () => {
        if (currentResponseIndex > 0) {
            currentResponseIndex--;
            renderIndividualNav();
        }
    });

    document.getElementById('nextResponseBtn')?.addEventListener('click', () => {
        if (currentResponseIndex < responses.length - 1) {
            currentResponseIndex++;
            renderIndividualNav();
        }
    });

    document.getElementById('exportCsvBtn')?.addEventListener('click', () => {
        exportToCSV(form, responses);
    });

    document.getElementById('deleteAllBtn')?.addEventListener('click', async () => {
        if (!responses.length) { showToast('No responses to delete', 'warning'); return; }
        if (!confirm(`Delete all ${responses.length} responses for "${form.title}"? This cannot be undone.`)) return;

        try {
            await Promise.all(responses.map(r => Api.deleteResponse(form.id, r.id)));
            responses = [];
            renderSummaryTab();
            renderIndividualNav();
            document.getElementById('totalResponseCount').textContent = '0';
            document.getElementById('lastResponseDate').textContent = '—';
            showToast('All responses deleted', 'success');
        } catch (err) {
            showToast('Failed to delete: ' + err.message, 'error');
        }
    });
}

// ─── Utility ──────────────────────────────────────────────
function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ─── Boot ─────────────────────────────────────────────────
init();
