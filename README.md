# 游戏王卡片判例助手

一个浏览器原型，用来搜索游戏王卡片、收集相关卡片文本，并生成可复制到 DeepSeek 网页端的判例分析 Prompt。

## 使用

直接打开 `index.html` 即可使用在线搜索。

如果想本地化搜索，先同步百鸽全量卡库：

```bash
chmod +x scripts/sync-cards.sh
./scripts/sync-cards.sh
```

然后用本地静态服务器打开：

```bash
python3 -m http.server 5173
```

访问 `http://localhost:5173`。页面会自动读取 `data/cards.json`，之后搜索会走本地卡库。

页面里的“更新卡池”会直接从百鸽下载最新 `cards.zip`，在浏览器中解压并缓存到 IndexedDB。更新成功后，搜索会优先使用浏览器缓存的最新卡池。这个操作不会改写项目里的 `data/cards.json`。

如果想把最新卡池持久写入项目文件，继续使用脚本：

```bash
bash scripts/sync-cards.sh
```

选择卡片后，可以点击“获取 YGO 脚本”。程序会按卡片密码查找 `c{id}.lua`，优先读取 Project Ignis 的 official 脚本，其次尝试 pre-release 脚本，并缓存到浏览器本地。

如果不想自己写完整问题，可以先选“判例场景模板”。模板会自动填入典型问题、场景结构，并尽量自动选择相关卡片；之后再点“获取 YGO 脚本”和“生成 Prompt”。

## 手机使用

页面已经支持 PWA，可以在手机浏览器里添加到主屏幕，当作轻量 App 使用。

无线调试连接后，可以把电脑的本地服务映射到手机：

```bash
adb connect 192.168.1.3:39689
adb reverse tcp:5173 tcp:5173
adb shell am start -a android.intent.action.VIEW -d http://127.0.0.1:5173/
```

生成 Prompt 后，手机面板可以绑定 AI 应用并一键“复制并打开 AI”。当前内置包名：

- DeepSeek：`com.deepseek.chat`
- ChatGPT：`com.openai.chatgpt`
- 通义：`com.aliyun.tongyi`
- Gemini：`com.google.android.apps.bard`

如果你的 AI 应用不在列表里，选择“自定义”，填 Android 包名和打开地址即可。

## 数据来源

- 在线搜索：`https://ygocdb.com/api/v0/?search=关键词`
- 本地卡库：`https://ygocdb.com/api/v0/cards.zip`
- YGO/EDOPro Lua 脚本：`https://github.com/ProjectIgnis/CardScripts`

百鸽 API v0 文档标注为不稳定接口，后续如果字段变化，需要调整 `app.js` 里的 `normalizeCard`。

YGO/EDOPro 脚本可以帮助判断模拟器实际如何处理发动条件、分类、连锁与效果处理，但它不是官方裁定本身。复杂判例仍建议结合官方数据库、FAQ、事务局回答或赛事政策核对。
