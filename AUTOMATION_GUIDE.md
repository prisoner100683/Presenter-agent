# Automation GUI

这个项目新增了一个本地半自动 GUI，用来把 `pptx` 文件送入模型流程并输出静态网页。

## 启动

在项目根目录运行：

```bash
npm run automation:start
```

启动后会自动打开本地地址：

```text
http://127.0.0.1:3210
```

## 使用方式

1. 在“模型配置”里填写：
   - 昵称
   - Base URL
   - 模型名
   - API Key
2. 点击“保存配置”。
3. 在“生成任务”里选择一个 `.pptx` 文件。
4. 可选填写项目名、场景、受众、风格、技术栈。
5. 点击“开始生成”。
6. 生成完成后，界面会展示本地预览链接。

## 输出位置

- 原始上传文件：`docs/source/`
- 归档输出：`output/archive/{project}/vN/site/`
- 版本说明：`versions/{project}/vN/notes.md`
- 本地模型配置：`.local/automation/profiles.json`

## 当前限制

- 当前自动化提取流程仅支持 `.pptx`
- `.ppt` 老格式尚未接入解析
- 如果模型返回内容无法解析，系统会自动生成一个本地 fallback 静态站点，保证流程可结束

## 实现说明

- GUI：原生 HTML/CSS/JS
- 本地服务：Node.js 原生 `http`
- PPTX 解包：PowerShell `Expand-Archive`
- 模型接口：OpenAI-compatible `chat/completions`
