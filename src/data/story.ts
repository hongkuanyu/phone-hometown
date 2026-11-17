import type { StoryChapter, StoryTerm } from '../types'

/**
 * All dialect transcriptions below are narrative placeholders.
 * They are intentionally marked for family confirmation instead of claiming
 * to be a standard Changzhou dialect reference.
 */
export const placeholderNotice =
  '方言写法为叙事占位，并非常州话标准答案；上线前请换成家庭确认的录音与转写。'

export const introCopy = {
  title: '她在电话里回到故乡',
  subtitle: '一个不会说常州话的年轻人，\n试图听懂母亲电话里的声音。',
  listening: '建议佩戴耳机',
  privacy: '麦克风仅在主动跟读时启用，录音不会上传。',
  answer: '接听',
  skip: '跳过说明，直接接听',
  about: '作品与声音说明',
}

export const callChapter: StoryChapter = {
  scene: 'call',
  eyebrow: '现在',
  stage: '电话那头',
  ambient: 'phone',
  chapterNote: '她一边收拾厨房，一边把话头递给电话这头。',
  nextScene: 'stove',
  nextLabel: '去灶台看看',
  terms: [
    {
      id: 'call-01',
      scene: 'call',
      speaker: '母亲',
      beat: '来电',
      display: '夜饭吃过了伐',
      familyText: '囡囡，夜饭吃过了伐？',
      spokenText: '囡囡，夜饭吃过了伐？',
      pronunciation: '近似音：nan nan，ya fan qih guo le va（待家庭确认）',
      mandarinHint: '她先问你，吃过晚饭没有。',
      context: '电话刚接通，厨房里的水声还没有停。',
      voiceRate: 0.92,
    },
    {
      id: 'call-02',
      scene: 'call',
      speaker: '母亲',
      beat: '天气',
      display: '常州冷下来了',
      familyText: '常州这两日冷下来了。',
      spokenText: '常州这两日冷下来了。',
      pronunciation: '近似音：chang zhou liang ni leng xia lai le（待家庭确认）',
      mandarinHint: '她说常州降温了，也想知道你那边冷不冷。',
      context: '她没有把“多穿点”说完，只把天气预报重复了一遍。',
      voiceRate: 0.9,
    },
    {
      id: 'call-03',
      scene: 'call',
      speaker: '母亲',
      beat: '叮咛',
      display: '衣裳带够伐',
      familyText: '你那边衣裳带够伐？',
      spokenText: '你那边衣裳带够伐？',
      pronunciation: '近似音：ni na bian yi zang dai geu va（待家庭确认）',
      mandarinHint: '她问你的衣服够不够，语气像随口一提。',
      context: '她总把关心藏进日常问题里，等你先回答。',
      voiceRate: 0.9,
    },
  ],
}

export const stoveChapter: StoryChapter = {
  scene: 'stove',
  eyebrow: '记忆里',
  stage: '灶台',
  ambient: 'kitchen',
  chapterNote: '灶火、油声和电话底噪叠在一起。她说的每句话都像从很远的地方端过来。',
  nextScene: 'transition',
  nextLabel: '让风吹过去',
  terms: [
    {
      id: 'stove-01',
      scene: 'stove',
      speaker: '母亲',
      beat: '汤',
      display: '灶上炖着腌笃鲜',
      familyText: '灶头上炖着腌笃鲜。',
      spokenText: '灶头上炖着腌笃鲜。',
      pronunciation: '近似音：zao tou lang dun zhe yan du xian（待家庭确认）',
      mandarinHint: '她说灶上炖着汤，让你别急着挂电话。',
      context: '锅盖被水汽顶得轻轻响，她把火调小了一点。',
      voiceRate: 0.86,
    },
    {
      id: 'stove-02',
      scene: 'stove',
      speaker: '母亲',
      beat: '火候',
      display: '小火慢慢笃',
      familyText: '小火慢慢笃，笃到汤发白。',
      spokenText: '小火慢慢笃，笃到汤发白。',
      pronunciation: '近似音：xiao hou man man du（待家庭确认）',
      mandarinHint: '她说要用小火慢慢煨，汤色才会变白。',
      context: '“笃”是锅里的声音，也是她愿意为一顿饭等下去的时间。',
      voiceRate: 0.82,
    },
    {
      id: 'stove-03',
      scene: 'stove',
      speaker: '母亲',
      beat: '等待',
      display: '等你回来吃饭',
      familyText: '筷儿摆摆好，等你回来吃饭。',
      spokenText: '筷儿摆摆好，等你回来吃饭。',
      pronunciation: '近似音：kuai er ba ba hao，deng ni wei lai qih fan（待家庭确认）',
      mandarinHint: '她摆好了筷子，还是默认你会回来吃饭。',
      context: '碗筷碰到桌面的声音很轻，像一句没有追问的等待。',
      voiceRate: 0.84,
    },
  ],
}

