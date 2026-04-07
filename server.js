import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env or .env.local
dotenv.config();
dotenv.config({ path: '.env.local', override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3026;

// Get API Key securely from the server environment
const getServerApiKey = () => {
    return process.env.API_KEY || process.env.GEMINI_API_KEY || "";
};

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for base64 images

// Proxy API Endpoint
app.post('/api/generate', async (req, res) => {
    try {
        // Look for client-provided API key first, fallback to server key
        const clientApiKey = req.body.customApiKey;
        const apiKey = clientApiKey || getServerApiKey();
        
        // Remove the custom API key from the payload before sending to Kie.ai
        delete req.body.customApiKey;

        if (!apiKey) {
            return res.status(500).json({ 
                error: 'Server configuration error: API_KEY is missing on the server and no client key provided.' 
            });
        }

        const KIE_API_URL = 'https://api.kie.ai/gemini-2.5-flash/v1/chat/completions';
        
        // Forward the request directly to Kie.ai
        const response = await fetch(KIE_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(req.body)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Kie API Error [${response.status}]:`, errorText);
            return res.status(response.status).json({ error: `API returned ${response.status}. ${errorText}` });
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Proxy Error:', error);
        res.status(500).json({ error: error.message || 'Internal server error during API request' });
    }
});

// Serve static frontend files from 'dist'
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// Fallback for SPA routing - serve index.html for unknown routes
app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api/')) {
        res.sendFile(path.join(distPath, 'index.html'));
    } else {
        next();
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running securely on port ${PORT}`);
    console.log(`Frontend served from: ${distPath}`);
});
