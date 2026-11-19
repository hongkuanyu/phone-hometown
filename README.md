# 听不全的故乡

一段约 5—8 分钟的浏览器互动叙事。一个不会说常州话的年轻人，在母亲不断切换的方言里靠近她的日常、记忆与过去，却始终只能听懂一部分。

线上地址：<https://hongkuanyu.github.io/phone-hometown/>

## 本地运行

```bash
npm install
npm run dev
```

生产构建与预览：

```bash
npm run build
npm run preview
```

## 当前体验

- `intro → call → stove → transition → cooling → ending → about` 完整状态机。
- 电话 5 句、灶台 6 句、纳凉 6 句，包含重听、追问、点击文字查看词义、让句子过去和跟读。
- Canvas 玻璃文字场：真实字形 alpha mask、稳定种子的不规则 Voronoi 碎片、分级裂纹扩散、冲击闪光、悬停漂移和冷白碎片复原；碎片数量按整段文字场预算控制，移动端与 reduced-motion 进一步降级。
- 母亲主句与补充解释的破碎进度直接绑定当前录音的媒体位置：0%—10% 受力与首裂纹、10%—30% 裂纹扩展、30%—55% 笔画断裂、55%—85% 主要分离、85%—100% 减速停稳。暂停、恢复、倍速、重听和词条切换均沿用同一媒体时钟；`src/config/glassTiming.ts` 仅保留给转场、结尾和录音缺失时的演示降级。
- 开发模式提供可折叠的时间轴检查面板；有真实录音时可检查 0%/25%/50%/75%/100%，演示降级时可检查固定毫秒节点。生产构建中不会显示。
- 碎片预算：桌面普通章节 180 片、纳凉 200 片；移动端普通章节 96 片、纳凉 108 片；reduced-motion 再降至桌面 96 片、移动端 54 片。位移分为近距（0.05—0.15F）、中距（0.25—0.60F）与远距（0.65—1.10F）三组。
- 母亲录音优先通过 AudioBufferSourceNode 播放，并以 AudioContext 时间、启动锚点和当前倍速计算媒体位置；不支持 Web Audio 时自动改用 HTMLAudioElement.currentTime 作为同一套破碎主时钟。实时音量只影响局部震动、边缘亮度和短促反馈，不决定主破碎阶段。
- Web Audio 实时生成电话底噪、灶台火声/水声、夏夜虫鸣与扇子声。
- 字形、碎片拓扑与裂纹边界按词条缓存；首屏空闲时预热首句，当前词播放时预处理下一词。恢复用冷白片段在空闲帧分批生成，避免进入词条时集中重建。
- 播放设置支持暂停/继续、当前章节重启、`0.85× / 1× / 1.15×` 速度、环境声与母亲声音独立音量。
- 首次进入电话与纳凉时各出现一次短暂引导；正文文字场提供固定的可点击词义区域，可与“看这句话”打开同一个抽屉。词义抽屉支持键盘焦点、Esc 关闭，并把焦点还给实际触发控件。
- 复原来源相互独立：查看/解释只聚合红色碎片，节奏替代使用暖灰碎片，只有实际检测到观众声音时才生成冷白碎片。真实录音自动进入当前标签页声音档案；节奏替代和权限授权本身不计入录音数量。
- 跟读只分析音量、起音、持续时间和节奏，不做语音识别、评分或发音判断。
- 麦克风被拒绝或 `MediaRecorder` 不可用时自动切换为触摸/空格节奏模式，不阻断故事。
- 声音档案只存在于当前标签页内存中，刷新或关闭标签页即清除。
- 支持 `prefers-reduced-motion`、键盘和触摸操作、移动端安全区及 320px 起窄屏布局；已覆盖 Chromium、Firefox 和 WebKit，以及 320、375、390、430、768、1024、1440、1920px 视口。

## 内容与素材结构

```text
src/
  App.tsx                    场景状态机、播放与会话状态
  content/terms.ts           17 个词条与全部转写/解释内容
  content/scenes.ts          章节、首屏、结尾与作品说明文案
  config/glassTiming.ts      玻璃破碎分段时间、声音起音阈值与章节速度
  audio/NarrativeAudio.ts    真实录音播放、Web Audio 环境声与声音降级
  hooks/useMicRecorder.ts    麦克风跟读、音量/节奏分析与临时录音
  components/SoundTextCanvas.tsx
  components/StoryScene.tsx
  components/AboutScene.tsx
public/audio/mother/          17 条家庭录音的主句与解释分段
.github/workflows/deploy.yml GitHub Pages 部署工作流
```

当前已接入项目提供的 17 条家庭录音。每条原始录音按中间停顿拆成主句与补充解释两段，处理为单声道 AAC，并通过 `audioSrc` / `supplementAudioSrc` 接入词条；环境声仍由 Web Audio 实时生成。

## 录音素材

项目现有 17 条母亲录音，对应 `call-01` 至 `cooling-06`。原始文件每条都包含“主句 + 停顿 + 补充解释”，构建仓库中使用的是已分段、单声道、96 kbps AAC 的网页版本：

- `public/audio/mother/<id>-main.m4a`：进入词条时播放的主句。
- `public/audio/mother/<id>-supplement.m4a`：点击“请母亲解释”时播放的补充解释。
- `public/audio/mother/manifest.json`：原始时长、分段点与输出音频时长记录。

词条通过 `src/content/terms.ts` 中的 `audioSrc` 与 `supplementAudioSrc` 引用录音。素材说明与替换规则见 `public/audio/README.md`。

真实录音只应使用本人明确授权、允许公开的本地文件。录音中若有自然改口，方言转写应同时由家庭成员最终确认，展示内容不应把任何写法视为常州话标准答案。

词条的素材状态保留在 `transcriptStatus` 中，不显示在普通观众界面。
## 麦克风与隐私

- 页面加载和 intro 不申请麦克风。
- 只有按住“跟读”时才调用 `getUserMedia`。
- 录音不发送到网络、不写入 `localStorage` / IndexedDB、不持久化。
- 权限被拒绝后不会反复请求，跟读会切换为不录音的节奏替代模式。
- 录音片段只存在于当前标签页的内存中，刷新后清除。

## GitHub Pages

`vite.config.ts` 根据 GitHub Actions 提供的 `GITHUB_REPOSITORY` 自动设置仓库路径。部署工作流位于 `.github/workflows/deploy.yml`，推送到 `main` 后自动触发。

发布流程：

```bash
git add .
git commit -m "feat: refine phone hometown interactive narrative"
git push
```

GitHub 仓库 **Settings → Pages → Build and deployment** 的 Source 应为 **GitHub Actions**。

预计地址：

```text
https://hongkuanyu.github.io/phone-hometown/
```