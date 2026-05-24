import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, errorInfo) {
    console.error('Zero 1 Bags — Erro fatal capturado:', error, errorInfo)
  }
  render() {
    if (this.state.hasError) {
      return React.createElement('div', {
        style: {
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Inter, sans-serif',
          background: '#FCFAF9',
          color: '#29141B',
          padding: '2rem',
          textAlign: 'center'
        }
      },
        React.createElement('h1', { style: { fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' } }, '⚠️ Erro ao carregar o sistema'),
        React.createElement('p', { style: { fontSize: '0.9rem', color: '#735A64', marginBottom: '1.5rem', maxWidth: '400px' } },
          'Ocorreu um erro inesperado. Tente recarregar a página.'),
        React.createElement('p', { style: { fontSize: '0.75rem', color: '#8E727C', marginBottom: '1rem', maxWidth: '400px', wordBreak: 'break-word' } },
          String(this.state.error)),
        React.createElement('button', {
          onClick: () => window.location.reload(),
          style: {
            background: '#D12D6C',
            color: '#fff',
            border: 'none',
            borderRadius: '0.5rem',
            padding: '0.75rem 2rem',
            fontSize: '0.9rem',
            fontWeight: 'bold',
            cursor: 'pointer'
          }
        }, 'Recarregar')
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

