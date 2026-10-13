const { query, transaction } = require('../config/database');

class Page {
    static async findById(id) {
        const pages = await query(
            'SELECT * FROM pages WHERE id = ?',
            [id]
        );
        return pages[0] || null;
    }

    static async findByUrl(urlPath) {
        const pages = await query(
            'SELECT * FROM pages WHERE url_path = ?',
            [urlPath]
        );
        return pages[0] || null;
    }

    static async findAll(options = {}) {
        const {
            category,
            subcategory,
            is_tracked = true,
            is_3d_demo,
            search,
            limit = 50,
            offset = 0
        } = options;

        let sql = 'SELECT * FROM pages WHERE 1=1';
        const params = [];

        if (category) {
            sql += ' AND category = ?';
            params.push(category);
        }

        if (subcategory) {
            sql += ' AND subcategory = ?';
            params.push(subcategory);
        }

        if (is_tracked !== undefined) {
            sql += ' AND is_tracked = ?';
            params.push(is_tracked);
        }

        if (is_3d_demo !== undefined) {
            sql += ' AND is_3d_demo = ?';
            params.push(is_3d_demo);
        }

        if (search) {
            sql += ' AND (title LIKE ? OR url LIKE ? OR description LIKE ?)';
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        sql += ' ORDER BY category, title LIMIT ? OFFSET ?';
        params.push(limit, offset);

        return query(sql, params);
    }

    static async findByCategory(category) {
        return query(
            'SELECT * FROM pages WHERE category = ? ORDER BY title',
            [category]
        );
    }

    static async getCategories() {
        return query(
            'SELECT DISTINCT category, COUNT(*) as count FROM pages GROUP BY category ORDER BY category'
        );
    }

    static async create(pageData) {
        const {
            url,
            url_path,
            title,
            category,
            subcategory = null,
            description = null,
            grid_columns = 12,
            grid_row_height = 50,
            is_3d_demo = false
        } = pageData;

        const result = await query(
            `INSERT INTO pages (url, url_path, title, category, subcategory, description,
              grid_columns, grid_row_height, is_3d_demo)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [url, url_path, title, category, subcategory, description,
             grid_columns, grid_row_height, is_3d_demo]
        );

        return { id: result.insertId, ...pageData };
    }

    static async update(id, updateData) {
        const fields = [];
        const values = [];

        const allowedFields = [
            'title', 'category', 'subcategory', 'description',
            'grid_columns', 'grid_row_height', 'grid_max_rows',
            'viewport_width', 'viewport_height', 'is_tracked',
            'last_synced_at', 'last_data_update'
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
            `UPDATE pages SET ${fields.join(', ')} WHERE id = ?`,
            values
        );

        return result.affectedRows > 0;
    }

    static async delete(id) {
        const result = await query('DELETE FROM pages WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    static async getGridCells(pageId, options = {}) {
        const { date, days = 7 } = options;

        let sql = `
            SELECT
                gc.*,
                COALESCE(SUM(ce.click_count), 0) as total_clicks,
                COALESCE(AVG(ce.avg_scroll_depth), 0) as avg_scroll
            FROM grid_cells gc
            LEFT JOIN click_events ce ON ce.page_id = gc.page_id
                AND ce.grid_col_start <= gc.grid_col
                AND ce.grid_col_end >= gc.grid_col
                AND ce.grid_row_start <= gc.grid_row
                AND ce.grid_row_end >= gc.grid_row
                AND ce.data_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            WHERE gc.page_id = ?
            GROUP BY gc.id
            ORDER BY gc.grid_row, gc.grid_col
        `;

        return query(sql, [days, pageId]);
    }

    static async count(options = {}) {
        const { category, is_tracked, is_3d_demo } = options;

        let sql = 'SELECT COUNT(*) as count FROM pages WHERE 1=1';
        const params = [];

        if (category) {
            sql += ' AND category = ?';
            params.push(category);
        }

        if (is_tracked !== undefined) {
            sql += ' AND is_tracked = ?';
            params.push(is_tracked);
        }

        if (is_3d_demo !== undefined) {
            sql += ' AND is_3d_demo = ?';
            params.push(is_3d_demo);
        }

        const [result] = await query(sql, params);
        return result.count;
    }
}

module.exports = Page;
