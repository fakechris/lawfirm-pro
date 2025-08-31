# Law Firm Pro Infrastructure Documentation

## 概述

本文档描述了 Law Firm Pro 应用程序的基础设施即代码 (IaC) 实现，包括 Terraform 模块、Kubernetes 配置和自动化部署脚本。

## 架构概览

### 云服务提供商
- **AWS**: 主要云服务提供商
- **EKS**: Kubernetes 容器编排
- **RDS**: PostgreSQL 数据库
- **ElastiCache**: Redis 缓存
- **S3**: 对象存储
- **ALB**: 应用负载均衡器
- **CloudWatch**: 监控和日志

### 环境架构
```
┌─────────────────────────────────────────────────────────────────┐
│                           AWS Cloud                             │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Development   │  │    Staging      │  │   Production    │ │
│  │                 │  │                 │  │                 │ │
│  │  ┌───────────┐  │  │  ┌───────────┐  │  │  ┌───────────┐  │ │
│  │  │   VPC     │  │  │  │   VPC     │  │  │  │   VPC     │  │ │
│  │  │           │  │  │  │           │  │  │  │           │  │ │
│  │  │ ┌───────┐ │  │  │  │ ┌───────┐ │  │  │  │ ┌───────┐ │  │ │
│  │  │ │ EKS   │ │  │  │  │ │ EKS   │ │  │  │  │ │ EKS   │ │  │ │
│  │  │ │Cluster│ │  │  │  │ │Cluster│ │  │  │  │ │Cluster│ │  │ │
│  │  │ └───────┘ │  │  │  │ └───────┘ │  │  │  │ └───────┘ │  │ │
│  │  │           │  │  │  │           │  │  │  │           │  │ │
│  │  │ ┌───────┐ │  │  │  │ ┌───────┐ │  │  │  │ ┌───────┐ │  │ │
│  │  │ │  RDS   │ │  │  │  │ │  RDS   │ │  │  │  │ │  RDS   │ │  │ │
│  │  │ │        │ │  │  │  │ │        │ │  │  │  │ │        │ │  │ │
│  │  │ └───────┘ │  │  │  │ └───────┘ │  │  │  │ └───────┘ │  │ │
│  │  │           │  │  │  │           │  │  │  │           │  │ │
│  │  │ ┌───────┐ │  │  │  │ ┌───────┐ │  │  │  │ ┌───────┐ │  │ │
│  │  │ │ Redis │ │  │  │  │ │ Redis │ │  │  │  │ │ Redis │ │  │ │
│  │  │ │        │ │  │  │  │ │        │ │  │  │  │ │        │ │  │ │
│  │  │ └───────┘ │  │  │  │ └───────┘ │  │  │  │ └───────┘ │  │ │
│  │  └───────────┘  │  │  └───────────┘  │  │  └───────────┘  │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## 目录结构

```
lawfirmpro/
├── terraform/
│   ├── main.tf                    # 主配置文件
│   ├── variables.tf               # 变量定义
│   ├── outputs.tf                 # 输出定义
│   ├── modules/
│   │   ├── network/               # 网络模块
│   │   ├── security/              # 安全组模块
│   │   ├── compute/               # 计算资源模块
│   │   ├── database/              # 数据库模块
│   │   └── kubernetes/            # Kubernetes 模块
│   └── environments/
│       ├── dev/                    # 开发环境配置
│       ├── staging/                # 测试环境配置
│       └── production/             # 生产环境配置
├── kubernetes/
│   └── helm/
│       └── lawfirmpro/
│           ├── Chart.yaml          # Helm Chart 定义
│           ├── values.yaml         # 默认值
│           ├── values-dev.yaml     # 开发环境值
│           ├── values-staging.yaml # 测试环境值
│           ├── values-prod.yaml    # 生产环境值
│           └── templates/          # Kubernetes 模板
└── infrastructure/
    └── scripts/
        ├── deploy.sh               # 部署脚本
        └── health-check.sh         # 健康检查脚本
