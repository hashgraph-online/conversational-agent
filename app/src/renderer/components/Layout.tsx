import React from 'react'
import Sidebar from './navigation/Sidebar'
import Typography from './ui/Typography'
import { FiSearch } from 'react-icons/fi'
import { cn } from '../lib/utils'

interface LayoutProps {
  children: React.ReactNode
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="flex h-screen bg-white dark:bg-gray-900">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-6">
          <div className="flex-1 max-w-xl">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search anything..."
                className={cn(
                  "w-full h-10 pl-10 pr-4 rounded-lg",
                  "bg-gray-50 dark:bg-gray-800",
                  "border border-transparent",
                  "focus:outline-none focus:ring-2 focus:ring-[#5599fe]/50 focus:bg-white dark:focus:bg-gray-900 focus:border-[#5599fe]",
                  "placeholder:text-gray-500 dark:placeholder:text-gray-400",
                  "text-gray-900 dark:text-white",
                  "transition-all duration-200"
                )}
              />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded text-gray-500 dark:text-gray-400 font-mono">
                ⌘K
              </kbd>
            </div>
          </div>

        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

export default Layout