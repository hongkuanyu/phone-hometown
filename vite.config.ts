import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { siteConfig } from './src/config/site.js'

const repository = process.env.GITHUB_REPOSITORY?.split('/')[1]

function siteMetaPlugin() {
  return {
    name: 'phone-hometown-site-meta',
    transformIndexHtml(html: string) {
      return html
        .replaceAll('%SITE_TITLE%', siteConfig.title)
        .replaceAll('%SITE_DESCRIPTION%', siteConfig.description)
        .replaceAll('%SITE_AUTHOR%', siteConfig.credits.author ?? '')
        .replaceAll('%SITE_URL%', siteConfig.siteUrl)
        .replaceAll('%SITE_IMAGE%', siteConfig.shareImageUrl)
        .replaceAll('%SITE_IMAGE_WIDTH%', String(siteConfig.shareImageWidth))
        .replaceAll('%SITE_IMAGE_HEIGHT%', String(siteConfig.shareImageHeight))
    },
  }
}

// GitHub Actions supplies GITHUB_REPOSITORY, so project Pages use the repo name.
export default defineConfig({
  plugins: [react(), siteMetaPlugin()],
  base: repository ? `/${repository}/` : '/',
})