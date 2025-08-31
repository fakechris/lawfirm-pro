# Law Firm Pro - 综合律师事务所管理系统

一个专为中小型中国律师事务所设计的综合性案件管理系统，实现标准化5阶段工作流程、基于角色的任务分配、阶段式收费和知识管理。该系统将传统法律实践转变为高效、标准化运营，同时确保符合中国法律法规和收费结构。

## 🎯 系统概述

Law Firm Pro 提供完整的法律实践管理解决方案，包括：

- **案件生命周期管理** - 5阶段标准化工作流程
- **智能任务分配** - 基于角色和专业能力的自动化任务系统
- **财务管理系统** - 符合中国法律规范的收费和财务管理
- **文档协作平台** - 版本控制和实时协作功能
- **客户门户系统** - 透明的案件状态和沟通工具
- **通知通信系统** - 多渠道通知和提醒服务

## 🏛️ 核心功能

### 案件管理系统

#### 5阶段生命周期
1. **接案风险评估与策略制定** (Intake & Risk Assessment)
2. **诉前准备与立案** (Pre-proceeding Preparation)
3. **正式程序进行** (Formal Proceedings)
4. **解决方案与后续行动** (Resolution & Post-actions)
5. **结案审查与归档** (Closure & Review)

#### 支持9种案件类型
- 劳动争议 (Labor Disputes)
- 医疗纠纷 (Medical Malpractice)
- 刑事辩护 (Criminal Defense)
- 离婚家事 (Divorce & Family Law)
- 继承纠纷 (Inheritance Disputes)
- 合同纠纷 (Contract Disputes)
- 行政诉讼 (Administrative Cases)
- 拆迁类案件 (Demolition Cases)
- 特殊事项管理 (Special Matters)

### 任务自动化系统

#### 工作流引擎
- **基于规则的任务生成** - 根据案件类型和阶段自动创建任务
- **智能任务分配** - 基于角色、工作负荷和专业能力分配
- **审批工作流** - 敏感操作的多级审批机制
- **依赖关系管理** - 任务间依赖和阻塞处理

#### 角色权限体系
1. **超级管理员** (Super Admin) - 系统级管理
2. **律所管理员** (Firm Admin) - 律所管理
3. **主办律师** (Lead Attorney) - 案件管理和团队领导
4. **参与律师** (Participating Attorney) - 案件执行和支持
5. **律师助理** (Legal Assistant) - 文档准备和研究
6. **行政人员** (Administrative Staff) - 行政任务
7. **档案管理员** (Archivist) - 文档归档管理

### 财务管理系统

#### 阶段式收费
- **按阶段收费** - 根据案件进展阶段计算费用
- **小时计费** - 精确的时间跟踪和计费
- **风险代理** - 基于结果的成功收费模式
- **固定费用** - 预先确定的固定收费标准

#### 中国法律合规
- **增值税处理** - 6%税率的正确计算和申报
- **发票管理** - 符合中国发票规范的管理系统
- **信托账户** - 客户资金的安全管理和对账
- **支付集成** - 支付宝、微信支付、银行转账

### 文档管理系统

#### 文档协作
- **版本控制** - 完整的文档版本历史和审计追踪
- **OCR识别** - 智能文档内容识别和索引
- **实时协作** - 多用户同时编辑和评论
- **权限管理** - 细粒度的文档访问控制

#### 模板系统
- **法律文书模板** - 标准法律文件模板库
- **自定义模板** - 律所专用模板创建和管理
- **模板版本** - 模板版本控制和审批流程

### 通知通信系统

#### 多渠道通知
- **邮件通知** - HTML和纯文本邮件模板
- **应用内通知** - 实时数据库驱动通知
- **WebSocket推送** - 即时浏览器更新
- **静默时段** - 尊重用户休息时间的智能发送

#### 智能提醒
- **截止日期提醒** - 可配置时间的截止提醒
- **任务逾期通知** - 自动升级的逾期处理
- **会议安排** - 日程管理和会议提醒

## 🛠️ 技术架构

### 技术栈
- **前端**: React + TypeScript + WebSocket
- **后端**: Node.js + Express.js + TypeScript
- **数据库**: PostgreSQL + Prisma ORM
- **缓存**: Redis (会话管理和性能优化)
- **认证**: JWT + 基于角色的访问控制
- **文件存储**: 本地文件系统 + 云备份
- **实时通信**: Socket.IO + WebSocket
- **部署**: Docker + 容器编排

