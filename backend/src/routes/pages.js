const express = require('express');
const { body, query, validationResult } = require('express-validator');
const Page = require('../models/Page');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

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

// GET /api/pages - List all pages
router.get('/', authenticate, asyncHandler(async (req, res) => {
    const {
        category,
        subcategory,
        is_tracked,
        is_3d_demo,
        search,
        limit = 50,
        offset = 0
    } = req.query;

    const pages = await Page.findAll({
        category,
        subcategory,
        is_tracked: is_tracked !== undefined ? is_tracked === 'true' : undefined,
        is_3d_demo: is_3d_demo !== undefined ? is_3d_demo === 'true' : undefined,
        search,
        limit: parseInt(limit),
        offset: parseInt(offset)
    });

    const total = await Page.count({
        category,
        is_tracked: is_tracked !== undefined ? is_tracked === 'true' : undefined,
        is_3d_demo: is_3d_demo !== undefined ? is_3d_demo === 'true' : undefined
    });

    res.json({
        success: true,
        data: {
            pages,
            total,
            limit: parseInt(limit),
            offset: parseInt(offset)
        }
    });
}));

// GET /api/pages/categories - Get all categories
router.get('/categories', authenticate, asyncHandler(async (req, res) => {
    const categories = await Page.getCategories();

    res.json({
        success: true,
        data: categories
    });
}));

// GET /api/pages/:id - Get single page
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
    const { id } = req.params;

    const page = await Page.findById(id);

    if (!page) {
        return res.status(404).json({
            success: false,
            message: 'Page not found'
        });
    }

    res.json({
        success: true,
        data: page
    });
}));

// GET /api/pages/:id/grid - Get grid cells for page
router.get('/:id/grid', authenticate, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { days = 7 } = req.query;

    const page = await Page.findById(id);

    if (!page) {
        return res.status(404).json({
            success: false,
            message: 'Page not found'
        });
    }

    const gridCells = await Page.getGridCells(id, {
        days: parseInt(days)
    });

    res.json({
        success: true,
        data: {
            page,
            gridCells,
            config: {
                columns: page.grid_columns,
                rowHeight: page.grid_row_height,
                maxRows: page.grid_max_rows
            }
        }
    });
}));

// GET /api/pages/:id/analytics - Get analytics for page
router.get('/:id/analytics', authenticate, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { days = 7 } = req.query;

    const page = await Page.findById(id);

    if (!page) {
        return res.status(404).json({
            success: false,
            message: 'Page not found'
        });
    }

    const ClickEvent = require('../models/ClickEvent');

    const hotspots = await ClickEvent.getHotspots(id, parseInt(days));
    const deadZones = await ClickEvent.getDeadZones(
        id,
        parseInt(days),
        page.grid_columns,
        page.grid_row_height,
        page.grid_max_rows * page.grid_row_height
    );
    const aggregatedData = await ClickEvent.getAggregatedByCell(id, parseInt(days));

    res.json({
        success: true,
        data: {
            page,
            summary: {
                hotspotsCount: hotspots.length,
                deadZonesCount: deadZones.length,
                totalDataPoints: aggregatedData.length
            },
            hotspots,
            deadZones,
            clickData: aggregatedData,
            config: {
                columns: page.grid_columns,
                rowHeight: page.grid_row_height
            }
        }
    });
}));

// POST /api/pages - Create new page
router.post('/', authenticate, authorize('admin', 'dev'), [
    body('url').notEmpty().isURL(),
    body('title').notEmpty().trim(),
    body('category').notEmpty().trim()
], validate, asyncHandler(async (req, res) => {
    const {
        url,
        title,
        category,
        subcategory,
        description,
        grid_columns,
        grid_row_height,
        is_3d_demo
    } = req.body;

    // Extract url_path from url
    const urlObj = new URL(url);
    const url_path = urlObj.pathname;

    // Check if page already exists
    const existing = await Page.findByUrl(url_path);
    if (existing) {
        return res.status(409).json({
            success: false,
            message: 'Page with this URL already exists'
        });
    }

    const page = await Page.create({
        url,
        url_path,
        title,
        category,
        subcategory,
        description,
        grid_columns,
        grid_row_height,
        is_3d_demo
    });

    res.status(201).json({
        success: true,
        message: 'Page created successfully',
        data: page
    });
}));

// PUT /api/pages/:id - Update page
router.put('/:id', authenticate, authorize('admin', 'dev'), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    const page = await Page.findById(id);

    if (!page) {
        return res.status(404).json({
            success: false,
            message: 'Page not found'
        });
    }

    const updated = await Page.update(id, updates);

    if (updated) {
        const updatedPage = await Page.findById(id);
        res.json({
            success: true,
            message: 'Page updated successfully',
            data: updatedPage
        });
    } else {
        res.status(400).json({
            success: false,
            message: 'No changes made'
        });
    }
}));

// DELETE /api/pages/:id - Delete page
router.delete('/:id', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
    const { id } = req.params;

    const page = await Page.findById(id);

    if (!page) {
        return res.status(404).json({
            success: false,
            message: 'Page not found'
        });
    }

    const deleted = await Page.delete(id);

    if (deleted) {
        res.json({
            success: true,
            message: 'Page deleted successfully'
        });
    } else {
        res.status(400).json({
            success: false,
            message: 'Failed to delete page'
        });
    }
}));

module.exports = router;