export const coolingChapter: StoryChapter = {
  scene: 'cooling',
  eyebrow: '再早一点',
  stage: '纳凉',
  ambient: 'night',
  chapterNote: '虫鸣和扇子声围过来。你可以跟读，也可以什么都不做。',
  nextScene: 'ending',
  nextLabel: '回到电话',
  terms: [
    {
      id: 'cooling-01',
      scene: 'cooling',
      speaker: '母亲',
      beat: '竹榻',
      display: '竹榻搬出来乘风凉',
      familyText: '竹榻搬出来乘风凉。',
      spokenText: '竹榻搬出来乘风凉。',
      pronunciation: '近似音：zoh ta ban chu lai cheng fong liang（待家庭确认）',
      mandarinHint: '她说把竹榻搬到外面，坐着吹夜风。',
      context: '竹片被身体压出细小的响声，暑气从窗边退开一点。',
      voiceRate: 0.8,
    },
    {
      id: 'cooling-02',
      scene: 'cooling',
      speaker: '母亲',
      beat: '蒲扇',
      display: '蒲扇拍一拍',
      familyText: '蒲扇拍一拍，蚊子赶赶。',
      spokenText: '蒲扇拍一拍，蚊子赶赶。',
      pronunciation: '近似音：pu suo pa yih pa（待家庭确认）',
      mandarinHint: '她一边扇风，一边替你赶蚊子。',
      context: '扇面拍在空气里，声音比风先到。',
      voiceRate: 0.8,
    },
    {
      id: 'cooling-03',
      scene: 'cooling',
      speaker: '母亲',
      beat: '身边',
      display: '坐我边上',
      familyText: '你小辰光，总归坐我边上。',
      spokenText: '你小辰光，总归坐我边上。',
      pronunciation: '近似音：ni xiao chen guang，zong gui zuo ngo bian lang（待家庭确认）',
      mandarinHint: '她说你小时候总是坐在她旁边。',
      context: '这句话没有要你回答，她只是把位置留了出来。',
      voiceRate: 0.76,
    },
  ],
}

export const chapters = {
  call: callChapter,
  stove: stoveChapter,
  cooling: coolingChapter,
} satisfies Record<StoryChapter['scene'], StoryChapter>

export const getChapter = (scene: StoryChapter['scene']): StoryChapter => chapters[scene]

export const getAllTerms = (): StoryTerm[] => [
  ...callChapter.terms,
  ...stoveChapter.terms,
  ...coolingChapter.terms,
]

export const endingCopy = {
  title: '电话还没有挂断。',
  lead: '她还在和亲戚说话。你听见几个词，又把它们放回声音里。',
  action: '走进声音档案',
}

export const aboutCopy = {
  title: '你留下的声音',
  lead: '这里只保留当前标签页里的片段。刷新后，它们会一起消失。',
  empty: '这次没有留下录音。沉默也是完整的。',
  creation:
    '这是一段关于方言、亲情与“听懂一点”的作品。声音先于解释，遗漏也是叙事的一部分。',
  transcript:
    '所有方言词条都是可替换的家庭转写占位，不构成常州话标准答案。真实版本应由家庭成员确认后替换。',
  permission:
    '麦克风只在按住跟读时申请。页面不上传、不持久化录音；片段只存在于当前标签页的内存中。',
  technology:
    'React + TypeScript + Canvas + Web Audio API。没有后端、语音识别、发音评分或第三方音频服务。',
}