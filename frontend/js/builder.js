/**
 * builder.js — Form Builder logic for FormsCosmo
 */

// ─── State ────────────────────────────────────────────────
let formId = null;
let questions = [];
let formSettings = {
    collectEmail: false,
    limitOneResponse: false,
    showProgressBar: true,
    shuffleQuestions: false,
    confirmationMessage: 'Your response has been recorded.'
};
let formTheme = { color: '#7c3aed', font: 'Inter' };
let isSaving = false;

// ─── Init ─────────────────────────────────────────────────
async function init() {
    formId = getUrlParam('id');

    if (formId) {
        await loadExistingForm();
    } else {
        // New form
        renderQuestions();
    }

    setupEventListeners();
}

async function loadExistingForm() {
    try {
        const data = await Api.getForm(formId);
        if (!data.success) throw new Error(data.error);

        const form = data.data;
        document.getElementById('formTitle').value = form.title || '';
        document.getElementById('formTitleCard').value = form.title || '';
        document.getElementById('formDescription').value = form.description || '';

        questions = form.questions || [];
        formSettings = form.settings || formSettings;
        formTheme = form.theme || formTheme;

        syncSettings();
        applyTheme(formTheme.color);
        renderQuestions();
        showToast('Form loaded', 'success');
    } catch (err) {
        showToast('Failed to load form: ' + err.message, 'error');
    }
}

function syncSettings() {
    document.getElementById('settingCollectEmail').checked = formSettings.collectEmail;
    document.getElementById('settingLimitOne').checked = formSettings.limitOneResponse;
    document.getElementById('settingProgressBar').checked = formSettings.showProgressBar;
    document.getElementById('settingShuffleQuestions').checked = formSettings.shuffleQuestions;
    document.getElementById('settingConfirmation').value = formSettings.confirmationMessage;

    // Highlight active theme color
    document.querySelectorAll('.theme-color-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.color === formTheme.color);
    });
}

function applyTheme(color) {
    formTheme.color = color;
    document.getElementById('formColorBar').style.background = color;
    document.querySelectorAll('.theme-color-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.color === color);
    });
}

// ─── Question Rendering ───────────────────────────────────
function renderQuestions() {
    const container = document.getElementById('questionsContainer');
    const prompt = document.getElementById('addQuestionPrompt');

    if (!questions.length) {
        container.innerHTML = '';
        show(prompt);
        return;
    }

    hide(prompt);
    container.innerHTML = questions.map((q, i) => buildQuestionCard(q, i)).join('');
    attachQuestionListeners();
}

function buildQuestionCard(q, index) {
    const isSection = q.type === 'section';

    if (isSection) {
        return `
      <div class="question-card section-card focused" data-id="${q.id}" data-index="${index}">
        <div class="question-card-inner">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
            <span style="font-size:20px;">📌</span>
            <span class="badge badge-purple">Section</span>
          </div>
          <input type="text" class="question-title-input section-title-input form-header-title"
            data-field="title" data-index="${index}"
            value="${escHtml(q.title || '')}" placeholder="Section Title" />
          <textarea class="form-header-desc" style="margin-top:10px;width:100%;"
            data-field="description" data-index="${index}"
            placeholder="Section description (optional)" rows="2">${q.description || ''}</textarea>
        </div>
        <div class="question-footer">
          <div class="question-footer-left">
            <button class="q-action-btn duplicate" data-action="duplicate" data-index="${index}">⧉ Duplicate</button>
          </div>
          <button class="q-action-btn delete" data-action="delete" data-index="${index}">🗑 Remove</button>
        </div>
      </div>
    `;
    }

    return `
    <div class="question-card" data-id="${q.id}" data-index="${index}">
      <div class="question-card-inner">
        <div class="question-card-top">
          <span class="question-number">Q${index + 1}</span>
          <input type="text" class="question-title-input"
            data-field="title" data-index="${index}"
            value="${escHtml(q.title || '')}" placeholder="Question" />
          <span class="question-type-label">${questionTypeLabel(q.type)}</span>
        </div>
        ${buildQuestionBody(q, index)}
      </div>
      <div class="question-footer">
        <div class="question-footer-left">
          <button class="q-action-btn duplicate" data-action="duplicate" data-index="${index}">⧉ Duplicate</button>
          <button class="q-action-btn" data-action="move-up" data-index="${index}">↑ Move Up</button>
          <button class="q-action-btn" data-action="move-down" data-index="${index}">↓ Move Down</button>
        </div>
        <div style="display:flex;align-items:center;gap:12px;">
          <label class="required-toggle">
            <label class="toggle">
              <input type="checkbox" class="required-checkbox" data-index="${index}" ${q.required ? 'checked' : ''} />
              <span class="toggle-slider"></span>
            </label>
            Required
          </label>
          <button class="q-action-btn delete" data-action="delete" data-index="${index}">🗑 Delete</button>
        </div>
      </div>
    </div>
  `;
}

