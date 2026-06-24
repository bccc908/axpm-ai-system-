# MT5 ↔ Signal Flag 黄金信号

把 **Signal Flag** 生成的 XAUUSD 信号接到 **MetaTrader 5**：自动画进场/止损/目标水平线，可选弹窗提醒，进阶可挂单（默认关闭）。

---

## 架构

```
Signal Flag (Mac/服务器)
  POST 生成信号 → data/gold-signals.json
  GET  /api/gold-signals/mt5  ← MT5 EA 或 Python 轮询
         ↑
    Authorization: Bearer LOCAL_API_KEY
         ↓
MetaTrader 5 (Windows / Mac MT5 客户端)
  GoldSignalBridge.mq5 画线 + 提醒
```

---

## 前置条件

1. Signal Flag 已运行：`npm run system`
2. `.env.local` 已配置：
   ```bash
   LOCAL_API_KEY=你的长随机密钥
   TELEGRAM_BOT_TOKEN=...   # 可选，手机收信号
   TELEGRAM_CHAT_ID=...
   ```
3. 至少生成过 **一条** 黄金信号（仪表盘 → 生成黄金信号）
4. MT5 已登录券商，图表品种为 **XAUUSD**（或券商的 `GOLD` / `XAUUSDm`）

---

## 方式 A：MQL5 EA（推荐）

适合在 MT5 图表上 **自动画线**。

### 1. 安装 EA

1. 复制 `mt5-addon/GoldSignalBridge.mq5` 到 MT5 数据目录：
   - MT5 → **文件 → 打开数据文件夹 → MQL5 → Experts**
2. 在 **MetaEditor** 中打开该文件，按 **编译**（F7）
3. 在导航器 **Experts** 里找到 `GoldSignalBridge`，拖到 **XAUUSD** 图表上

### 2. 允许 WebRequest（必做）

MT5 → **工具 → 选项 → 专家顾问**：

- 勾选 **允许算法交易**
- 勾选 **允许 WebRequest**
- 在 URL 列表添加（按你的 Signal Flag 地址）：
  ```
  http://127.0.0.1:3000
  ```
  若 Signal Flag 在局域网另一台电脑：
  ```
  http://192.168.x.x:3000
  ```

### 3. EA 参数

| 参数 | 说明 |
|------|------|
| `InpApiUrl` | `http://127.0.0.1:3000/api/gold-signals/mt5` |
| `InpApiKey` | 与 `.env.local` 里 `LOCAL_API_KEY` **相同** |
| `InpPollSec` | 轮询间隔（秒），默认 30 |
| `InpDrawLines` | 画 ENTRY / STOP / TP 水平线 |
| `InpShowAlert` | 新信号弹窗 |
| `InpAutoTrade` | **默认 false** — 自动下单，仅模拟盘测试后再开 |
| `InpLots` | 自动下单手数 |

### 4. 验证 API

在 MT5 所在电脑终端测试（把密钥换成你的）：

```bash
curl -H "Authorization: Bearer 你的LOCAL_API_KEY" \
  http://127.0.0.1:3000/api/gold-signals/mt5
```

应返回 `alert` JSON，含 `levels`、`stop`、`targets`、`signal_id`。

---

## 方式 B：Python + MetaTrader5 库

适合 **用 Python 下单**（需 MT5 终端同机运行）。

```bash
pip install MetaTrader5
cd "axpm- ai-system"
export LOCAL_API_KEY=你的密钥
export SIGNAL_FLAG_URL=http://127.0.0.1:3000/api/gold-signals/mt5
export MT5_SYMBOL=XAUUSD

# 只打印价位
python mt5-addon/gold_signal_bridge.py

# 自动下单（务必先用模拟盘）
export MT5_MODE=trade
export MT5_LOTS=0.01
python mt5-addon/gold_signal_bridge.py
```

---

## 方式 C：Telegram + 手动

不连 MT5 API，手机收 Telegram 后在 MT5 手动画线。与 ATAS 流程相同。

---

## Mac 用户说明

- **Signal Flag** 可在 Mac 上跑（`npm run system`）
- **MT5** 有 Mac 版，但 EA 需在 MT5 里编译运行
- 若 Mac 与 Windows 分机：Signal Flag 在 Mac，`InpApiUrl` 填 Mac 的局域网 IP；MT5 在 Windows 虚拟机亦可

---

## API 字段（给 EA / 脚本）

`GET /api/gold-signals/mt5`

| 字段 | 用途 |
|------|------|
| `signal_id` | 去重，避免重复画线/下单 |
| `bias` | long / short / neutral / wait |
| `entry_zone` | `{ low, high }` 进场区 |
| `stop` | 止损价 |
| `targets` | 止盈数组 |
| `levels` | 画线用 `{ price, label, kind }[]` |
| `magic_number` | 建议魔术号 |
| `suggested_lots` | 参考手数（非强制） |

---

## 安全提示

- **不要**把 `LOCAL_API_KEY` 提交到 Git
- **自动交易默认关闭**；实盘前请在 **模拟账户** 验证
- 本系统信号仅供研究，**非投资建议**

---

## 故障排查

| 现象 | 处理 |
|------|------|
| HTTP 401 | `InpApiKey` 与 `.env.local` 不一致 |
| WebRequest -1 | 未在 MT5 允许 URL |
| 无新线 | 先生成新信号；`signal_id` 未变不会重复画 |
| 品种不对 | 改图表品种或 `MT5_SYMBOL` 为券商黄金代码 |
