# Trust Score Service

## 功能
- MySQL 存储：`user_trust_scores / verification_logs / safe_link_creations / share_health_rate / sync_state`
- 链到库：监听 `IssuerBatchSBT` 的 `BatchClaimed` 事件，自动累计 `sbt_count`
- 库到链：当 `trust_level` 发生变化时，将等级存证哈希写入 `UserScoreRegistry.setScore(user, uint256)`
- 评分与调度：按 40/30/20/10 权重计算四维度分数，`node-cron` 每 24h 全量更新
- 企业验证 API：验证 `secure-verify-v1` 链接并写入 `verification_logs`，异常/篡改触发扣分

## 启动
1. 准备 MySQL 数据库 `trust_archive`
2. 在本目录创建 `.env` 并补齐参数（Windows 下可直接复制 `.env.example`）
   - `copy .env.example .env`
3. 安装依赖并迁移表结构
   - `npm install`
   - `npm run migrate`
4. 启动服务
   - `npm start`

默认监听端口：`8787`

## 常见启动报错
- `Access denied for user 'root'@'localhost' (using password: NO)`：说明你没有配置 `MYSQL_PASSWORD`（服务默认空密码）。请在 `.env` 填上 MySQL 密码，或改用允许空密码的本地账号。

## 环境变量说明（关键）
- `MYSQL_*`：数据库连接
- `CHAIN_RPC_URL`：JSON-RPC
- `ISSUER_BATCH_ADDRESS`：`IssuerBatchSBT` 合约地址
- `CREDENTIAL_CENTER_ADDRESS`：`CredentialCenter` 合约地址（传统 SBT）
- `USER_SCORE_REGISTRY_ADDRESS`：`UserScoreRegistry` 合约地址
- `SCORE_REGISTRY_OWNER_PRIVATE_KEY`：`UserScoreRegistry` owner 的私钥（用于写链，可选；不填则跳过链上存证）
- `SYNC_FROM_BLOCK`：可选，首次同步从指定区块开始
- `CREDENTIAL_SYNC_FROM_BLOCK`：可选，传统 SBT 首次同步从指定区块开始
- `PINATA_GATEWAY`：可选，用于读取 IPFS JSON（不填则走 `gateway.pinata.cloud`）

## API
- `GET /api/trust-score/:address`
  - 推荐前端调用：`/api/trust-score/:address?sync=1&refresh=1`（同步事件 + 以链上 balanceOf 纠偏 sbt_count + 立刻重算）
- `POST /api/connect/apply`
- `POST /api/connect/review`
- `POST /api/connect/requirements`
- `PUT /api/connect/requirements/:id`
- `DELETE /api/connect/requirements/:id`
- `POST /api/connect/requirements/batch-delete`
- `GET /api/connect/manage/requirements`
- `GET /api/connect/manage/applications?requirement_id=...`
- `POST /api/connect/verify/sbt`
- `GET /api/share/meta/:share_id`
- `POST /api/v1/verify/sbt`（Header：`x-api-key`）
- `GET /api/share/view/:share_id`
- `POST /api/share/safe-link/created`
  - body: `{ userAddress, cid, expiresAt }`
- `POST /api/verify/safe-link`
  - body: `{ cid }`（推荐：后端会根据 `safe_link_creations` 反查持有人地址，保持企业侧“匿名验证”）
  - body: `{ userAddress, cid }`（可选：强制指定评分归属地址）
- `GET /api/verify/safe-link/status/:cid`
  - 返回该链接是否已被验证（successCount > 0）以及是否过期

## TrustConnect 环境变量
- `TRUSTCONNECT_API_KEY`：`/api/v1/verify/sbt` 的鉴权 key
- `TRUSTCONNECT_AES_KEY_B64`：32 字节 AES key（base64），用于加解密 `secret_contact_encrypted`
