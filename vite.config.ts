import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const repository = process.env.GITHUB_REPOSITORY?.split('/')[1]

// GitHub Actions supplies GITHUB_REPOSITORY, so project Pages use the repo name.
export default defineConfig({
  plugins: [react()],
  base: repository ? `/${repository}/` : '/',
})