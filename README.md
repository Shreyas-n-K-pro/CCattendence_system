# Attendance Management System

A full-stack attendance management system with admin and teacher roles.

## Project Structure

```
├── backend/          # Node.js + Express + PostgreSQL
├── frontend/         # Static HTML/CSS/JS
```

## Deployment

### Backend (Railway)

1. Create a new project on [Railway](https://railway.app)
2. Add a PostgreSQL database from the Railway dashboard
3. Connect your GitHub repo or deploy via CLI
4. Set environment variables in Railway:
   - `JWT_SECRET`: Your secret key for JWT tokens
   - `FRONTEND_URL`: Your Vercel frontend URL (for CORS)
   - `NODE_ENV`: `production`
   - Railway automatically sets `DATABASE_URL`

5. After deployment, copy your Railway backend URL (e.g., `https://your-app.up.railway.app`)

### Frontend (Vercel)

1. Create a new project on [Vercel](https://vercel.com)
2. Set the root directory to `frontend`
3. Before deploying, update `frontend/js/config.js`:
   ```javascript
   API_BASE_URL: 'https://your-railway-app.up.railway.app/api'
   ```
4. Deploy!

## Default Login

- **Username:** `admin`
- **Password:** `admin123`

## Local Development

### Backend
```bash
cd backend
npm install
# Create .env file with your PostgreSQL credentials
npm start
```

### Frontend
Simply open `frontend/index.html` in a browser or use a local server:
```bash
cd frontend
npx serve .
```

## Environment Variables

### Backend (.env)
```
DATABASE_URL=postgresql://user:password@host:5432/database
JWT_SECRET=your_secret_key
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```
