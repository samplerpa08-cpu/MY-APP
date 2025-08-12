/**
 * Netlify Function: Add new user
 * POST /.netlify/functions/users/add
 */

const { GoogleSpreadsheet } = require('google-spreadsheet');

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

exports.handler = async (event, context) => {
    // Handle CORS preflight
    if (event.httpMethod === "OPTIONS") {
        return {
            statusCode: 200,
            headers: corsHeaders,
        };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: corsHeaders,
            body: JSON.stringify({ ok: false, message: 'Method not allowed' })
        };
    }

    try {
        const { name, password, isAdmin } = JSON.parse(event.body);

        if (!name || !password) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({
                    ok: false,
                    message: 'Name and password are required'
                })
            };
        }

        // Validate password format
        if (!/^[0-9]{4}$/.test(password)) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({
                    ok: false,
                    message: 'Password must be 4 digits'
                })
            };
        }

        // Initialize Google Sheets
        const serviceAccountInfo = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
        const doc = new GoogleSpreadsheet(process.env.SHEET_BACKEND_ID);
        await doc.useServiceAccountAuth(serviceAccountInfo);
        await doc.loadInfo();

        // Get users sheet
        let usersSheet = doc.sheetsByTitle['users'];
        if (!usersSheet) {
            usersSheet = await doc.addSheet({
                title: 'users',
                headerValues: ['name', 'password_encrypted', 'is_admin', 'created_at']
            });
        }

        // Check if user already exists
        const rows = await usersSheet.getRows();
        const existingUser = rows.find(row => row.name === name);
        
        if (existingUser) {
            return {
                statusCode: 409,
                headers: corsHeaders,
                body: JSON.stringify({
                    ok: false,
                    message: 'User already exists'
                })
            };
        }

        // Add new user
        await usersSheet.addRow({
            name: name,
            password_encrypted: encrypt(password),
            is_admin: Boolean(isAdmin),
            created_at: new Date().toISOString()
        });

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                ok: true,
                message: 'User added successfully'
            })
        };

    } catch (error) {
        console.error('Error adding user:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                ok: false,
                message: 'Internal server error'
            })
        };
    }
};

// Simple encryption function
function encrypt(text) {
    const key = process.env.ENCRYPTION_KEY || 'default-key';
    const crypto = require('crypto');
    const cipher = crypto.createCipher('aes192', key);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}