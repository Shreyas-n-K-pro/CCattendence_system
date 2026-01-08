require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool, initializeDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'attendance_secret_key_2024';

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true
}));
app.use(express.json());

// Health check endpoint for Railway
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Only serve static files in development
if (process.env.NODE_ENV !== 'production') {
    app.use(express.static('../frontend'));
}

// Auth middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access denied' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
    });
}

// Admin only middleware
function requireAdmin(req, res, next) {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}

// ==================== AUTH ROUTES ====================

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const result = await pool.query(
            'SELECT * FROM users WHERE username = $1',
            [username]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== STUDENT ROUTES ====================

// Get all students (with optional class filter)
app.get('/api/students', authenticateToken, async (req, res) => {
    try {
        const { class: className } = req.query;
        let query = 'SELECT * FROM students ORDER BY class, roll_number';
        let params = [];

        if (className) {
            query = 'SELECT * FROM students WHERE class = $1 ORDER BY roll_number';
            params = [className];
        }

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all classes
app.get('/api/classes', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT DISTINCT class FROM students ORDER BY class'
        );
        res.json(result.rows.map(r => r.class));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add new student
app.post('/api/students', authenticateToken, async (req, res) => {
    try {
        const { name, roll_number, class: className } = req.body;
        const result = await pool.query(
            'INSERT INTO students (name, roll_number, class) VALUES ($1, $2, $3) RETURNING *',
            [name, roll_number, className]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            res.status(400).json({ error: 'Roll number already exists' });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

// Delete student
app.delete('/api/students/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM students WHERE id = $1', [req.params.id]);
        res.json({ message: 'Student deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== ATTENDANCE ROUTES ====================

// Mark attendance
app.post('/api/attendance', authenticateToken, async (req, res) => {
    try {
        const { date, attendance } = req.body; // attendance: [{student_id, status}]
        const marked_by = req.user.id;

        for (const record of attendance) {
            await pool.query(`
                INSERT INTO attendance (student_id, date, status, marked_by)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (student_id, date) 
                DO UPDATE SET status = $3, marked_by = $4
            `, [record.student_id, date, record.status, marked_by]);
        }

        res.json({ message: 'Attendance marked successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get attendance
app.get('/api/attendance', authenticateToken, async (req, res) => {
    try {
        const { date, class: className, student_id } = req.query;
        let query = `
            SELECT a.*, s.name, s.roll_number, s.class 
            FROM attendance a 
            JOIN students s ON a.student_id = s.id 
            WHERE 1=1
        `;
        let params = [];
        let paramIndex = 1;

        if (date) {
            query += ` AND a.date = $${paramIndex++}`;
            params.push(date);
        }
        if (className) {
            query += ` AND s.class = $${paramIndex++}`;
            params.push(className);
        }
        if (student_id) {
            query += ` AND a.student_id = $${paramIndex++}`;
            params.push(student_id);
        }

        query += ' ORDER BY s.class, s.roll_number, a.date DESC';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get attendance stats
app.get('/api/attendance/stats', authenticateToken, async (req, res) => {
    try {
        const { class: className } = req.query;

        let query = `
            SELECT 
                s.id, s.name, s.roll_number, s.class,
                COUNT(a.id) as total_days,
                SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_days,
                SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent_days
            FROM students s
            LEFT JOIN attendance a ON s.id = a.student_id
        `;
        let params = [];

        if (className) {
            query += ' WHERE s.class = $1';
            params.push(className);
        }

        query += ' GROUP BY s.id, s.name, s.roll_number, s.class ORDER BY s.class, s.roll_number';

        const result = await pool.query(query, params);

        // Calculate percentage
        const stats = result.rows.map(row => ({
            ...row,
            attendance_percentage: row.total_days > 0
                ? Math.round((row.present_days / row.total_days) * 100)
                : 0
        }));

        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== ADMIN ROUTES ====================

// Get all users (admin only)
app.get('/api/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, username, role, created_at FROM users ORDER BY role, username'
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add new user (admin only)
app.post('/api/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { username, password, role } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await pool.query(
            'INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id, username, role',
            [username, hashedPassword, role]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            res.status(400).json({ error: 'Username already exists' });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

// Delete user (admin only)
app.delete('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
        res.json({ message: 'User deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get settings
app.get('/api/settings', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM settings WHERE id = 1');
        res.json(result.rows[0] || { min_attendance_percent: 75, max_absences: 10 });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update settings (admin only)
app.put('/api/settings', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { min_attendance_percent, max_absences } = req.body;
        await pool.query(
            'UPDATE settings SET min_attendance_percent = $1, max_absences = $2 WHERE id = 1',
            [min_attendance_percent, max_absences]
        );
        res.json({ message: 'Settings updated' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Dashboard stats (admin only)
app.get('/api/dashboard/stats', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const students = await pool.query('SELECT COUNT(*) FROM students');
        const teachers = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'teacher'");
        const classes = await pool.query('SELECT COUNT(DISTINCT class) FROM students');
        const todayAttendance = await pool.query(
            "SELECT COUNT(*) FROM attendance WHERE date = CURRENT_DATE AND status = 'present'"
        );

        res.json({
            total_students: parseInt(students.rows[0].count),
            total_teachers: parseInt(teachers.rows[0].count),
            total_classes: parseInt(classes.rows[0].count),
            today_present: parseInt(todayAttendance.rows[0].count)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start server
initializeDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
});
