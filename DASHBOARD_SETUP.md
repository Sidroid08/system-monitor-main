# Sidroid Next.js Dashboard - Setup & Build Guide

## Project Overview

This is a Next.js 14+ web application for personalized, multi-organization monitoring of cloud (AWS) and local systems. The dashboard provides real-time metrics visualization similar to Grafana with built-in personalization based on public IP address.

## Prerequisites

- Node.js 18+ and npm/yarn
- Backend service running at http://localhost:5000 (or configured URL)
- VictoriaMetrics service running at http://localhost:8428 (or configured URL)
- Redis (optional, for advanced caching and snapshots)

## Quick Start

### 1. Initialize the Project

Run the setup scripts to create all necessary directories and files:

```bash
# Create directory structure
node create-dirs.js

# Create main application files
node create-files.js

# Create additional component and utility files
node create-more-files.js
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
```

### 3. Environment Setup

Copy the example environment file and configure:

```bash
cp .env.local.example .env.local
```

Then edit `.env.local` with your actual values:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_VICTORIA_METRICS_URL=http://localhost:8428
NEXT_PUBLIC_APP_URL=http://localhost:3000
REDIS_URL=redis://localhost:6379
SESSION_SECRET=your-secret-key-change-in-production
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### 5. Build for Production

```bash
npm run build
npm run start
```

## Project Structure

```
.
├── src/
│   ├── app/                 # Next.js app directory
│   │   ├── (auth)/         # Authentication routes (login, register)
│   │   ├── (dashboard)/    # Protected dashboard routes
│   │   ├── page.tsx        # Root redirect page
│   │   └── layout.tsx      # Root layout
│   ├── components/          # Reusable React components
│   │   ├── dashboard/      # Dashboard-specific components
│   │   └── common/         # Shared components (TopNav, Sidebar)
│   ├── context/             # React context providers
│   │   ├── AuthContext.tsx
│   │   └── RedisContext.tsx
│   ├── hooks/               # Custom React hooks
│   │   └── useMetrics.ts
│   ├── lib/                 # Utility libraries
│   │   ├── api/            # API client and queries
│   │   └── redis/          # Redis cache client
│   ├── styles/              # Global CSS
│   ├── types/               # TypeScript type definitions
│   └── utils/               # Utility functions
├── public/                  # Static assets
├── tailwind.config.js       # Tailwind CSS configuration
├── tsconfig.json            # TypeScript configuration
├── next.config.js           # Next.js configuration
├── postcss.config.js        # PostCSS configuration
└── package.json
```

## Key Features

### Authentication

- User login/registration with JWT tokens
- Protected routes and middleware
- Token refresh and automatic logout on expiration
- Auth context for global state management

### Personalization

- Auto-detection of user organization via public IP (when implemented)
- User preference storage
- Customizable dashboard layouts
- Metric filtering and selection

### Dashboard Components

- **Metric Cards**: Real-time display of CPU, Memory, Disk, Network metrics
- **Instances List**: Filterable table of monitored instances
- **Organization Selector**: Switch between organizations
- **Sidebar Navigation**: Quick access to main sections
- **Top Navigation**: User profile and logout button

### Real-time Monitoring

- 30-second metric refresh intervals (configurable)
- VictoriaMetrics integration for metric queries
- Alert management and display
- Health status indicators

### Redis Optimization

- Client-side cache for frequently accessed data
- Metric snapshot storage
- Session data caching
- TTL-based cache expiration

## API Integration

### Backend Endpoints Used

- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/me` - Get current user
- `GET /api/org` - List organizations
- `GET /api/org/:id` - Get organization details
- `GET /api/instances` - List monitored instances
- `GET /api/instances/:id` - Get instance details
- `GET /api/aws` - List AWS accounts
- `GET /api/alerts` - List alerts

### VictoriaMetrics Queries

The application queries VictoriaMetrics for metrics:

- CPU usage: `node_cpu_seconds_total`
- Memory: `node_memory_*`
- Disk: `node_filesystem_*`
- Network: `node_network_*`
- Load average: `node_load*`

## Configuration

### Environment Variables

| Variable                           | Default                   | Purpose                 |
| ---------------------------------- | ------------------------- | ----------------------- |
| `NEXT_PUBLIC_API_URL`              | http://localhost:5000/api | Backend API URL         |
| `NEXT_PUBLIC_VICTORIA_METRICS_URL` | http://localhost:8428     | VictoriaMetrics URL     |
| `NEXT_PUBLIC_APP_URL`              | http://localhost:3000     | App URL                 |
| `REDIS_URL`                        | redis://localhost:6379    | Redis connection string |
| `SESSION_SECRET`                   | your-secret-key           | JWT/Session secret      |

### Tailwind CSS

Customizable theme settings in `tailwind.config.js`:

```javascript
colors: {
  primary: 'rgb(59, 130, 246)',    // Blue
  secondary: 'rgb(107, 114, 128)',  // Gray
  success: 'rgb(34, 197, 94)',      // Green
  warning: 'rgb(251, 146, 60)',     // Orange
  danger: 'rgb(239, 68, 68)',       // Red
}
```

## Development

### Adding New Pages

1. Create directory under `src/app/(dashboard)/`
2. Add `page.tsx` file with your page component
3. Page automatically available at `/dashboard/your-page`

### Adding New Components

1. Create `.tsx` file in `src/components/`
2. Import and use in pages or other components
3. Keep components reusable and typed

### Adding Hooks

Create custom hooks in `src/hooks/`:

```typescript
// src/hooks/useCustom.ts
import { useEffect, useState } from "react";

export const useCustom = () => {
  // Your hook logic
};
```

## Testing

Tests are configured with Jest and React Testing Library:

```bash
npm test                      # Run all tests
npm test -- --watch          # Watch mode
npm test -- --coverage       # Coverage report
```

## Performance Optimization

- **Code Splitting**: Automatic with Next.js
- **Image Optimization**: Built-in Next.js Image component
- **Caching**: Redis client-side cache + HTTP caching headers
- **Metrics Snapshots**: Periodic snapshots in Redis for historical data
- **Lazy Loading**: Components loaded on demand

## Deployment

### Docker Deployment

```bash
docker build -t sidroid-dashboard .
docker run -p 3000:3000 sidroid-dashboard
```

### Vercel Deployment

```bash
vercel deploy
```

### Manual Server Deployment

```bash
npm run build
npm start
```

## Troubleshooting

### Issues with Authentication

1. Check backend is running: `curl http://localhost:5000/health`
2. Verify JWT token in localStorage
3. Check CORS configuration in backend

### Metrics Not Loading

1. Verify VictoriaMetrics is running: `curl http://localhost:8428/api/v1/status/buildinfo`
2. Check instance labels match queries
3. Review browser console for API errors

### Redis Connection Issues

1. Verify Redis is running: `redis-cli ping`
2. Check `REDIS_URL` in `.env.local`
3. Test connection: `redis-cli -u $REDIS_URL ping`

## Contributing

1. Create feature branch: `git checkout -b feature/my-feature`
2. Commit changes: `git commit -am 'Add my feature'`
3. Push to branch: `git push origin feature/my-feature`
4. Create Pull Request

## License

See LICENSE file in project root

## Support

For issues or questions, please:

1. Check documentation in `/docs`
2. Review GitHub issues
3. Contact the development team

---

**Next Steps**:

- [ ] Run setup scripts
- [ ] Install dependencies
- [ ] Configure environment variables
- [ ] Start development server
- [ ] Implement public IP personalization logic
- [ ] Integrate with VictoriaMetrics for real metrics
- [ ] Add user preference persistence
- [ ] Implement alert management UI
- [ ] Add testing coverage
