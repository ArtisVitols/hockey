import { defineConfig } from 'vite'

export default defineConfig({
  // relative asset paths so the build works at any URL (GitHub Pages serves
  // project sites from /<repo-name>/)
  base: './',
  server: {
    port: 5173,
  },
  build: {
    target: 'es2022',
  },
})