function buildQuestionBody(q, index) {
    switch (q.type) {
        case 'short_answer':
            return `<div style="margin-top:12px;"><input type="text" class="form-control" placeholder="Short answer text" disabled style="opacity:0.6;cursor:default;" /></div>`;

        case 'paragraph':
            return `<div style="margin-top:12px;"><textarea class="form-control" placeholder="Long answer text" rows="3" disabled style="opacity:0.6;cursor:default;"></textarea></div>`;

        case 'date':
            return `<div style="margin-top:12px;"><input type="date" class="form-control" disabled style="opacity:0.6;cursor:default;max-width:200px;" /></div>`;

        case 'multiple_choice':
        case 'checkboxes':
        case 'dropdown':
            return buildOptionsBody(q, index);

        case 'linear_scale':
            return buildLinearScaleBody(q, index);

        default:
            return '';
    }
}

function buildOptionsBody(q, index) {
    const opts = q.options || ['Option 1'];
    const iconClass = q.type === 'checkboxes' ? 'option-checkbox-icon' : 'option-radio-icon';

    const optionsHtml = opts.map((opt, oi) => `
    <div class="option-item">
      <div class="${iconClass}"></div>
      <input type="text" class="option-input" data-qindex="${index}" data-oindex="${oi}"
        value="${escHtml(opt)}" placeholder="Option ${oi + 1}" />
      <button class="option-remove" data-qindex="${index}" data-oindex="${oi}" title="Remove">×</button>
    </div>
  `).join('');

    return `
    <div class="options-list" data-qindex="${index}">
      ${optionsHtml}
    </div>
    <button class="add-option-btn" data-action="add-option" data-qindex="${index}">
      <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
      Add option
    </button>
  `;
}

function buildLinearScaleBody(q, index) {
    const min = q.scaleMin ?? 1;
    const max = q.scaleMax ?? 5;
    const minLabel = q.scaleMinLabel ?? '';
    const maxLabel = q.scaleMaxLabel ?? '';

    const minOptions = [0, 1].map(v => `<option ${min === v ? 'selected' : ''} value="${v}">${v}</option>`).join('');
    const maxOptions = [2, 3, 4, 5, 6, 7, 8, 9, 10].map(v => `<option ${max === v ? 'selected' : ''} value="${v}">${v}</option>`).join('');

    return `
    <div class="linear-scale-config">
      <label>From</label>
      <select class="scale-min-select" data-index="${index}">${minOptions}</select>
      <label>to</label>
      <select class="scale-max-select" data-index="${index}">${maxOptions}</select>
    </div>
    <div class="scale-labels">
      <input type="text" class="scale-label-input" data-field="scaleMinLabel" data-index="${index}"
        value="${escHtml(minLabel)}" placeholder="Label for ${min} (optional)" />
      <input type="text" class="scale-label-input" data-field="scaleMaxLabel" data-index="${index}"
        value="${escHtml(maxLabel)}" placeholder="Label for ${max} (optional)" />
    </div>
  `;
}