```

## Terraform 模块

### 网络模块 (modules/network)

**功能：**
- VPC 创建和配置
- 子网划分（公共、私有、数据库）
- NAT 网关配置
- 路由表管理
- VPC 端点配置

**主要资源：**
- `aws_vpc`: 主 VPC
- `aws_subnet`: 公共、私有、数据库子网
- `aws_internet_gateway`: 互联网网关
- `aws_nat_gateway`: NAT 网关
- `aws_route_table`: 路由表

### 安全组模块 (modules/security)

**功能：**
- 安全组管理
- 网络访问控制
- 堡垒主机安全组

**主要资源：**
- `aws_security_group`: ALB、应用、数据库、监控、堡垒主机安全组

### 计算资源模块 (modules/compute)

**功能：**
- 应用负载均衡器配置
- SSL 证书管理
- Route 53 DNS 配置
- IAM 角色和策略

**主要资源：**
- `aws_lb`: 应用负载均衡器
- `aws_lb_target_group`: 目标组
- `aws_lb_listener`: 监听器
- `aws_acm_certificate`: SSL 证书
- `aws_route53_record`: DNS 记录

### 数据库模块 (modules/database)

**功能：**
- RDS PostgreSQL 实例配置
- ElastiCache Redis 集群配置
- S3 存储桶配置
- 数据库备份策略

**主要资源：**
- `aws_db_instance`: PostgreSQL 实例
- `aws_elasticache_replication_group`: Redis 集群
- `aws_s3_bucket`: S3 存储桶

### Kubernetes 模块 (modules/kubernetes)

**功能：**
- EKS 集群配置
- 节点组管理
- IAM OIDC 提供商
- 服务账户角色

**主要资源：**
- `aws_eks_cluster`: EKS 集群
- `aws_eks_node_group`: 节点组
- `aws_iam_openid_connect_provider`: OIDC 提供商

## Helm Chart

### Chart 结构

```
lawfirmpro/
├── Chart.yaml          # Chart 元数据
├── values.yaml         # 默认配置值
├── values-dev.yaml     # 开发环境配置
├── values-staging.yaml # 测试环境配置
├── values-prod.yaml    # 生产环境配置
└── templates/
    ├── deployment.yaml # 部署配置
    ├── service.yaml    # 服务配置
    ├── ingress.yaml    # 入口配置
    ├── secret.yaml     # 密钥配置
    ├── configmap.yaml  # 配置映射
    ├── pvc.yaml        # 持久卷声明
    └── _helpers.tpl    # 助手模板
```

### 主要配置

**部署配置：**
- 副本数：开发环境 1，测试环境 2，生产环境 3+
- 资源限制：根据环境调整
- 自动扩缩：生产环境启用

**网络配置：**
- 服务类型：ClusterIP
- 入口控制器：AWS ALB
- SSL 终止：AWS ACM

**存储配置：**
- 上传存储：EFS (ReadWriteMany)
- 日志存储：gp3 (ReadWriteOnce)
- 数据库：RDS PostgreSQL
- 缓存：ElastiCache Redis

## 环境配置

### 开发环境 (dev)
- **节点数量**: 2
- **实例类型**: t3.medium
- **数据库**: db.t3.medium, 50GB
- **Redis**: cache.t3.medium
- **监控**: 基础监控
- **备份**: 启用 (7天保留)

### 测试环境 (staging)
- **节点数量**: 3
- **实例类型**: t3.medium
- **数据库**: db.t3.medium, 100GB
- **Redis**: cache.t3.medium
- **监控**: 完整监控
- **备份**: 启用 (14天保留)

### 生产环境 (production)
- **节点数量**: 6
- **实例类型**: t3.large
- **数据库**: db.t3.large, 500GB
- **Redis**: cache.t3.large
- **监控**: 完整监控
- **备份**: 启用 (30天保留)

## 自动化脚本

### 部署脚本 (deploy.sh)

**功能：**
- 自动化基础设施部署
- 支持多个环境
- 完整的错误处理
- 回滚支持

**使用方法：**
```bash
# 初始化
./deploy.sh dev init

# 计划部署
./deploy.sh staging plan

# 应用部署
./deploy.sh production apply

# 部署应用
./deploy.sh dev deploy

# 创建备份
./deploy.sh production backup

# 恢复备份
./deploy.sh production restore snapshot-id
```

### 健康检查脚本 (health-check.sh)

**功能：**
- 全面健康检查
- 组件状态监控
- 自动报告生成

**检查项目：**
- AWS 连接性
- EKS 集群状态
- 应用 Pod 状态
- 服务和入口
- 数据库连接
- Redis 连接
- S3 存储桶
- CloudWatch 日志
- 应用健康端点

**使用方法：**
```bash
# 检查开发环境
./health-check.sh dev

