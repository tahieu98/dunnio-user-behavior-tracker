const express = require('express');
const { query, validationResult } = require('express-validator');
const CtaSuggestion = require('../models/CtaSuggestion');
const Page = require('../models/Page');
const CtaEngine = require('../services/ctaEngine');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();
const ctaEngine = new CtaEngine();

// Validation helper
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }
    next();
};

// GET /api/cta/suggestions - List all suggestions
router.get('/', authenticate, asyncHandler(async (req, res) => {
    const {
        status,
        suggestion_type,
        page_id,
        priority_min,
        limit = 50,
        offset = 0
    } = req.query;

    const suggestions = await CtaSuggestion.findAll({
        status,
        suggestion_type,
        page_id,
        priority_min: priority_min ? parseInt(priority_min) : undefined,
        limit: parseInt(limit),
        offset: parseInt(offset)
    });

    res.json({
        success: true,
        data: suggestions
    });
}));

// GET /api/cta/pending - Get pending suggestions
router.get('/pending', authenticate, asyncHandler(async (req, res) => {
    const suggestions = await CtaSuggestion.getPending();

    res.json({
        success: true,
        data: suggestions
    });
}));

// GET /api/cta/stats - Get suggestion statistics
router.get('/stats', authenticate, asyncHandler(async (req, res) => {
    const { page_id, date_from, date_to } = req.query;

    const stats = await CtaSuggestion.getStats({
        page_id,
        date_from,
        date_to
    });

    res.json({
        success: true,
        data: stats
    });
}));

// GET /api/cta/generate/:pageId - Generate suggestions for a page
router.get('/generate/:pageId', authenticate, asyncHandler(async (req, res) => {
    const { pageId } = req.params;
    const { days = 7 } = req.query;

    const page = await Page.findById(pageId);
    if (!page) {
        return res.status(404).json({
            success: false,
            message: 'Page not found'
        });
    }

    // Get dead zones
    const ClickEvent = require('../models/ClickEvent');
    const deadZones = await ClickEvent.getDeadZones(
        pageId,
        parseInt(days),
        page.grid_columns,
        page.grid_row_height,
        page.grid_max_rows * page.grid_row_height
    );

    // Generate suggestions
    const generatedSuggestions = await ctaEngine.analyzeDeadZones(
        deadZones,
        page.category,
        page
    );

    // Add page_id to each suggestion
    const suggestionsWithPageId = generatedSuggestions.map(s => ({
        ...s,
        page_id: parseInt(pageId)
    }));

    res.json({
        success: true,
        data: {
            page,
            deadZonesCount: deadZones.length,
            suggestions: suggestionsWithPageId,
            summary: ctaEngine.summarizeSuggestions(suggestionsWithPageId)
        }
    });
}));

// GET /api/cta/:id - Get single suggestion
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
    const { id } = req.params;

    const suggestion = await CtaSuggestion.findById(id);

    if (!suggestion) {
        return res.status(404).json({
            success: false,
            message: 'Suggestion not found'
        });
    }

    res.json({
        success: true,
        data: suggestion
    });
}));

// POST /api/cta/suggestions - Create new suggestion
router.post('/', authenticate, [
    query('page_id').isInt(),
    query('grid_col').isInt({ min: 1, max: 12 }),
    query('grid_row').isInt({ min: 1 }),
    query('suggestion_type').isIn(['cta_button', 'internal_link', 'promo_banner', 'product_feature', 'form_improvement', 'content_gap'])
], validate, asyncHandler(async (req, res) => {
    const {
        page_id,
        grid_col,
        grid_row,
        suggestion_type,
        suggestion_title,
        suggestion_text,
        suggestion_code,
        priority,
        difficulty
    } = req.body;

    // Verify page exists
    const page = await Page.findById(page_id);
    if (!page) {
        return res.status(404).json({
            success: false,
            message: 'Page not found'
        });
    }

    const suggestion = await CtaSuggestion.create({
        page_id,
        grid_col,
        grid_row,
        suggestion_type,
        suggestion_title,
        suggestion_text,
        suggestion_code,
        priority: priority || 5,
        difficulty: difficulty || 'medium',
        created_by: req.user.id
    });

    res.status(201).json({
        success: true,
        message: 'Suggestion created successfully',
        data: suggestion
    });
}));

// POST /api/cta/bulk - Bulk create suggestions
router.post('/bulk', authenticate, authorize('admin', 'dev'), asyncHandler(async (req, res) => {
    const { suggestions } = req.body;

    if (!Array.isArray(suggestions) || suggestions.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Suggestions array is required'
        });
    }

    const created = [];
    for (const suggestion of suggestions) {
        const createdSuggestion = await CtaSuggestion.create({
            ...suggestion,
            created_by: req.user.id
        });
        created.push(createdSuggestion);
    }

    res.status(201).json({
        success: true,
        message: `${created.length} suggestions created`,
        data: created
    });
}));

// PATCH /api/cta/:id - Update suggestion
router.patch('/:id', authenticate, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    const suggestion = await CtaSuggestion.findById(id);

    if (!suggestion) {
        return res.status(404).json({
            success: false,
            message: 'Suggestion not found'
        });
    }

    // Only creator or admin can edit suggestions. Approval always requires admin.
    if (updates.status && req.user.role !== 'admin') {
        return res.status(403).json({success:false,message:'Only admin can change status'});
    }
    if (suggestion.created_by !== req.user.id &&
        req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Cannot edit suggestions created by others'
        });
    }

    // Admin can approve/reject
    if (req.user.role === 'admin') {
        if (updates.status === 'approved') {
            updates.approved_by = req.user.id;
        }
    }

    const updated = await CtaSuggestion.update(id, updates);

    if (updated) {
        const updatedSuggestion = await CtaSuggestion.findById(id);
        res.json({
            success: true,
            message: 'Suggestion updated successfully',
            data: updatedSuggestion
        });
    } else {
        res.status(400).json({
            success: false,
            message: 'No changes made'
        });
    }
}));

// PATCH /api/cta/:id/status - Quick status update
router.patch('/:id/status', authenticate, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'approved', 'implemented', 'rejected', 'archived'].includes(status)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid status'
        });
    }

    const suggestion = await CtaSuggestion.findById(id);

    if (!suggestion) {
        return res.status(404).json({
            success: false,
            message: 'Suggestion not found'
        });
    }

    // Only admin can approve/reject
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Only admin can approve or reject suggestions'
        });
    }

    await CtaSuggestion.updateStatus(id, status, req.user.id);

    const updatedSuggestion = await CtaSuggestion.findById(id);

    res.json({
        success: true,
        message: `Suggestion ${status}`,
        data: updatedSuggestion
    });
}));

// DELETE /api/cta/:id - Delete suggestion
router.delete('/:id', authenticate, asyncHandler(async (req, res) => {
    const { id } = req.params;

    const suggestion = await CtaSuggestion.findById(id);

    if (!suggestion) {
        return res.status(404).json({
            success: false,
            message: 'Suggestion not found'
        });
    }

    // Only creator or admin can delete
    if (suggestion.created_by !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Cannot delete suggestions created by others'
        });
    }

    await CtaSuggestion.delete(id);

    res.json({
        success: true,
        message: 'Suggestion deleted successfully'
    });
}));

module.exports = router;
