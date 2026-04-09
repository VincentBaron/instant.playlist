import { Link, useRouterState } from '@tanstack/react-router'
import { Moon, Sun, Monitor } from 'lucide-react'

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
  useSidebar,
} from '@/components/ui/sidebar'
import { useIsMobile } from '@/hooks/use-mobile'
import { sidebarNavGroups } from './sidebar-nav'
import { UserMenu } from './UserMenu'
import { useTheme } from '@/components/theme-provider'
import { APP_NAME } from '@/lib/constants'

function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const toggleTheme = () => {
    if (theme === 'light') setTheme('dark')
    else if (theme === 'dark') setTheme('system')
    else setTheme('light')
  }

  const getIcon = () => {
    if (theme === 'light') return <Sun className="h-4 w-4" />
    if (theme === 'dark') return <Moon className="h-4 w-4" />
    return <Monitor className="h-4 w-4" />
  }

  const getLabel = () => {
    if (theme === 'light') return 'Light'
    if (theme === 'dark') return 'Dark'
    return 'System'
  }

  return (
    <SidebarMenuButton onClick={toggleTheme} tooltip={`Theme: ${getLabel()}`}>
      {getIcon()}
      <span>{getLabel()}</span>
    </SidebarMenuButton>
  )
}

function SidebarWrapper({ children }: { children: React.ReactNode }) {
  const { state } = useSidebar()
  const isMobile = useIsMobile()

  const width = isMobile
    ? undefined
    : `var(${state === 'expanded' ? '--sidebar-width' : '--sidebar-width-icon'})`

  return (
    <Sidebar
      collapsible="icon"
      className="border-r-0"
      style={{ width, minWidth: width, maxWidth: width }}
    >
      {children}
    </Sidebar>
  )
}

export function AppSidebar() {
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname

  return (
    <SidebarWrapper>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="Home">
              <Link to="/">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <span className="text-sm font-bold">{APP_NAME[0]}</span>
                </div>
                <div className="grid text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate font-semibold">{APP_NAME}</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
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
            <ThemeToggle />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <UserMenu />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </SidebarWrapper>
  )
}
