import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import Typography from '../ui/Typography';
import Logo from '../ui/Logo';
import {
  FiHome,
  FiMessageSquare,
  FiServer,
  FiPackage,
  FiSettings,
  FiHelpCircle,
  FiUser,
  FiChevronLeft,
  FiChevronRight,
} from 'react-icons/fi';
import {
  HiSparkles,
  HiChatBubbleBottomCenterText,
  HiServerStack,
  HiPuzzlePiece,
  HiUserCircle,
  HiCog6Tooth,
  HiQuestionMarkCircle,
  HiSquares2X2,
  HiHeart,
} from 'react-icons/hi2';

interface SidebarProps {
  className?: string;
}

interface NavItem {
  id: string;
  path: string;
  label: string;
  icon: React.ElementType;
  description?: string;
  gradient?: string;
  iconBg?: string;
}

const primaryNavItems: NavItem[] = [
  {
    id: 'chat',
    path: '/chat',
    label: 'Agent Chat',
    icon: HiChatBubbleBottomCenterText,
    description: 'Interact with AI agents',
    gradient: 'from-[#a679f0] to-[#5599fe]',
    iconBg:
      'from-purple-500/30 to-blue-500/30 dark:from-purple-400/40 dark:to-blue-400/40',
  },
  {
    id: 'mcp',
    path: '/mcp',
    label: 'MCP Servers',
    icon: HiServerStack,
    description: 'Manage MCP connections',
    gradient: 'from-[#48df7b] to-[#5599fe]',
    iconBg:
      'from-green-500/30 to-blue-500/30 dark:from-green-400/40 dark:to-blue-400/40',
  },
  {
    id: 'plugins',
    path: '/plugins',
    label: 'Plugins',
    icon: HiPuzzlePiece,
    description: 'Extend functionality',
    gradient: 'from-[#5599fe] to-[#a679f0]',
    iconBg:
      'from-blue-500/30 to-purple-500/30 dark:from-blue-400/40 dark:to-purple-400/40',
  },
  {
    id: 'hcs10',
    path: '/hcs10-profile',
    label: 'My Profile',
    icon: HiUserCircle,
    description: 'Manage your profile',
    gradient: 'from-[#a679f0] to-[#48df7b]',
    iconBg:
      'from-purple-500/30 to-green-500/30 dark:from-purple-400/40 dark:to-green-400/40',
  },
];

const secondaryNavItems: NavItem[] = [
  {
    id: 'settings',
    path: '/settings',
    label: 'Settings',
    icon: HiCog6Tooth,
    description: 'Configure your workspace',
    gradient: 'from-gray-500 to-gray-600',
    iconBg: 'from-gray-500/20 to-gray-600/20',
  },
  {
    id: 'help',
    path: '/help',
    label: 'Help & Docs',
    icon: HiQuestionMarkCircle,
    description: 'Get support',
    gradient: 'from-blue-500 to-indigo-600',
    iconBg: 'from-blue-500/20 to-indigo-600/20',
  },
  {
    id: 'acknowledgements',
    path: '/acknowledgements',
    label: 'Acknowledgements',
    icon: HiHeart,
    description: 'Credits & licenses',
    gradient: 'from-pink-500 to-rose-600',
    iconBg: 'from-pink-500/20 to-rose-600/20',
  },
];

