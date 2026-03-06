require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { initializeCosmosDB } = require('./config/cosmos');

const formsRouter = require('./routes/forms');
const responsesRouter = require('./routes/responses');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Serve frontend static files
app.use(express.static('../frontend'));

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/forms', formsRouter);
app.use('/api/forms', responsesRouter);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Catch-all for 404
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
});

// ─── Start ────────────────────────────────────────────────────────────────────
async function startServer() {
    try {
        console.log('🔌 Connecting to Azure CosmosDB...');
        await initializeCosmosDB();
        console.log('✅ CosmosDB connected successfully!');

        app.listen(PORT, () => {
            console.log(`\n🚀 Server running at http://localhost:${PORT}`);
            console.log(`📋 Forms API:     http://localhost:${PORT}/api/forms`);
            console.log(`💚 Health check:  http://localhost:${PORT}/api/health`);
            console.log(`🌐 Frontend:      http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error.message);
        process.exit(1);
    }
}

startServer();
