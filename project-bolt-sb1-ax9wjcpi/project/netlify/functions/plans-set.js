/**
 * Netlify Function: Set plan for user and week
 * POST /.netlify/functions/plans/set
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
        const { weekStart, name, locationsArray } = JSON.parse(event.body);

        if (!weekStart || !name || !Array.isArray(locationsArray)) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({
                    ok: false,
                    message: 'weekStart, name, and locationsArray are required'
                })
            };
        }

        if (locationsArray.length !== 7) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({
                    ok: false,
                    message: 'locationsArray must have exactly 7 entries'
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

        // Find existing row for this user and week
        const rows = await plansSheet.getRows();
        const existingRow = rows.find(row => row.week_start === weekStart && row.name === name);

        const planData = {
            week_start: weekStart,
            name: name,
            mon: locationsArray[0] || '',
            tue: locationsArray[1] || '',
            wed: locationsArray[2] || '',
            thu: locationsArray[3] || '',
            fri: locationsArray[4] || '',
            sat: locationsArray[5] || '',
            sun: locationsArray[6] || '',
            updated_at: new Date().toISOString()
        };

        if (existingRow) {
            // Update existing row
            Object.assign(existingRow, planData);
            await existingRow.save();
        } else {
            // Add new row
            await plansSheet.addRow(planData);
        }

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                ok: true,
                message: 'Plan saved successfully'
            })
        };

    } catch (error) {
        console.error('Error setting plan:', error);
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