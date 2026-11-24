import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Content-Security-Policy for the built site (GitHub Pages can't send headers, so it
// goes in a <meta> tag). Only applied to production builds — the dev server injects
// inline scripts for hot reload.
//  • scripts/frames: only our own files      • styles: own + Google Fonts (+ inline style attrs)
//  • connect: any https/wss/http/ws host, because the game-server address is configurable
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self' https: wss: http: ws:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const cspPlugin = {
  name: 'gg-csp',
  apply: 'build',
  transformIndexHtml: html => html.replace(
    '<meta charset="UTF-8" />',
    `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />\n    <meta name="referrer" content="strict-origin-when-cross-origin" />`,
  ),
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cspPlugin],
  base: '/Gathering-games/',
})
