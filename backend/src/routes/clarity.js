const express = require('express');
const clarityService = require('../services/clarityService');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();
const {invalid}=require('../services/behaviorMath');
function rejectCalendarRange(values){if(['startDate','endDate','dateFrom','dateTo','month','monthA','monthB'].some(k=>values[k]!==undefined))invalid('Clarity Export API supports only relative 1–3 day windows; use stored exports or portal heatmaps for calendar date ranges');}
router.get('/compare-exports',authenticate,asyncHandler(async(req,res)=>res.json({success:true,data:await require('../services/clarityComparison').compare(req.query)})));

// GET /api/clarity/status - Get Clarity integration status
router.get('/status', authenticate, asyncHandler(async (req, res) => {
    try {
        const token = await clarityService.getActiveToken();

        res.json({
            success: true,
            data: {
                configured: true,
                projectId: token.project_id,
                projectName: token.project_name,
                expiresAt: token.expires_at,
                lastUsed: token.last_used_at
            }
        });
    } catch (error) {
        res.json({
            success: true,
            data: {
                configured: false,
                message: error.message
            }
        });
    }
}));

// POST /api/clarity/token - Add/Update Clarity token
router.post('/token', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
    const { token_name, jwt_token, project_id, project_name, expires_at } = req.body;

    if (!jwt_token) {
        return res.status(400).json({
            success: false,
            message: 'JWT token is required'
        });
    }

    const token = await clarityService.saveToken({
        token_name: token_name || 'Default',
        jwt_token,
        project_id: project_id || '',
        project_name: project_name || '',
        expires_at: expires_at || null,
        created_by: req.user.id
    });

    res.status(201).json({
        success: true,
        message: 'Clarity token saved successfully',
        data: {
            id: token.id,
            token_name: token.token_name,
            project_id: token.project_id
        }
    });
}));

// GET /api/clarity/insights - Get live insights from Clarity
router.get('/insights', authenticate, authorize('admin','dev'), asyncHandler(async (req, res) => {
    rejectCalendarRange(req.query);
    const { numOfDays = 2, dimension1, dimension2, dimension3 } = req.query;

    try {
        const token = await clarityService.getActiveToken();

        const insights = await clarityService.getLiveInsights(
            token.jwt_token,
            token.project_id,
            {
                numOfDays: parseInt(numOfDays),
                dimension1,
                dimension2,
                dimension3
            }
        );

        res.json({
            success: true,
            data: {
                insights,
                projectId: token.project_id,
                ...await clarityService.getExportMetadata(token.project_id,{numOfDays:Number(numOfDays),dimension1,dimension2,dimension3})
            }
        });
    } catch (error) {
        res.status(error.statusCode || 502).json({
            success: false,
            message: error.message
        });
    }
}));

// POST /api/clarity/sync - Sync data from Clarity for a page
router.post('/sync/:pageId(\\d+)', authenticate, authorize('admin', 'dev'), asyncHandler(async (req, res) => {
    const { pageId } = req.params;
    const { numOfDays = 2 } = req.body;

    try {
        const result = await clarityService.syncData(parseInt(pageId), {
            numOfDays: parseInt(numOfDays)
        });

        res.json({
            success: true,
            message: 'Sync completed successfully',
            data: result
        });
    } catch (error) {
        res.status(error.statusCode || 502).json({
            success: false,
            message: error.message
        });
    }
}));

// POST /api/clarity/sync/all - Sync all pages
router.post('/sync/all', authenticate, authorize('admin','dev'), asyncHandler(async (req, res) => {
    rejectCalendarRange(req.body);
    const { numOfDays = 2 } = req.body;

    const results = await clarityService.syncData(null, { numOfDays: Number(numOfDays),dimensions:req.body.dimensions||['URL','Device'] });

    res.json({
        success: true,
        message: 'Project aggregate export archived',
        data: results
    });
}));

// GET /api/clarity/history - Get sync history
router.get('/history', authenticate, asyncHandler(async (req, res) => {
    const { limit = 10 } = req.query;

    const history = await clarityService.getSyncHistory(parseInt(limit));

    res.json({
        success: true,
        data: history
    });
}));

// GET /api/clarity/suggestions - Get CTA suggestions from Clarity data
router.get('/suggestions/:pageId', authenticate, asyncHandler(async (req, res) => {
    const { pageId } = req.params;

    const Page = require('../models/Page');
    const page = await Page.findById(pageId);

    if (!page) {
        return res.status(404).json({
            success: false,
            message: 'Page not found'
        });
    }

    // This would use Clarity data to generate suggestions
    // For now, we'll use the local data
    const ClickEvent = require('../models/ClickEvent');
    const CtaEngine = require('../services/ctaEngine');
    const ctaEngine = new CtaEngine();

    const deadZones = await ClickEvent.getDeadZones(
        pageId,
        7,
        page.grid_columns,
        page.grid_row_height,
        page.grid_max_rows * page.grid_row_height
    );

    const suggestions = await ctaEngine.analyzeDeadZones(deadZones, page.category, page);

    res.json({
        success: true,
        data: {
            page,
            deadZonesCount: deadZones.length,
            suggestions: suggestions.map(s => ({
                ...s,
                page_id: pageId
            })),
            summary: ctaEngine.summarizeSuggestions(suggestions)
        }
    });
}));

module.exports = router;
