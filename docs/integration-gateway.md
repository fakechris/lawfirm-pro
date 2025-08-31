# API Gateway & Framework - 集成层开发

## 概述

API网关和框架为Law Firm Pro提供了统一的集成接口，支持与外部服务的安全、可靠的通信。该实现包括：

- **API网关架构** - 中央集成网关，提供认证和授权
- **断路器模式** - 外部服务调用的故障容错机制
- **速率限制系统** - API配额管理和节流
- **配置管理** - 安全凭证存储和管理
- **请求/响应日志** - 全面的监控和审计

## 核心组件

### 1. 集成网关服务 (IntegrationGatewayService)

主要功能：
- 认证和授权
- 速率限制
- 断路器管理
- 请求执行和响应处理

**位置**: `src/services/integration/gateway.ts`

### 2. 断路器模式 (CircuitBreaker)

提供故障容错机制：
- 自动故障检测
- 状态管理（关闭/打开/半开）
- 重试机制
- 手动控制

**位置**: `src/services/integration/circuitBreaker.ts`

### 3. 速率限制器 (RateLimiter)

API配额管理：
- 基于时间窗口的限流
- 用户级别的限流
- 自动过期清理
- 统计信息

**位置**: `src/services/integration/rateLimiter.ts`

### 4. 配置管理器 (ConfigManager)

安全凭证管理：
- 配置验证
- 加密/解密
- API密钥轮换
- 服务配置管理

**位置**: `src/services/integration/configManager.ts`

### 5. 集成日志器 (IntegrationLogger)

监控和审计：
- 请求/响应日志
- 安全事件记录
- 性能指标
- 敏感数据掩码

**位置**: `src/services/integration/logger.ts`

## API端点

### 公开端点

```
GET /api/integration/health - 健康检查
GET /api/integration/services - 服务状态
GET /api/integration/config - 配置信息
```

### 服务代理端点

```
ALL /api/integration/service/:service/* - 通用服务代理
ALL /api/integration/pacer/* - PACER集成
ALL /api/integration/courts/* - 法院系统集成
ALL /api/integration/payments/* - 支付处理
ALL /api/integration/research/* - 法律研究
ALL /api/integration/documents/* - 文档管理
ALL /api/integration/communication/* - 通信服务
```

### 管理端点

```
GET /api/integration/admin/circuit-breakers - 断路器状态
POST /api/integration/admin/circuit-breakers/:service/reset - 重置断路器
POST /api/integration/admin/circuit-breakers/:service/open - 强制打开断路器
POST /api/integration/admin/circuit-breakers/:service/close - 强制关闭断路器

GET /api/integration/admin/config/services - 服务配置
POST /api/integration/admin/config/services/:service/validate - 验证配置

GET /api/integration/admin/rate-limits - 速率限制状态
POST /api/integration/admin/rate-limits/:service/reset - 重置速率限制

GET /api/integration/admin/logs - 日志查询
GET /api/integration/admin/metrics - 性能指标
```

## 使用示例

### 1. 基本请求

```javascript
const apiKey = 'your-api-key';
const response = await fetch('/api/integration/pacer/cases/123', {
  headers: {
    'X-API-Key': apiKey,
    'Content-Type': 'application/json'
  }
});
```

### 2. 断路器管理

```javascript
// 重置特定服务的断路器
const response = await fetch('/api/integration/admin/circuit-breakers/pacer/reset', {
  method: 'POST'
});
```

### 3. 配置验证

```javascript
const config = {
  enabled: true,
  apiKey: 'test-key',
  baseUrl: 'https://api.example.com'
};

const response = await fetch('/api/integration/admin/config/services/pacer/validate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(config)
});
```

## 配置

### 环境变量

