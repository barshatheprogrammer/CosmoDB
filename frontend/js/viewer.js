/**
 * viewer.js — Form Viewer logic for FormsCosmo
 */

let form = null;
let answers = {};
let progressEnabled = true;

// ─── Init ─────────────────────────────────────────────────
async function init() {
    const formId = getUrlParam('id');
    if (!formId) {
        showError();
        return;
    }

    try {
        const data = await Api.getForm(formId);
        if (!data.success || !data.data) throw new Error('Form not found');

        form = data.data;
        renderForm(form);
    } catch (err) {
        showError();
    }
}

function showError() {
    hide(document.getElementById('loadingState'));
    show(document.getElementById('errorState'));
}

// ─── Render Form ──────────────────────────────────────────
function renderForm(form) {
    hide(document.getElementById('loadingState'));
    show(document.getElementById('formViewer'));

    document.title = `${form.title || 'Form'} — FormsCosmo`;

    // Theme
    const color = form.theme?.color || '#7c3aed';
    document.getElementById('viewerColorBar').style.background = color;

    // Header
    document.getElementById('viewerFormTitle').textContent = form.title || 'Untitled Form';
    const desc = form.description || '';
    document.getElementById('viewerFormDescription').textContent = desc;
    if (!desc) hide(document.getElementById('viewerFormDescription'));

    // Settings
    progressEnabled = form.settings?.showProgressBar !== false;
    if (!progressEnabled) hide(document.getElementById('progressBarContainer'));

    // Email field
    if (form.settings?.collectEmail) {
        show(document.getElementById('emailQuestion'));
    }

    // Questions
    const questions = form.settings?.shuffleQuestions
        ? [...(form.questions || [])].sort(() => Math.random() - 0.5)
        : (form.questions || []);

    renderQuestions(questions, color);
    setupSubmit(form, questions);
    updateProgress();
}

function renderQuestions(questions, themeColor) {
    const container = document.getElementById('viewerQuestionsContainer');
    let questionNumber = 0;

    container.innerHTML = questions.map(q => {
        if (q.type === 'section') {
            return `
        <div class="viewer-section">
          <h3>${escHtml(q.title || '')}</h3>
          ${q.description ? `<p>${escHtml(q.description)}</p>` : ''}
        </div>
      `;
        }
        questionNumber++;
        return renderQuestionCard(q, questionNumber, themeColor);
    }).join('');

    attachAnswerListeners();
}

function renderQuestionCard(q, num, color) {
    const requiredMark = q.required ? `<span class="required-star"> *</span>` : '';

    return `
    <div class="viewer-question-card" data-qid="${q.id}" id="qcard_${q.id}">
      <div class="viewer-question-label">
        ${num}. ${escHtml(q.title || 'Question')}${requiredMark}
      </div>
      ${renderAnswerField(q, color)}
      <div class="field-error" id="err_${q.id}">This field is required.</div>
    </div>
  `;
}

function renderAnswerField(q, color) {
    switch (q.type) {
        case 'short_answer':
            return `<input type="text" class="viewer-text-input" data-qid="${q.id}" placeholder="Your answer" />`;

        case 'paragraph':
            return `<textarea class="viewer-textarea" data-qid="${q.id}" placeholder="Your answer" rows="4"></textarea>`;

        case 'date':
            return `<input type="date" class="viewer-date" data-qid="${q.id}" />`;

        case 'multiple_choice':
            return `
        <div class="viewer-options">
          ${(q.options || []).map((opt, i) => `
            <label class="viewer-option">
              <input type="radio" name="q_${q.id}" value="${escHtml(opt)}" data-qid="${q.id}" class="custom-radio" />
              ${escHtml(opt)}
            </label>
          `).join('')}
        </div>
      `;

        case 'checkboxes':
            return `
        <div class="viewer-options">
          ${(q.options || []).map((opt, i) => `
            <label class="viewer-option">
              <input type="checkbox" value="${escHtml(opt)}" data-qid="${q.id}" class="custom-checkbox" />
              ${escHtml(opt)}
            </label>
          `).join('')}
        </div>
      `;

        case 'dropdown':
            return `
        <select class="viewer-select" data-qid="${q.id}">
          <option value="">Choose an option</option>
          ${(q.options || []).map(opt => `<option value="${escHtml(opt)}">${escHtml(opt)}</option>`).join('')}
        </select>
      `;

        case 'linear_scale': {
            const min = q.scaleMin ?? 1;
            const max = q.scaleMax ?? 5;
            const values = Array.from({ length: max - min + 1 }, (_, i) => i + min);
            return `
        <div class="linear-scale-viewer">
          <div class="scale-track">
            ${values.map(v => `
              <div class="scale-btn">
                <input type="radio" name="q_${q.id}" id="scale_${q.id}_${v}" value="${v}" data-qid="${q.id}" />
                <label for="scale_${q.id}_${v}">${v}</label>
              </div>
            `).join('')}
          </div>
          ${(q.scaleMinLabel || q.scaleMaxLabel) ? `
            <div class="scale-min-max">
              <span>${escHtml(q.scaleMinLabel || '')}</span>
              <span>${escHtml(q.scaleMaxLabel || '')}</span>
            </div>
          ` : ''}
        </div>
      `;
        }

        default:
            return `<p class="text-muted text-sm">Unsupported question type</p>`;
    }
}

