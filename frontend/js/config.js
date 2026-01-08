// Configuration for the Attendance System Frontend
// Update API_BASE_URL after deploying the backend to Railway

const CONFIG = {
    // For local development
    // API_BASE_URL: 'http://localhost:3000/api'
    
    // For production - Replace with your Railway backend URL
    // Example: 'https://your-app-name.up.railway.app/api'
    API_BASE_URL: window.location.hostname === 'localhost' 
        ? 'http://localhost:3000/api'
        : 'YOUR_RAILWAY_BACKEND_URL/api'  // <-- UPDATE THIS after Railway deployment
};