### 架构模式
- **状态机模式** - 案件生命周期管理
- **工作流引擎模式** - 任务生成和分配
- **仓储模式** - 数据访问抽象
- **命令模式** - 用户操作和系统事件
- **观察者模式** - 实时通知和更新

### 设计原则
- **领域驱动设计** - 围绕法律领域组织代码
- **微服务架构** - 不同业务领域的模块化服务
- **事件驱动架构** - 通过事件消息实现松耦合
- **API优先设计** - RESTful API和OpenAPI文档

## 📊 项目结构

```
src/
├── api/                    # API 层
│   └── documents/         # 文档相关 API
├── app.ts                 # Express 应用设置
├── client/                # 客户端路由
│   ├── auth.ts           # 认证相关
│   ├── case.ts           # 案件相关
│   ├── document.ts       # 文档相关
│   └── message.ts        # 消息相关
├── config/               # 配置文件
│   ├── financial.ts      # 财务配置
│   ├── index.ts          # 主配置
│   └── integration.ts    # 集成配置
├── controllers/          # 控制器层
│   ├── auth.ts           # 认证控制器
│   ├── case.ts           # 案件控制器
│   ├── document.ts       # 文档控制器
│   ├── financial/        # 财务控制器
│   │   ├── BillingController.ts
│   │   ├── FinancialController.ts
│   │   ├── InvoiceController.ts
│   │   └── PaymentController.ts
│   ├── message.ts        # 消息控制器
│   ├── tasks/            # 任务控制器
│   │   ├── NotificationController.ts
│   │   └── TaskController.ts
│   └── users/            # 用户控制器
├── index.ts              # 服务器入口
├── middleware/           # 中间件
│   ├── audit.ts          # 审计中间件
│   ├── auth.ts           # 认证中间件
│   ├── errorHandler.ts   # 错误处理
│   ├── logger.ts         # 日志中间件
│   ├── requestLogger.ts  # 请求日志
│   └── upload.ts         # 文件上传
├── models/               # 数据模型
│   ├── financial/        # 财务模型
│   │   └── InvoiceTemplate.ts
│   └── users/            # 用户模型
├── repositories/         # 数据仓储
│   └── documentRepository.ts
├── routes/               # 路由定义
│   ├── audit.ts          # 审计路由
│   ├── auth.ts           # 认证路由
│   ├── cases.ts          # 案件路由
│   ├── document.ts       # 文档路由
│   ├── financial.ts      # 财务路由
│   ├── message.ts        # 消息路由
│   ├── profiles.ts       # 用户档案路由
│   ├── roles.ts          # 角色路由
│   ├── tasks.ts          # 任务路由
│   ├── users.ts          # 用户路由
│   └── webhooks.ts       # Webhook 路由
├── services/             # 业务逻辑层
│   ├── auth.ts           # 认证服务
│   ├── cases/            # 案件服务
│   │   ├── CaseLifecycleService.ts
│   │   ├── CaseTransitionService.ts
│   │   ├── StateMachine.ts
│   │   └── validators/   # 验证器
│   ├── document.ts       # 文档服务
│   ├── documents/        # 文档管理服务
│   │   ├── collaborationService.ts
│   │   ├── documentService.ts
│   │   ├── index.ts
│   │   ├── performanceService.ts
│   │   ├── searchService.ts
│   │   └── securityService.ts
│   ├── financial/        # 财务服务
│   │   ├── AlipayService.ts
│   │   ├── BillingService.ts
│   │   ├── ChineseBillingEngine.ts
│   │   ├── FeeCalculationService.ts
│   │   ├── FinancialService.ts
│   │   ├── InvoiceService.ts
│   │   ├── InvoiceTemplateService.ts
│   │   ├── PDFGenerationService.ts
│   │   ├── PaymentAutomationService.ts
│   │   ├── PaymentGatewayService.ts
│   │   ├── PaymentMethodManager.ts
│   │   ├── PaymentReconciliationService.ts
│   │   ├── PaymentService.ts
│   │   ├── PaymentWebhookService.ts
│   │   ├── RefundService.ts
│   │   ├── StageBillingService.ts
│   │   ├── TrustAccountService.ts
│   │   └── WechatPayService.ts
│   ├── integration/      # 集成服务
│   │   ├── IntegrationGateway.ts
│   │   ├── IntegrationMonitor.ts
│   │   ├── IntegrationOrchestrator.ts
│   │   └── index.ts
│   ├── message.ts        # 消息服务
│   ├── tasks/            # 任务服务
│   │   ├── BusinessRuleEngine.ts
│   │   ├── CaseTaskIntegrationService.ts
│   │   ├── EmailNotificationService.ts
│   │   ├── InAppNotificationService.ts
│   │   ├── NotificationPreferenceService.ts
│   │   ├── TaskAssignmentService.ts
│   │   ├── TaskAutomationService.ts
│   │   ├── TaskDependencyService.ts
│   │   ├── TaskNotificationService.ts
│   │   ├── TaskPriorityService.ts
│   │   ├── TaskSchedulingService.ts
│   │   ├── TaskService.ts
│   │   ├── TaskTemplateService.ts
│   │   └── WorkflowEngine.ts
│   └── websocket.ts       # WebSocket 服务
├── test/                 # 测试文件
│   ├── integration/      # 集成测试
│   ├── models/           # 模型测试
│   ├── services/         # 服务测试
│   └── setup.ts          # 测试设置
├── types/                # 类型定义
│   └── index.ts
└── utils/                # 工具函数
    ├── auth.ts           # 认证工具
    ├── database.ts       # 数据库工具
    ├── document-processing/ # 文档处理
    ├── index.ts          # 主工具文件
    ├── storage/          # 存储工具
    └── validation/       # 验证工具
```

