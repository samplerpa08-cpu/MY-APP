/**
 * Netlify Function: Decrypt user password (admin only)
 * POST /.netlify/functions/users/decrypt
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
        const { name } = JSON.parse(event.body);

        if (!name) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({
                    ok: false,
                    message: 'User name is required'
                })
            };
        }

        // Check admin secret (optional - for additional security)
        const adminSecret = event.headers['x-admin-secret'];
        if (process.env.ADMIN_SECRET && adminSecret !== process.env.ADMIN_SECRET) {
            return {
                statusCode: 403,
                headers: corsHeaders,
                body: JSON.stringify({
                    ok: false,
                    message: 'Admin access required'
                })
            };
        }

        // Initialize Google Sheets
        const serviceAccountInfo = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
        const doc = new GoogleSpreadsheet(process.env.SHEET_BACKEND_ID);
        await doc.useServiceAccountAuth(serviceAccountInfo);
        await doc.loadInfo();

        // Get users sheet
        const usersSheet = doc.sheetsByTitle['users'];
        if (!usersSheet) {
            return {
                statusCode: 404,
                headers: corsHeaders,
                body: JSON.stringify({
                    ok: false,
                    message: 'Users sheet not found'
                })
            };
        }

        // Find user
        const rows = await usersSheet.getRows();
        const userRow = rows.find(row => row.name === name);
        
        if (!userRow) {
            return {
                statusCode: 404,
                headers: corsHeaders,
                body: JSON.stringify({
                    ok: false,
                    message: 'User not found'
                })
            };
        }

        // Decrypt password
        const decryptedPassword = decrypt(userRow.password_encrypted);

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                ok: true,
                password: decryptedPassword
            })
        };

    } catch (error) {
        console.error('Error decrypting password:', error);
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

// Simple decryption function
function decrypt(encryptedText) {
    if (!encryptedText) return '';
    const key = process.env.ENCRYPTION_KEY || 'default-key';
    const crypto = require('crypto');
    try {
        const decipher = crypto.createDecipher('aes192', key);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (error) {
        console.error('Decryption error:', error);
        return '';
    }
}