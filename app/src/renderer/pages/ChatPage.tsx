import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
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
import { Disclaimer } from '../components/chat/Disclaimer'

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

    const timer = setTimeout(() => {
      initializeAgent()
    }, 100)

    return () => clearTimeout(timer)
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
            return `\n<!-- FILE_ERROR:${file.name} -->\n[File: ${file.name} - Error reading file]\n<!-- FILE_ERROR_END -->\n`
          }
        })
        
        const fileContents = await Promise.all(filePromises)
        
        const fileList = selectedFiles.map(file => {
          const sizeStr = file.size > 1024 * 1024 
            ? `${(file.size / (1024 * 1024)).toFixed(1)}MB`
            : `${(file.size / 1024).toFixed(1)}KB`
          return `📎 ${file.name} (${sizeStr})`
        }).join('\n')
        
        const userVisiblePart = message 
          ? `${message}\n\nAttached files:\n${fileList}`
          : `Attached files:\n${fileList}`
        
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

  if (!isConnected) {
    return (
      <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950">
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

        <div className="flex-1 flex items-center justify-center p-8">
          {status === 'connecting' ? (
            <div className="text-center space-y-6 max-w-lg animate-fade-in">
              <div className="w-20 h-20 bg-gradient-to-br from-[#a679f0] to-[#5599fe] rounded-2xl flex items-center justify-center mx-auto">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                >
                  <FiRefreshCw className="w-10 h-10 text-white" />
                </motion.div>
              </div>
              <div className="space-y-3">
                <Typography variant="h3" gradient className="font-bold">
                  Connecting to Agent
                </Typography>
                <Typography variant="body1" color="muted" className="max-w-md mx-auto">
                  Initializing your AI assistant. This may take a moment...
                </Typography>
                <div className="flex flex-col gap-2 mt-4">
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <motion.div
                      className="w-2 h-2 bg-[#5599fe] rounded-full"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                    Loading MCP servers...
                  </div>
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <motion.div
                      className="w-2 h-2 bg-[#a679f0] rounded-full"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
                    />
                    Establishing Hedera connection...
                  </div>
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <motion.div
                      className="w-2 h-2 bg-[#48df7b] rounded-full"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.5, repeat: Infinity, delay: 1 }}
                    />
                    Configuring AI model...
                  </div>
                </div>
              </div>
            </div>
          ) : (
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
                  variant="default"
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
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 opacity-[0.01] dark:opacity-[0.02] pointer-events-none">
        <motion.div
          className="absolute inset-0"
          animate={{
            backgroundPosition: ['0% 0%', '100% 100%'],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            repeatType: 'reverse',
          }}
          style={{
            backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(85, 153, 254, 0.1) 35px, rgba(85, 153, 254, 0.1) 70px)`,
            backgroundSize: '200% 200%',
          }}
        />
      </div>
      <header className="h-16 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-6 relative z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <motion.div 
              className="w-10 h-10 bg-gradient-to-br from-[#a679f0] to-[#5599fe] rounded-xl flex items-center justify-center shadow-md"
              whileHover={{ scale: 1.1, rotate: 5 }}
              whileTap={{ scale: 0.95 }}
            >
              <FiZap className="w-5 h-5 text-white" />
            </motion.div>
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

      <div className="flex-1 overflow-y-auto relative">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center p-8">
            <div className="text-center space-y-6 max-w-2xl relative z-10">
              {/* Floating orbs */}
              <motion.div
                className="absolute -top-20 -right-20 w-64 h-64 bg-[#a679f0]/10 rounded-full blur-3xl"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.1, 0.2, 0.1],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
              <motion.div
                className="absolute -bottom-20 -left-20 w-64 h-64 bg-[#48df7b]/10 rounded-full blur-3xl"
                animate={{
                  scale: [1.2, 1, 1.2],
                  opacity: [0.1, 0.2, 0.1],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: 2,
                }}
              />
              
              <motion.div 
                className="w-16 h-16 bg-gradient-to-br from-[#a679f0] to-[#5599fe] rounded-2xl flex items-center justify-center mx-auto shadow-lg"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                whileHover={{ scale: 1.1 }}
              >
                <FiMessageSquare className="w-8 h-8 text-white" />
              </motion.div>
              <div className="space-y-3">
                <Typography 
                  variant="h4" 
                  className="font-bold animate-gradient bg-gradient-to-r from-[#a679f0] via-[#5599fe] to-[#48df7b] bg-clip-text text-transparent"
                  style={{ backgroundSize: '200% 200%' }}
                >
                  Welcome to OpenARC
                </Typography>
                <Typography variant="body1" color="muted">
                  I can help you with Hedera network operations, HCS-1 inscriptions, HCS-20 ticks, 
                  account management, NFT minting, smart contracts, and more. Start by asking me a question or requesting help with a task.
                </Typography>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
                {[
                  { icon: FiCpu, text: "Inscribe data using HCS-1", gradient: 'from-[#a679f0] to-[#5599fe]' },
                  { icon: FiCode, text: "Deploy an HCS-20 tick", gradient: 'from-[#5599fe] to-[#48df7b]' },
                  { icon: FiShield, text: "Mint NFTs on Hedera", gradient: 'from-[#48df7b] to-[#5599fe]' },
                  { icon: FiMessageSquare, text: "Check my HCS inscriptions", gradient: 'from-[#5599fe] to-[#a679f0]' }
                ].map((suggestion, index) => {
                  const Icon = suggestion.icon
                  
                  return (
                    <motion.button
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      whileHover={{ scale: 1.05, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setInputValue(suggestion.text)}
                      className="p-4 bg-white/80 dark:bg-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-800 hover:border-[#5599fe]/50 hover:shadow-xl transition-all text-left group relative overflow-hidden"
                    >
                      <div className={cn(
                        "absolute inset-0 opacity-0 group-hover:opacity-[0.05] transition-opacity duration-500",
                        `bg-gradient-to-br ${suggestion.gradient}`
                      )} />
                      
                      <div className="relative">
                        <div className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center mb-3 shadow-md group-hover:shadow-lg transition-all duration-300",
                          `bg-gradient-to-br ${suggestion.gradient}`
                        )}>
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        <Typography variant="body2" className="group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-[#5599fe] group-hover:to-[#a679f0] group-hover:bg-clip-text transition-all duration-300">
                          {suggestion.text}
                        </Typography>
                      </div>
                    </motion.button>
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
              <motion.div 
                className="flex justify-start"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="bg-white/80 dark:bg-gray-900/50 backdrop-blur-sm border border-gray-200 dark:border-gray-800 rounded-2xl px-4 py-3 shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      <motion.div 
                        className="w-2 h-2 bg-gradient-to-r from-[#a679f0] to-[#5599fe] rounded-full"
                        animate={{ y: [-4, 0, -4] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                      />
                      <motion.div 
                        className="w-2 h-2 bg-gradient-to-r from-[#5599fe] to-[#48df7b] rounded-full"
                        animate={{ y: [-4, 0, -4] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }}
                      />
                      <motion.div 
                        className="w-2 h-2 bg-gradient-to-r from-[#48df7b] to-[#a679f0] rounded-full"
                        animate={{ y: [-4, 0, -4] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }}
                      />
                    </div>
                    <Typography variant="caption" className="bg-gradient-to-r from-[#5599fe] to-[#a679f0] bg-clip-text text-transparent font-medium">
                      Agent is thinking...
                    </Typography>
                  </div>
                </div>
              </motion.div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <Disclaimer />

      <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
        <div className="max-w-4xl mx-auto">
          {fileError && (
            <Alert className="mb-3 border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20">
              <FiAlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              <AlertDescription className="text-orange-800 dark:text-orange-200">
                {fileError}
              </AlertDescription>
            </Alert>
          )}
          
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