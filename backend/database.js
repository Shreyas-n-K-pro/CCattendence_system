const { Pool } = require('pg');

// Support Railway's DATABASE_URL or individual env vars
let poolConfig;

if (process.env.DATABASE_URL) {
    // Railway/Heroku style connection string
    poolConfig = {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    };
} else {
    // Individual environment variables (local development)
    const DB_USER = process.env.DB_USER || 'postgres';
    const DB_HOST = process.env.DB_HOST || 'localhost';
    const DB_NAME = process.env.DB_NAME || 'attendance_db';
    const DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';
    const DB_PORT = parseInt(process.env.DB_PORT, 10) || 5432;
    
    poolConfig = {
        user: DB_USER,
        host: DB_HOST,
        database: DB_NAME,
        password: DB_PASSWORD,
        port: DB_PORT,
    };
}

const pool = new Pool(poolConfig);

// Ensure the target database exists (only for local development)
async function ensureDatabaseExists() {
    // Skip for production (Railway creates the database)
    if (process.env.DATABASE_URL) {
        console.log('Using DATABASE_URL, skipping database creation');
        return;
    }
    
    const DB_USER = process.env.DB_USER || 'postgres';
    const DB_HOST = process.env.DB_HOST || 'localhost';
    const DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';
    const DB_PORT = parseInt(process.env.DB_PORT, 10) || 5432;
    const DB_ADMIN_DB = process.env.DB_ADMIN_DB || 'postgres';
    const DB_NAME = process.env.DB_NAME || 'attendance_db';

    const adminConfig = {
        user: DB_USER,
        host: DB_HOST,
        database: DB_ADMIN_DB,
        password: DB_PASSWORD,
        port: DB_PORT,
    };

    const adminPool = new Pool(adminConfig);
    const client = await adminPool.connect();
    try {
        const res = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [DB_NAME]);
        if (res.rowCount === 0) {
            // Create database
            await client.query(`CREATE DATABASE "${DB_NAME}"`);
            console.log('Created database:', DB_NAME);
        }
    } finally {
        client.release();
        await adminPool.end();
    }
}

// Initialize database tables
async function initializeDatabase() {
    // Try to ensure DB exists first
    try {
        await ensureDatabaseExists();
    } catch (err) {
        console.error('Could not ensure database exists:', err.message || err);
        throw err;
    }

    const client = await pool.connect();
    try {
        // Users table (teachers and admins)
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(20) NOT NULL CHECK (role IN ('teacher', 'admin')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Students table
        await client.query(`
            CREATE TABLE IF NOT EXISTS students (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                roll_number VARCHAR(50) UNIQUE NOT NULL,
                class VARCHAR(50) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Attendance table
        await client.query(`
            CREATE TABLE IF NOT EXISTS attendance (
                id SERIAL PRIMARY KEY,
                student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
                date DATE NOT NULL,
                status VARCHAR(10) NOT NULL CHECK (status IN ('present', 'absent')),
                marked_by INTEGER REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(student_id, date)
            )
        `);

        // Settings table
        await client.query(`
            CREATE TABLE IF NOT EXISTS settings (
                id SERIAL PRIMARY KEY,
                min_attendance_percent INTEGER DEFAULT 75,
                max_absences INTEGER DEFAULT 10
            )
        `);

        // Insert default admin if not exists
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await client.query(`
            INSERT INTO users (username, password, role)
            VALUES ('admin', $1, 'admin')
            ON CONFLICT (username) DO NOTHING
        `, [hashedPassword]);

        // Insert default settings if not exists
        await client.query(`
            INSERT INTO settings (id, min_attendance_percent, max_absences)
            VALUES (1, 75, 10)
            ON CONFLICT (id) DO NOTHING
        `);

        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Database initialization error:', error);
        throw error;
    } finally {
        client.release();
    }
}

module.exports = { pool, initializeDatabase };
