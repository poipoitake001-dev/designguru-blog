# Cloudflare WAF 边缘防护策略配置指南

> 本文档提供 Cloudflare WAF 自定义规则的配置建议，用于保护 POI 技术社区的前端着陆页和 API 接口。
> 所有规则均在 Cloudflare Dashboard → Security → WAF → Custom Rules 中配置。

---

## 规则 1：拦截恶意扫描器 & 不合规 UA

**目的：** 阻止常见爬虫、漏洞扫描器、以及国内特征 UA 的恶意访问。

**规则名称：** `Block Malicious Scanners`

**表达式（Expression）：**

```
(http.user_agent contains "sqlmap") or
(http.user_agent contains "nmap") or
(http.user_agent contains "Nikto") or
(http.user_agent contains "masscan") or
(http.user_agent contains "DirBuster") or
(http.user_agent contains "zgrab") or
(http.user_agent contains "Go-http-client") or
(http.user_agent contains "python-requests") or
(http.user_agent contains "HttpClient") or
(http.user_agent contains "java/") or
(http.user_agent contains "curl/") or
(http.user_agent contains "wget/") or
(http.user_agent contains "Scrapy") or
(http.user_agent contains "Bytespider") or
(http.user_agent contains "PetalBot") or
(http.user_agent contains "Sogou") or
(http.user_agent contains "YisouSpider") or
(http.user_agent contains "Applebot") or
(http.user_agent eq "")
```

**操作（Action）：** `Block`（直接拦截）

---

## 规则 2：高频访问 JS Challenge（质询）

**目的：** 对短时间内高频访问的 IP 触发 JavaScript 质询，验证是否是真正的浏览器环境。

**规则名称：** `Rate Limit JS Challenge`

> ⚠️ 此规则需要在 **Security → WAF → Rate Limiting Rules** 中配置，而非 Custom Rules。

**配置参数：**

| 参数 | 值 |
|------|------|
| 匹配 URL | `*api.xxx.cyou/api/*` 或 `*tech.xxx.cyou/*` |
| 时间窗口 | 10 秒 |
| 请求阈值 | 30 次 |
| 触发操作 | JS Challenge |
| 持续时间 | 600 秒（10 分钟） |

**等效表达式（用于 Custom Rule 降级方案）：**

```
(http.request.uri.path contains "/api/cdk/verify")
```

**操作：** `JS Challenge`（对所有 verify 请求强制 JS 质询，或仅用于 Rate Limiting 补充）

---

## 规则 3：严格 Referer 校验（保护 API 子域名）

**目的：** 确保 API 子域名（`api.xxx.cyou`）的鉴权接口 **只接受** 来自合法前端子域名（`tech.xxx.cyou`）的请求。

**规则名称：** `Strict Referer Check for API`

**表达式（Expression）：**

```
(http.host eq "api.xxx.cyou") and
(http.request.uri.path contains "/api/cdk/") and
(not http.referer contains "tech.xxx.cyou") and
(not http.referer contains "localhost")
```

**操作（Action）：** `Block`

> **注意：** `localhost` 白名单仅用于本地开发环境，生产上线后可移除。

---

## 规则 4：保护管理后台路径

**目的：** 阻止非授权 IP 直接访问 `/admin` 路径。

**规则名称：** `Protect Admin Panel`

**表达式：**

```
(http.request.uri.path contains "/admin") and
(not ip.src in {你的管理员IP}) and
(not http.request.uri.path contains "/api/")
```

**操作：** `JS Challenge` 或 `Block`

> 将 `{你的管理员IP}` 替换为你的实际 IP 地址或 IP 列表。
> 如果管理员 IP 不固定，建议使用 JS Challenge 而非直接 Block。

---

## 部署步骤

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 选择你的域名 → **Security** → **WAF**
3. 点击 **Create Rule**
4. 按照上述规则逐条添加（名称、表达式、操作）
5. Rate Limiting 规则需在 **Security → WAF → Rate Limiting Rules** 中单独配置
6. 保存并启用

> **建议操作顺序：**
> 1. 先用 `Log`（日志模式）观察 7 天，确认没有误伤正常用户
> 2. 确认无误后切换为 `Block` 或 `JS Challenge`
