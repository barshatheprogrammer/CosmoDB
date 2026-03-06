require('dotenv').config();
const { CosmosClient } = require('@azure/cosmos');

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;
const databaseId = process.env.COSMOS_DATABASE || 'FormsDB';
const formsContainerId = process.env.COSMOS_FORMS_CONTAINER || 'forms';
const responsesContainerId = process.env.COSMOS_RESPONSES_CONTAINER || 'responses';

const client = new CosmosClient({ endpoint, key });

let database;
let formsContainer;
let responsesContainer;

async function initializeCosmosDB() {
    try {
        // Create database if it doesn't exist
        const { database: db } = await client.databases.createIfNotExists({ id: databaseId });
        database = db;
        console.log(`✅ Database "${databaseId}" ready.`);

        // Create forms container
        const { container: forms } = await database.containers.createIfNotExists({
            id: formsContainerId,
            partitionKey: { paths: ['/id'] }
        });
        formsContainer = forms;
        console.log(`✅ Container "${formsContainerId}" ready.`);

        // Create responses container
        const { container: responses } = await database.containers.createIfNotExists({
            id: responsesContainerId,
            partitionKey: { paths: ['/formId'] }
        });
        responsesContainer = responses;
        console.log(`✅ Container "${responsesContainerId}" ready.`);

        return { database, formsContainer, responsesContainer };
    } catch (error) {
        console.error('❌ CosmosDB initialization failed:', error.message);
        throw error;
    }
}

function getFormsContainer() {
    if (!formsContainer) throw new Error('CosmosDB not initialized. Call initializeCosmosDB() first.');
    return formsContainer;
}

function getResponsesContainer() {
    if (!responsesContainer) throw new Error('CosmosDB not initialized. Call initializeCosmosDB() first.');
    return responsesContainer;
}

module.exports = { initializeCosmosDB, getFormsContainer, getResponsesContainer };
