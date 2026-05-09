# 🤖 SISTEMA DE AGENTES — Businessskore v3.0
> Índice central. Directiva maestra en `CLAUDE_BRAIN.md` (sección DIRECTIVA MAESTRO CISO).
> Última actualización: 2026-04-30

---

## Arquitectura de Orquestación

```
AGENTE MAESTRO CISO (Orquestador)
    ├── AGENTES-01..07   (por proyecto/dominio)
    ├── SWARM-SEC        (Seguridad & Cifrado)       → 6 sub-agentes
    ├── SWARM-AUD        (Auditoría & Trazabilidad)  → 4 sub-agentes
    ├── SWARM-DEV        (Desarrollo & Stack)         → 4 sub-agentes
    └── SWARM-CMP        (Compliance & Regulación)   → 5 sub-agentes
```

---

## Agentes Base — Por Proyecto/Dominio

| ID | Nombre | Proyecto / Contexto | Definición completa |
|----|--------|-------------------|---------------------|
| AGENTE-01 | DriverTax Architect | DriverTax Pro — IRS | `CLAUDE_BRAIN.md` |
| AGENTE-02 | VerificaRenta / LexiCredit Legal | VerificaRenta (Ley 85-25) / LexiCredit (FCRA) | `CLAUDE_BRAIN.md` |
| AGENTE-03 | ServiRD/SV Engineer | Servi RD / Servi SV — Ley 63-17 | `CLAUDE_BRAIN.md` |
| AGENTE-04 | Security & ONAPI Guard | Global — antes de commit/deploy | `CLAUDE_BRAIN.md` |
| AGENTE-05 | Context7 Researcher | Global — docs actualizadas | `CLAUDE_BRAIN.md` |
| AGENTE-06 | Code Simplifier (Karpathy) | Global — revisión código | `CLAUDE_BRAIN.md` |
| AGENTE-07 | Sequential Thinker (CoT) | Global — arquitectura / bugs | `CLAUDE_BRAIN.md` |

---

## 🔴 SWARM-SEC — Seguridad & Cifrado
> Activar: auth, datos sensibles, endpoints, deploy. Definiciones: `swarm/swarm-sec.md`

| ID | Sub-Agente | Trigger | Herramienta principal |
|----|-----------|---------|----------------------|
| SWARM-SEC-01 | AES Encryption Guard | Antes de guardar dato sensible | Google Cloud KMS / AES-256-GCM |
| SWARM-SEC-02 | App Check Validator | Antes de deploy a producción | Firebase App Check + reCAPTCHA Enterprise |
| SWARM-SEC-03 | Session Defender | Cualquier flujo de autenticación | httpOnly cookies + token rotation |
| SWARM-SEC-04 | DoS Mitigator | Endpoints públicos | express-rate-limit + Cloud Armor |
| SWARM-SEC-05 | Injection Preventer | Input del usuario | express-validator + DOMPurify |
| SWARM-SEC-06 | Zero Trust Enforcer | Todos los endpoints / Cloud Functions | Firebase Admin SDK (server-side UID) |

---

## 🟡 SWARM-AUD — Auditoría & Trazabilidad
> Activar: errores en prod, nuevas deps, transacciones críticas. Definiciones: `swarm/swarm-aud.md`

| ID | Sub-Agente | Trigger | Herramienta principal |
|----|-----------|---------|----------------------|
| SWARM-AUD-01 | Error Tracer | Cada bloque try/catch | Structured logging (timestamp+UID+stack) |
| SWARM-AUD-02 | Sentry Integrator | Nuevo proyecto / error en producción | Sentry MCP |
| SWARM-AUD-03 | Audit Logger | Transacciones con impacto legal/financiero | Firestore colección `audit_log` (immutable) |
| SWARM-AUD-04 | Dependency Scanner | Antes de agregar/actualizar librería | npm audit + license-checker |

---

## 🔵 SWARM-DEV — Desarrollo & Stack
> Activar: funciones grandes, actualizaciones de deps, refactor. Definiciones: `swarm/swarm-dev.md`

| ID | Sub-Agente | Trigger | Herramienta principal |
|----|-----------|---------|----------------------|
| SWARM-DEV-01 | Architecture Decoupler | Función >50 líneas o >2 responsabilidades | Revisión CoT + refactor |
| SWARM-DEV-02 | Stack Updater | Semanalmente / nueva dependencia | Context7 MCP + changelog review |
| SWARM-DEV-03 | Cross-Module Connector | Antes de merge / refactor global | Mapa de dependencias Firestore + tipos TS |
| SWARM-DEV-04 | Serverless Optimizer | Antes de deploy de función nueva | Firebase emulators + performance profiling |

---

## 🟢 SWARM-CMP — Compliance & Regulación
> Activar: cálculos fiscales, flujos de disputa, proyectos RD, recolección de datos. Definiciones: `swarm/swarm-cmp.md`

