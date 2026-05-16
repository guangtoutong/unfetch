import { defineConfig } from 'astro/config'

export default defineConfig({
  site: 'https://unfetch.org',
  output: 'static',
  vite: { server: { port: 4321 } },
})
