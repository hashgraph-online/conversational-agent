import React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { cn } from '../../lib/utils'
import Typography from '../ui/Typography'
import Logo from '../ui/Logo'
import { 
  FiHome,
  FiMessageSquare,
  FiServer,
  FiPackage,
  FiSettings,
  FiHelpCircle
} from 'react-icons/fi'

interface SidebarProps {
  className?: string
}

interface NavItem {
  id: string
  path: string
  label: string
  icon: React.ElementType
  description?: string
}

const primaryNavItems: NavItem[] = [
  {
    id: 'home',
    path: '/',
    label: 'Dashboard',
    icon: FiHome,
    description: 'Overview and quick actions'
  },
  {
    id: 'chat',
    path: '/chat',
    label: 'Agent Chat',
    icon: FiMessageSquare,
    description: 'Interact with AI agents'
  },
  {
    id: 'mcp',
    path: '/mcp',
    label: 'MCP Servers',
    icon: FiServer,
    description: 'Manage MCP connections'
  },
  {
    id: 'plugins',
    path: '/plugins',
    label: 'Plugins',
    icon: FiPackage,
    description: 'Extend functionality'
  }
]

const secondaryNavItems: NavItem[] = [
  {
    id: 'settings',
    path: '/settings',
    label: 'Settings',
    icon: FiSettings,
    description: 'Configure your workspace'
  },
  {
    id: 'help',
    path: '/help',
    label: 'Help & Docs',
    icon: FiHelpCircle,
    description: 'Get support'
  }
]

const SidebarContent: React.FC<SidebarProps & { location: any }> = ({ className, location }) => {
  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/'
    }
    return location.pathname.startsWith(path)
  }

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon
    const active = isActive(item.path)

    if (item.id === 'help') {
      return (
        <a
          key={item.id}
          href="https://hashgraphonline.com/docs/standards/"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "group relative flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200",
            "hover:bg-gray-50 dark:hover:bg-gray-800"
          )}
        >
          <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
            "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
            "group-hover:bg-gray-200 dark:group-hover:bg-gray-700"
          )}>
            <Icon className="w-5 h-5" />
          </div>

          <div className="flex-1 min-w-0">
            <Typography 
              variant="body1" 
              className="font-medium text-gray-900 dark:text-white"
            >
              {item.label}
            </Typography>
            {item.description && (
              <Typography 
                variant="caption" 
                color="muted"
                className="block truncate"
              >
                {item.description}
              </Typography>
            )}
          </div>
        </a>
      )
    }

    return (
      <Link
        key={item.id}
        to={item.path}
        className={cn(
          "group relative flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200",
          "hover:bg-gray-50 dark:hover:bg-gray-800",
          active && "bg-[#5599fe]/10 dark:bg-[#5599fe]/20"
        )}
      >
        {active && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-[#5599fe] rounded-r-full shadow-[0_0_8px_rgba(85,153,254,0.5)]" />
        )}

        <div className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
          active ? "bg-[#5599fe] text-white shadow-md" : "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
          !active && "group-hover:bg-gray-200 dark:group-hover:bg-gray-700"
        )}>
          <Icon className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <Typography 
            variant="body1" 
            className={cn(
              "font-medium",
              active ? "text-[#5599fe] dark:text-[#5599fe]" : "text-gray-900 dark:text-white"
            )}
          >
            {item.label}
          </Typography>
          {item.description && (
            <Typography 
              variant="caption" 
              color="muted"
              className="block truncate"
            >
              {item.description}
            </Typography>
          )}
        </div>
      </Link>
    )
  }

  return (
    <aside className={cn(
      "w-72 h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800",
      "flex flex-col",
      className
    )}>
      <div className="p-6 border-b border-gray-200 dark:border-gray-800">
        <Logo size="lg" showText={false} className="mb-4" />
        <div>
          <Typography variant="h6" className="font-bold">
            Conversational Agent
          </Typography>
          <Typography variant="caption" color="muted">
            by Hashgraph Online
          </Typography>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {primaryNavItems.map(renderNavItem)}
      </nav>

      <div className="p-4 border-t border-gray-200 dark:border-gray-800 space-y-1">
        {secondaryNavItems.map(renderNavItem)}
      </div>
    </aside>
  )
}

const Sidebar: React.FC<SidebarProps> = (props) => {
  const location = useLocation()
  return <SidebarContent {...props} location={location} />
}

export default Sidebar