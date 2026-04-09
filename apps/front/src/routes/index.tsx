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
  GitBranch,
  Lock,
  Palette,
  FlaskConical,
  ShieldCheck,
  Users,
  Settings,
} from 'lucide-react'

export const Route = createFileRoute('/')({ component: App })

function App() {
  const { isAuthenticated: isSignedIn } = useAuth()

  const stack = [
    { icon: Layers, title: 'Turborepo Monorepo', description: 'Organized workspace with shared ESLint plugin, TypeScript configs, logger, metrics, and Jest presets.' },
    { icon: Zap, title: 'React 19 + TanStack', description: 'TanStack Router with file-based routing, TanStack Query with SSR-safe prefetch and queryOptions pattern.' },
    { icon: Server, title: 'Express API', description: 'Type-safe REST API with Zod contracts shared between frontend and backend.' },
    { icon: Database, title: 'PostgreSQL + Kysely', description: 'Type-safe SQL queries with automatic migrations and auto-generated TypeScript types.' },
    { icon: Shield, title: 'Better Auth', description: 'Email/password auth with organizations, member roles, invitations, and cookie-based sessions.' },
    { icon: BarChart3, title: 'Full Observability', description: 'Prometheus metrics, Grafana dashboards, Loki log aggregation, and structured Pino logging.' },
    { icon: FlaskConical, title: 'Integration Tests', description: 'BDD-style test framework with user pooling, domain users, Given/When/Then structure, and auto-cleanup.' },
    { icon: Palette, title: 'Shadcn/ui + Tailwind 4', description: 'Beautiful UI with Radix primitives, collapsible sidebar, dark/light theme, and full component library.' },
  ]

  const features = [
    { icon: Building, title: 'Organization Management', description: 'Multi-org with member management, role switching, invitations, and org settings.' },
    { icon: ShieldCheck, title: 'Admin Backoffice', description: 'Dual sidebar with admin panel, user role management, and role-based access control.' },
    { icon: Users, title: 'User Management', description: 'Full CRUD with role editing, search, pagination, and admin-only access.' },
    { icon: GitBranch, title: 'Type-Safe Contracts', description: 'API contracts shared between frontend and backend with Zod schemas.' },
    { icon: Lock, title: 'Protected Routes', description: 'Auth-protected pages, admin-only routes, and automatic redirects.' },
    { icon: Settings, title: 'Account Settings', description: 'Profile editing, password change, forgot/reset password flows.' },
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
            React 19, Express, PostgreSQL, Better Auth with multi-org support,
            integration test framework, custom ESLint plugin, and full observability stack.
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
                <>
                  <Button asChild>
                    <Link to="/orgs">
                      <Building className="w-4 h-4" />
                      Organizations
                    </Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link to="/admin">
                      <ShieldCheck className="w-4 h-4" />
                      Admin Panel
                    </Link>
                  </Button>
                </>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {isSignedIn
                ? 'Explore organization management, admin backoffice, and account settings.'
                : 'Sign in to access organizations, admin panel, and account settings.'}
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

      <section className="py-16 px-6 max-w-3xl mx-auto">
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

# Run integration tests
pnpm --filter @repo/api test:integration`}
            </pre>
          </CardContent>
        </Card>
      </section>

      <Separator />

      <footer className="py-8 px-6">
        <p className="text-center text-sm text-muted-foreground">
          Built with Turborepo, React 19, Express, PostgreSQL, and Better Auth
        </p>
      </footer>
    </div>
  )
}
