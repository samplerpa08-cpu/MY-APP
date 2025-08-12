/**
 * Netlify Function: Get plans for a specific week
 * POST /.netlify/functions/plans/get
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
        const { weekStart } = JSON.parse(event.body);

        if (!weekStart) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({
                    ok: false,
                    message: 'weekStart is required'
                })
            };
        }

        // Initialize Google Sheets
        const serviceAccountInfo = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
        const doc = new GoogleSpreadsheet(process.env.SHEET_BACKEND_ID);
        await doc.useServiceAccountAuth(serviceAccountInfo);
        await doc.loadInfo();

        // Get or create plans sheet
        let plansSheet = doc.sheetsByTitle['plans'];
        if (!plansSheet) {
            plansSheet = await doc.addSheet({
                title: 'plans',
                headerValues: ['week_start', 'name', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun', 'updated_at']
            });
        }

        // Get plans for the specific week
        const rows = await plansSheet.getRows();
        const weekPlans = {};
        
        rows.forEach(row => {
            if (row.week_start === weekStart) {
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

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                ok: true,
                plans: weekPlans
            })
        };

    } catch (error) {
        console.error('Error getting plans:', error);
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