// ─── Answer Listeners ─────────────────────────────────────
function attachAnswerListeners() {
    // Text inputs
    document.querySelectorAll('.viewer-text-input, .viewer-textarea, .viewer-date, .viewer-select').forEach(el => {
        el.addEventListener('input', e => {
            answers[e.target.dataset.qid] = e.target.value;
            clearError(e.target.dataset.qid);
            updateProgress();
        });
        el.addEventListener('change', e => {
            answers[e.target.dataset.qid] = e.target.value;
            clearError(e.target.dataset.qid);
            updateProgress();
        });
    });

    // Radio buttons (MCQ & linear scale)
    document.querySelectorAll('input[type="radio"][data-qid]').forEach(el => {
        el.addEventListener('change', e => {
            if (e.target.checked) {
                answers[e.target.dataset.qid] = e.target.value;
                clearError(e.target.dataset.qid);
                updateProgress();
            }
        });
    });

    // Checkboxes
    document.querySelectorAll('input[type="checkbox"][data-qid]').forEach(el => {
        el.addEventListener('change', () => {
            const qid = el.dataset.qid;
            const checked = [...document.querySelectorAll(`input[type="checkbox"][data-qid="${qid}"]:checked`)]
                .map(cb => cb.value);
            answers[qid] = checked;
            clearError(qid);
            updateProgress();
        });
    });
}

function clearError(qid) {
    const err = document.getElementById(`err_${qid}`);
    const card = document.getElementById(`qcard_${qid}`);
    if (err) err.classList.remove('visible');
    if (card) card.classList.remove('has-error');
}

// ─── Progress Bar ─────────────────────────────────────────
function updateProgress() {
    if (!progressEnabled || !form) return;
    const questions = (form.questions || []).filter(q => q.type !== 'section');
    const answered = questions.filter(q => {
        const a = answers[q.id];
        if (Array.isArray(a)) return a.length > 0;
        return a !== undefined && a !== '';
    }).length;

    const pct = questions.length ? Math.round((answered / questions.length) * 100) : 0;
    document.getElementById('progressBar').style.width = `${pct}%`;
}

// ─── Submit ───────────────────────────────────────────────
function setupSubmit(form, questions) {
    document.getElementById('submitFormBtn').addEventListener('click', () => submitForm(form, questions));
    document.getElementById('clearFormBtn').addEventListener('click', clearForm);
}

async function submitForm(form, questions) {
    // Validate
    let hasErrors = false;

    // Email
    if (form.settings?.collectEmail) {
        const email = document.getElementById('respondentEmail')?.value.trim();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            document.getElementById('respondentEmail')?.focus();
            showToast('Please enter a valid email address', 'error');
            return;
        }
    }

    const validQuestions = questions.filter(q => q.type !== 'section');
    for (const q of validQuestions) {
        if (!q.required) continue;
        const a = answers[q.id];
        const isEmpty = !a || (Array.isArray(a) && !a.length) || a === '';

        if (isEmpty) {
            const err = document.getElementById(`err_${q.id}`);
            const card = document.getElementById(`qcard_${q.id}`);
            if (err) err.classList.add('visible');
            if (card) {
                card.classList.add('has-error');
                if (!hasErrors) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            hasErrors = true;
        }
    }

    if (hasErrors) {
        showToast('Please fill in all required fields', 'error');
        return;
    }

    // Build answer payload
    const answerPayload = validQuestions.map(q => ({
        questionId: q.id,
        questionTitle: q.title,
        questionType: q.type,
        value: answers[q.id] ?? null
    }));

    const submitBtn = document.getElementById('submitFormBtn');
    submitBtn.textContent = 'Submitting...';
    submitBtn.disabled = true;

    try {
        const email = form.settings?.collectEmail
            ? document.getElementById('respondentEmail')?.value.trim()
            : null;

        const result = await Api.submitResponse(form.id, {
            answers: answerPayload,
            respondentEmail: email
        });

        if (!result.success) throw new Error(result.error);

        // Show success
        hide(document.getElementById('formViewer'));
        show(document.getElementById('successState'));
        document.getElementById('successMessage').textContent =
            form.settings?.confirmationMessage || 'Your response has been recorded.';
        document.getElementById('progressBar').style.width = '100%';

    } catch (err) {
        showToast('Failed to submit: ' + err.message, 'error');
        submitBtn.textContent = 'Submit';
        submitBtn.disabled = false;
    }
}

function clearForm() {
    answers = {};
    document.querySelectorAll('.viewer-text-input, .viewer-textarea, .viewer-date').forEach(el => {
        el.value = '';
    });
    document.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(el => {
        el.checked = false;
    });
    document.querySelectorAll('.viewer-select').forEach(el => {
        el.selectedIndex = 0;
    });
    document.querySelectorAll('.field-error').forEach(el => el.classList.remove('visible'));
    document.querySelectorAll('.viewer-question-card').forEach(el => el.classList.remove('has-error'));
    updateProgress();
    showToast('Form cleared', 'info');
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
