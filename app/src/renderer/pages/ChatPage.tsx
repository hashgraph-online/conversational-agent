import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Typography from '../components/ui/Typography'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip'
import { Alert, AlertDescription } from '../components/ui/alert'
import { useAgentStore } from '../stores/agentStore'
import { useConfigStore } from '../stores/configStore'
import { 
  FiSettings, 
  FiRefreshCw, 
  FiSend, 
  FiMessageSquare,
  FiZap,
  FiWifi,
  FiWifiOff,
  FiShield,
  FiCpu,
  FiCode,
  FiAlertCircle,
  FiPaperclip,
  FiFile,
  FiX
} from 'react-icons/fi'
import { cn } from '../lib/utils'
import type { Message } from '../stores/agentStore'
import { ModeToggle } from '../components/chat/ModeToggle'
import MessageBubble from '../components/chat/MessageBubble'

interface ChatPageProps {}

const ChatPage: React.FC<ChatPageProps> = () => {
  const navigate = useNavigate()
  const { 
    status, 
    isConnected, 
    connectionError, 
    messages,
    operationalMode,
    setOperationalMode,
    connect, 
    disconnect, 
    sendMessage 
  } = useAgentStore()
  
  const { config, isConfigured } = useConfigStore()
  const [isLoading, setIsLoading] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const messagesEndRef = React.useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const isConfigComplete = isConfigured()
  

  useEffect(() => {
    const initializeAgent = async () => {
      if (config && isConfigComplete && !isConnected && status === 'idle') {
        try {
          await connect()
        } catch (error) {
        }
      }
    }

    initializeAgent()
  }, [config, isConfigComplete, isConnected, status, connect])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'm') {
        e.preventDefault()
        if (status !== 'connecting' && status !== 'disconnecting') {
          setOperationalMode(operationalMode === 'autonomous' ? 'returnBytes' : 'autonomous').catch(
            error => {}
          )
        }
      }
      
      if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
        e.preventDefault()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [operationalMode, status, setOperationalMode])

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    setFileError(null)
    
    if (files) {
      const oversizedFiles: string[] = []
      const newFiles = Array.from(files).filter(file => {
        if (file.size > 10 * 1024 * 1024) {
          oversizedFiles.push(file.name)
          return false
        }
        return true
      })
      
      if (oversizedFiles.length > 0) {
        setFileError(`File${oversizedFiles.length > 1 ? 's' : ''} too large (max 10MB): ${oversizedFiles.join(', ')}`)
        setTimeout(() => setFileError(null), 5000)
      }
      
      setSelectedFiles(prev => [...prev, ...newFiles])
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleFileButtonClick = () => {
    fileInputRef.current?.click()
  }

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const base64 = reader.result as string
        resolve(base64.split(',')[1])
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const handleSendMessage = async () => {
    const message = inputValue.trim()
    if ((!message && selectedFiles.length === 0) || isSubmitting || !isConnected) return

    setIsSubmitting(true)
    setIsLoading(true)
    
    try {
      let messageToSend = message
      
      if (selectedFiles.length > 0) {
        // Process files and create a hidden section for the agent
        const filePromises = selectedFiles.map(async (file) => {
          try {
            const base64Content = await fileToBase64(file)
            const fileType = file.type || 'application/octet-stream'
            
            if (file.type.startsWith('image/')) {
              return `\n<!-- FILE_START:${file.name} -->\n[Image: ${file.name}]\n![${file.name}](data:${fileType};base64,${base64Content})\n<!-- FILE_END:${file.name} -->\n`
            } else {
              return `\n<!-- FILE_START:${file.name} -->\n[File: ${file.name} (${(file.size / 1024).toFixed(1)}KB, ${fileType})]\nBase64 content:\n${base64Content}\n<!-- FILE_END:${file.name} -->\n`
            }
          } catch (error) {
            console.error(`Failed to read file ${file.name}:`, error)
            return `\n<!-- FILE_ERROR:${file.name} -->\n[File: ${file.name} - Error reading file]\n<!-- FILE_ERROR_END -->\n`
          }
        })
        
        const fileContents = await Promise.all(filePromises)
        
        // Create a user-friendly message with file list
        const fileList = selectedFiles.map(file => {
          const sizeStr = file.size > 1024 * 1024 
            ? `${(file.size / (1024 * 1024)).toFixed(1)}MB`
            : `${(file.size / 1024).toFixed(1)}KB`
          return `📎 ${file.name} (${sizeStr})`
        }).join('\n')
        
        const userVisiblePart = message 
          ? `${message}\n\nAttached files:\n${fileList}`
          : `Attached files:\n${fileList}`
        
        // Combine visible part with hidden file content
        messageToSend = `${userVisiblePart}\n\n<!-- HIDDEN_FILE_CONTENT -->\n${fileContents.join('')}\n<!-- END_HIDDEN_FILE_CONTENT -->`
      }
      
      await sendMessage(messageToSend)
      setInputValue('')
      setSelectedFiles([])
    } catch (error) {
    } finally {
      setIsSubmitting(false)
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleConnect = async () => {
    try {
      await connect()
    } catch (error) {
    }
  }

  const handleGoToSettings = () => {
    navigate('/settings')
  }

  if (!isConfigComplete) {
    return (
      <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950">
        {/* Header */}
        <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#a679f0] to-[#5599fe] rounded-xl flex items-center justify-center">
              <FiMessageSquare className="w-5 h-5 text-white" />
            </div>
            <Typography variant="h5" className="font-bold">
              AI Agent Chat
            </Typography>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-6 max-w-lg animate-fade-in">
            <div className="w-20 h-20 bg-gradient-to-br from-[#a679f0] to-[#5599fe] rounded-2xl flex items-center justify-center mx-auto animate-float">
              <FiSettings className="w-10 h-10 text-white" />
            </div>
            <div className="space-y-3">
              <Typography variant="h3" gradient className="font-bold">
                Welcome to Agent Chat
              </Typography>
              <Typography variant="body1" color="muted" className="max-w-md mx-auto">
                To start chatting with your AI assistant, you'll need to configure your Hedera account 
                and OpenAI API credentials. This ensures secure, private conversations.
              </Typography>
            </div>
            <Button
              onClick={handleGoToSettings}
              variant="gradient"
              size="lg"
            >
              <FiSettings className="w-5 h-5" />
              Configure Settings
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!isConnected && !['connecting'].includes(status)) {
    return (
      <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950">
        {/* Header */}
        <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#a679f0] to-[#5599fe] rounded-xl flex items-center justify-center">
              <FiMessageSquare className="w-5 h-5 text-white" />
            </div>
            <Typography variant="h5" className="font-bold">
              AI Agent Chat
            </Typography>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-6 max-w-lg animate-fade-in">
            <div className="w-20 h-20 bg-gradient-to-br from-[#48df7b] to-[#5599fe] rounded-2xl flex items-center justify-center mx-auto animate-float">
              <FiRefreshCw className="w-10 h-10 text-white" />
            </div>
            <div className="space-y-3">
              <Typography variant="h3" gradient className="font-bold">
                Ready to Connect
              </Typography>
              <Typography variant="body1" color="muted" className="max-w-md mx-auto">
                {connectionError 
                  ? `Connection failed: ${connectionError}. Please check your configuration and try again.`
                  : 'Your AI assistant is ready to start. Click below to establish a secure connection and begin chatting.'
                }
              </Typography>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={handleConnect}
                variant="gradient"
                size="lg"
                disabled={status === 'connecting'}
              >
                <FiRefreshCw className={cn(
                  "w-5 h-5",
                  status === 'connecting' && "animate-spin"
                )} />
                {status === 'connecting' ? 'Connecting...' : 'Connect to Agent'}
              </Button>
              <Button
                onClick={handleGoToSettings}
                variant="secondary"
                size="lg"
              >
                <FiSettings className="w-5 h-5" />
                Settings
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#a679f0] to-[#5599fe] rounded-xl flex items-center justify-center shadow-md">
              <FiZap className="w-5 h-5 text-white" />
            </div>
            <div>
              <Typography variant="h6" className="font-bold">
                AI Assistant
              </Typography>
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  isConnected ? "bg-[#48df7b]" : "bg-gray-400"
                )} />
                <Typography variant="caption" color="muted">
                  {status === 'connected' ? 'Online' : status}
                </Typography>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Mode Toggle */}
          <ModeToggle
            mode={operationalMode}
            onChange={async (mode) => {
              try {
                await setOperationalMode(mode)
              } catch (error) {
              }
            }}
            disabled={status === 'connecting' || status === 'disconnecting'}
          />
          
          <div className="h-6 w-px bg-gray-300 dark:bg-gray-700" />
          
          {config && (
            <>
              {/* Network Status */}
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                {isConnected ? (
                  <FiWifi className="w-4 h-4 text-[#48df7b]" />
                ) : (
                  <FiWifiOff className="w-4 h-4 text-gray-400" />
                )}
                <Typography variant="caption" className="font-medium">
                  {config.hedera?.network?.toUpperCase() || 'TESTNET'}
                </Typography>
              </div>
              
              {/* Account Info */}
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <FiShield className="w-4 h-4 text-[#a679f0]" />
                <Typography variant="caption" className="font-medium">
                  {config.hedera?.accountId || 'Not configured'}
                </Typography>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center p-8">
            <div className="text-center space-y-6 max-w-2xl">
              <div className="w-16 h-16 bg-gradient-to-br from-[#a679f0] to-[#5599fe] rounded-2xl flex items-center justify-center mx-auto shadow-lg">
                <FiMessageSquare className="w-8 h-8 text-white" />
              </div>
              <div className="space-y-3">
                <Typography variant="h4" className="font-bold">
                  Welcome to Conversational Agent
                </Typography>
                <Typography variant="body1" color="muted">
                  I can help you with Hedera network operations, account management, token transfers, 
                  smart contracts, and more. Start by asking me a question or requesting help with a task.
                </Typography>
              </div>

              {/* Suggestion Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8 stagger-children">
                {[
                  { icon: FiCpu, text: "What's my account balance?", color: "purple" },
                  { icon: FiCode, text: "Transfer 5 HBAR to 0.0.123456", color: "blue" },
                  { icon: FiShield, text: "Help me create a new account", color: "green" },
                  { icon: FiMessageSquare, text: "Send a message to HCS topic", color: "purple" }
                ].map((suggestion, index) => {
                  const Icon = suggestion.icon
                  const gradientClass = {
                    purple: 'from-[#a679f0]/20 to-[#a679f0]/10',
                    blue: 'from-[#5599fe]/20 to-[#5599fe]/10',
                    green: 'from-[#48df7b]/20 to-[#48df7b]/10'
                  }[suggestion.color]
                  
                  return (
                    <button
                      key={index}
                      onClick={() => setInputValue(suggestion.text)}
                      className="p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-all text-left group card-hover"
                    >
                      <div className={cn(
                        "w-10 h-10 rounded-lg bg-gradient-to-br flex items-center justify-center mb-3",
                        gradientClass
                      )}>
                        <Icon className="w-5 h-5 text-gray-700 dark:text-white" />
                      </div>
                      <Typography variant="body2" className="group-hover:text-[#5599fe] transition-colors">
                        {suggestion.text}
                      </Typography>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="py-6 pr-6 space-y-4">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            
            {isLoading && (
              <div className="flex justify-start animate-fade-in">
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-[#5599fe] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-[#5599fe] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-[#5599fe] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <Typography variant="caption" color="muted">
                      Agent is thinking...
                    </Typography>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
        <div className="max-w-4xl mx-auto">
          {/* File error alert */}
          {fileError && (
            <Alert className="mb-3 border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20">
              <FiAlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              <AlertDescription className="text-orange-800 dark:text-orange-200">
                {fileError}
              </AlertDescription>
            </Alert>
          )}
          
          {/* File previews */}
          {selectedFiles.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {selectedFiles.map((file, index) => (
                <div
                  key={index}
                  className="inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm"
                >
                  <FiFile className="w-4 h-4 text-gray-600 dark:text-gray-400 flex-shrink-0" />
                  <span className="truncate max-w-[200px] text-gray-900 dark:text-gray-100 font-medium">
                    {file.name}
                  </span>
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    ({file.size > 1024 * 1024 
                      ? `${(file.size / (1024 * 1024)).toFixed(1)}MB`
                      : `${(file.size / 1024).toFixed(1)}KB`
                    })
                  </span>
                  <button
                    onClick={() => handleRemoveFile(index)}
                    className="ml-1 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                    aria-label={`Remove ${file.name}`}
                  >
                    <FiX className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={isConnected ? "Type a message..." : "Connect to agent to start chatting..."}
                disabled={!isConnected || isSubmitting}
                className="px-4 py-3 pr-12 rounded-xl"
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleFileButtonClick}
                    disabled={!isConnected || isSubmitting}
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8"
                  >
                    <FiPaperclip className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Attach files (max 10MB each)</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Button
              onClick={handleSendMessage}
              disabled={!isConnected || isSubmitting || (!inputValue.trim() && selectedFiles.length === 0)}
              variant="gradient"
              size="default"
              className="px-6"
            >
              <FiSend className="w-4 h-4" />
              Send
            </Button>
          </div>
          
          <div className="mt-2 flex items-center justify-between">
            <Typography variant="caption" color="muted">
              Press Enter to send, Shift+Enter for new line • Click 📎 to attach files
            </Typography>
            <Typography 
              variant="caption" 
              color="muted"
              className={cn(
                "tabular-nums",
                inputValue.length > 1800 && "text-orange-500",
                inputValue.length > 1950 && "text-red-500"
              )}
            >
              {inputValue.length}/2000
            </Typography>
          </div>
        </div>
        
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          accept="*/*"
        />
      </div>
    </div>
  )
}

export default ChatPage