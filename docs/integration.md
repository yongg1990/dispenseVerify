# 真实系统接口联调说明

> 当前接口接入及交接以 [接口对接交接文档](接口对接交接文档.md) 为准。下面保留的是旧版演示阶段的建议契约，不是现有请求地址；源代码已改为调用 `/api/prescription/pharmacy/...`，请勿按下表新增或替换接口。

下列为建议契约，不代表医院已有接口。本项目当前使用 `src/domain/pharmacy.js` 的本地模拟数据；接口名称、字段和权限需与 HIS / 护理系统后端共同确定后接入。

## 身份与权限

通过医院登录或护理系统 SSO 换取短期访问令牌，由服务端返回医院、操作人、可用病区和业务权限。不要信任前端自报的 hospitalId、operatorId、操作时间，不在 URL 中传递长期令牌。前端演示的医院与人员不能作为生产身份来源。

## 建议接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/session` | 当前医院、操作人、权限、可访问病区 |
| GET | `/api/packages/resolve?code=...` | 解析物理药包码 / 处方码，返回批次、处方和药包唯一标识；不限制验收日期 |
| GET | `/api/patients/resolve?code=...` | 解析就诊码或腕带，返回患者及登记号 |
| GET | `/api/prescriptions/dispensable` | 默认日期过滤及关键字查询，只返回当前医院、权限范围内且符合自取及状态规则的处方 |
| POST | `/api/packages/{packageId}/accept` | 药房验收，返回服务器时间、操作人、最终状态 |
| POST | `/api/packages/{packageId}/ward-receive` | 病区逐包接收 |
| POST | `/api/executions/{executionId}/dispense` | 指定患者、登记号、药包、处方及执行批次，二次确认发药 |
| GET | `/api/operation-records?kind=accept` | 验收操作明细 |
| GET | `/api/operation-records?kind=dispense` | 发药操作明细 |
| GET | `/api/integration-events` | 有权限的用户查询 HIS / 短信真实发送状态 |

命令请求使用 `Idempotency-Key`。发药体至少携带 `patientId`、`registrationNo`、`prescriptionId`、`executionId`、`packageIds`、`expectedVersion`；服务端从认证上下文获取医院和操作人，使用服务器时间生成审计记录。

## 服务端必须保证

- 按医院 / 病区授权读取和操作；任何跨医院编号均拒绝。
- 在同一事务中重新验证自取规则、处方有效状态、验收记录、病区接收、登记号一致性和未发药状态。
- 对执行批次建立业务唯一约束并配合条件更新或行锁，确保两个 PDA 同时提交只产生一笔发药记录；幂等重试返回原结果。
- 拆分处方按执行批次隔离；一个批次多个物理药包时校验药包齐套和接收状态，不能仅凭处方号发放。
- 业务事务中写入 Outbox 事件，由服务端异步可靠回传 HIS；超时重试、去重、失败提示和对账。不得由前端显示成功来推断 HIS 已接收。
- 门诊验收成功后由后端触发患者取药短信，模板、手机号及密钥保留在服务端；按验收事件去重，避免重试重复发送。
- 网络失败时查询服务器状态后再重试，前端不离线确认发药。

## 护理系统与 PDA

住院护理系统应提供受信任的启动上下文及单点登录，按系统能力选择 H5 WebView 或原生容器。二维码结果统一交给扫码服务解析；调用 `uni.scanCode` 的原生实现和浏览器模拟分开，厂商广播 SDK 通过同一个扫码服务入口适配。

医院网络及真实接口未提供前，不启用外网默认地址、不自动发送短信、不伪造 HIS 成功回执。
