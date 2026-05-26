# 🚀 QUICK START GUIDE - Sidroid Dashboard

Get the Next.js dashboard up and running in 5 minutes!

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Backend API running (http://localhost:5000)
- Optional: Docker & Docker Compose for full stack

## 5-Minute Setup

### 1. Run the Bootstrap Script (2 minutes)

```bash
node bootstrap.js
```

This will automatically:

- Create all project directories
- Generate all application files
- Install npm dependencies
- Setup environment configuration

### 2. Configure Environment (1 minute)

```bash
# Edit the generated .env.local file
nano .env.local  # or use your editor
```

Key variables to set:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_VICTORIA_METRICS_URL=http://localhost:8428
REDIS_URL=redis://localhost:6379
```

### 3. Start Development Server (1 minute)

```bash
npm run dev
```

Output should show:

```
  ▲ Next.js 14.1.0
  - Ready in 1234ms
  ▲ Local:        http://localhost:3000
```

### 4. Open Browser (1 minute)

Visit: **http://localhost:3000**

Default test credentials:

- Email: `test@example.com`
- Password: `password123`

## Key Directories

After bootstrap, you'll have this structure:

```
src/
├── app/              # Pages and layouts
├── components/       # Reusable components
├── context/          # State management
├── lib/              # API clients and utilities
├── styles/           # CSS
└── types/            # TypeScript types
```

## Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm start        # Start production server
npm run lint     # Run ESLint
```

## Docker Deployment

For full stack with database and Redis:

```bash
# Start all services
docker-compose up -d

# Verify services are running
docker-compose ps

# View logs
docker-compose logs -f dashboard

# Stop all services
docker-compose down
```

Services started:

- Dashboard (port 3000)
- Backend API (port 5000)
- MySQL Database (port 3306)
- Redis Cache (port 6379)
- VictoriaMetrics (port 8428)
- Grafana (port 3001)

## Common Tasks

### Create a New Page

Create file: `src/app/(dashboard)/new-page/page.tsx`

```typescript
'use client';

export default function NewPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white">New Page</h1>
    </div>
  );
}
```

Page automatically available at: `/dashboard/new-page`

### Create a New Component

Create file: `src/components/MyComponent.tsx`

```typescript
export default function MyComponent() {
  return <div className="text-white">My Component</div>;
}
```

Use it:

```typescript
import MyComponent from '@/components/MyComponent';

export default function Page() {
  return <MyComponent />;
}
```

### Fetch Data from API

```typescript
import { apiClient } from "@/lib/api/client";

async function fetchData() {
  try {
    const response = await apiClient.get("/instances");
    return response.data;
  } catch (error) {
    console.error("Error:", error);
  }
}
```

### Cache Data with Redis

```typescript
import { redisCache } from "@/lib/redis/cache";

// Set cache (with 1 hour TTL)
redisCache.set("key", { data: "value" }, 3600);

// Get from cache
const cached = redisCache.get("key");

// Check if exists
if (redisCache.has("key")) {
  console.log("Found in cache");
}

// Delete
redisCache.delete("key");

// Clear all
redisCache.clear();
```

## Styling with Tailwind CSS

All components use Tailwind CSS. No CSS files needed!

```typescript
<div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
  <h1 className="text-3xl font-bold text-white">Hello</h1>
  <p className="text-slate-400 mt-2">Description</p>
</div>
```

Color scheme (customizable in `tailwind.config.js`):

- Primary: Blue (3b82f6)
- Secondary: Gray (6b7280)
- Success: Green (22c55e)
- Warning: Orange (fb923c)
- Danger: Red (ef4444)
- Background: Slate-900 (0f172a)

## Troubleshooting

### Port 3000 Already in Use

```bash
# Find process on port 3000
lsof -i :3000

# Kill process
kill -9 <PID>

# Or use a different port
PORT=3001 npm run dev
```

### npm install Fails

```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules
rm -rf node_modules package-lock.json

# Reinstall
npm install
```

### Can't Connect to Backend

```bash
# Check backend is running
curl http://localhost:5000/health

# Check CORS in .env.local
echo $NEXT_PUBLIC_API_URL

# If using Docker, verify network
docker network ls
docker network inspect sidroid
```

### Redis Connection Error

```bash
# Check Redis is running
redis-cli ping

# Check connection string
echo $REDIS_URL

# Test connection
redis-cli -u redis://localhost:6379 ping
```

## Performance Tips

1. **Use Tailwind CSS** - No external CSS files
2. **Lazy load components** - Use `dynamic()` for heavy components
3. **Cache API responses** - Use Redis for 30+ seconds
4. **Optimize images** - Use Next.js `Image` component
5. **Code split** - App Router does automatic splitting

## Security Best Practices

1. **Change SESSION_SECRET** - Use strong random value in production
2. **Use HTTPS** - In production, always use HTTPS
3. **Validate inputs** - All form inputs should be validated
4. **Sanitize output** - Prevent XSS attacks
5. **Protect API routes** - Check authentication/authorization
6. **Rotate credentials** - Change database passwords regularly

## Next Steps

1. ✅ Run bootstrap script
2. ✅ Configure .env.local
3. ✅ Start dev server
4. ✅ Test authentication
5. ⬜ Implement public IP personalization
6. ⬜ Connect VictoriaMetrics for real metrics
7. ⬜ Deploy to production

## Getting Help

1. **Check documentation**: `DASHBOARD_SETUP.md`
2. **View source files**: Code is well-commented
3. **Check logs**: `docker-compose logs`
4. **Test endpoints**: Use curl or Postman

## Success Indicators

You'll know everything is working when:

✅ Bootstrap script completes without errors
✅ Development server starts on http://localhost:3000
✅ Login page loads
✅ Can authenticate with test credentials
✅ Dashboard displays without errors
✅ All navigation links work
✅ Docker services are healthy

## Resources

- Next.js Docs: https://nextjs.org/docs
- Tailwind CSS: https://tailwindcss.com/docs
- React Docs: https://react.dev
- TypeScript: https://www.typescriptlang.org/docs

---

**You're all set! Happy coding! 🎉**

For detailed configuration and advanced topics, see `DASHBOARD_SETUP.md`