// ─── Question Mutations ───────────────────────────────────
function addQuestion(type) {
    const q = {
        id: generateId(),
        type,
        title: '',
        required: false
    };

    // set defaults per type
    if (['multiple_choice', 'checkboxes', 'dropdown'].includes(type)) {
        q.options = ['Option 1', 'Option 2'];
    }
    if (type === 'linear_scale') {
        q.scaleMin = 1;
        q.scaleMax = 5;
        q.scaleMinLabel = '';
        q.scaleMaxLabel = '';
    }
    if (type === 'section') {
        q.description = '';
    }

    questions.push(q);
    renderQuestions();
    // scroll to new question
    const cards = document.querySelectorAll('.question-card');
    if (cards.length) cards[cards.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
    showToast(`${questionTypeLabel(type)} question added`, 'success');
}

function deleteQuestion(index) {
    questions.splice(index, 1);
    renderQuestions();
}

function duplicateQuestion(index) {
    const clone = JSON.parse(JSON.stringify(questions[index]));
    clone.id = generateId();
    questions.splice(index + 1, 0, clone);
    renderQuestions();
}

function moveQuestion(index, direction) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= questions.length) return;
    [questions[index], questions[newIndex]] = [questions[newIndex], questions[index]];
    renderQuestions();
}

// ─── Listeners ────────────────────────────────────────────
function attachQuestionListeners() {
    // Question title changes
    document.querySelectorAll('.question-title-input').forEach(input => {
        input.addEventListener('input', e => {
            const i = parseInt(e.target.dataset.index);
            const field = e.target.dataset.field;
            questions[i][field] = e.target.value;
        });
        input.addEventListener('focus', e => {
            e.target.closest('.question-card')?.classList.add('focused');
        });
        input.addEventListener('blur', e => {
            e.target.closest('.question-card')?.classList.remove('focused');
        });
    });

    // Section desc
    document.querySelectorAll('textarea[data-field="description"]').forEach(ta => {
        ta.addEventListener('input', e => {
            const i = parseInt(e.target.dataset.index);
            questions[i].description = e.target.value;
        });
    });

    // Required toggles
    document.querySelectorAll('.required-checkbox').forEach(cb => {
        cb.addEventListener('change', e => {
            const i = parseInt(e.target.dataset.index);
            questions[i].required = e.target.checked;
        });
    });

    // Option inputs
    document.querySelectorAll('.option-input').forEach(input => {
        input.addEventListener('input', e => {
            const qi = parseInt(e.target.dataset.qindex);
            const oi = parseInt(e.target.dataset.oindex);
            questions[qi].options[oi] = e.target.value;
        });
    });

    // Remove option
    document.querySelectorAll('.option-remove').forEach(btn => {
        btn.addEventListener('click', e => {
            const qi = parseInt(e.target.dataset.qindex);
            const oi = parseInt(e.target.dataset.oindex);
            if (questions[qi].options.length > 1) {
                questions[qi].options.splice(oi, 1);
                renderQuestions();
            } else {
                showToast('At least one option is required', 'warning');
            }
        });
    });

    // Add option
    document.querySelectorAll('[data-action="add-option"]').forEach(btn => {
        btn.addEventListener('click', e => {
            const qi = parseInt(e.target.closest('[data-action]').dataset.qindex);
            questions[qi].options.push(`Option ${questions[qi].options.length + 1}`);
            renderQuestions();
            // Focus new option
            setTimeout(() => {
                const optInputs = document.querySelectorAll(`.option-input[data-qindex="${qi}"]`);
                if (optInputs.length) optInputs[optInputs.length - 1].focus();
            }, 50);
        });
    });

    // Scale selects
    document.querySelectorAll('.scale-min-select').forEach(sel => {
        sel.addEventListener('change', e => {
            const i = parseInt(e.target.dataset.index);
            questions[i].scaleMin = parseInt(e.target.value);
        });
    });

    document.querySelectorAll('.scale-max-select').forEach(sel => {
        sel.addEventListener('change', e => {
            const i = parseInt(e.target.dataset.index);
            questions[i].scaleMax = parseInt(e.target.value);
        });
    });

    document.querySelectorAll('.scale-label-input').forEach(input => {
        input.addEventListener('input', e => {
            const i = parseInt(e.target.dataset.index);
            const field = e.target.dataset.field;
            questions[i][field] = e.target.value;
        });
    });

    // Card action buttons
    document.querySelectorAll('.q-action-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            const action = btn.dataset.action;
            const index = parseInt(btn.dataset.index);
            if (action === 'delete') deleteQuestion(index);
            else if (action === 'duplicate') duplicateQuestion(index);
            else if (action === 'move-up') moveQuestion(index, -1);
            else if (action === 'move-down') moveQuestion(index, 1);
        });
    });
}

