import { siteConfig } from '../config/site'
import type { StoryChapter } from '../types'
import { callTerms, coolingTerms, stoveTerms } from './terms'

export const prologueCopy = {
  sentences: [
    '母亲是常州人。',
    '天气降温后，她打来电话，问你那边冷不冷。',
  ],
  action: '继续',
  soundHint: '继续后开启环境声',
  skip: '跳过前情',
}

export const introCopy = {
  title: siteConfig.title,
  subtitle: '声音会先抵达，意思可以迟到。',
  identity: '你在常州长大，却没有真正学会母亲说的常州话。',
  listening: '耳机体验更佳',
  answer: '接听',
  about: '作品与声音',
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
  chapterNote: '锅盖边冒着白气，抹布搭在灶台边，火调得很小。',
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
  chapterNote: '井水洒过，竹榻还带着白天的热气。收音机的声音从巷口轻轻传进来。',
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
  lead: '她还在和亲戚说话。',
  echo: '坐我边上',
  afterword: '你听见几个词，又把它们放回声音里。',
  action: '看看留下了什么',
}

export const aboutCopy = {
  title: siteConfig.title,
  concept: '一通没有挂断的电话，和一组来自家庭的真实录音。',
  creation:
    '母亲说话时，文字形成裂纹、碎开。你可以重听、追问，或留下自己的声音；但只能补回其中一部分。',
  transcript:
    '家庭转写依据录音脚本与家庭记忆整理，用词和语序保留地方表达。录音中若有自然改口，文字仍以家庭成员最终确认的版本为准。',
  motherArchive:
    '主句和补充解释都来自母亲本人同意公开的家庭录音，并保留原始声音。',
  collection:
    '母亲声音来自项目提供的 17 条家庭录音。主句与补充解释已从原始录音中分段，环境声由 Web Audio API 实时生成。',
  authorization:
    '真实声音只使用本人明确同意公开的录音。当前录音仅用于本作品展示；未经同意的亲属录音、电话号码与私人对话不应进入仓库或线上页面。',
  permission:
    '麦克风只在按住“留下声音”时申请。不识别、不评分、不上传；片段只存在当前页面，刷新或关闭后消失。',
  technology:
    'React + TypeScript + Canvas + Web Audio API + MediaRecorder。母亲录音以单声道 AAC 接入；没有后端、第三方音频服务、语音识别、评分或账号系统。',
  aria: '作品与声音',
}
