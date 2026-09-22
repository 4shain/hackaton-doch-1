import '@fontsource/rubik/400.css'
import '@fontsource/rubik/500.css'
import '@fontsource/rubik/600.css'
import '@fontsource/rubik/700.css'
import '@fontsource/rubik/800.css'

import createCache from '@emotion/cache'
import { CacheProvider } from '@emotion/react'
import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider } from '@mui/material/styles'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { prefixer } from 'stylis'
import rtlPlugin from 'stylis-plugin-rtl'
import App from './App'
import { AuthProvider } from './auth'
import { theme } from './theme'

// Global RTL: document direction is set in index.html; this cache flips all emotion styles,
// including portal-rendered dialogs, menus and tooltips.
const rtlCache = createCache({ key: 'muirtl', stylisPlugins: [prefixer, rtlPlugin] })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CacheProvider value={rtlCache}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </CacheProvider>
  </StrictMode>,
)