## 🚀 快速开始

### 环境要求
- Node.js 18.0.0 或更高版本
- PostgreSQL 13.0 或更高版本
- Redis 6.0 或更高版本 (可选，用于缓存和会话)
- npm 或 yarn

### 安装步骤

1. **克隆仓库**
```bash
git clone <repository-url>
cd lawfirmpro
```

2. **安装依赖**
```bash
npm install
```

3. **环境配置**
```bash
cp .env.example .env
# 编辑 .env 文件，配置数据库连接和其他设置
```

4. **数据库设置**
```bash
# 生成 Prisma 客户端
npm run db:generate

# 运行数据库迁移
npm run db:migrate

# (可选) 打开 Prisma Studio
npm run db:studio
```

5. **启动开发服务器**
```bash
npm run dev
```

API 将在 `http://localhost:3000` 可用

### 环境变量配置

```env
# 基础配置
NODE_ENV=development
PORT=3000

# 数据库配置
DATABASE_URL="postgresql://username:password@localhost:5432/lawfirmpro"

# JWT 配置
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
JWT_REFRESH_SECRET="your-super-secret-refresh-key-change-this-in-production"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# Redis 配置 (可选)
REDIS_URL="redis://localhost:6379"

# 邮件配置
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-email-password"

# 文件上传配置
MAX_FILE_SIZE=10485760
UPLOAD_PATH="./uploads"

# 客户端门户配置
CLIENT_PORT=3000
CLIENT_URL="http://localhost:3000"

# 支付网关配置
# 支付宝
ALIPAY_APP_ID="your-alipay-app-id"
ALIPAY_PRIVATE_KEY="your-alipay-private-key"
ALIPAY_PUBLIC_KEY="your-alipay-public-key"

# 微信支付
WECHAT_APP_ID="your-wechat-app-id"
WECHAT_MCH_ID="your-wechat-mch-id"
WECHAT_API_KEY="your-wechat-api-key"

# 银行转账
BANK_ACCOUNT_NUMBER="your-bank-account-number"
BANK_NAME="your-bank-name"
BANK_SWIFT_CODE="your-bank-swift-code"

# 支付安全
PAYMENT_WEBHOOK_SECRET="your-webhook-secret-key"
```

## 🧪 测试

### 运行所有测试
```bash
npm test
```

### 监听模式运行测试
```bash
npm run test:watch
```

### 生成测试覆盖率报告
```bash
npm run test -- --coverage
```

### 数据库测试

测试使用独立的测试数据库。确保 `.env.test` 中的 `DATABASE_URL` 指向您的测试数据库。

## 📚 API 文档

详细的 API 文档请参考 [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)

### 主要 API 端点

