# ATAS ↔ Signal Flag 黄金信号

用 **ATAS** 看黄金集群图 / 足迹图，用 **Signal Flag** 生成方向与价位。

## 你需要什么

| 项目 | 说明 |
|------|------|
| **ATAS** | [atas.net](https://atas.net) 下载，**Windows** 版（Mac 需虚拟机或远程 Windows） |
| **券商行情** | 在 ATAS 里连接你的期货/外汇数据源（Rithmic、CQG 等，看券商） |
| **Signal Flag** | 本项目的「黄金信号」页面 |
| **Telegram（推荐）** | 手机收信号，不用写代码 |

---

## 方式 A：Telegram（最简单）

1. `.env.local` 配置：
   ```bash
   TELEGRAM_BOT_TOKEN=你的bot
   TELEGRAM_CHAT_ID=你的chat_id
   LOCAL_API_KEY=任意强密码
   ```
2. 重启：`npm run system`
3. 打开 `/dashboard/gold-signals` → **生成黄金信号**
4. 手机 Telegram 收到：方向、进场、止损、目标、ATAS 读法
5. 在 ATAS 里对照画线交易

---

## 方式 B：侧栏脚本（Windows，与 ATAS 同机）

适合 ATAS 开着、旁边开个终端看价位。

1. Signal Flag 已设 `LOCAL_API_KEY` 并生成过至少一条信号
2. **在 Windows** 打开 PowerShell：

```powershell
cd "路径\axpm- ai-system"
$env:SIGNAL_FLAG_URL="http://localhost:3000/api/gold-signals/atas"
$env:LOCAL_API_KEY="你的密钥"
python atas-addon\gold_signal_bridge.py
```

3. 新信号会打印 **levels**（进场/止损/目标），在 ATAS 用水平线工具标上
4. 若 Signal Flag 在别的电脑：`SIGNAL_FLAG_URL=http://192.168.x.x:3000/api/gold-signals/atas`

---

## 方式 C：ATAS 自定义指标（进阶）

ATAS 支持 **C# 指标**（需 Visual Studio + ATAS.Indicators.dll）：

- [官方文档](https://docs.atas.net/)
- [指标开发说明](https://help.atas.net/en/support/solutions/articles/72000649737-creating-custom-indicators-and-trading-bots-in-atas)

可自行写指标轮询 `GET /api/gold-signals/atas`，在图表画 `levels` 数组里的价位。  
技术支持需自行查文档 / 开发者 Telegram 群。

---

## ATAS 图表建议

1. 品种：**XAUUSD** 或 **GC**（黄金期货）
2. 图表：集群图 + 足迹图
3. 对照信号里的 **ATAS 读法**：Delta、POC、大单吸收
4. 用 **水平线** 标 entry / stop / TP

---

## API 格式

`GET /api/gold-signals/atas`  
`Authorization: Bearer <LOCAL_API_KEY>`

返回 `alert.levels` 数组，每项 `{ price, label, kind }`，便于画线或做指标。

---

**非投资建议** — 请先模拟盘验证。
