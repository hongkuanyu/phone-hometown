# 她在电话里回到故乡

一段约 5—8 分钟的浏览器互动叙事。一个不会说常州话的年轻人，在母亲不断切换的方言里靠近她的日常、记忆与过去，却始终只能听懂一部分。

## 本地运行

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
npm run preview
```

## 已实现的体验

- `intro → call → stove → transition → cooling → ending → about` 完整状态机。
- Canvas 声音文字场：聚合、松动、碎裂、部分复原，并保留轻微错位。
- Web Audio API 生成电话底噪、灶台、夏夜虫鸣等占位环境声。
- 可选普通话提示与独立词义抽屉，默认关闭。
- 纳凉章节的“按住跟读”：仅分析音量、起音和节奏，不做识别、评分或上传。
- 麦克风拒绝、`MediaRecorder` 不可用或无音频素材时，自动进入节奏替代模式，不阻断故事。
- 页面不可见时暂停音频分析与 Canvas 动画；支持键盘焦点与 `prefers-reduced-motion`。
- 声音档案只保存在当前标签页内存中，刷新即清除。

## 主要文件

```text
src/
  App.tsx                    场景状态机与会话状态
  data/story.ts              章节、词条、文案和可选录音路径
  data/theme.ts              颜色令牌
  audio/NarrativeAudio.ts    Web Audio 环境声与声音降级
  hooks/useMicRecorder.ts    麦克风跟读、音量/节奏分析与临时录音
  components/SoundTextCanvas.tsx
  components/StoryScene.tsx
  components/AboutScene.tsx
public/audio/                 可替换的真实音频素材目录
.github/workflows/deploy.yml GitHub Pages 部署工作流
```

## 替换真实录音和方言词条

素材说明见 `public/audio/README.md`。配置集中在 `src/data/story.ts`，每个词条包含：

- `familyText`：家庭转写
- `spokenText`：用于占位语音或真实录音对应的朗读文本
- `pronunciation`：近似读音
- `mandarinHint`：普通话提示
- `context`：生活场景说明
- `audioSrc`：可选的真实本地录音路径

当前所有方言写法均为叙事占位，不是“常州话标准答案”。正式发布前应由家庭成员确认录音、转写和授权。

## 麦克风与隐私

- 页面加载和 intro 不申请麦克风。
- 只有按住“跟读”时才调用 `getUserMedia`。
- 录音不发送到网络、不写入 `localStorage` / IndexedDB、不持久化。
- 权限被拒绝后不会反复请求，按住跟读会切换为不录音的节奏替代模式。
- 录音片段只存在于当前标签页的内存中，刷新后自动清除。

## GitHub Pages 部署

`vite.config.ts` 会在 GitHub Actions 中读取 `GITHUB_REPOSITORY`，自动把 `base` 设置为仓库名路径。工作流位于 `.github/workflows/deploy.yml`。

首次部署步骤：

```bash
git init
git add .
git commit -m "feat: build interactive dialect audio narrative"
git branch -M main
git remote add origin https://github.com/<用户名>/phone-hometown.git
git push -u origin main
```

然后在 GitHub 仓库的 **Settings → Pages → Build and deployment** 中将 Source 设为 **GitHub Actions**。工作流成功后，预计地址为：

```text
https://<用户名>.github.io/phone-hometown/
```

如果仓库名不同，`vite.config.ts` 会随 GitHub Actions 的仓库名自动适配，无需手动修改。