#### 认证相关
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/refresh` - 刷新访问令牌
- `POST /api/auth/logout` - 用户登出
- `GET /api/auth/current-user` - 获取当前用户

#### 案件管理
- `GET /api/cases` - 获取案件列表
- `POST /api/cases` - 创建新案件
- `GET /api/cases/:id` - 获取案件详情
- `PUT /api/cases/:id` - 更新案件
- `POST /api/cases/:id/transition` - 案件状态转换

#### 任务管理
- `GET /api/tasks` - 获取任务列表
- `POST /api/tasks` - 创建任务
- `PUT /api/tasks/:id/assign` - 分配任务
- `POST /api/tasks/:id/complete` - 完成任务

#### 财务管理
- `GET /api/financial/billing` - 获取账单
- `POST /api/financial/invoices` - 创建发票
- `POST /api/financial/payments` - 处理支付
- `GET /api/financial/reports` - 财务报告

#### 文档管理
- `GET /api/documents` - 获取文档列表
- `POST /api/documents/upload` - 上传文档
- `GET /api/documents/:id/download` - 下载文档
- `PUT /api/documents/:id/versions` - 创建新版本

## 🔒 安全特性

### 认证与授权
- **JWT 令牌认证** - 无状态认证机制
- **基于角色的访问控制** - 细粒度权限管理
- **会话管理** - 安全的会话处理和自动清理
- **审计日志** - 完整的用户活动记录

### 数据安全
- **密码哈希** - bcrypt 加密
- **输入验证** - 全面的请求验证
- **SQL 注入防护** - Prisma ORM 参数化查询
- **XSS 防护** - 输出转义和 CSP 头

### 网络安全
- **HTTPS 支持** - 生产环境强制 HTTPS
- **CORS 保护** - 跨域资源共享控制
- **速率限制** - 防止暴力攻击
- **安全头** - Helmet.js 安全头设置

## 🎛️ 开发脚本

```bash
# 开发
npm run dev          # 启动开发服务器
npm run build        # 构建生产版本
npm start           # 启动生产服务器

# 数据库
npm run db:generate  # 生成 Prisma 客户端
npm run db:migrate   # 运行迁移
npm run db:push      # 推送模式到数据库
npm run db:studio    # 打开 Prisma Studio

# 测试
npm test             # 运行测试
npm run test:watch   # 监听模式运行测试

# 代码质量
npm run lint         # 运行 ESLint
npm run lint:fix     # 修复 ESLint 问题
npm run format       # 使用 Prettier 格式化代码
```

## 📈 性能特性

### 性能优化
- **数据库索引优化** - 针对查询模式优化的索引
- **缓存策略** - Redis 缓存频繁访问的数据
- **连接池** - 数据库连接池管理
- **异步处理** - 非阻塞 I/O 操作

### 可扩展性
- **微服务架构** - 水平扩展能力
- **负载均衡** - 支持多实例部署
- **数据库分片** - 支持数据分片
- **CDN 集成** - 静态资源分发

## 🌐 国际化

### 中文本地化
- **界面语言** - 完整的中文界面
- **法律术语** - 中国法律术语标准
- **日期格式** - 中文日期和时间格式
- **货币格式** - 人民币格式化

### 时区支持
- **多时区** - 支持多个时区
- **用户时区** - 基于用户偏好的时区显示
- **服务器时区** - 统一的 UTC 时间存储

## 🤝 贡献指南

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

### 开发规范
- 使用 TypeScript 严格模式
- 遵循 ESLint 配置
- 编写全面的测试
- 使用有意义的提交信息
- 保持函数小而专注

## 📄 许可证

本项目采用 ISC 许可证 - 详见 [LICENSE](LICENSE) 文件。

## 🆘 支持

如有问题和疑问，请在仓库中创建 issue。

## 📞 联系我们

- **项目主页**: [GitHub Repository](https://github.com/your-org/lawfirmpro)
- **问题反馈**: [GitHub Issues](https://github.com/your-org/lawfirmpro/issues)
- **邮件支持**: support@lawfirmpro.com

---

**注意**: 这是一个完整的律师事务所管理系统后端 API。对于完整的 Law Firm Pro 应用程序，此系统将与前端用户界面、移动应用和其他集成模块一起提供全面的法律实践管理解决方案。

## 🗺️ 发展路线图

### 近期计划 (3个月内)
- [ ] 前端 React 应用开发
- [ ] 移动端应用支持
- [ ] 高级报告和分析
- [ ] 更多第三方集成

### 中期计划 (6个月内)
- [ ] 机器学习功能 (案例结果预测)
- [ ] 高级工作流自动化
- [ ] 多语言支持
- [ ] 云部署优化

### 长期计划 (12个月内)
- [ ] AI 法律助手集成
- [ ] 区块链文档验证
- [ ] 国际市场扩展
- [ ] 企业级功能增强

---

**Law Firm Pro** - 让法律实践管理更智能、更高效、更合规 🚀