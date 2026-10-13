const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { generateToken, authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Validation middleware
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

// POST /api/auth/login
router.post('/login', [
    body('username').notEmpty().trim(),
    body('password').notEmpty()
], validate, asyncHandler(async (req, res) => {
    const { username, password } = req.body;

    // Find user
    const user = await User.findByUsername(username);

    if (!user) {
        return res.status(401).json({
            success: false,
            message: 'Invalid username or password'
        });
    }

    // Check if user is active
    if (!user.is_active) {
        return res.status(401).json({
            success: false,
            message: 'Account is disabled'
        });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
        return res.status(401).json({
            success: false,
            message: 'Invalid username or password'
        });
    }

    // Update last login
    await User.updateLastLogin(user.id);

    // Generate token
    const token = generateToken(user);

    res.json({
        success: true,
        message: 'Login successful',
        data: {
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        }
    });
}));

// POST /api/auth/register
router.post('/register', [
    body('username').isLength({ min: 3, max: 50 }).trim(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 12 }),
    body('role').optional().isIn(['dev', 'editor'])
], validate, authenticate, authorize('admin'), asyncHandler(async (req, res) => {
    const { username, email, password, role } = req.body;

    // Check if username exists
    const existingUser = await User.findByUsername(username);
    if (existingUser) {
        return res.status(409).json({
            success: false,
            message: 'Username already exists'
        });
    }

    // Check if email exists
    const existingEmail = await User.findByEmail(email);
    if (existingEmail) {
        return res.status(409).json({
            success: false,
            message: 'Email already exists'
        });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Create user
    const user = await User.create({
        username,
        email,
        password_hash,
        role: role || 'editor'
    });

    res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role
        }
    });
}));

// GET /api/auth/me
router.get('/me', authenticate, asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);

    if (!user) {
        return res.status(404).json({
            success: false,
            message: 'User not found'
        });
    }

    res.json({
        success: true,
        data: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            last_login: user.last_login,
            created_at: user.created_at
        }
    });
}));

// GET /api/auth/users
router.get('/users', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
    const { role, is_active, limit, offset } = req.query;

    const users = await User.findAll({
        role,
        is_active: is_active !== undefined ? is_active === 'true' : undefined,
        limit: parseInt(limit) || 50,
        offset: parseInt(offset) || 0
    });

    const total = await User.count({ role });

    res.json({
        success: true,
        data: {
            users,
            total,
            limit: parseInt(limit) || 50,
            offset: parseInt(offset) || 0
        }
    });
}));

// PATCH /api/auth/users/:id
router.patch('/users/:id', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { username, email, role, is_active } = req.body;

    const user = await User.findById(id);
    if (!user) {
        return res.status(404).json({
            success: false,
            message: 'User not found'
        });
    }

    // Prevent changing own role
    if (parseInt(id) === req.user.id && role && role !== user.role) {
        return res.status(400).json({
            success: false,
            message: 'Cannot change your own role'
        });
    }

    const updated = await User.update(id, {
        username,
        email,
        role,
        is_active
    });

    if (updated) {
        const updatedUser = await User.findById(id);
        res.json({
            success: true,
            message: 'User updated successfully',
            data: updatedUser
        });
    } else {
        res.status(400).json({
            success: false,
            message: 'No changes made'
        });
    }
}));

// DELETE /api/auth/users/:id
router.delete('/users/:id', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (parseInt(id) === req.user.id) {
        return res.status(400).json({
            success: false,
            message: 'Cannot delete your own account'
        });
    }

    const deleted = await User.delete(id);

    if (deleted) {
        res.json({
            success: true,
            message: 'User deleted successfully'
        });
    } else {
        res.status(404).json({
            success: false,
            message: 'User not found'
        });
    }
}));

// PUT /api/auth/password
router.put('/password', authenticate, [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 12 })
], validate, asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    const user = await User.findForPasswordChange(userId);

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
        return res.status(400).json({
            success: false,
            message: 'Current password is incorrect'
        });
    }

    const password_hash = await bcrypt.hash(newPassword, 10);
    await User.update(userId, { password_hash });

    res.json({
        success: true,
        message: 'Password updated successfully'
    });
}));

module.exports = router;
