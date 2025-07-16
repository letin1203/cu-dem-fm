# 🏈 Cu Dem FM - Tech Stack Summary

## 🎨 **Frontend (FE)**

### **Core Framework**
- **Vue 3** `v3.5.17` - Progressive JavaScript framework with Composition API
- **TypeScript** `v5.8.3` - Type-safe JavaScript development
- **Vite** `v7.0.4` - Fast build tool and dev server

### **UI & Styling**
- **Tailwind CSS** `v3.4.17` - Utility-first CSS framework
- **Headless UI Vue** `v1.7.23` - Unstyled, accessible UI components
- **Heroicons Vue** `v2.2.0` - Beautiful hand-crafted SVG icons
- **PostCSS** `v8.5.6` - CSS processing tool

### **State Management & Routing**
- **Pinia** `v3.0.3` - Vue store library (Vuex successor)
- **Vue Router** `v4.5.1` - Official router for Vue.js

### **Forms & Validation**
- **VeeValidate** `v4.15.1` - Form validation library
- **Zod** `v3.25.76` - TypeScript schema validation

### **Data Visualization & UX**
- **Chart.js** `v4.5.0` - JavaScript charting library
- **Vue-ChartJS** `v5.3.2` - Vue wrapper for Chart.js
- **Vue Toastification** `v2.0.0-rc.5` - Toast notifications
- **VueUse** `v13.5.0` - Collection of Vue composition utilities

### **HTTP Client**
- **Axios** `v1.10.0` - Promise-based HTTP client

---

## ⚙️ **Backend (BE)**

### **Runtime & Framework**
- **Node.js** - JavaScript runtime
- **Express.js** `v4.18.2` - Web application framework
- **TypeScript** `v5.3.3` - Type-safe development
- **TSX** - TypeScript execution environment

### **Database & ORM**
- **Prisma** `v5.7.1` - Modern database toolkit and ORM
- **Prisma Client** - Type-safe database client

### **Authentication & Security**
- **JWT** `v9.0.2` - JSON Web Tokens for authentication
- **bcryptjs** `v2.4.3` - Password hashing
- **Helmet** `v7.1.0` - Security middleware
- **CORS** `v2.8.5` - Cross-origin resource sharing
- **Express Rate Limit** `v7.1.5` - Rate limiting middleware

### **Development & Utilities**
- **Morgan** `v1.10.0` - HTTP request logger
- **Compression** `v1.7.4` - Response compression
- **dotenv** `v16.3.1` - Environment variable management
- **Zod** `v3.22.4` - Schema validation (shared with frontend)

### **Caching (Optional)**
- **Redis** `v4.6.12` - In-memory data structure store

---

## 🗄️ **Database (DB)**

### **Database Engine**
- **SQLite** - Embedded relational database (development)
- **Prisma Schema** - Database schema definition and migration

### **Database Features**
- **Relational Model** - User, Player, Team, Tournament, Match entities
- **CUID IDs** - Collision-resistant unique identifiers
- **Automatic Timestamps** - CreatedAt/UpdatedAt tracking
- **Foreign Key Relationships** - Proper data integrity
- **Migrations** - Version-controlled schema changes

---

## 🛠️ **Development Tools**

### **Build & Development**
- **Vite** - Fast development server and bundler
- **Vue TSC** - Vue TypeScript compiler
- **Autoprefixer** - CSS vendor prefixing
- **TypeScript** - Static type checking

### **Code Quality**
- **ESLint** (implied) - Code linting
- **Prettier** (implied) - Code formatting
- **Type Safety** - Full TypeScript coverage

---

## 🏗️ **Architecture Patterns**

### **Frontend Architecture**
- **Composition API** - Vue 3's modern reactivity system
- **Component-based** - Modular UI components
- **Store Pattern** - Centralized state management with Pinia
- **Route-based** - SPA with client-side routing

### **Backend Architecture**
- **RESTful API** - HTTP-based web services
- **Middleware Pattern** - Express.js middleware stack
- **Repository Pattern** - Data access abstraction with Prisma
- **JWT Authentication** - Stateless authentication

