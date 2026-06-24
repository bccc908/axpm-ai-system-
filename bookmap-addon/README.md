# Bookmap ↔ Signal Flag 黄金信号

在 Bookmap 热力图交易时，从 Signal Flag 拉取最新 XAUUSD 分析信号。

## Signal Flag 端

1. 打开 **黄金信号**：`/dashboard/gold-signals`
2. 点 **生成黄金信号** 得到方向、价位、Bookmap 读法
3. 在 `.env.local` 设置 `LOCAL_API_KEY`（任意强密码）
4. API：`GET /api/gold-signals/bookmap`  
   Header：`Authorization: Bearer <LOCAL_API_KEY>`

## Bookmap 端

1. [Bookmap Python API](https://bookmap.com/knowledgebase/docs/Addons-Python-API)（Bookmap 7.4+）
2. 配置环境变量：
   - `SIGNAL_FLAG_URL=http://你的服务器:3000/api/gold-signals/bookmap`
   - `LOCAL_API_KEY=与上面相同`
3. 运行 `gold_signal_bridge.py`（或在 Bookmap 插件里加载）

```bash
export SIGNAL_FLAG_URL=http://localhost:3000/api/gold-signals/bookmap
export LOCAL_API_KEY=your-key
python bookmap-addon/gold_signal_bridge.py
```

新信号会在终端打印；可在脚本 `TODO` 处接入 Bookmap 图表提醒。

## 说明

- 金价参考 COMEX `GC=F`（Yahoo），可选手动备注
- **非投资建议** — 请先模拟盘验证
- Bookmap L1 API 在 Bookmap 进程内运行，不能直接访问 localhost 时，把 Signal Flag 部署到 Bookmap 能访问的地址（如同局域网 IP 或 Tailscale）
