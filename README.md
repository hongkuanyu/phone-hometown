# 她在电话里回到故乡

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
- 电话 5 句、灶台 6 句、纳凉 6 句，包含重听、追问、查看意思、跳过、装作听懂与跟读。
- Canvas 玻璃文字场：真实字形 alpha mask、稳定种子的不规则 Voronoi 碎片、分级裂纹扩散、冲击闪光、悬停漂移和冷白碎片复原；桌面 24—48 片、移动端 12—24 片，reduced-motion 进一步降级。
- 玻璃破碎节奏集中在 `src/config/glassTiming.ts`：电话约 650ms、灶台约 760ms、纳凉约 580ms、结尾约 1050ms。
- Web Audio 实时生成电话底噪、灶台火声/水声、夏夜虫鸣与扇子声。
- 播放设置支持暂停/继续、当前章节重启、`0.85× / 1× / 1.15×` 速度、环境声与母亲声音独立音量。
- 词义抽屉在桌面端为右侧面板，移动端为底部抽屉；支持焦点进入、Esc 关闭与焦点返回。
- 跟读只分析音量、起音、持续时间和节奏，不做语音识别、评分或发音判断。
- 麦克风被拒绝或 `MediaRecorder` 不可用时自动切换为触摸/空格节奏模式，不阻断故事。
- 声音档案只存在于当前标签页内存中，刷新或关闭标签页即清除。
- 支持 `prefers-reduced-motion`、键盘操作、移动端安全区和 320px 起窄屏布局。

## 内容与素材结构

```text
src/
  App.tsx                    场景状态机、播放与会话状态
  content/terms.ts           17 个词条与全部转写/解释内容
  content/scenes.ts          章节、首屏、结尾与作品说明文案
  config/glassTiming.ts      玻璃破碎分段时间、声音起音阈值与章节速度
  audio/NarrativeAudio.ts    Web Audio 环境声与声音降级
  hooks/useMicRecorder.ts    麦克风跟读、音量/节奏分析与临时录音
  components/SoundTextCanvas.tsx
  components/StoryScene.tsx
  components/AboutScene.tsx
public/audio/                 可替换的授权音频素材目录
.github/workflows/deploy.yml GitHub Pages 部署工作流
```

当前没有真实亲属录音。母亲声音由浏览器中文语音合成叠加 Web Audio 占位声纹构成，环境声全部由 Web Audio 生成；它们不会被描述为真实母亲录音。

## 替换真实录音

素材说明见 `public/audio/README.md`。在 `src/content/terms.ts` 对应词条中补充：

```ts
audioSrc: 'audio/call-01.mp3'
```

路径相对于站点 `base`。真实录音应只使用本人明确授权、允许公开的本地文件。方言转写应同时由家庭成员确认，展示内容不应把任何写法视为常州话标准答案。

词条的素材确认状态保留在数据字段 `transcriptStatus` 中，不显示在普通观众界面。

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