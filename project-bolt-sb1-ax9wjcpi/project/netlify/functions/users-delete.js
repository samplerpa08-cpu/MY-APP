/**
 * Netlify Function: Delete user and all associated data
 * POST /.netlify/functions/users/delete
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

        // Initialize Google Sheets
        const serviceAccountInfo = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
        const doc = new GoogleSpreadsheet(process.env.SHEET_BACKEND_ID);
        await doc.useServiceAccountAuth(serviceAccountInfo);
        await doc.loadInfo();

        let deletedData = {
            user: false,
            plans: 0,
            customLocations: 0
        };

        // Delete from users sheet
        const usersSheet = doc.sheetsByTitle['users'];
        if (usersSheet) {
            const userRows = await usersSheet.getRows();
            const userRow = userRows.find(row => row.name === name);
            if (userRow) {
                await userRow.delete();
                deletedData.user = true;
            }
        }

        // Delete from plans sheet
        const plansSheet = doc.sheetsByTitle['plans'];
        if (plansSheet) {
            const planRows = await plansSheet.getRows();
            const userPlanRows = planRows.filter(row => row.name === name);
            for (const row of userPlanRows) {
                await row.delete();
                deletedData.plans++;
            }
        }

        // Delete from custom_locations sheet
        const customSheet = doc.sheetsByTitle['custom_locations'];
        if (customSheet) {
            const customRows = await customSheet.getRows();
            const userCustomRows = customRows.filter(row => row.name === name);
            for (const row of userCustomRows) {
                await row.delete();
                deletedData.customLocations++;
            }
        }

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                ok: true,
                message: `User ${name} and all associated data deleted successfully`,
                deletedData
            })
        };

    } catch (error) {
        console.error('Error deleting user:', error);
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