### **Database Architecture**
- **Relational Model** - Normalized database design
- **ORM Pattern** - Object-relational mapping with Prisma
- **Migration-based** - Version-controlled schema evolution

---

## 📦 **Project Structure**

```
football-management/
├── frontend/
│   ├── src/
│   │   ├── components/     # Reusable Vue components
│   │   ├── views/          # Page components
│   │   ├── stores/         # Pinia state management
│   │   ├── router/         # Vue Router configuration
│   │   ├── api/            # API client and endpoints
│   │   └── types/          # TypeScript type definitions
│   ├── public/             # Static assets
│   └── package.json        # Frontend dependencies
├── backend/
│   ├── src/
│   │   ├── routes/         # Express route handlers
│   │   ├── middleware/     # Express middleware
│   │   ├── schemas/        # Zod validation schemas
│   │   ├── lib/            # Utility libraries
│   │   └── scripts/        # Database seeding scripts
│   ├── prisma/
│   │   ├── schema.prisma   # Database schema
│   │   └── migrations/     # Database migrations
│   └── package.json        # Backend dependencies
└── README.md
```

---

## 🚀 **Key Features Implemented**

### **Tournament Management**
- Weekly tournaments with automated scheduling
- Team generation with balanced tier distribution
- Player attendance tracking
- T9/T10 player locking system

### **User Management**
- Role-based authentication (Admin, Mod, User)
- JWT-based session management
- Player profile linking

### **Data Visualization**
- Real-time attendance statistics
- Team balance analytics
- Interactive charts and progress bars

### **Modern UX/UI**
- Responsive design with Tailwind CSS
- Toast notifications for user feedback
- Modal dialogs for detailed views
- Mobile-first approach

This modern tech stack provides a robust, scalable, and maintainable football management system with type safety throughout the entire application.

---

## 🌐 **Free Hosting Options**

### **🎯 Recommended Full-Stack Solutions**

#### **1. Railway** ⭐ (Best Overall)
- **Frontend + Backend + Database** in one platform
- **PostgreSQL included** (SQLite → PostgreSQL migration needed)
- **$5/month free tier** with good limits
- **Easy deployment** from GitHub
- **Custom domains** supported
- **Automatic HTTPS**

#### **2. Render** ⭐ (Great Alternative)
- **Frontend + Backend + Database** all free
- **PostgreSQL included** (free tier)
- **Static site hosting** for frontend
- **Web service hosting** for backend
- **Automatic deployments** from Git
- **Custom domains** + SSL

### **🔄 Split Hosting Approach**

#### **Frontend Hosting** (Choose One)
- **Vercel** ⭐ - Perfect for Vue apps, automatic deployments
- **Netlify** ⭐ - Great for SPAs, form handling, serverless functions
- **GitHub Pages** - Simple static hosting
- **Surge.sh** - Quick deployment with CLI

#### **Backend + Database Hosting** (Choose One)
- **Railway** - Node.js + PostgreSQL
- **Render** - Web services + managed PostgreSQL
- **Heroku** - Still has limited free tier (dyno sleeping)
- **Fly.io** - Good for containers

### **🗄️ Database-Only Hosting**
- **Supabase** - PostgreSQL + real-time features
- **PlanetScale** - MySQL-compatible serverless database
- **Neon** - Serverless PostgreSQL
- **MongoDB Atlas** - NoSQL option (would require schema changes)

---

## 🚀 **Deployment Guide**

### **Option 1: Railway (Recommended)**

**Preparation:**
```bash
# 1. Update Prisma for PostgreSQL
npm install @prisma/client
# Update schema.prisma: sqlite → postgresql
```

**Deploy Steps:**
1. Push code to GitHub repository
2. Connect Railway to your GitHub repo
3. Add environment variables:
   - `DATABASE_URL` (auto-generated by Railway)
   - `JWT_SECRET`
   - `NODE_ENV=production`
4. Railway auto-deploys on git push

**Cost:** ~$5-10/month after free tier

