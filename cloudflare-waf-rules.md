# Cloudflare WAF 自定义规则配置

针对 POI 技术社区的 Cloudflare WAF 规则，保护 API 端点与前端资产。

---

## 规则 1：拦截恶意扫描器 & 异常 UA

**目的**：直接 Block 已知恶意工具和无 UA 的请求。

```
规则名称: Block Malicious Scanners
操作: Block
表达式:

(http.user_agent contains "sqlmap") or
(http.user_agent contains "nikto") or
(http.user_agent contains "masscan") or
(http.user_agent contains "zgrab") or
(http.user_agent contains "python-requests") or
(http.user_agent contains "Go-http-client") or
(http.user_agent contains "Java/") or
(http.user_agent contains "libwww-perl") or
(http.user_agent contains "Wget") or
(http.user_agent contains "curl/") or
(http.user_agent contains "scrapy") or
(http.user_agent contains "HttpClient") or
(http.user_agent contains "Mechanize") or
(http.user_agent eq "")
```

> **Cloudflare Dashboard 路径**: Security → WAF → Custom rules → Create rule

---

## 规则 2：API 高频访问 → JS Challenge

**目的**：对 `/api/cdk/` 路径的高频请求触发 JavaScript Challenge，阻止自动化脚本。

```
规则名称: Rate Limit CDK API
操作: JS Challenge
表达式:

(http.request.uri.path contains "/api/cdk/") and
(cf.threat_score gt 10)
```

**配合 Rate Limiting Rule（需单独配置）**：
```
URL 匹配:      api.xxx.cyou/api/cdk/*
时间窗口:      5 分钟
请求阈值:      20 次
超限操作:      JS Challenge（持续 10 分钟）
按以下分组:    IP
```

> **Dashboard 路径**: Security → WAF → Rate limiting rules → Create rule

---

## 规则 3：Referer 校验保护 API

**目的**：`/api/cdk/verify` 仅允许来自合法前端域名的请求。

```
规则名称: API Referer Guard
操作: Block
表达式:

(http.request.uri.path eq "/api/cdk/verify") and
not (http.referer contains "tech.super-card-shop.cyou") and
not (http.referer contains "super-card-shop.cyou") and
not (http.referer contains "localhost")
```

> 注意：Postman/cURL 测试时需临时禁用此规则或添加白名单 IP。

---

## 附加建议

| 防护层 | 配置项 | 建议值 |
|--------|--------|--------|
| **Bot 防护** | Security Level | High |
| **SSL/TLS** | 加密模式 | Full (Strict) |
| **Page Rules** | 缓存 API 响应 | Bypass Cache |
| **Firewall** | 国家/地区限制 | 根据业务需要 |
| **DDoS** | L7 DDoS 自动缓解 | 开启（默认） |