// ─── Save Form ────────────────────────────────────────────
async function saveForm() {
    if (isSaving) return;

    const title = document.getElementById('formTitle').value.trim();
    if (!title) {
        showToast('Please enter a form title', 'warning');
        document.getElementById('formTitle').focus();
        return;
    }

    const description = document.getElementById('formDescription').value.trim();

    // Sync settings
    formSettings = {
        collectEmail: document.getElementById('settingCollectEmail').checked,
        limitOneResponse: document.getElementById('settingLimitOne').checked,
        showProgressBar: document.getElementById('settingProgressBar').checked,
        shuffleQuestions: document.getElementById('settingShuffleQuestions').checked,
        confirmationMessage: document.getElementById('settingConfirmation').value.trim() || 'Your response has been recorded.'
    };

    const payload = { title, description, questions, settings: formSettings, theme: formTheme };

    isSaving = true;
    const saveBtn = document.getElementById('saveFormBtn');
    saveBtn.textContent = '⏳ Saving...';
    saveBtn.disabled = true;

    try {
        let result;
        if (formId) {
            result = await Api.updateForm(formId, payload);
        } else {
            result = await Api.createForm(payload);
        }

        if (!result.success) throw new Error(result.error);

        if (!formId) {
            formId = result.data.id;
            history.replaceState({}, '', `?id=${formId}`);
        }

        showToast('Form saved successfully!', 'success');
        saveBtn.textContent = '✅ Saved!';
        setTimeout(() => {
            saveBtn.textContent = '💾 Save Form';
        }, 2000);
    } catch (err) {
        showToast('Failed to save: ' + err.message, 'error');
        saveBtn.textContent = '💾 Save Form';
    } finally {
        isSaving = false;
        saveBtn.disabled = false;
    }
}

// ─── Settings helpers ─────────────────────────────────────
function setupSettingsListeners() {
    document.querySelectorAll('.theme-color-btn').forEach(btn => {
        btn.addEventListener('click', () => applyTheme(btn.dataset.color));
    });
}

// ─── Tab switching ────────────────────────────────────────
function switchTab(tab) {
    const qtab = document.getElementById('questionsTab');
    const stab = document.getElementById('settingsTab');
    document.getElementById('questionsTabBtn').classList.toggle('active', tab === 'questions');
    document.getElementById('settingsTabBtn').classList.toggle('active', tab === 'settings');
    tab === 'questions' ? show(qtab) && hide(stab) : hide(qtab) || show(stab);
    if (tab === 'questions') { show(qtab); hide(stab); }
    else { hide(qtab); show(stab); }
}

// ─── Global event listeners ───────────────────────────────
function setupEventListeners() {
    // Question type sidebar buttons
    document.querySelectorAll('.q-type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            addQuestion(btn.dataset.type);
            // Switch to questions tab
            switchTab('questions');
        });
    });

    // Title sync
    document.getElementById('formTitle').addEventListener('input', e => {
        document.getElementById('formTitleCard').value = e.target.value;
    });
    document.getElementById('formTitleCard').addEventListener('input', e => {
        document.getElementById('formTitle').value = e.target.value;
    });

    // Save button
    document.getElementById('saveFormBtn')?.addEventListener('click', saveForm);

    // Preview button
    document.getElementById('previewBtn')?.addEventListener('click', async () => {
        const title = document.getElementById('formTitle').value.trim();
        if (!title) { showToast('Save the form first', 'warning'); return; }
        if (!formId) {
            await saveForm();
            if (formId) window.open(`form-view.html?id=${formId}`, '_blank');
        } else {
            window.open(`form-view.html?id=${formId}`, '_blank');
        }
    });

    // Tabs
    document.getElementById('questionsTabBtn')?.addEventListener('click', () => switchTab('questions'));
    document.getElementById('settingsTabBtn')?.addEventListener('click', () => switchTab('settings'));

    // Settings
    setupSettingsListeners();

    // Keyboard shortcut: Ctrl+S
    document.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            saveForm();
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