### **Option 2: Split Deployment**

**Frontend (Vercel):**
```bash
# 1. Build frontend
npm run build

# 2. Deploy to Vercel
npx vercel --prod
```

**Backend (Render):**
1. Create web service on Render
2. Connect GitHub repository
3. Set build command: `npm install && npm run build`
4. Set start command: `npm start`
5. Add environment variables

**Database (Supabase):**
1. Create Supabase project
2. Get PostgreSQL connection string
3. Update `DATABASE_URL` in backend

### **Option 3: GitHub + Free Services**
- **Frontend**: GitHub Pages (static build)
- **Backend**: Render free tier
- **Database**: Supabase free tier

---

## 🔧 **Migration Requirements**

### **Database Migration (SQLite → PostgreSQL)**
```prisma
// Update prisma/schema.prisma
datasource db {
  provider = "postgresql"  // Changed from "sqlite"
  url      = env("DATABASE_URL")
}
```

### **Environment Variables Needed**
```env
# Backend (.env)
DATABASE_URL="postgresql://..."
JWT_SECRET="your-secret-key"
NODE_ENV="production"
CORS_ORIGIN="https://your-frontend-domain.com"

# Frontend (.env)
VITE_API_URL="https://your-backend-domain.com/api"
```

### **Build Scripts Updates**
```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "postinstall": "prisma generate && prisma migrate deploy"
  }
}
```

---

## 💰 **Cost Breakdown**

### **Free Tier Limits**
- **Railway**: $5 credit/month (covers small apps)
- **Render**: Web service + PostgreSQL free
- **Vercel**: 100GB bandwidth, unlimited projects
- **Supabase**: 500MB database, 2GB bandwidth

### **Upgrade Costs (if needed)**
- **Railway**: ~$5-20/month for production
- **Render**: $7/month for always-on services
- **Vercel Pro**: $20/month for team features
- **Supabase Pro**: $25/month for more storage

### **🎯 Best Free Combination**
1. **Frontend**: Vercel (free)
2. **Backend**: Render (free tier)
3. **Database**: Supabase (free tier)
4. **Total Cost**: $0/month for moderate traffic

---

## 🚀 **Step-by-Step Deployment Guide**

### **🎯 Best Free Combination Setup**
1. **Frontend**: Vercel (free)
2. **Backend**: Render (free tier)
3. **Database**: Supabase (free tier)

---

### **📋 Prerequisites**
```bash
# Ensure you have these installed
node --version  # Should be 18+
npm --version   # Should be 9+
git --version   # For version control
```

---

## **Step 1: 🗄️ Database Setup (Supabase)**

