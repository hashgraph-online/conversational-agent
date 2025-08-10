import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { FiServer, FiCpu, FiSettings, FiAlertCircle, FiX } from 'react-icons/fi'
import { HederaSettings } from './settings/HederaSettings'
import { LLMSettings } from './settings/LLMSettings'
import { AdvancedSettings } from './settings/AdvancedSettings'
import { useConfigStore } from '../stores/configStore'
import { Button } from '../components/ui/Button'
import { Card, CardContent } from '../components/ui/Card'
import Typography from '../components/ui/Typography'
import { cn } from '../lib/utils'

interface SettingsPageProps {}

type TabKey = 'hedera' | 'llm' | 'advanced'

interface Tab {
  key: TabKey
  label: string
  icon: React.ElementType
  component: React.ComponentType
}

const tabs: Tab[] = [
  { key: 'hedera', label: 'Hedera', icon: FiServer, component: HederaSettings },
  { key: 'llm', label: 'AI Models', icon: FiCpu, component: LLMSettings },
  { key: 'advanced', label: 'Advanced', icon: FiSettings, component: AdvancedSettings }
]

const tabGradients = {
  hedera: 'from-[#a679f0] to-[#5599fe]',
  llm: 'from-[#5599fe] to-[#48df7b]',
  advanced: 'from-[#48df7b] to-[#a679f0]'
}

const SettingsPage: React.FC<SettingsPageProps> = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('hedera')
  const { config, isLoading, loadConfig, saveConfig, error, clearError, isHederaConfigValid, isLLMConfigValid } = useConfigStore()
  const [hasChanges, setHasChanges] = useState(false)
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null)

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  useEffect(() => {
    const unsubscribe = useConfigStore.subscribe((state, prevState) => {
      if (JSON.stringify(state.config) !== JSON.stringify(prevState.config)) {
        setHasChanges(true)
        
        if (saveTimeout) {
          clearTimeout(saveTimeout)
        }
        
        const hederaValid = isHederaConfigValid()
        const llmValid = isLLMConfigValid()
        
        if (hederaValid && llmValid) {
          const timeout = setTimeout(() => {
            saveConfig()
            setHasChanges(false)
          }, 2000)
          setSaveTimeout(timeout)
        }
      }
    })

    return () => {
      unsubscribe()
      if (saveTimeout) {
        clearTimeout(saveTimeout)
      }
    }
  }, [saveConfig, isHederaConfigValid, isLLMConfigValid, saveTimeout])

  const handleSaveConfiguration = async () => {
    try {
      await saveConfig()
      setHasChanges(false)
    } catch (error) {
    }
  }

  const handleCancel = async () => {
    await loadConfig()
    setHasChanges(false)
  }

  const isConfigValid = isHederaConfigValid() && isLLMConfigValid()


  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-6 py-8 max-w-6xl">
          <div className="flex items-center justify-center min-h-[400px]">
            <Typography variant="body1" color="muted">Loading configuration...</Typography>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-8 max-w-6xl">
      

        <div className="mb-8">
          <Typography 
            variant="h1" 
            className="text-3xl font-bold mb-4 bg-gradient-to-r from-[#a679f0] via-[#5599fe] to-[#48df7b] bg-clip-text text-transparent"
            noMargin
          >
            Settings
          </Typography>
          <Typography variant="body1" className="text-muted-foreground">
            Configure your agent's connection to Hedera, AI models, and advanced options
          </Typography>
        </div>
      
      {error && (
        <div 
          className="mb-4 sm:mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start space-x-3"
          role="alert"
          aria-live="polite"
        >
          <FiAlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1">
            <Typography variant="caption" className="text-red-800 dark:text-red-300">
              {error}
            </Typography>
          </div>
          <button
            onClick={clearError}
            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 p-1 -m-1 rounded focus:outline-none focus:ring-2 focus:ring-red-500/50"
            aria-label="Dismiss error"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>
      )}
      
        <Card className="shadow-lg">
        <div className="border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
          <nav className="flex space-x-4 sm:space-x-8 px-4 sm:px-6 min-w-max" role="tablist" aria-label="Settings tabs">
            {tabs.map((tab, index) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.key
              const gradient = tabGradients[tab.key]
              
              return (
                <motion.button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    "py-3 sm:py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2",
                    "transition-all focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:rounded-t-md min-h-[44px] touch-manipulation relative",
                    isActive
                      ? 'border-transparent text-transparent'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  )}
                  role="tab"
                  aria-selected={activeTab === tab.key}
                  aria-controls={`${tab.key}-panel`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeTabBorder"
                      className={cn(
                        "absolute inset-x-0 bottom-0 h-0.5",
                        `bg-gradient-to-r ${gradient}`
                      )}
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  
                  <div className={cn(
                    "relative w-5 h-5 sm:w-6 sm:h-6 rounded-lg flex items-center justify-center transition-all duration-300",
                    isActive && `bg-gradient-to-br ${gradient} shadow-lg`
                  )}>
                    <Icon className={cn(
                      "w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 transition-colors duration-300",
                      isActive ? "text-white" : "text-current"
                    )} aria-hidden="true" />
                  </div>
                  
                  <span className={cn(
                    "whitespace-nowrap transition-all duration-300",
                    isActive && `bg-gradient-to-r ${gradient} bg-clip-text text-transparent font-semibold`
                  )}>
                    {tab.label}
                  </span>
                </motion.button>
              )
            })}
          </nav>
        </div>
        
        <CardContent className="p-4 sm:p-6">
          <motion.div 
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            role="tabpanel" 
            id={`${activeTab}-panel`}
            aria-labelledby={`${activeTab}-tab`}
          >
            {activeTab === 'hedera' && <HederaSettings />}
            {activeTab === 'llm' && <LLMSettings />}
            {activeTab === 'advanced' && <AdvancedSettings />}
          </motion.div>
        </CardContent>
        
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="w-full sm:w-auto">
            {hasChanges && isConfigValid && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2"
              >
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <Typography variant="caption" color="muted">
                  <span role="status" aria-live="polite">
                    Configuration will auto-save in 2 seconds...
                  </span>
                </Typography>
              </motion.div>
            )}
            {hasChanges && !isConfigValid && (
              <Typography variant="caption" className="text-red-600 dark:text-red-400">
                <span role="status" aria-live="polite">
                  Please complete all required fields
                </span>
              </Typography>
            )}
          </div>
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={!hasChanges}
              className="w-full sm:w-auto"
              aria-label="Cancel changes"
            >
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={handleSaveConfiguration}
              disabled={!hasChanges || !isConfigValid}
              className="w-full sm:w-auto"
              aria-label="Save configuration"
            >
              Save Configuration
            </Button>
          </div>
        </div>
        </Card>
      </div>
    </div>
  )
}

export default SettingsPage