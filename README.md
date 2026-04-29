# claude-sustain

[![CI](https://github.com/BryantChi/claude-sustain/actions/workflows/ci.yml/badge.svg)](https://github.com/BryantChi/claude-sustain/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> 給 Claude Code 用的 Token 節省規則 + Skill 路由 + 自動提醒 + 記憶子系統 + 跨平台 AGENTS.md 產生器。讓 AI 用得久、用得省、用得好。

## 為什麼做這個

長期跟 AI 配合寫程式，會發現自己一直在重複交代同一件事：「不要讀整個檔案」「subagent 要寫字數上限」「重複改用 perl 不要一個個編輯」⋯這些規則寫進 CLAUDE.md 會被忽略，貼在每次對話又煩。

更深的問題是：

- **Token 越燒越多**：context 一長就爆，但 AI 永遠記不住「該節省」這件事。
- **跨 session 沒記憶**：今天教過明天又問。
- **跨工具沒辦法重用**：Claude Code 的設定搬到 Codex CLI 又要重弄。
- **沒法量化**：「規則有沒有省到 token？」答不出來。

`claude-sustain` 是為了解決這四件事做的 plugin。

## 它做什麼

**規則層**（`rules/spec.json` 是唯一真相）

- 鐵律 3+1：使用者意圖優先 / Subagent 字數上限 + escape clause / 重複編輯改用 perl + git diff / 規劃 N 個相似 task 先模板化
- R1–R5 細則：檔案讀取、搜尋、subagent、回應、通用規則 ~25 條
- 階段結束 6 問自檢

**強制層**（hooks 自動提醒）

- `SessionStart` 注入規則 primer + 偵測 memory backend + 過濾 skill routing
- `UserPromptSubmit` 偵測「逐個 / 仔細 / 全部 / thoroughly」等鐵律 1 觸發詞
- `PreToolUse` 攔截 Task subagent 沒寫字數上限的呼叫
- `Stop` 印階段六問 + token 統計 + 寫 telemetry log

**記憶層**（多 backend 抽象）

- 自動偵測 [MemPalace](https://github.com/mempalace/mempalace)（MIT，主選）和 [claude-mem](https://github.com/thedotmack/claude-mem)（AGPL-3.0，次選，只透過 MCP 引用永不靜態連結）
- 都沒裝 → 自動降級到結構化的檔案系統 fallback（仿 mempalace 的 wings/rooms/drawers，未來可無痛轉移）
- 三個對應 skill：`memory-write-router` / `memory-search-bridge` / `audit-memory`

**觀測層**

- 每次 Stop 寫一筆到 `~/.claude/sustain/telemetry/<日期>.jsonl`
- `/sustain:status` 顯示當下 + 7 日移動平均
- `token-budget-coach` skill 解讀數字、建議 `/compact` / 切 subagent / 換模型

**自我修護**

- `/sustain:audit` 掃 memory（>90 天沒動的 / slug 太相近的重複 / 抽出 URL 給你檢查）+ skill routing（spec 列了沒裝的 / 裝了沒列的）
- 永遠只報告，不自動刪
- Skill routing 在每次 SessionStart 會**動態過濾**：只顯示當前機器真的有裝的 entries，避免使用者看到一份兌現不了的菜單

**跨平台**

- 同一份 `spec.json` 產出 `CLAUDE.md` / `AGENTS.md` / `GEMINI.md`
- `/sustain:export` 寫進任何專案目錄
- 本 repo 的 `AGENTS.md` symlink 到 `CLAUDE.md`，讓 Codex CLI / Gemini CLI 等吃 AGENTS.md 的工具直接能讀

## 安裝

```text
/plugin marketplace add BryantChi/claude-sustain
/plugin install claude-sustain@claude-sustain
```

完整重啟 Claude Code（`/clear` 不夠 — 要 CLI 退出再重開）。新 session 應該看到：

- `[claude-sustain v0.6.0] active — 4 Iron Rules + 6-question phase check + N/M skill routes · memory: <backend>` 一行
- 鐵律 + 過濾過的 routing 表 + 偵測到的 memory backend（在 Claude 的 context 裡）
- 每次 Stop 顯示六問 checklist + token 行

從本機 clone 安裝：

```text
/plugin marketplace add /path/to/claude-sustain
/plugin install claude-sustain@claude-sustain
```

## 指令

| 指令 | 用途 |
| --- | --- |
| `/sustain:status` | 看當前規則、routing 涵蓋、memory backend、session token、7 日移動平均、建議下一步 |
| `/sustain:audit` | Memory + routing 健診。只報告、永不自動刪 |
| `/sustain:export` | 把 `CLAUDE.md` / `AGENTS.md` / `GEMINI.md` 寫進指定目錄 |
| `/sustain:update-rules` | 從 GitHub 拉最新 spec、diff 給你看、寫進 `~/.claude/sustain/overrides.json`（永不動 plugin 目錄） |

## Skills

| Skill | 觸發場景 |
| --- | --- |
| `token-rules-primer` | 重新建立鐵律 + R1–R5 的記憶 |
| `phase-self-check` | 走完 6 問 checklist |
| `memory-write-router` | 決定要不要存、存哪 |
| `memory-search-bridge` | 「以前怎麼做的」回想 |
| `token-budget-coach` | 解讀 token 統計、建議下一步 |
| `audit-memory` | 走完 audit 報告的可行動項目 |

## 設定

### 個人化規則覆蓋

編輯 `~/.claude/sustain/overrides.json`（你自己建立，plugin 永遠不會動它）。內容是 `spec.json` 的子集，依 id 對齊合併：改一條規則不用重列整張表。

範例 — 客製化 R1.3 的描述：

```jsonc
{
  "details": {
    "R1": {
      "rules": [
        { "id": "R1.3", "text": "檔案 > 500 行：只讀相關段落，別整檔。" }
      ]
    }
  }
}
```

升級 plugin（`/plugin update` 或 `/sustain:update-rules`）時，bundled 規則會更新但你的 overrides 不會被蓋掉。

### Iron-2 hard-gate（v0.6+）

預設 v0.5 warn-only 行為不變。要把 Iron-2 升級成擋下來的硬閘，建立 `~/.claude/sustain/strict.json`：

```jsonc
{
  "ironGate": true,
  "bypassPatterns": ["#bypass-iron2"]
}
```

開啟後，`Task` prompt 缺字數上限或 escape clause 會直接被 Claude Code 擋掉（`permissionDecision=deny`）。`bypassPatterns` 給內部信任模板留逃生口。

範例設定：[`examples/strict.json`](examples/strict.json) — 已預先列出 oh-my-claudecode / superpowers Explore agent 等常見模板的 pattern。

> ⚠️ **與 oh-my-claudecode 共存**：先保持 `ironGate: false` 跑 1 週收 telemetry，看哪些 OMC dispatch 被警告，再把它們加進 `bypassPatterns`，**最後**才開硬閘。直接開會把 OMC 大半功能擋掉。

### Stop 通知 webhook（v0.6+）

長 session 跑完想被推訊息？建立 `~/.claude/sustain/notify.json`：

```jsonc
{
  "webhook": "https://hooks.slack.com/services/XXX/YYY/ZZZ",
  "format": "slack",
  "threshold": { "tokenTotal": 100000, "durationMs": 600000 },
  "minIntervalMs": 60000
}
```

`format` 支援 `slack` / `discord` / `telegram` / `raw`。網路失敗或 timeout 永遠不會擋住 `Stop`。

範例設定：[`examples/notify.json`](examples/notify.json)。

### 環境變數

| 變數 | 用途 |
| --- | --- |
| `CLAUDE_SUSTAIN_FORCE_BACKEND` | `mempalace` / `claude-mem` / `fs` — 跳過自動偵測 |
| `CLAUDE_SUSTAIN_MEMPALACE_PATH` | MemPalace 安裝在非標準路徑時用 |
| `CLAUDE_SUSTAIN_CLAUDE_MEM_PATH` | claude-mem 安裝在非標準路徑時用 |
| `CLAUDE_SUSTAIN_CONFIG_DIR` | 覆蓋 `strict.json` / `notify.json` 的目錄（預設 `~/.claude/sustain/`，主要給測試用）|

## 文件

- [docs/architecture.md](docs/architecture.md) — 三層架構、每個 hook 的 data flow、模組依賴圖
- [docs/configuration.md](docs/configuration.md) — overrides.json schema、檔案位置、更新與解除安裝流程
- [docs/extending.md](docs/extending.md) — 怎麼加 skill / hook / memory backend / audit 檢查
- [CHANGELOG.md](CHANGELOG.md) — 完整版本歷史

## License 與依賴

`claude-sustain` 是 **MIT**。

可選整合兩個 memory backend，但**程式碼從不直接 import 任何一邊**：

- **MemPalace（MIT）** — 主選，透過 MCP 工具引用
- **claude-mem（AGPL-3.0）** — 次選，**只**透過 MCP 工具引用，plugin 程式碼不靜態連結，避免 AGPL 感染

## 與其他 plugin 共存

### oh-my-claudecode (OMC)
互補，沒 hard conflict。OMC 補 sustain 沒做的執行模式 + 平行化；sustain 補 OMC 沒做的跨平台規則 + audit + 通知。

**設定步驟**：
1. 安裝 OMC：`/plugin marketplace add https://github.com/Yeachan-Heo/oh-my-claudecode` → `/plugin install oh-my-claudecode`
2. 完整重啟 Claude Code
3. sustain `strict.json` 保持 `ironGate: false` 跑 1 週
4. 看 telemetry 哪些 OMC 模板被警告 → 加進 `bypassPatterns`（[examples/strict.json](examples/strict.json) 已預列常見 pattern）
5. 之後再開硬閘

### superpowers
sustain 的 routing 表大量指向 superpowers skill，主動建議搭配安裝。沒有衝突。

### claude-mem / mempalace
sustain 自動偵測，作為 memory backend 之一。mempalace 優先（MIT），claude-mem 透過 MCP 引用（不靜態連結，避免 AGPL）。

## 為什麼叫 sustain

大多數規則系統壞兩種：要嘛太兇（agent 跟你打架，省的 token 還沒違規多），要嘛沒人管（中段就忘）。`sustain` 想要的是中間地帶：

- 一小撮硬規則（鐵律）
- Hooks 在事情失控前先提醒
- Memory 跨 session 留得住
- Telemetry 告訴你規則有沒有真的省到

## 專案狀態

v0.6.0 — 在 v0.5 的「規則 + memory + telemetry + audit」之上加了三件事：模型路由提示（lookup 類 Task 自動建議 `model: "haiku"`）、Iron-2 hard-gate（opt-in，預設不變）、Stop 通知 webhook（Slack / Discord / Telegram / raw）。下一階段（v2.0）會加 OTLP-based telemetry、A/B 對照框架（規則開/關比較）、dashboard。

## 反饋

issue / PR 歡迎丟到 [GitHub](https://github.com/BryantChi/claude-sustain/issues)。

## License

MIT。詳見 [`LICENSE`](LICENSE)。

## Acknowledgements

- [superpowers](https://github.com/obra/superpowers) — plugin 結構與 hook 約定
- [claude-mem](https://github.com/thedotmack/claude-mem) — memory backend 之一（AGPL-3.0；只透過 MCP 引用）
- [MemPalace](https://github.com/mempalace/mempalace) — 另一個 memory backend（MIT）
- [AGENTS.md 標準](https://agents.md/) — 跨平台規則檔案約定