| ID | Sub-Agente | Trigger | Regulación |
|----|-----------|---------|-----------|
| SWARM-CMP-01 | Gig Worker Entity Separator | Todo flujo de cálculo IRS — DriverTax | IRS Schedule C / LLC vs Personal |
| SWARM-CMP-02 | IRS Compliance Monitor | Cálculos fiscales — actualizar cada enero | IRS Rev. Proc. (mileage, brackets, 1040-ES) |
| SWARM-CMP-03 | FCRA/CROA Guardian | Flujos de disputa — LexiCredit | FCRA §609/§611 + CROA |
| SWARM-CMP-04 | RD Law Enforcer | Proyectos República Dominicana | Ley 85-25 + Ley 63-17 + Ley 176-07 |
| SWARM-CMP-05 | Data Privacy Auditor | Recolección de dato personal | GDPR/CCPA principles |

---

## Agentes de Seguridad — Implementaciones (SECURITY_STACK.md)

| ID | Nombre | Propósito |
|----|--------|-----------|
| AGENTE-SEC-01 | RLS Agent | Firestore Rules + ownership middleware |
| AGENTE-SEC-02 | CORS Agent | Whitelist de dominios por proyecto |
| AGENTE-SEC-03 | Headers Agent | Helmet.js — CSP, HSTS, noSniff |
| AGENTE-SEC-04 | Sanitize Agent | express-validator + DOMPurify |
| AGENTE-SEC-05 | RateLimit Agent | Protección auth, pagos, envíos |
| AGENTE-SEC-06 | Auth Token Agent | httpOnly cookies — NO localStorage |
| AGENTE-SEC-07 | XSS Prevention | DOMPurify + React escape |
| AGENTE-SEC-08 | CSRF Protection | sameSite:strict + csurf |

---

## Agentes Social Media & Email

| ID | Nombre | Perfil / Función | Archivo |
|----|--------|-----------------|---------|
| AGENTE-08 | Content Creator Personal | @amin_ventura — Instagram/Facebook | `social-media/agent-amin-ventura.md` |
| AGENTE-09 | Content Creator Business | @driverskore — Instagram/Facebook | `social-media/agent-driverskore.md` |
| AGENTE-12 | Gmail Cleanup Bot | Limpieza diaria email | `email/agent-gmail-cleanup.md` |

> Meta (Instagram/Facebook) sin MCP oficial. Flujo: Agente genera caption → guarda en `/content/` → Amin publica manualmente.

---

## Tareas Programadas Activas

| Tarea | Horario | Función |
|-------|---------|---------|
| `businessskore-brain-daily-sync` | 8pm diario | Sync CLAUDE_BRAIN.md + TASKS.md |
| `businessskore-skills-weekly-audit` | Lunes 9am | Auditoría nuevas capacidades + SWARM-AUD-04 |
| `nyc-driver-news-daily` | 7am diario | Noticias NYC conductores |
| `social-content-weekly` | Domingo 8am | Plan contenido semana |
| `gmail-cleanup-daily` | 9pm diario | Limpieza email basura |
| `swarm-dep-scan-weekly` | Martes 9am | SWARM-AUD-04 — CVEs + GPL en todas las deps |

---

## 🟣 SWARM-ADS (Google Ads / AdSense — contenido de valor)

> Definiciones en `google-ads/`. Orquestador general: `swarm-ads-content.md`. Sitio prediccionloteria.com: `swarm-ads-prediccion-site.md`.

| Enjambre | Archivo |
|-----------|---------|
| ADS general | `google-ads/swarm-ads-content.md` |
| prediccionloteria.com | `google-ads/swarm-ads-prediccion-site.md` |
| ads.txt / rastreo | `google-ads/sub-ads-ads-txt-crawl.md` |
| Historial MLB/NBA + algoritmo | `google-ads/sub-prediccion-historial-deportes.md` |

---

```
Rechazo AdSense / «contenido de bajo valor» / ads.txt / revisión de anunciantes (prediccionloteria.com)
  → google-ads/swarm-ads-prediccion-site.md
Nueva función con datos de usuario     → SWARM-SEC-01 + SWARM-SEC-05 + SWARM-SEC-06
Antes de cualquier deploy              → SWARM-SEC-02 + SWARM-AUD-04
Error en producción                    → SWARM-AUD-01 + SWARM-AUD-02
Agregar librería npm                   → SWARM-AUD-04 + SWARM-DEV-02
Refactorizar módulo grande             → SWARM-DEV-01 + SWARM-DEV-03
Cálculo fiscal DriverTax               → SWARM-CMP-01 + SWARM-CMP-02
Flujo de disputa LexiCredit            → SWARM-CMP-03 + SWARM-SEC-01
Proyecto República Dominicana          → SWARM-CMP-04
Recolectar dato personal nuevo         → SWARM-CMP-05 + SWARM-SEC-01
```
