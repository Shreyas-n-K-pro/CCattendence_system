// Configuration for the Attendance System Frontend
// Update API_BASE_URL after deploying the backend to Railway

const CONFIG = {
    // For local development
    // API_BASE_URL: 'http://localhost:3000/api'
    
    // For production - Render backend URL
    API_BASE_URL: window.location.hostname === 'localhost' 
        ? 'http://localhost:3000/api'
        : 'https://attendence-backend-h5x2.onrender.com/api'
};
