/**
 * Netlify Function: Add custom location
 * POST /.netlify/functions/custom/add
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
        const { name, weekStart, dayDate, location } = JSON.parse(event.body);

        if (!name || !weekStart || !dayDate || !location) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({
                    ok: false,
                    message: 'name, weekStart, dayDate, and location are required'
                })
            };
        }

        // Initialize Google Sheets
        const serviceAccountInfo = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
        const doc = new GoogleSpreadsheet(process.env.SHEET_BACKEND_ID);
        await doc.useServiceAccountAuth(serviceAccountInfo);
        await doc.loadInfo();

        // Get or create custom_locations sheet
        let customSheet = doc.sheetsByTitle['custom_locations'];
        if (!customSheet) {
            customSheet = await doc.addSheet({
                title: 'custom_locations',
                headerValues: ['name', 'week_start', 'day_date', 'location', 'created_at']
            });
        }

        // Add custom location
        await customSheet.addRow({
            name: name,
            week_start: weekStart,
            day_date: dayDate,
            location: location,
            created_at: new Date().toISOString()
        });

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                ok: true,
                message: 'Custom location added successfully'
            })
        };

    } catch (error) {
        console.error('Error adding custom location:', error);
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