```bash
# 集成网关配置
INTEGRATION_GATEWAY_ENABLED=true
INTEGRATION_GATEWAY_PORT=3001
INTEGRATION_TIMEOUT=30000
INTEGRATION_RETRIES=3

# 速率限制配置
INTEGRATION_RATE_LIMIT_ENABLED=true
INTEGRATION_RATE_LIMIT_WINDOW_MS=900000
INTEGRATION_RATE_LIMIT_MAX=1000

# 断路器配置
INTEGRATION_CIRCUIT_BREAKER_ENABLED=true
INTEGRATION_CIRCUIT_TIMEOUT=30000
INTEGRATION_CIRCUIT_ERROR_THRESHOLD=50
INTEGRATION_CIRCUIT_RESET_TIMEOUT=30000

# 认证配置
INTEGRATION_API_KEY_HEADER=X-API-Key
INTEGRATION_WEBHOOK_SECRET=your-webhook-secret

# 日志配置
INTEGRATION_LOGGING_ENABLED=true
INTEGRATION_LOG_LEVEL=info
INTEGRATION_LOG_MASKING=true
```

### 服务特定配置

```bash
# PACER配置
PACER_ENABLED=true
PACER_API_KEY=your-pacer-api-key
PACER_CLIENT_ID=your-pacer-client-id
PACER_BASE_URL=https://pacer.uscourts.gov

# Stripe配置
STRIPE_ENABLED=true
STRIPE_API_KEY=your-stripe-api-key
STRIPE_WEBHOOK_SECRET=your-webhook-secret

# 其他服务配置...
```

## 数据库模式

集成网关使用以下数据库模型：

- `ApiKey` - API密钥管理
- `IntegrationConfig` - 服务配置存储
- `IntegrationLog` - 请求/响应日志
- `CircuitBreakerLog` - 断路器状态变化日志
- `RateLimitLog` - 速率限制日志
- `WebhookLog` - Webhook处理日志
- `UserPermission` - 用户权限管理

## 安全考虑

1. **API密钥管理**
   - 使用强随机密钥
   - 定期轮换密钥
   - 设置过期时间
   - 限制权限范围

2. **数据加密**
   - 敏感配置数据加密存储
   - 使用环境变量
   - 避免硬编码密钥

3. **访问控制**
   - 基于角色的访问控制
   - 服务级别权限
   - IP白名单

4. **监控和审计**
   - 详细日志记录
   - 异常检测
   - 安全事件告警

## 性能优化

1. **缓存策略**
   - 响应缓存
   - 配置缓存
   - 断路器状态缓存

2. **连接池**
   - 数据库连接池
   - HTTP连接池

3. **异步处理**
   - 非阻塞I/O
   - 并发处理

## 监控和指标

### 关键指标

- **请求成功率** - 成功请求数/总请求数
- **平均响应时间** - 所有请求的平均处理时间
- **错误率** - 错误请求数/总请求数
- **断路器状态** - 各服务断路器的当前状态
- **速率限制命中** - 被限制的请求数

### 监控端点

- `/api/integration/health` - 健康状态
- `/api/integration/metrics` - 性能指标
- `/api/integration/admin/logs` - 日志查询

## 故障排除

### 常见问题

1. **API密钥无效**
   - 检查密钥是否正确
   - 确认密钥未过期
   - 验证用户权限

2. **断路器打开**
   - 检查服务状态
   - 查看错误日志
   - 手动重置断路器

3. **速率限制**
   - 检查请求频率
   - 确认配额设置
   - 等待时间窗口重置

### 日志位置

- 错误日志: `logs/integration-error.log`
- 综合日志: `logs/integration-combined.log`

## 扩展开发

### 添加新服务

1. 在 `src/config/integration.ts` 中添加服务配置
2. 在 `prisma/schema.prisma` 中添加服务枚举值
3. 实现特定的服务处理器
4. 添加相应的API端点

### 自定义中间件

可以在 `src/middleware/integration/` 中添加自定义中间件：

```typescript
export const customMiddleware = (req, res, next) => {
  // 自定义逻辑
  next();
};
```

## 测试

运行集成测试：

```bash
npm test
npm run test:watch
```

测试文件位置：`src/test/integration/`

## 部署

### 生产环境配置

1. 设置所有必要的环境变量
2. 配置数据库连接
3. 设置日志轮转
4. 配置监控和告警
5. 启用HTTPS

### 扩展性考虑

- 水平扩展支持
- 负载均衡配置
- 数据库分片
- 缓存层配置