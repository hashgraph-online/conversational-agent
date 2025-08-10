import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Sidebar from './navigation/Sidebar';
import Typography from './ui/Typography';
import { FiSearch, FiMoon, FiSun, FiUser } from 'react-icons/fi';
import { cn } from '../lib/utils';
import { useConfigStore } from '../stores/configStore';
import { HCS10Client } from '@hashgraphonline/standards-sdk';

interface LayoutProps {
  children: React.ReactNode;
}

const ThemeToggle: React.FC = () => {
  const { config, setTheme } = useConfigStore();
  const currentTheme =
    config && (config as any).advanced && (config as any).advanced.theme
      ? (config as any).advanced.theme
      : 'light';

  const toggleTheme = async () => {
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    await setTheme(newTheme);
  };

  return (
    <motion.button
      onClick={toggleTheme}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      className={cn(
        'ml-4 p-2.5 rounded-xl transition-all duration-200',
        'bg-gradient-to-r from-[#a679f0]/10 to-[#5599fe]/10 hover:from-[#a679f0]/20 hover:to-[#5599fe]/20',
        'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white',
        'border border-gray-200/50 dark:border-white/10'
      )}
      aria-label={`Switch to ${
        currentTheme === 'light' ? 'dark' : 'light'
      } mode`}
    >
      <motion.div
        key={currentTheme}
        initial={{ rotate: -90, opacity: 0 }}
        animate={{ rotate: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {currentTheme === 'light' ? (
          <FiMoon className='w-5 h-5' />
        ) : (
          <FiSun className='w-5 h-5' />
        )}
      </motion.div>
    </motion.button>
  );
};

interface UserProfile {
  display_name?: string;
  alias?: string;
  profileImage?: string;
}

const ProfileButton: React.FC = () => {
  const navigate = useNavigate();
  const { config } = useConfigStore();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (
        config?.hedera?.accountId &&
        config?.hedera?.network &&
        !isLoadingProfile
      ) {
        setIsLoadingProfile(true);
        try {
          const client = new HCS10Client({
            network: config.hedera.network as 'mainnet' | 'testnet',
            operatorId: config.hedera.accountId,
            operatorPrivateKey: config.hedera.privateKey,
            logLevel: 'info',
          });

          const profileResult = await client.retrieveProfile(
            config.hedera.accountId
          );

          if (profileResult.success && profileResult.profile) {
            setUserProfile(profileResult.profile);
          }
        } catch (error) {
        } finally {
          setIsLoadingProfile(false);
        }
      }
    };

    fetchUserProfile();
  }, [
    config?.hedera?.accountId,
    config?.hedera?.network,
    config?.hedera?.privateKey,
  ]);

  return (
    <motion.button
      onClick={() => navigate('/hcs10-profile')}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      className={cn(
        'ml-3 p-2 rounded-xl transition-all duration-200',
        'bg-gradient-to-r from-[#a679f0]/10 to-[#5599fe]/10 hover:from-[#a679f0]/20 hover:to-[#5599fe]/20',
        'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white',
        'border border-gray-200/50 dark:border-white/10'
      )}
      aria-label='View profile'
      title='My Profile'
    >
      {userProfile?.profileImage ? (
        <img
          src={
            userProfile.profileImage.startsWith('hcs://')
              ? `${userProfile.profileImage.replace(
                  'hcs://1/',
                  'https://kiloscribe.com/api/inscription-cdn/'
                )}?network=${config?.hedera?.network || 'testnet'}`
              : userProfile.profileImage.startsWith('ipfs://')
              ? userProfile.profileImage.replace(
                  'ipfs://',
                  'https://gateway.pinata.cloud/ipfs/'
                )
              : userProfile.profileImage
          }
          alt={userProfile.display_name || userProfile.alias || 'Profile'}
          className='w-6 h-6 rounded-full object-cover'
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            const fallback = target.parentElement?.querySelector(
              '.profile-icon-fallback'
            ) as HTMLElement;
            if (fallback) fallback.style.display = 'flex';
          }}
        />
      ) : null}
      <div
        className={cn(
          'profile-icon-fallback w-6 h-6 rounded-full flex items-center justify-center',
          userProfile?.profileImage ? 'hidden' : 'flex'
        )}
        style={{ display: userProfile?.profileImage ? 'none' : 'flex' }}
      >
        {userProfile?.display_name || userProfile?.alias ? (
          <span className='text-sm font-semibold'>
            {(userProfile?.display_name || userProfile?.alias || '')
              .charAt(0)
              .toUpperCase()}
          </span>
        ) : (
          <FiUser className='w-5 h-5' />
        )}
      </div>
    </motion.button>
  );
};

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className='flex h-screen bg-gray-50 dark:bg-[#0a0a0a]'>
      <Sidebar />

      <div className='flex-1 flex flex-col overflow-hidden'>
        <header className='h-16 bg-white/80 dark:bg-black/40 backdrop-blur-lg border-b border-gray-200/50 dark:border-white/[0.06] flex items-center justify-between px-6 relative overflow-hidden'>
          <div className='absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#a679f0] via-[#5599fe] to-[#48df7b]' />

          <div className='flex-1 max-w-xl'>
            <motion.div className='relative' whileFocus={{ scale: 1.02 }}>
              <FiSearch className='absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none' />
              <input
                type='text'
                placeholder='Search anything... (Press Enter)'
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                  }
                }}
                className={cn(
                  'w-full h-10 pl-10 pr-4 rounded-xl',
                  'bg-white/50 dark:bg-white/5 backdrop-blur-sm',
                  'border border-gray-200/50 dark:border-white/[0.06]',
                  'focus:outline-none focus:ring-2 focus:ring-[#5599fe]/30 focus:bg-white dark:focus:bg-white/10 focus:border-[#5599fe]/50',
                  'placeholder:text-gray-500 dark:placeholder:text-gray-400',
                  'text-gray-900 dark:text-white',
                  'transition-all duration-200',
                  'hover:border-[#5599fe]/30 dark:hover:border-[#5599fe]/30',
                  'hover:shadow-md hover:shadow-[#5599fe]/10'
                )}
              />
            </motion.div>
          </div>

          <div className='flex items-center'>
            <ProfileButton />
            <ThemeToggle />
          </div>
        </header>

        <main className='flex-1 overflow-y-auto'>
          <div className='container mx-auto p-6'>{children}</div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
