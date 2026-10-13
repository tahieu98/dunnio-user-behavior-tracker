const { query } = require('../config/database');

class User {
    static async findForPasswordChange(id) {
        const users = await query('SELECT id, password_hash FROM users WHERE id = ?', [id]);
        return users[0] || null;
    }
    static async findById(id) {
        const users = await query(
            'SELECT id, username, email, role, is_active, last_login, created_at FROM users WHERE id = ?',
            [id]
        );
        return users[0] || null;
    }

    static async findByUsername(username) {
        const users = await query(
            'SELECT * FROM users WHERE username = ?',
            [username]
        );
        return users[0] || null;
    }

    static async findByEmail(email) {
        const users = await query(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );
        return users[0] || null;
    }

    static async findAll(options = {}) {
        const { role, is_active, limit = 50, offset = 0 } = options;

        let sql = 'SELECT id, username, email, role, is_active, last_login, created_at FROM users WHERE 1=1';
        const params = [];

        if (role) {
            sql += ' AND role = ?';
            params.push(role);
        }

        if (is_active !== undefined) {
            sql += ' AND is_active = ?';
            params.push(is_active);
        }

        sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        return query(sql, params);
    }

    static async create(userData) {
        const { username, email, password_hash, role = 'editor' } = userData;

        const result = await query(
            'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
            [username, email, password_hash, role]
        );

        return { id: result.insertId, username, email, role };
    }

    static async update(id, updateData) {
        const fields = [];
        const values = [];

        const allowedFields = ['username', 'email', 'role', 'is_active', 'last_login', 'password_hash'];

        for (const field of allowedFields) {
            if (updateData[field] !== undefined) {
                fields.push(`${field} = ?`);
                values.push(updateData[field]);
            }
        }

        if (fields.length === 0) return false;

        values.push(id);
        const result = await query(
            `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
            values
        );

        return result.affectedRows > 0;
    }

    static async updateLastLogin(id) {
        await query(
            'UPDATE users SET last_login = NOW() WHERE id = ?',
            [id]
        );
    }

    static async delete(id) {
        const result = await query('DELETE FROM users WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    static async count(options = {}) {
        const { role, is_active } = options;

        let sql = 'SELECT COUNT(*) as count FROM users WHERE 1=1';
        const params = [];

        if (role) {
            sql += ' AND role = ?';
            params.push(role);
        }

        if (is_active !== undefined) {
            sql += ' AND is_active = ?';
            params.push(is_active);
        }

        const [result] = await query(sql, params);
        return result.count;
    }
}

module.exports = User;
