import { Link, useRouterState, useNavigate } from '@tanstack/react-router'
import { Moon, Sun, Monitor, LogOut, Building2, Settings } from 'lucide-react'
import { toast } from 'sonner'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import { sidebarNavGroups } from './sidebar-nav'
import { useTheme } from '@/components/theme-provider'
import { useAuth } from '@/lib/auth-provider'
import { APP_NAME } from '@/lib/constants'
import { authClient } from '@/lib/auth-client'
import { useOrganizations, useSetActiveOrganization } from '@/lib/hooks/use-organizations'

export function AppSidebar() {
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname
  const { theme, setTheme } = useTheme()
  const auth = useAuth()
  const navigate = useNavigate()
  const { data: orgs } = useOrganizations()
  const setActiveOrg = useSetActiveOrganization()

  const currentOrg = orgs?.find((o) => o.id === auth.orgId)

  const toggleTheme = () => {
    if (theme === 'light') {
      setTheme('dark')
    } else if (theme === 'dark') {
      setTheme('system')
    } else {
      setTheme('light')
    }
  }

  const getThemeLabel = () => {
    if (theme === 'light') return 'Light'
    if (theme === 'dark') return 'Dark'
    return 'System'
  }

  const handleSignOut = async () => {
    await authClient.signOut()
    window.location.href = '/signin'
  }

  const handleSwitchOrg = async (orgId: string) => {
    try {
      await setActiveOrg.mutateAsync(orgId)
      navigate({ to: '/users', search: { page: 1, pageSize: 10 } })
    } catch {
      toast.error('Failed to switch organization')
    }
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <span className="text-lg font-bold">{APP_NAME[0]}</span>
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{APP_NAME}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    Dashboard
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* Organization Switcher */}
        {orgs && orgs.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Organization</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {orgs.map((org) => (
                  <SidebarMenuItem key={org.id}>
                    <SidebarMenuButton
                      isActive={org.id === auth.orgId}
                      tooltip={org.name}
                      onClick={() => {
                        if (org.id !== auth.orgId) handleSwitchOrg(org.id)
                      }}
                    >
                      <Building2 className="h-4 w-4" />
                      <span>{org.name}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Manage organizations">
                    <Link to="/orgs">
                      <Settings className="h-4 w-4" />
                      <span>Manage</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {sidebarNavGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive = currentPath === item.url
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                        <Link to={item.url}>
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={toggleTheme} tooltip={`Theme: ${getThemeLabel()}`}>
              {theme === 'light' && <Sun className="h-4 w-4" />}
              {theme === 'dark' && <Moon className="h-4 w-4" />}
              {theme === 'system' && <Monitor className="h-4 w-4" />}
              <span>{getThemeLabel()}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleSignOut} tooltip="Sign out">
              <LogOut className="h-4 w-4" />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{auth.user?.name || 'Account'}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {auth.user?.email || 'Sign out'}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
