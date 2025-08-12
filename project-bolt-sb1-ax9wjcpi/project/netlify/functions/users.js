/**
 * Netlify Function: Get users list
 * GET /.netlify/functions/users
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

    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers: corsHeaders,
            body: JSON.stringify({ ok: false, message: 'Method not allowed' })
        };
    }

    try {
        // Initialize Google Sheets
        const serviceAccountInfo = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
        const doc = new GoogleSpreadsheet(process.env.SHEET_BACKEND_ID);
        await doc.useServiceAccountAuth(serviceAccountInfo);
        await doc.loadInfo();

        // Get or create users sheet
        let usersSheet = doc.sheetsByTitle['users'];
        if (!usersSheet) {
            usersSheet = await doc.addSheet({
                title: 'users',
                headerValues: ['name', 'password_encrypted', 'is_admin', 'created_at']
            });
            
            // Add initial users
            const initialUsers = [
                {
                    name: "Sahil Sharma",
                    password_encrypted: encrypt("8371"),
                    is_admin: false,
                    created_at: new Date().toISOString()
                },
                {
                    name: "Vijay Kumar",
                    password_encrypted: encrypt("4926"),
                    is_admin: false,
                    created_at: new Date().toISOString()
                },
                {
                    name: "Pawan Gupta",
                    password_encrypted: encrypt("7149"),
                    is_admin: false,
                    created_at: new Date().toISOString()
                },
                {
                    name: "Sunil Suri",
                    password_encrypted: encrypt("3652"),
                    is_admin: false,
                    created_at: new Date().toISOString()
                },
                {
                    name: "Sudhir Kumar",
                    password_encrypted: encrypt("9211"),
                    is_admin: true,
                    created_at: new Date().toISOString()
                }
            ];
            
            await usersSheet.addRows(initialUsers);
        }

        // Get all users
        const rows = await usersSheet.getRows();
        const users = rows.map(row => ({
            name: row.name,
            isAdmin: row.is_admin === 'true' || row.is_admin === true
        }));

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                ok: true,
                users
            })
        };

    } catch (error) {
        console.error('Error fetching users:', error);
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

// Simple encryption function (for demonstration - use stronger encryption in production)
function encrypt(text) {
    const key = process.env.ENCRYPTION_KEY || 'default-key';
    const crypto = require('crypto');
    const cipher = crypto.createCipher('aes192', key);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}