### **1.1 Create Supabase Account**
1. Go to [supabase.com](https://supabase.com)
2. Sign up with GitHub (recommended)
3. Create a new project
   - **Project Name**: `cu-dem-fm`
   - **Database Password**: Generate strong password
   - **Region**: Choose closest to your users

### **1.2 Get Database Connection String**
1. Go to **Settings** → **Database**
2. Copy the **Connection String** (URI format)
3. Replace `[YOUR-PASSWORD]` with your actual password
```
postgresql://postgres:[YOUR-PASSWORD]@db.project-ref.supabase.co:5432/postgres
```

### **1.3 Update Backend Configuration**
Create `.env` file in `/backend/` folder:
```env
# Supabase Database
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.project-ref.supabase.co:5432/postgres"

# JWT Secret (generate a random string)
JWT_SECRET="your-super-secret-jwt-key-here"

# CORS Origin (will update after Vercel deployment)
CORS_ORIGIN="http://localhost:5173"
```

### **1.4 Migrate Database Schema**
```bash
cd backend
npm install
npx prisma db push
npx prisma generate
npm run seed  # Optional: add test data
```

---

## **Step 2: 🌐 Backend Deployment (Render)**

### **2.1 Prepare Backend for Production**
Create `render.yaml` in `/backend/` folder:
```yaml
services:
  - type: web
    name: cu-dem-fm-backend
    env: node
    plan: free
    buildCommand: npm install && npx prisma generate
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
```

Update `package.json` in `/backend/`:
```json
{
  "scripts": {
    "start": "node dist/index.js",
    "build": "tsc",
    "dev": "tsx watch src/index.ts",
    "seed": "tsx src/scripts/seed.ts"
  }
}
```

### **2.2 Deploy to Render**
1. Go to [render.com](https://render.com)
2. Sign up with GitHub
3. Click **New** → **Web Service**
4. Connect your GitHub repository
5. Select the `backend` folder as root directory
6. Configure:
   - **Environment**: Node
   - **Build Command**: `npm install && npx prisma generate && npm run build`
   - **Start Command**: `npm start`
7. Add Environment Variables:
   - `DATABASE_URL`: Your Supabase connection string
   - `JWT_SECRET`: Your secret key
   - `NODE_ENV`: `production`
   - `PORT`: `10000`

### **2.3 Test Backend**
Your backend will be available at: `https://cu-dem-fm-backend.onrender.com`

Test with:
```bash
curl https://cu-dem-fm-backend.onrender.com/api/health
```

---

## **Step 3: 🎨 Frontend Deployment (Vercel)**

### **3.1 Update Frontend Configuration**
Create `.env.production` in root folder:
```env
VITE_API_BASE_URL=https://cu-dem-fm-backend.onrender.com/api
```

Update `src/api/client.ts`:
```typescript
import axios from 'axios'

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'

export const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add auth token if available
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
```

### **3.2 Deploy to Vercel**
1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub
3. Click **New Project**
4. Import your GitHub repository
5. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `./` (root)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
6. Add Environment Variables:
   - `VITE_API_BASE_URL`: `https://cu-dem-fm-backend.onrender.com/api`

### **3.3 Custom Domain (Optional)**
1. Go to Vercel project settings
2. **Domains** → Add your domain
3. Follow DNS configuration instructions

---

## **Step 4: 🔗 Final Configuration**

### **4.1 Update CORS Settings**
Update backend `.env` on Render:
```env
CORS_ORIGIN=https://your-vercel-app.vercel.app
```

### **4.2 Test Full Application**
1. **Frontend**: `https://your-app.vercel.app`
2. **Backend**: `https://cu-dem-fm-backend.onrender.com`
3. **Database**: Connected via Supabase

### **4.3 Monitor and Debug**
- **Vercel**: Check deployment logs in dashboard
- **Render**: Monitor service logs and metrics
- **Supabase**: Use SQL Editor for database queries

---

## **🛠️ Troubleshooting Tips**

### **Common Issues:**
1. **Build Fails**: Check Node.js version compatibility
2. **CORS Errors**: Verify CORS_ORIGIN environment variable
3. **Database Connection**: Test DATABASE_URL format
4. **API Not Found**: Check VITE_API_BASE_URL path

### **Debug Commands:**
```bash
# Test backend locally
cd backend && npm run dev

# Test frontend locally
npm run dev

# Check Prisma connection
cd backend && npx prisma studio

# View production logs
vercel logs  # Frontend logs
# Check Render dashboard for backend logs
```

---

## **📊 Free Tier Limits**

| Service | Limits | Upgrade Cost |
|---------|--------|--------------|
| **Vercel** | 100GB bandwidth/month | $20/month Pro |
| **Render** | 750 hours/month | $7/month Starter |
| **Supabase** | 500MB database, 2GB bandwidth | $25/month Pro |

**Total Cost**: **$0/month** (within limits) → **$52/month** (all upgraded)

---

## **🎉 You're Live!**

Your Cu Dem FM application is now deployed with:
- ✅ **Frontend**: Fast, global CDN via Vercel
- ✅ **Backend**: Reliable API hosting via Render  
- ✅ **Database**: Managed PostgreSQL via Supabase
- ✅ **Free Tier**: Everything included at no cost
- ✅ **Auto Deployment**: Push to GitHub = instant updates

**Next Steps**: Share your live URL and start managing football tournaments! 🏈
