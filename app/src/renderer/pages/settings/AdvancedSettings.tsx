import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FiMoon, FiSun } from 'react-icons/fi'
import { useConfigStore } from '../../stores/configStore'
import { advancedConfigSchema, type AdvancedConfigForm } from '../../schemas/configuration'
import Typography from '../../components/ui/Typography'
import { Label } from '../../components/ui/label'
import { Switch } from '../../components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'

interface AdvancedSettingsProps {}

export const AdvancedSettings: React.FC<AdvancedSettingsProps> = () => {
  const { config, setTheme, setAutoStart, setLogLevel } = useConfigStore()

  const {
    register,
    watch,
    reset
  } = useForm<AdvancedConfigForm>({
    resolver: zodResolver(advancedConfigSchema),
    defaultValues: {
      theme: config?.advanced?.theme || 'light',
      autoStart: config?.advanced?.autoStart || false,
      logLevel: config?.advanced?.logLevel || 'info'
    }
  })

  React.useEffect(() => {
    if (config?.advanced) {
      reset({
        theme: config.advanced.theme || 'light',
        autoStart: config.advanced.autoStart || false,
        logLevel: config.advanced.logLevel || 'info'
      })
    }
  }, [config, reset])

  const watchTheme = watch('theme')
  const watchAutoStart = watch('autoStart')
  const watchLogLevel = watch('logLevel')

  React.useEffect(() => {
    const updateTheme = async () => {
      await setTheme(watchTheme || 'light')
    }
    updateTheme()
  }, [watchTheme, setTheme])

  React.useEffect(() => {
    setAutoStart(watchAutoStart || false)
  }, [watchAutoStart, setAutoStart])

  React.useEffect(() => {
    setLogLevel(watchLogLevel || 'info')
  }, [watchLogLevel, setLogLevel])

  return (
    <div className="space-y-6">
      <div>
        <Typography variant="h4" noMargin>Advanced Settings</Typography>
        <div className="mt-2">
          <Typography variant="body1" color="muted" noMargin>
            Customize your application preferences and behavior.
          </Typography>
        </div>
      </div>

      <form className="space-y-6">
        <div>
          <Typography variant="body1" className="font-medium mb-3" noMargin>
            Theme
          </Typography>
          <div className="space-y-2">
            <label className="flex items-center p-3 border border-gray-300 dark:border-gray-600 rounded-md cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <input
                type="radio"
                value="light"
                {...register('theme')}
                className="mr-3"
              />
              <FiSun className="w-5 h-5 mr-2 text-yellow-500" />
              <div>
                <Typography variant="body1" className="font-medium">Light Mode</Typography>
                <Typography variant="caption" color="muted">Bright theme for daytime use</Typography>
              </div>
            </label>
            <label className="flex items-center p-3 border border-gray-300 dark:border-gray-600 rounded-md cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <input
                type="radio"
                value="dark"
                {...register('theme')}
                className="mr-3"
              />
              <FiMoon className="w-5 h-5 mr-2 text-gray-700 dark:text-gray-300" />
              <div>
                <Typography variant="body1" className="font-medium">Dark Mode</Typography>
                <Typography variant="caption" color="muted">Dark theme for reduced eye strain</Typography>
              </div>
            </label>
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="autoStart" className="text-base font-medium">Start on System Boot</Label>
              <Typography variant="caption" color="muted">
                Automatically launch the application when your computer starts
              </Typography>
            </div>
            <Switch
              id="autoStart"
              checked={watchAutoStart}
              onCheckedChange={(checked) => {
                reset({ ...watch(), autoStart: checked })
              }}
            />
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <div className="space-y-2">
            <Label htmlFor="logLevel" className="text-base font-medium">Log Level</Label>
            <Select
              value={watchLogLevel}
              onValueChange={(value) => {
                reset({ ...watch(), logLevel: value as any })
              }}
            >
              <SelectTrigger id="logLevel" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="debug">Debug - All logs including debug information</SelectItem>
                <SelectItem value="info">Info - General information and above</SelectItem>
                <SelectItem value="warn">Warning - Warnings and errors only</SelectItem>
                <SelectItem value="error">Error - Errors only</SelectItem>
              </SelectContent>
            </Select>
            <Typography variant="caption" color="muted">
              Controls the verbosity of application logs. Debug level may impact performance.
            </Typography>
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <Typography variant="body1" className="font-medium mb-3" noMargin>Application Info</Typography>
          <div className="space-y-2">
            <div className="flex justify-between">
              <Typography variant="caption" color="muted">Version</Typography>
              <Typography variant="caption">1.0.0</Typography>
            </div>
            <div className="flex justify-between">
              <Typography variant="caption" color="muted">Electron</Typography>
              <Typography variant="caption">37.2.4</Typography>
            </div>
            <div className="flex justify-between">
              <Typography variant="caption" color="muted">Chrome</Typography>
              <Typography variant="caption">{navigator.userAgent.match(/Chrome\/(\S+)/)?.[1] || 'Unknown'}</Typography>
            </div>
            <div className="flex justify-between">
              <Typography variant="caption" color="muted">Node.js</Typography>
              <Typography variant="caption">{process.versions.node}</Typography>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}