import { createFileRoute, Link } from '@tanstack/react-router'
import { useAuth } from '@/lib/auth-provider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Zap,
  Server,
  Database,
  Shield,
  BarChart3,
  Layers,
  Building,
  Box,
  GitBranch,
  Terminal,
  Lock,
  Palette,
} from 'lucide-react'

export const Route = createFileRoute('/')({ component: App })

function App() {
  const { isAuthenticated: isSignedIn } = useAuth()

  const stack = [
    { icon: Layers, title: 'Turborepo Monorepo', description: 'Organized workspace with shared packages for logger, metrics, ESLint, TypeScript configs, and Jest presets.' },
    { icon: Zap, title: 'React 19 + TanStack', description: 'Modern React with TanStack Router for file-based routing and TanStack Query for server state management.' },
    { icon: Server, title: 'Express API', description: 'Type-safe REST API with Zod validation and contract-based route organization shared with the frontend.' },
    { icon: Database, title: 'PostgreSQL + Kysely', description: 'Type-safe SQL queries with Kysely, automatic migrations, and auto-generated TypeScript types.' },
    { icon: Shield, title: 'Better Auth', description: 'Complete auth system with email/password sign-in, sign-up, protected routes, and cookie-based sessions.' },
    { icon: BarChart3, title: 'Full Observability', description: 'Prometheus metrics, Grafana dashboards, Loki log aggregation, and structured Pino logging.' },
    { icon: Box, title: 'Docker Infrastructure', description: 'PostgreSQL, Redis Stack, Prometheus, Grafana, and Loki ready to go.' },
    { icon: Palette, title: 'Shadcn/ui + Tailwind', description: 'Beautiful UI components with Radix primitives, dark/light theme support, and Tailwind CSS 4.' },
  ]

  const features = [
    { icon: GitBranch, title: 'Type-Safe Contracts', description: 'API contracts shared between frontend and backend with Zod schemas.' },
    { icon: Terminal, title: 'Database Migrations', description: 'Versioned migrations with Kysely and auto-generated types.' },
    { icon: Lock, title: 'Protected Routes', description: 'Authentication-protected pages with automatic redirects.' },
  ]

  return (
    <div className="min-h-screen bg-background">
      <section className="py-20 px-6 text-center">
        <div className="max-w-5xl mx-auto space-y-6">
          <h1 className="text-5xl md:text-6xl font-black tracking-tight">
            Turbo Express Start
          </h1>
          <p className="text-xl text-muted-foreground">
            Production-Ready Full-Stack Monorepo Boilerplate
          </p>
          <p className="text-muted-foreground max-w-3xl mx-auto">
            A comprehensive starter template with React 19, Express, PostgreSQL, Better Auth,
            and full observability stack. Everything you need to build modern web applications.
          </p>

          <div className="flex flex-col items-center gap-4 pt-4">
            <div className="flex gap-4 flex-wrap justify-center">
              {!isSignedIn && (
                <>
                  <Button asChild>
                    <Link to="/signin">Sign In</Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link to="/signup">Create Account</Link>
                  </Button>
                </>
              )}
              {isSignedIn && (
                <Button asChild>
                  <Link to="/orgs">
                    <Building className="w-4 h-4" />
                    Organizations Demo
                  </Link>
                </Button>
              )}
              <Button variant="outline" asChild>
                <a href="https://github.com" target="_blank" rel="noopener noreferrer">
                  View on GitHub
                </a>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              {isSignedIn ? (
                <>
                  Check out the{' '}
                  <Link to="/orgs" className="underline">
                    Users Demo
                  </Link>{' '}
                  to see the full-stack architecture in action
                </>
              ) : (
                'Sign in to access the protected Users Demo page'
              )}
            </p>
          </div>
        </div>
      </section>

      <Separator />

      <section className="py-16 px-6 max-w-7xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-2">Complete Tech Stack</h2>
        <p className="text-muted-foreground text-center mb-12">
          Everything configured and ready for production deployment
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stack.map((item, index) => (
            <Card key={index}>
              <CardHeader>
                <item.icon className="w-8 h-8 mb-2 text-muted-foreground" />
                <CardTitle className="text-lg">{item.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Separator />

      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Key Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="text-center space-y-2">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-muted mb-2">
                  <feature.icon className="w-6 h-6 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Separator />

      <section className="py-16 px-6 max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-12">Architecture Overview</h2>
        <Card>
          <CardContent className="p-6">
            <pre className="text-sm text-muted-foreground overflow-x-auto">
{`turbo-express-start-boilerplate/
├── apps/
│   ├── api/                 # Express backend (port 3001)
│   │   ├── src/
│   │   │   ├── config/      # Environment & auth config
│   │   │   ├── db/          # Database, migrations, types
│   │   │   ├── middlewares/ # Auth, metrics, validation
│   │   │   ├── routes_web/  # API routes with contracts
│   │   │   ├── services/    # Business logic
│   │   │   └── auth/        # Better Auth configuration
│   │   └── package.json
│   │
│   └── front/               # React frontend (port 3000)
│       └── src/
│           ├── components/  # UI components, layout, sidebar
│           ├── routes/      # TanStack Router pages
│           │   ├── _auth/   # Protected routes (users)
│           │   ├── signin   # Sign-in page
│           │   └── signup   # Sign-up page
│           └── lib/         # API client, hooks, utils
│
├── packages/
│   ├── logger/              # Pino logging + Loki
│   ├── metrics/             # Prometheus metrics
│   ├── eslint-config/       # Shared ESLint
│   ├── typescript-config/   # Shared TS configs
│   └── jest-presets/        # Test configurations
│
└── docker-compose.yml       # PostgreSQL, Redis,
                             # Prometheus, Grafana, Loki`}
            </pre>
          </CardContent>
        </Card>
      </section>

      <Separator />

      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">Quick Start</h2>
          <Card>
            <CardContent className="p-6">
              <pre className="text-sm text-muted-foreground overflow-x-auto">
{`# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env

# Start infrastructure
docker network create app_network
docker-compose up -d

# Run database migrations
pnpm db:migrate

# Start development servers
pnpm dev

# Frontend: http://localhost:3000
# API: http://localhost:3001
# Grafana: http://localhost:3201`}
              </pre>
            </CardContent>
          </Card>
        </div>
      </section>

      <Separator />

      <footer className="py-8 px-6">
        <p className="text-center text-sm text-muted-foreground">
          Built with Turborepo, React, Express, PostgreSQL, and Better Auth
        </p>
      </footer>
    </div>
  )
}
