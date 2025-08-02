import React, { useEffect, useState } from 'react'
import { FiServer, FiCpu, FiSettings, FiAlertCircle, FiX } from 'react-icons/fi'
import { HederaSettings } from './settings/HederaSettings'
import { LLMSettings } from './settings/LLMSettings'
import { AdvancedSettings } from './settings/AdvancedSettings'
import { useConfigStore } from '../stores/configStore'
import { Button } from '../components/ui/Button'
import { Card, CardContent } from '../components/ui/Card'
import Typography from '../components/ui/Typography'

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

  const ActiveComponent = tabs.find(tab => tab.key === activeTab)?.component || HederaSettings

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
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
        <div className="flex items-center justify-center min-h-[400px]">
          <Typography variant="body1" color="muted">Loading configuration...</Typography>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-4 sm:mb-6">
        <Typography variant="h2" gradient as="h1" noMargin>
          Settings
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
      
      <Card className="shadow-xl">
        <div className="border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
          <nav className="flex space-x-4 sm:space-x-8 px-4 sm:px-6 min-w-max" role="tablist" aria-label="Settings tabs">
            {tabs.map(tab => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`
                    py-3 sm:py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2
                    transition-all focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:rounded-t-md min-h-[44px] touch-manipulation
                    ${activeTab === tab.key
                      ? 'border-brand-blue text-brand-blue'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
                    }
                  `}
                  role="tab"
                  aria-selected={activeTab === tab.key}
                  aria-controls={`${tab.key}-panel`}
                >
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" aria-hidden="true" />
                  <span className="whitespace-nowrap">
                    {tab.label}
                  </span>
                </button>
              )
            })}
          </nav>
        </div>
        
        <CardContent className="p-4 sm:p-6">
          <div 
            role="tabpanel" 
            id={`${activeTab}-panel`}
            aria-labelledby={`${activeTab}-tab`}
          >
            <ActiveComponent />
          </div>
        </CardContent>
        
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="w-full sm:w-auto">
            {hasChanges && isConfigValid && (
              <Typography variant="caption" color="muted">
                <span role="status" aria-live="polite">
                  Configuration will auto-save in 2 seconds...
                </span>
              </Typography>
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
  )
}

export default SettingsPage