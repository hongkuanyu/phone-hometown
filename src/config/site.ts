export interface SiteCredits {
  author: string | null
  school: string | null
  instructor: string | null
  copyright: string | null
}

export const siteConfig = {
  title: '听不全的故乡',
  titleLines: ['听不全的', '故乡'],
  description:
    '母亲说话时，文字逐渐形成裂纹、碎开。重听和追问让它们重新聚合；观众的声音只能补回其中一部分，无法替母亲把话说完。',
  durationLabel: '约 4—8 分钟 · 声音会先抵达',
  siteUrl: 'https://hongkuanyu.github.io/phone-hometown/',
  shareImageUrl:
    'https://hongkuanyu.github.io/phone-hometown/share/og-title.png',
  shareImageWidth: 1200,
  shareImageHeight: 630,
  workType: '浏览器互动叙事',
  materials: '17 条家庭录音；环境声由 Web Audio 实时生成。',
  credits: {
    author: null,
    school: null,
    instructor: null,
    copyright: null,
  } satisfies SiteCredits,
} as const