# 检查生产环境
./health-check.sh production
```

## 安全最佳实践

### 网络安全
- VPC 隔离
- 私有子网部署应用
- 安全组最小权限原则
- NAT 网关出站流量

### 数据安全
- 数据库 SSL 加密
- S3 存储加密
- Redis 传输加密
- 静态数据加密

### 访问控制
- IAM 角色和策略
- 最小权限原则
- 密钥管理
- 审计日志

### 监控和日志
- CloudWatch 监控
- 应用日志收集
- 安全事件监控
- 性能指标跟踪

## 部署流程

### 首次部署

1. **环境准备**
   ```bash
   # 配置 AWS 凭证
   aws configure
   
   # 创建 S3 后端存储桶
   aws s3 mb s3://lawfirmpro-terraform-state
   
   # 创建 DynamoDB 锁表
   aws dynamodb create-table \
       --table-name lawfirmpro-terraform-lock \
       --attribute-definitions AttributeName=LockID,AttributeType=S \
       --key-schema AttributeName=LockID,KeyType=HASH \
       --provisioned-throughput ReadCapacityUnits=1,WriteCapacityUnits=1
   ```

2. **初始化和部署**
   ```bash
   # 初始化 Terraform
   ./deploy.sh dev init
   
   # 部署基础设施
   ./deploy.sh dev apply
   
   # 部署应用
   ./deploy.sh dev deploy
   ```

### 日常更新

1. **代码更新**
   ```bash
   # 更新应用镜像
   docker build -t lawfirmpro/app:latest .
   docker push lawfirmpro/app:latest
   
   # 更新 Helm Chart
   helm upgrade lawfirmpro ./kubernetes/helm/lawfirmpro \
       -f ./kubernetes/helm/lawfirmpro/values-dev.yaml
   ```

2. **基础设施更新**
   ```bash
   # 计划变更
   ./deploy.sh dev plan
   
   # 应用变更
   ./deploy.sh dev apply
   ```

### 故障恢复

1. **应用回滚**
   ```bash
   # 查看部署历史
   helm history lawfirmpro -n lawfirmpro
   
   # 回滚到上一个版本
   helm rollback lawfirmpro 1 -n lawfirmpro
   ```

2. **基础设施恢复**
   ```bash
   # 创建备份
   ./deploy.sh production backup
   
   # 恢复备份
   ./deploy.sh production restore snapshot-id
   ```

## 监控和运维

### 关键指标

**应用指标：**
- 响应时间
- 错误率
- 吞吐量
- 资源使用率

**基础设施指标：**
- CPU 使用率
- 内存使用率
- 磁盘使用率
- 网络流量

**数据库指标：**
- 连接数
- 查询性能
- 复制延迟
- 存储使用

### 日志管理

**日志收集：**
- 应用日志 → CloudWatch
- 系统日志 → CloudWatch
- 审计日志 → CloudWatch

**日志保留：**
- 开发环境：30 天
- 测试环境：90 天
- 生产环境：365 天

### 告警配置

**关键告警：**
- 应用不可用
- 高错误率
- 资源耗尽
- 数据库连接失败

## 成本优化

### 实例选择
- 开发环境：t3.medium
- 测试环境：t3.medium
- 生产环境：t3.large

### 存储优化
- S3 生命周期策略
- EBS 卷类型优化
- 数据库存储自动扩缩

### 网络优化
- 数据传输优化
- 跨区域复制策略
- CDN 配置

## 故障排除

### 常见问题

**Terraform 问题：**
```bash
# 清理本地状态
terraform state list
terraform state rm <resource>

# 重新初始化
terraform init -reconfigure
```

**Kubernetes 问题：**
```bash
# 检查 Pod 状态
kubectl get pods -n lawfirmpro

# 查看日志
kubectl logs -f <pod-name> -n lawfirmpro

# 描述资源
kubectl describe pod <pod-name> -n lawfirmpro
```

**数据库问题：**
```bash
# 检查数据库状态
aws rds describe-db-instances

# 查看数据库事件
aws rds describe-events --duration 1440
```

## 维护计划

### 定期维护
- 每周：安全更新
- 每月：系统更新
- 每季度：架构审查
- 每年：灾难恢复演练

### 备份策略
- 数据库：每日自动备份
- S3：版本控制 + 跨区域复制
- 配置：Git 版本控制
- 灾难恢复：定期演练

## 联系信息

- **基础设施团队**: infra@lawfirmpro.com
- **运维团队**: ops@lawfirmpro.com
- **紧急联系**: emergency@lawfirmpro.com

## 变更日志

### v1.0.0 (2025-08-31)
- 初始版本
- 完整的基础设施即代码实现
- 自动化部署脚本
- 监控和日志配置
- 安全最佳实践