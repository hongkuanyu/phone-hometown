# 声音素材目录

当前版本已接入项目提供的 17 条母亲录音，覆盖电话、灶台和纳凉三个章节。

## 网页交付文件

```text
public/audio/mother/
  call-01-main.m4a ... cooling-06-main.m4a
  call-01-supplement.m4a ... cooling-06-supplement.m4a
  manifest.json
```

- 原始录音每条包含“主句 + 约 3 秒停顿 + 补充解释”。
- 网页版通过静音区间检测把每条录音拆成主句与补充解释两段。
- 输出为单声道 AAC、44.1 kHz、96 kbps，并做轻度高低通、响度统一与首尾淡入淡出。
- `manifest.json` 保留原始时长、分段点和最终片段时长，修改素材时可用于复核。
- 原始 320 kbps 文件没有提交到仓库，避免线上包体积不必要地增大。

## 词条对应

在 `src/content/terms.ts` 中，每个词条使用两个字段：

```ts
audioSrc: 'audio/mother/call-01-main.m4a'
supplementAudioSrc: 'audio/mother/call-01-supplement.m4a'
```

路径相对于站点 `base`，因此本地开发和 GitHub Pages 子路径部署都可直接使用。

## 素材替换规则

1. 只使用本人明确授权、允许公开展示的录音。
2. 一个文件对应一个词条；主句与补充解释应保持清楚的分段。
3. 建议保留 15–30 厘米录音距离，并在每条前后留出安静。
4. 替换后重新检测静音区间、更新分段文件与 `manifest.json`，再检查移动端加载时间。
5. 方言转写应同时由家庭成员最终确认，展示内容不应把任何写法视为标准答案。

## 隐私

不要提交未经授权的亲属录音、真实电话号码、住址或私人对话。目录 `public/audio/private/` 与 `public/audio/local/` 已被 `.gitignore` 排除。