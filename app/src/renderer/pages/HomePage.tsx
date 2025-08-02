import React from 'react'
import { useNavigate } from 'react-router-dom'
import Typography from '../components/ui/Typography'
import { Button } from '../components/ui/Button'
import { 
  FiMessageSquare, 
  FiServer, 
  FiPackage, 
  FiArrowRight
} from 'react-icons/fi'
import { cn } from '../lib/utils'

interface HomePageProps {}

interface FeatureCard {
  icon: React.ElementType
  title: string
  description: string
  color: 'purple' | 'blue' | 'green'
  link: string
}

const HomePage: React.FC<HomePageProps> = () => {
  const navigate = useNavigate()

  const features: FeatureCard[] = [
    {
      icon: FiMessageSquare,
      title: 'Chat',
      description: 'Talk to the conversational agent',
      color: 'purple',
      link: '/chat'
    },
    {
      icon: FiServer,
      title: 'MCP Servers',
      description: 'Configure Model Context Protocol servers',
      color: 'blue',
      link: '/mcp'
    },
    {
      icon: FiPackage,
      title: 'Plugins',
      description: 'Install and manage agent plugins',
      color: 'green',
      link: '/plugins'
    }
  ]

  return (
    <div className="component-group animate-fade-in">
      <div className="stack-md">
        <Typography variant="h2" gradient className="font-bold">
          Conversational Agent
        </Typography>
        <Typography variant="subtitle1" color="muted">
          Local interface for @conversational-agent
        </Typography>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 grid-container-lg">
        {features.map((feature, index) => {
          const Icon = feature.icon
          const colorClasses = {
            purple: 'from-[#a679f0]/20 to-[#a679f0]/10 group-hover:from-[#a679f0]/30 group-hover:to-[#a679f0]/20',
            blue: 'from-[#5599fe]/20 to-[#5599fe]/10 group-hover:from-[#5599fe]/30 group-hover:to-[#5599fe]/20',
            green: 'from-[#48df7b]/20 to-[#48df7b]/10 group-hover:from-[#48df7b]/30 group-hover:to-[#48df7b]/20'
          }
          
          return (
            <button
              key={index}
              onClick={() => navigate(feature.link)}
              className="group bg-white dark:bg-gray-900 rounded-2xl card border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-all duration-200 text-left hover:shadow-lg card-hover"
            >
              <div className={cn(
                "w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center mb-4 transition-all duration-200",
                colorClasses[feature.color]
              )}>
                <Icon className="w-6 h-6 text-gray-700 dark:text-white" />
              </div>
              <div className="mb-2">
                <Typography variant="h5" className="font-semibold">
                  {feature.title}
                </Typography>
              </div>
              <div className="mb-4">
                <Typography variant="body2" color="muted">
                  {feature.description}
                </Typography>
              </div>
              <div className="flex items-center gap-2 text-[#5599fe] dark:text-[#5599fe]">
                <span className="text-sm font-medium">Open</span>
                <FiArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default HomePage