const SidebarContent: React.FC<SidebarProps & { location: any }> = ({
  className,
  location,
}) => {
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const active = isActive(item.path);

    if (item.id === 'help') {
      return (
        <a
          key={item.id}
          href='https://hashgraphonline.com/docs/standards/'
          target='_blank'
          rel='noopener noreferrer'
          className={cn(
            'group relative flex items-center gap-4 rounded-2xl transition-all duration-300',
            isCollapsed ? 'px-4 py-4 justify-center' : 'px-4 py-3.5',
            !isCollapsed && 'hover:translate-x-1',
            'hover:scale-[1.02]',
            'hover:bg-gray-100/50 dark:hover:bg-white/5'
          )}
          title={isCollapsed ? item.label : undefined}
        >
          <div
            className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200',
              `bg-gradient-to-br ${
                item.iconBg ||
                'from-gray-100/50 to-gray-200/50 dark:from-white/5 dark:to-white/10'
              }`,
              'group-hover:scale-110 group-hover:shadow-lg'
            )}
          >
            <Icon className='w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white transition-all duration-300' />
          </div>

          {!isCollapsed && (
            <div className='flex-1 min-w-0'>
              <div className='text-sm font-semibold text-gray-900 dark:text-white leading-tight font-mono tracking-wide group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-[#5599fe] group-hover:to-[#a679f0] group-hover:bg-clip-text transition-all duration-300'>
                {item.label}
              </div>
              {item.description && (
                <div className='text-xs text-gray-500 dark:text-gray-400 leading-tight font-mono opacity-75 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors duration-300'>
                  {item.description}
                </div>
              )}
            </div>
          )}
        </a>
      );
    }

    return (
      <Link
        key={item.id}
        to={item.path}
        className={cn(
          'group relative flex items-center gap-4 rounded-2xl transition-all duration-300',
          isCollapsed ? 'px-4 py-4 justify-center' : 'px-4 py-3.5',
          !isCollapsed && 'hover:translate-x-1',
          'hover:scale-[1.02]',
          active &&
            'bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-sm border border-white/10 shadow-lg'
        )}
        title={isCollapsed ? item.label : undefined}
      >
        {active && (
          <div className='absolute left-0 top-1/2 -translate-y-1/2 w-1 h-10 bg-gradient-to-b from-[#a679f0] via-[#5599fe] to-[#48df7b] rounded-r-full shadow-[0_0_20px_rgba(85,153,254,0.8)]' />
        )}

        <div
          className={cn(
            'relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 sparkle-hover',
            'before:absolute before:inset-0 before:rounded-xl before:opacity-0 before:transition-opacity before:duration-300',
            active
              ? `before:opacity-100 before:bg-gradient-to-br ${
                  item.gradient || 'from-[#5599fe] to-[#a679f0]'
                } text-white shadow-2xl shadow-[#5599fe]/30`
              : '',
            !active &&
              'group-hover:before:opacity-100 group-hover:shadow-lg'
          )}
        >
          <div
            className={cn(
              'absolute inset-0 rounded-xl transition-all duration-300',
              active
                ? `bg-gradient-to-br ${
                    item.gradient || 'from-[#5599fe] to-[#a679f0]'
                  }`
                : `bg-gradient-to-br ${
                    item.gradient || 'from-[#5599fe] to-[#a679f0]'
                  } opacity-70`,
              !active && 'group-hover:scale-110 group-hover:rotate-3 group-hover:opacity-100'
            )}
          />
          <Icon
            className={cn(
              'relative z-10 w-5 h-5 transition-all duration-300 text-white',
              !active && 'group-hover:scale-110'
            )}
          />
        </div>

        {!isCollapsed && (
          <div className='flex-1 min-w-0'>
            <div
              className={cn(
                'text-sm font-semibold leading-tight font-mono tracking-wide',
                active
                  ? 'text-transparent bg-gradient-to-r from-[#5599fe] to-[#a679f0] bg-clip-text'
                  : 'text-gray-900 dark:text-white',
                !active &&
                  'group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-[#5599fe] group-hover:to-[#a679f0] group-hover:bg-clip-text'
              )}
            >
              {item.label}
            </div>
            {item.description && (
              <div
                className={cn(
                  'text-xs leading-tight font-mono opacity-75 transition-colors duration-300',
                  active
                    ? 'text-gray-600 dark:text-gray-300'
                    : 'text-gray-500 dark:text-gray-400',
                  !active &&
                    'group-hover:text-gray-600 dark:group-hover:text-gray-300'
                )}
              >
                {item.description}
              </div>
            )}
          </div>
        )}
      </Link>
    );
  };

  return (
    <aside
      className={cn(
        'h-full bg-white/95 dark:bg-black/40 backdrop-blur-xl border-r border-gray-200/50 dark:border-white/[0.06]',
        'flex flex-col relative overflow-hidden transition-all duration-300',
        isCollapsed ? 'w-24' : 'w-72',
        className
      )}
    >
      {/* Animated gradient background */}
      <div className='absolute inset-0 opacity-[0.03] dark:opacity-[0.02]'>
        <div className='absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-[#a679f0] to-[#5599fe] rounded-full blur-3xl animate-pulse' />
        <div
          className='absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-[#48df7b] to-[#5599fe] rounded-full blur-3xl animate-pulse'
          style={{ animationDelay: '2s' }}
        />
      </div>
      <div className='relative p-4 border-b border-gray-200/50 dark:border-white/[0.06]'>
        {/* Collapse Toggle Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            'absolute top-2 right-2 w-7 h-7',
            'bg-white/90 dark:bg-gray-800/90',
            'border border-gray-200 dark:border-gray-700',
            'rounded-md flex items-center justify-center shadow-sm hover:shadow-md',
            'transition-all duration-300 hover:scale-105 z-10',
            'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white',
            'backdrop-blur-sm'
          )}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <FiChevronRight className='w-3 h-3' />
          ) : (
            <FiChevronLeft className='w-3 h-3' />
          )}
        </button>

        {isCollapsed ? (
          <div className='flex justify-center pt-2'>
            <div className='relative'>
              <div className='absolute inset-0 bg-gradient-to-br from-[#a679f0] to-[#5599fe] rounded-2xl blur-xl opacity-50' />
              <Logo size='md' showText={false} className='relative' />
            </div>
          </div>
        ) : (
          <div className='flex items-start gap-3 pr-8'>
            <div className='relative flex-shrink-0'>
              <div className='absolute inset-0 bg-gradient-to-br from-[#a679f0] to-[#5599fe] rounded-2xl blur-xl opacity-50' />
              <Logo size='lg' showText={false} className='relative' />
            </div>
            <div className='flex-1 min-w-0 flex flex-col'>
              <div className='text-2xl font-bold bg-gradient-to-r from-[#5599fe] to-[#a679f0] bg-clip-text text-transparent font-mono tracking-wide break-words' style={{ lineHeight: '1' }}>
                OpenARC
              </div>
              <div className='text-xs text-gray-500 dark:text-gray-400 font-mono opacity-80 tracking-wide' style={{ marginTop: '2px', lineHeight: '1' }}>
                by{' '}
                <Link
                  to='https://hashgraphonline.com'
                  target='_blank'
                  rel='noopener noreferrer'
                >
                  HashgraphOnline
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      <nav className='relative flex-1 p-4 space-y-2 overflow-y-auto'>
        {primaryNavItems.map(renderNavItem)}
      </nav>

      <div className='relative p-4 border-t border-gray-200/50 dark:border-white/[0.06] space-y-2'>
        {secondaryNavItems.map(renderNavItem)}
      </div>
    </aside>
  );
};

const Sidebar: React.FC<SidebarProps> = (props) => {
  const location = useLocation();
  return <SidebarContent {...props} location={location} />;
};

export default Sidebar;
