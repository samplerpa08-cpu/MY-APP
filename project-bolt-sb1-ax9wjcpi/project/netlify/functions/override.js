/**
 * Netlify Function: Get/Set admin week override
 * GET/POST /.netlify/functions/override
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

    try {
        // Initialize Google Sheets
        const serviceAccountInfo = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
        const doc = new GoogleSpreadsheet(process.env.SHEET_BACKEND_ID);
        await doc.useServiceAccountAuth(serviceAccountInfo);
        await doc.loadInfo();

        // Get or create admin_overrides sheet
        let overrideSheet = doc.sheetsByTitle['admin_overrides'];
        if (!overrideSheet) {
            overrideSheet = await doc.addSheet({
                title: 'admin_overrides',
                headerValues: ['admin_name', 'override_week_start', 'created_at']
            });
        }

        if (event.httpMethod === 'GET') {
            // Get current override
            const rows = await overrideSheet.getRows();
            const currentOverride = rows.length > 0 ? rows[rows.length - 1] : null; // Get most recent

            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({
                    ok: true,
                    override: currentOverride ? {
                        adminName: currentOverride.admin_name,
                        overrideWeekStart: currentOverride.override_week_start
                    } : null
                })
            };

        } else if (event.httpMethod === 'POST') {
            // Set override
            const { adminName, overrideWeekStart } = JSON.parse(event.body);

            if (overrideWeekStart === null || overrideWeekStart === '') {
                // Clear override - delete all rows
                const rows = await overrideSheet.getRows();
                for (const row of rows) {
                    await row.delete();
                }
            } else {
                // Set new override
                if (!adminName || !overrideWeekStart) {
                    return {
                        statusCode: 400,
                        headers: corsHeaders,
                        body: JSON.stringify({
                            ok: false,
                            message: 'adminName and overrideWeekStart are required'
                        })
                    };
                }

                // Clear existing overrides first
                const existingRows = await overrideSheet.getRows();
                for (const row of existingRows) {
                    await row.delete();
                }

                // Add new override
                await overrideSheet.addRow({
                    admin_name: adminName,
                    override_week_start: overrideWeekStart,
                    created_at: new Date().toISOString()
                });
            }

            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({
                    ok: true,
                    message: overrideWeekStart ? 'Override set successfully' : 'Override cleared successfully'
                })
            };
        } else {
            return {
                statusCode: 405,
                headers: corsHeaders,
                body: JSON.stringify({ ok: false, message: 'Method not allowed' })
            };
        }

    } catch (error) {
        console.error('Error handling override:', error);
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