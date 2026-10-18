import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './app.jsx'
import { prewarmServer } from './api'
import './index.css'

// Wake the backend as soon as ANY page opens: Render's free server sleeps after
// 15 idle minutes and needs 30-60 s to start, so starting early makes the first
// login/page load much faster.
prewarmServer()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
