/**
 * Netlify Function: User login
 * POST /.netlify/functions/login
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
        const { name, password } = JSON.parse(event.body);

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

        // Initialize Google Sheets
        const serviceAccountInfo = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
        const doc = new GoogleSpreadsheet(process.env.SHEET_BACKEND_ID);
        await doc.useServiceAccountAuth(serviceAccountInfo);
        await doc.loadInfo();

        // Get users sheet
        const usersSheet = doc.sheetsByTitle['users'];
        if (!usersSheet) {
            return {
                statusCode: 500,
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
                statusCode: 401,
                headers: corsHeaders,
                body: JSON.stringify({
                    ok: false,
                    message: 'Invalid name or password'
                })
            };
        }

        // Verify password
        const decryptedPassword = decrypt(userRow.password_encrypted);
        if (decryptedPassword !== password) {
            return {
                statusCode: 401,
                headers: corsHeaders,
                body: JSON.stringify({
                    ok: false,
                    message: 'Invalid name or password'
                })
            };
        }

        // Get current week plans
        const plansForCurrentWeek = await getCurrentWeekPlans(doc);

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                ok: true,
                isAdmin: userRow.is_admin === 'true' || userRow.is_admin === true,
                plansForCurrentWeek
            })
        };

    } catch (error) {
        console.error('Login error:', error);
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

// Get current week plans
async function getCurrentWeekPlans(doc) {
    try {
        const plansSheet = doc.sheetsByTitle['plans'];
        if (!plansSheet) return {};

        // Compute current week
        const weekInfo = computeWeekStartIST();
        
        const rows = await plansSheet.getRows();
        const weekPlans = {};
        
        rows.forEach(row => {
            if (row.week_start === weekInfo.weekStartId) {
                weekPlans[row.name] = [
                    row.mon || '',
                    row.tue || '',
                    row.wed || '',
                    row.thu || '',
                    row.fri || '',
                    row.sat || '',
                    row.sun || ''
                ];
            }
        });
        
        return weekPlans;
    } catch (error) {
        console.error('Error getting current week plans:', error);
        return {};
    }
}

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

// Week computation function (IST)
function computeWeekStartIST(date = new Date(), overrideDateISO = null) {
    if (overrideDateISO) {
        date = new Date(overrideDateISO + 'T00:00:00.000Z');
    }
    
    const IST_OFFSET = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(date.getTime() + IST_OFFSET);
    
    const dayOfWeek = istDate.getUTCDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : -(dayOfWeek - 1);
    
    const mondayDate = new Date(istDate);
    mondayDate.setUTCDate(istDate.getUTCDate() + mondayOffset);
    
    const year = mondayDate.getUTCFullYear();
    const month = String(mondayDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(mondayDate.getUTCDate()).padStart(2, '0');
    const weekStartId = `${year}${month}${day}`;
    
    return { weekStartId };
}