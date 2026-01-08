// Configuration for the Attendance System Frontend

const CONFIG = {
    // Auto-detect environment:
    // - localhost:80 (Docker) -> use localhost:3000 backend
    // - localhost:5500 or other (dev) -> use localhost:3000 backend  
    // - Production -> use Render backend
    API_BASE_URL: window.location.hostname === 'localhost' 
        ? 'http://localhost:3000/api'
        : 'https://attendence-backend-h5x2.onrender.com/api'
};
