const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getFormsContainer } = require('../config/cosmos');

// ─── GET /api/forms — List all forms ──────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const container = getFormsContainer();
        const { resources } = await container.items
            .query('SELECT c.id, c.title, c.description, c.createdAt, c.updatedAt, c.questionCount, c.isPublished FROM c ORDER BY c.createdAt DESC')
            .fetchAll();
        res.json({ success: true, data: resources });
    } catch (err) {
        console.error('GET /api/forms error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─── POST /api/forms — Create a new form ─────────────────────────────────────
router.post('/', async (req, res) => {
    try {
        const container = getFormsContainer();
        const id = uuidv4();
        const now = new Date().toISOString();

        const form = {
            id,
            title: req.body.title || 'Untitled Form',
            description: req.body.description || '',
            questions: req.body.questions || [],
            questionCount: (req.body.questions || []).length,
            settings: req.body.settings || {
                collectEmail: false,
                limitOneResponse: false,
                showProgressBar: true,
                shuffleQuestions: false,
                confirmationMessage: 'Your response has been recorded.'
            },
            theme: req.body.theme || { color: '#7c3aed', font: 'Inter' },
            isPublished: req.body.isPublished !== undefined ? req.body.isPublished : true,
            createdAt: now,
            updatedAt: now
        };

        const { resource } = await container.items.create(form);
        res.status(201).json({ success: true, data: resource });
    } catch (err) {
        console.error('POST /api/forms error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─── GET /api/forms/:id — Get a single form ──────────────────────────────────
router.get('/:id', async (req, res) => {
    try {
        const container = getFormsContainer();
        const { id } = req.params;
        const { resource } = await container.item(id, id).read();

        if (!resource) {
            return res.status(404).json({ success: false, error: 'Form not found' });
        }
        res.json({ success: true, data: resource });
    } catch (err) {
        if (err.code === 404) {
            return res.status(404).json({ success: false, error: 'Form not found' });
        }
        console.error('GET /api/forms/:id error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─── PUT /api/forms/:id — Update a form ──────────────────────────────────────
router.put('/:id', async (req, res) => {
    try {
        const container = getFormsContainer();
        const { id } = req.params;

        // Fetch existing
        let existingForm;
        try {
            const { resource } = await container.item(id, id).read();
            existingForm = resource;
        } catch (e) {
            return res.status(404).json({ success: false, error: 'Form not found' });
        }

        const updated = {
            ...existingForm,
            ...req.body,
            id, // preserve id
            updatedAt: new Date().toISOString(),
            questionCount: (req.body.questions || existingForm.questions || []).length
        };

        const { resource } = await container.items.upsert(updated);
        res.json({ success: true, data: resource });
    } catch (err) {
        console.error('PUT /api/forms/:id error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─── DELETE /api/forms/:id — Delete a form ───────────────────────────────────
router.delete('/:id', async (req, res) => {
    try {
        const container = getFormsContainer();
        const { id } = req.params;
        await container.item(id, id).delete();
        res.json({ success: true, message: 'Form deleted successfully' });
    } catch (err) {
        if (err.code === 404) {
            return res.status(404).json({ success: false, error: 'Form not found' });
        }
        console.error('DELETE /api/forms/:id error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
