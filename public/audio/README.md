# 声音素材目录

当前版本没有随仓库附带真实人声录音。页面使用 Web Audio API 生成环境声和声音占位，并在浏览器支持时叠加本地中文语音合成，方便先完成整段交互。

## 替换为家庭确认的录音

1. 只放入已获得本人授权的录音，建议使用 `.mp3`、`.m4a` 或 `.wav`。
2. 建议命名：
   - `call-01.mp3`
   - `stove-01.mp3`
   - `cooling-01.mp3`
   - `kitchen-ambience.mp3`
   - `night-ambience.mp3`
3. 打开 `src/data/story.ts`，在对应词条的 `audioSrc` 填入相对路径，例如：
   `audioSrc: 'audio/call-01.mp3'`
4. 如要替换章节环境声，可给 `StoryChapter` 增加 `ambientSrc` 并在 `App.tsx` 中传给 `setAmbient`。真实素材应保持低音量、长循环且不抢人声。
5. 方言转写请由家庭成员确认后替换，不要把占位文字当作标准答案。

## 隐私

不要提交个人临时录音、未经授权的亲属录音、真实电话号码或用户隐私数据。目录 `public/audio/private/` 与 `public/audio/local/` 已被 `.gitignore` 排除。