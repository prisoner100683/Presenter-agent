# Awesome Website Presenter Agent

一个将 `.pptx` 自动转换为静态演示网站的本地工具。

当前推荐用法是：启动本地 GUI，配置模型，上传 PPTX，生成网站。

## 适用范围

- 当前已验证可用：`.pptx`
- 输出结果：本地静态网站
- 生成模式：
  - `model`：模型生成成功
  - `fallback`：模型输出不可用时，程序自动生成兜底站点

## 环境要求

- Windows
- Node.js 18+
- 可用的 OpenAI-compatible 接口

已验证的一组模型配置：

- Base URL: `https://api.deepseek.com/v1`
- Model: `deepseek-chat`

## 启动程序

在项目根目录运行：

```powershell
cmd /c npm run automation:start
```

启动后会打开本地页面：

```text
http://127.0.0.1:3210
```

如果你的 PowerShell 允许直接执行 npm，也可以用：

```powershell
npm run automation:start
```

## 使用步骤

### 1. 配置模型

在 GUI 中填写并保存：

- `Nickname`：自定义名称
- `Base URL`
- `Model`
- `API Key`

保存后，配置会写入：

- [`.local/automation/profiles.json`](C:/CodeInVS/awesome-website-presenter-agent/.local/automation/profiles.json)

### 2. 选择 PPTX

在生成区域选择一个 `.pptx` 文件。

可选填写：

- `Project Name`
- `Scenario`
- `Audience`
- `Style`
- `Stack`

### 3. 开始生成

点击生成按钮后，程序会自动执行：

1. 保存源文件到 `docs/source/`
2. 解压并提取 PPTX 内容
3. 调用模型生成演示网站
4. 将结果写入版本目录

### 4. 查看结果

生成完成后，会得到一个版本目录，例如：

- [output/archive/caches-updating-and-coherence/v11/site/index.html](C:/CodeInVS/awesome-website-presenter-agent/output/archive/caches-updating-and-coherence/v11/site/index.html)

版本说明位于：

- [versions/caches-updating-and-coherence/v11/notes.md](C:/CodeInVS/awesome-website-presenter-agent/versions/caches-updating-and-coherence/v11/notes.md)

## 输出目录

- [docs/source](C:/CodeInVS/awesome-website-presenter-agent/docs/source)
  - 保存上传过的源 PPTX
- [output/archive](C:/CodeInVS/awesome-website-presenter-agent/output/archive)
  - 保存每次生成的网站结果
- [versions](C:/CodeInVS/awesome-website-presenter-agent/versions)
  - 保存版本级说明
- [`.local/automation`](C:/CodeInVS/awesome-website-presenter-agent/.local/automation)
  - 保存本地模型配置

## 常用命令

语法检查：

```powershell
cmd /c npm run automation:check
```

本地回归测试：

```powershell
cmd /c npm run automation:test
```

## 如何判断是否成功

看生成结果中的 `notes.md` 或版本记录：

- 若显示 `Mode: model`，说明模型生成成功
- 若显示 `Mode: fallback`，说明程序使用了本地兜底站点

## 当前限制

- 当前自动提取流程只支持 `.pptx`
- 接口需兼容 `chat/completions`
- 模型返回内容过大或格式异常时，可能会回退到 `fallback`

## 已验证结果

本项目已完成一次真实成功生成：

- [v11 站点](C:/CodeInVS/awesome-website-presenter-agent/output/archive/caches-updating-and-coherence/v11/site/index.html)

对应状态：

- `Mode: model`

## 相关文档

- [AUTOMATION_GUIDE.md](C:/CodeInVS/awesome-website-presenter-agent/AUTOMATION_GUIDE.md)
- [SESSION_PROGRESS.md](C:/CodeInVS/awesome-website-presenter-agent/SESSION_PROGRESS.md)
