import React from 'react'
import ReactDOM from 'react-dom/client'

const TestApp = () => {
  React.useEffect(() => {
    console.log('React Test App mounted!')
  }, [])
  
  return (
    <div style={{ padding: '20px', background: '#f0f0f0', minHeight: '100vh' }}>
      <h1>React Test App</h1>
      <p>If you can see this, React is working!</p>
      <p>Window.electronTest: {window.electronTest ? 'Available' : 'Not Available'}</p>
      <button onClick={() => alert('Button clicked!')}>Test Button</button>
    </div>
  )
}

console.log('Test script loading...')
const root = document.getElementById('root')
console.log('Root element:', root)

if (root) {
  ReactDOM.createRoot(root).render(<TestApp />)
  console.log('React render called')
} else {
  console.error('No root element found!')
}