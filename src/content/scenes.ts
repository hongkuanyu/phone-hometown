import { siteConfig } from '../config/site'
import type { StoryChapter } from '../types'
import { callTerms, coolingTerms, stoveTerms } from './terms'

export const prologueCopy = {
  sentences: [
    '母亲在常州。',
    '天气降温后，她打来电话，问你那边冷不冷。',
    '你在外地，没有正式学过常州话。',
    '她说的很多话，你只能靠语气和几个熟悉的词去猜。',
  ],
  action: '继续',
  soundHint: '继续后开启环境声',
  skip: '跳过前情',
}

export const introCopy = {
  title: siteConfig.title,
  subtitle: '一个不会说常州话的年轻人，\n试图听懂母亲电话里的声音。',
  listening: '建议佩戴耳机',
  privacy: '麦克风仅在主动跟读时启用，录音不会上传。',
  answer: '接听',
  about: '作品与声音说明',
}

export const callChapter: StoryChapter = {
  scene: 'call',
  eyebrow: '现在',
  stage: '电话那头',
  ambient: 'phone',
  opening: '电话刚接通。她还站在厨房里，碗柜的门没有关严。',
  chapterNote: '她一边收拾厨房，一边把话头递给电话这头。',
  nextScene: 'stove',
  nextLabel: '去灶台看看',
  terms: callTerms,
}

export const stoveChapter: StoryChapter = {
  scene: 'stove',
  eyebrow: '记忆里',
  stage: '灶台',
  ambient: 'kitchen',
  opening: '灶火声从电话底噪里浮起来。你开始想起一只旧砂锅。',
  chapterNote: '灶火、油声和电话底噪叠在一起。她说的每句话都像从很远的地方端过来。',
  nextScene: 'transition',
  nextLabel: '让风吹过去',
  terms: stoveTerms,
}

export const coolingChapter: StoryChapter = {
  scene: 'cooling',
  eyebrow: '再早一点',
  stage: '纳凉',
  ambient: 'night',
  opening: '虫鸣和扇子声围过来。夏夜比刚才更长。',
  chapterNote: '你可以跟读，也可以什么都不做。声音会替你留下不完整的一笔。',
  nextScene: 'ending',
  nextLabel: '回到电话',
  terms: coolingTerms,
}

export const chapters = {
  call: callChapter,
  stove: stoveChapter,
  cooling: coolingChapter,
} satisfies Record<StoryChapter['scene'], StoryChapter>

export const getChapter = (scene: StoryChapter['scene']): StoryChapter => chapters[scene]

export const endingCopy = {
  title: '电话还没有挂断。',
  lead: '她还在和亲戚说话。你听见几个词，又把它们放回声音里。',
  echo: '听见几个词',
  action: '看看留下了什么',
  unrecovered: '没有追问的字，仍然散在底噪里。',
  followed: '跟读留下的冷白笔画，没有把任何一句话变完整。',
  rhythmFollowed: '节奏补回的暖灰笔画，没有把任何一句话变完整。',
  semanticFollowed: '你看过一些解释，裂纹仍在原处。',
  unparticipated: '你没有把声音留下。她的话也仍然停在电话里。',
  context: '看过解释的地方，留下了更长的回声。',
}

export const aboutCopy = {
  title: siteConfig.title,
  concept:
    '母亲说话时，文字形成裂纹、碎开；你能补回一部分，却无法替她把话说完。',
  creation:
    '母亲说话时，文字逐渐形成裂纹、碎开。重听和追问让它们重新聚合；观众的声音只能补回其中一部分，无法替母亲把话说完。',
  transcript:
    '家庭转写依据录音脚本与家庭记忆整理，用词和语序保留地方表达。录音中若有自然改口，文字仍以家庭成员最终确认的版本为准。',
  collection:
    '母亲声音来自项目提供的 17 条家庭录音。主句与补充解释已从原始录音中分段，环境声由 Web Audio API 实时生成。',
  authorization:
    '真实声音只使用本人明确同意公开的录音。当前录音仅用于本作品展示；未经同意的亲属录音、电话号码与私人对话不应进入仓库或线上页面。',
  permission:
    '麦克风只在主动按住跟读时申请。页面不上传、不持久化录音；片段只存在于当前标签页内存中。跟读只分析音量、起音、持续时间和节奏，不做语音识别或发音判断。',
  technology:
    'React + TypeScript + Canvas + Web Audio API + MediaRecorder。母亲录音以单声道 AAC 接入；没有后端、第三方音频服务、语音识别、评分或账号系统。',
  aria: '作品信息与声音档案',
}
