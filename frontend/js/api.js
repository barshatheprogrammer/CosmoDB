/**
 * api.js — Centralized API client for FormsCosmo
 */

const API_BASE = 'http://localhost:3000/api';

const Api = {
    // ─── Forms ──────────────────────────────────────────────
    async getForms() {
        const res = await fetch(`${API_BASE}/forms`);
        return res.json();
    },

    async getForm(id) {
        const res = await fetch(`${API_BASE}/forms/${id}`);
        return res.json();
    },

    async createForm(data) {
        const res = await fetch(`${API_BASE}/forms`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return res.json();
    },

    async updateForm(id, data) {
        const res = await fetch(`${API_BASE}/forms/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return res.json();
    },

    async deleteForm(id) {
        const res = await fetch(`${API_BASE}/forms/${id}`, {
            method: 'DELETE'
        });
        return res.json();
    },

    // ─── Responses ──────────────────────────────────────────
    async submitResponse(formId, data) {
        const res = await fetch(`${API_BASE}/forms/${formId}/responses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return res.json();
    },

    async getResponses(formId) {
        const res = await fetch(`${API_BASE}/forms/${formId}/responses`);
        return res.json();
    },

    async deleteResponse(formId, responseId) {
        const res = await fetch(`${API_BASE}/forms/${formId}/responses/${responseId}`, {
            method: 'DELETE'
        });
        return res.json();
    },

    // ─── Health ──────────────────────────────────────────────
    async health() {
        try {
            const res = await fetch(`${API_BASE}/health`);
            return res.json();
        } catch {
            return { status: 'error' };
        }
    }
};
