# 声音素材目录

当前公开版本没有附带真实亲属录音。页面使用 Web Audio API 生成环境声和声音占位，并在浏览器支持时叠加本地中文语音合成。

## 替换为家庭确认的录音

1. 只放入已获得本人授权、允许公开展示的录音。
2. 建议使用 `.mp3`、`.m4a` 或 `.wav`，命名与词条 ID 对应：
   - `call-01.mp3` … `call-05.mp3`
   - `stove-01.mp3` … `stove-06.mp3`
   - `cooling-01.mp3` … `cooling-06.mp3`
3. 打开 `src/content/terms.ts`，给对应词条增加：
   `audioSrc: 'audio/call-01.mp3'`
4. 真实录音应保持清晰、单声道或兼容立体声，并避免过强压缩。不要依赖左右声道区分含义。
5. 如替换章节环境声，可在 `StoryChapter` 增加 `ambientSrc`，并在 `App.tsx` 的 `setAmbient` 调用中传入。
6. 方言转写需由家庭成员确认后再更新 `familyText`、`pronunciation`、`mandarinHint`、`context` 与 `supplement`。

## 隐私

不要提交个人临时录音、未经授权的亲属录音、真实电话号码或用户隐私数据。目录 `public/audio/private/` 与 `public/audio/local/` 已被 `.gitignore` 排除。