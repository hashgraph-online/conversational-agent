import React from 'react'
import ReactDOM from 'react-dom/client'

const TestApp = () => {
  React.useEffect(() => {
  }, [])
  
  return (
    <div style={{ padding: '20px', background: '#f0f0f0', minHeight: '100vh' }}>
      <h1>React Test App</h1>
      <p>If you can see this, React is working!</p>
      <p>Window.electron: {window.electron ? 'Available' : 'Not Available'}</p>
      <button onClick={() => alert('Button clicked!')}>Test Button</button>
    </div>
  )
}

const root = document.getElementById('root')

if (root) {
  ReactDOM.createRoot(root).render(<TestApp />)
} else {
}