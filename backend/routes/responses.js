const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getResponsesContainer, getFormsContainer } = require('../config/cosmos');

// ─── POST /api/forms/:id/responses — Submit a response ───────────────────────
router.post('/:formId/responses', async (req, res) => {
    try {
        const responsesContainer = getResponsesContainer();
        const formsContainer = getFormsContainer();
        const { formId } = req.params;

        // Verify form exists
        try {
            await formsContainer.item(formId, formId).read();
        } catch (e) {
            return res.status(404).json({ success: false, error: 'Form not found' });
        }

        const response = {
            id: uuidv4(),
            formId,
            answers: req.body.answers || [],
            respondentEmail: req.body.respondentEmail || null,
            submittedAt: new Date().toISOString(),
            metadata: {
                userAgent: req.headers['user-agent'] || null,
                ipAddress: req.ip || null
            }
        };

        const { resource } = await responsesContainer.items.create(response);
        res.status(201).json({ success: true, data: resource });
    } catch (err) {
        console.error('POST /api/forms/:formId/responses error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─── GET /api/forms/:id/responses — Get all responses ────────────────────────
router.get('/:formId/responses', async (req, res) => {
    try {
        const responsesContainer = getResponsesContainer();
        const { formId } = req.params;

        const { resources } = await responsesContainer.items
            .query({
                query: 'SELECT * FROM c WHERE c.formId = @formId ORDER BY c.submittedAt DESC',
                parameters: [{ name: '@formId', value: formId }]
            })
            .fetchAll();

        res.json({ success: true, data: resources, count: resources.length });
    } catch (err) {
        console.error('GET /api/forms/:formId/responses error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─── DELETE /api/forms/:formId/responses/:responseId — Delete a response ──────
router.delete('/:formId/responses/:responseId', async (req, res) => {
    try {
        const responsesContainer = getResponsesContainer();
        const { formId, responseId } = req.params;
        await responsesContainer.item(responseId, formId).delete();
        res.json({ success: true, message: 'Response deleted' });
    } catch (err) {
        if (err.code === 404) {
            return res.status(404).json({ success: false, error: 'Response not found' });
        }
        console.error('DELETE response error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
