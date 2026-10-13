const { query } = require('../config/database');

class CtaSuggestion {
    static async findById(id) {
        const suggestions = await query(
            `SELECT cs.*, p.title as page_title, p.url_path, u.username as created_by_name
             FROM cta_suggestions cs
             JOIN pages p ON p.id = cs.page_id
             LEFT JOIN users u ON u.id = cs.created_by
             WHERE cs.id = ?`,
            [id]
        );
        return suggestions[0] || null;
    }

    static async findByPage(pageId, options = {}) {
        const { status, limit = 50, offset = 0 } = options;

        let sql = `SELECT cs.*, u.username as created_by_name
                   FROM cta_suggestions cs
                   LEFT JOIN users u ON u.id = cs.created_by
                   WHERE cs.page_id = ?`;
        const params = [pageId];

        if (status) {
            sql += ' AND cs.status = ?';
            params.push(status);
        }

        sql += ' ORDER BY cs.priority DESC, cs.created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        return query(sql, params);
    }

    static async findAll(options = {}) {
        const {
            status,
            suggestion_type,
            page_id,
            priority_min,
            created_by,
            limit = 50,
            offset = 0
        } = options;

        let sql = `SELECT cs.*, p.title as page_title, p.url_path, u.username as created_by_name
                   FROM cta_suggestions cs
                   JOIN pages p ON p.id = cs.page_id
                   LEFT JOIN users u ON u.id = cs.created_by
                   WHERE 1=1`;
        const params = [];

        if (status) {
            sql += ' AND cs.status = ?';
            params.push(status);
        }

        if (suggestion_type) {
            sql += ' AND cs.suggestion_type = ?';
            params.push(suggestion_type);
        }

        if (page_id) {
            sql += ' AND cs.page_id = ?';
            params.push(page_id);
        }

        if (priority_min) {
            sql += ' AND cs.priority >= ?';
            params.push(priority_min);
        }

        if (created_by) {
            sql += ' AND cs.created_by = ?';
            params.push(created_by);
        }

        sql += ' ORDER BY cs.priority DESC, cs.created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        return query(sql, params);
    }

    static async getPending() {
        return query(
            `SELECT cs.*, p.title as page_title, p.url_path
             FROM cta_suggestions cs
             JOIN pages p ON p.id = cs.page_id
             WHERE cs.status = 'pending'
             ORDER BY cs.priority DESC, cs.created_at DESC`
        );
    }

    static async create(suggestionData) {
        const {
            page_id,
            grid_col,
            grid_row,
            suggestion_type,
            suggestion_title,
            suggestion_text,
            suggestion_code,
            priority = 0,
            difficulty = 'medium',
            created_by
        } = suggestionData;

        const result = await query(
            `INSERT INTO cta_suggestions (
                page_id, grid_col, grid_row, suggestion_type,
                suggestion_title, suggestion_text, suggestion_code,
                priority, difficulty, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                page_id, grid_col, grid_row, suggestion_type,
                suggestion_title, suggestion_text, suggestion_code,
                priority, difficulty, created_by
            ]
        );

        return { id: result.insertId, ...suggestionData };
    }

    static async update(id, updateData) {
        const fields = [];
        const values = [];

        const allowedFields = [
            'suggestion_type', 'suggestion_title', 'suggestion_text',
            'suggestion_code', 'priority', 'difficulty', 'status',
            'approved_by', 'implemented_at'
        ];

        for (const field of allowedFields) {
            if (updateData[field] !== undefined) {
                fields.push(`${field} = ?`);
                values.push(updateData[field]);
            }
        }

        if (fields.length === 0) return false;

        values.push(id);
        const result = await query(
            `UPDATE cta_suggestions SET ${fields.join(', ')} WHERE id = ?`,
            values
        );

        return result.affectedRows > 0;
    }

    static async updateStatus(id, status, userId = null) {
        const updateData = { status };

        if (status === 'approved') {
            updateData.approved_by = userId;
        }

        if (status === 'implemented') {
            updateData.implemented_at = new Date();
        }

        return this.update(id, updateData);
    }

    static async delete(id) {
        const result = await query('DELETE FROM cta_suggestions WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    static async getStats(options = {}) {
        const { page_id, date_from, date_to } = options;

        let sql = `SELECT
            COUNT(*) as total,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
            SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
            SUM(CASE WHEN status = 'implemented' THEN 1 ELSE 0 END) as implemented,
            SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
        FROM cta_suggestions WHERE 1=1`;
        const params = [];

        if (page_id) {
            sql += ' AND page_id = ?';
            params.push(page_id);
        }

        if (date_from) {
            sql += ' AND created_at >= ?';
            params.push(date_from);
        }

        if (date_to) {
            sql += ' AND created_at <= ?';
            params.push(date_to);
        }

        const [result] = await query(sql, params);
        return result;
    }

    // Auto-generate suggestions based on dead zones
    static async generateSuggestions(pageId, deadZones, pageCategory) {
        const suggestions = [];

        for (const zone of deadZones) {
            let suggestionType = 'cta_button';
            let suggestionTitle = 'Add Call-to-Action';
            let suggestionText = 'Consider adding a CTA button here';

            // Customize based on page category
            if (pageCategory === 'wedding') {
                suggestionTitle = 'Wedding Promotion';
                suggestionText = 'Add seasonal wedding promotion or package highlight';
            } else if (pageCategory === '3d-demo') {
                suggestionTitle = '3D Demo CTA';
                suggestionText = 'Add a prominent button to start 3D customization';
            } else if (pageCategory === 'suits' || pageCategory === 'tuxedo') {
                suggestionTitle = 'Product CTA';
                suggestionText = 'Add "Book Appointment" or "View Pricing" button';
            } else if (pageCategory === 'shirts' || pageCategory === 'pants') {
                suggestionTitle = 'Quick Order CTA';
                suggestionText = 'Add "Customize Now" or "Get Quote" button';
            }

            // Higher rows = lower on page = potentially missed CTA
            if (zone.grid_row > 5) {
                suggestions.push({
                    page_id: pageId,
                    grid_col: zone.grid_col,
                    grid_row: zone.grid_row,
                    suggestion_type: suggestionType,
                    suggestion_title: suggestionTitle,
                    suggestion_text: suggestionText,
                    priority: Math.max(1, 10 - zone.grid_row),
                    difficulty: 'medium'
                });
            }
        }

        return suggestions;
    }
}

module.exports = CtaSuggestion;
