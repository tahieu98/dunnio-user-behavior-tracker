const { query } = require('../config/database');

class ClickEvent {
    static async findByPageAndDate(pageId, date) {
        return query(
            'SELECT * FROM click_events WHERE page_id = ? AND data_date = ? ORDER BY grid_row_start, grid_col_start',
            [pageId, date]
        );
    }

    static async findByPageAndRange(pageId, startDate, endDate) {
        return query(
            `SELECT * FROM click_events
             WHERE page_id = ? AND data_date BETWEEN ? AND ?
             ORDER BY grid_row_start, grid_col_start`,
            [pageId, startDate, endDate]
        );
    }

    static async getAggregatedByCell(pageId, days = 7) {
        return query(
            `SELECT
                grid_col_start,
                grid_col_end,
                grid_row_start,
                grid_row_end,
                element_selector,
                SUM(click_count) as total_clicks,
                SUM(unique_clicks) as total_unique,
                AVG(avg_scroll_depth) as avg_scroll,
                AVG(avg_engagement_time) as avg_engagement,
                SUM(dead_click_count) as total_dead_clicks,
                SUM(rage_click_count) as total_rage_clicks
            FROM click_events
            WHERE page_id = ? AND data_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            GROUP BY grid_col_start, grid_col_end, grid_row_start, grid_row_end, element_selector
            ORDER BY total_clicks DESC`,
            [pageId, days]
        );
    }

    static async create(eventData) {
        const {
            page_id,
            element_selector,
            element_text,
            element_tag,
            grid_col_start,
            grid_col_end,
            grid_row_start,
            grid_row_end,
            click_count,
            unique_clicks,
            avg_scroll_depth,
            avg_engagement_time,
            dead_click_count,
            rage_click_count,
            data_date
        } = eventData;

        const result = await query(
            `INSERT INTO click_events (
                page_id, element_selector, element_text, element_tag,
                grid_col_start, grid_col_end, grid_row_start, grid_row_end,
                click_count, unique_clicks, avg_scroll_depth, avg_engagement_time,
                dead_click_count, rage_click_count, data_date
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                page_id, element_selector, element_text, element_tag,
                grid_col_start, grid_col_end, grid_row_start, grid_row_end,
                click_count, unique_clicks, avg_scroll_depth, avg_engagement_time,
                dead_click_count, rage_click_count, data_date
            ]
        );

        return { id: result.insertId, ...eventData };
    }

    static async bulkCreate(events) {
        if (events.length === 0) return { inserted: 0 };

        const values = events.map(e => [
            e.page_id, e.element_selector, e.element_text, e.element_tag,
            e.grid_col_start, e.grid_col_end, e.grid_row_start, e.grid_row_end,
            e.click_count, e.unique_clicks, e.avg_scroll_depth, e.avg_engagement_time,
            e.dead_click_count, e.rage_click_count, e.data_date
        ]);

        const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');

        const result = await query(
            `INSERT INTO click_events (
                page_id, element_selector, element_text, element_tag,
                grid_col_start, grid_col_end, grid_row_start, grid_row_end,
                click_count, unique_clicks, avg_scroll_depth, avg_engagement_time,
                dead_click_count, rage_click_count, data_date
            ) VALUES ${placeholders}`,
            values.flat()
        );

        return { inserted: result.affectedRows };
    }

    static async getHotspots(pageId, days = 7, limit = 10) {
        return query(
            `SELECT
                grid_col_start,
                grid_row_start,
                grid_col_end,
                grid_row_end,
                element_selector,
                SUM(click_count) as total_clicks,
                AVG(avg_scroll_depth) as avg_scroll
            FROM click_events
            WHERE page_id = ? AND data_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            GROUP BY grid_col_start, grid_row_start, grid_col_end, grid_row_end, element_selector
            ORDER BY total_clicks DESC
            LIMIT ?`,
            [pageId, days, limit]
        );
    }

    static async getDeadZones(pageId, days = 7, gridCols = 12, rowHeight = 50, pageHeight = 5000) {
        // Get all cells with clicks
        const activeCells = await query(
            `SELECT DISTINCT
                grid_col_start,
                grid_row_start,
                grid_col_end,
                grid_row_end
             FROM click_events
             WHERE page_id = ? AND data_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)`,
            [pageId, days]
        );

        // Calculate dead zones (cells without clicks)
        const totalRows = Math.ceil(pageHeight / rowHeight);
        const deadZones = [];

        for (let row = 1; row <= totalRows; row++) {
            for (let col = 1; col <= gridCols; col++) {
                const hasClick = activeCells.some(cell =>
                    col >= cell.grid_col_start && col <= cell.grid_col_end &&
                    row >= cell.grid_row_start && row <= cell.grid_row_end
                );

                if (!hasClick) {
                    deadZones.push({
                        grid_col: col,
                        grid_row: row,
                        pixel_y: (row - 1) * rowHeight,
                        is_dead_zone: true
                    });
                }
            }
        }

        return deadZones;
    }

    static async deleteOldData(beforeDate) {
        const result = await query(
            'DELETE FROM click_events WHERE data_date < ?',
            [beforeDate]
        );
        return result.affectedRows;
    }
}

module.exports = ClickEvent;
