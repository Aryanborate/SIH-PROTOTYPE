# GigSetu — Database Schema (#46)

Source of truth: `prisma/schema.prisma` (Prisma ORM, SQLite provider in the prototype — PostgreSQL is a provider swap, see README deviations).

This document is the entity catalog: every model, its one-line purpose, and the key relations that make the cooperative ecosystem work.

---

## 1. Entity catalog

### Service taxonomy

| Model | Purpose | Key relations |
|---|---|---|
| `ServiceCategory` | Rate-card catalog (key, en/mr/hi names, base visit rate, average duration) | referenced by `Booking.categoryKey`, `TrainingCourse.categoryKey` |

### Cooperative hierarchy (configurable, levels 0–6)

| Model | Purpose | Key relations |
|---|---|---|
| `HierarchyLevelConfig` | The configurable hierarchy itself — levels 0–6 with codes/names (en/mr/hi), active flag, ordering | standalone config; the org units below instantiate it |
| `Federation` | Apex bodies: `STATE` (Maharashtra) and `NATIONAL` (Bharatiya apex) with aggregate KPIs, demand & skill-gap JSON | `District[]` |
| `District` | District cooperative network (coordinator, zone count, utilization, demand, schematic map position) | `federation` → Federation · `Taluka[]` |
| `Taluka` | Taluka coordination unit (zones JSON, skill-gap JSON, emergency capacity) | `district` → District · `Cooperative[]` |
| `Cooperative` | The primary society — the operating unit workers belong to (pricing policy JSON, welfare fund, featured flag) | `taluka` → Taluka · `Worker[]` · `GovRegistration?` · `AmcContract[]` |
| `GovRegistration` | Society registration record as it would come from a government registry (reg number, authority, verification) — labelled "External / Authorized Integration" | 1:1 with `Cooperative` |

**How the hierarchy works:** `HierarchyLevelConfig` defines up to seven named levels (0–6: national apex → state federation → district → taluka → primary society → …) that the Hierarchy Engine UI renders. The data chain `Federation → District → Taluka → Cooperative` is the concrete instantiation of that config, and every dashboard (taluka/district/state/national) aggregates the level below it. A cooperative's registration card (`GovRegistration`) is how the government ecosystem would verify a society — read-only, consent-framed, no live government call in the prototype.

### People

| Model | Purpose | Key relations |
|---|---|---|
| `Worker` | Cooperative member with skills JSON, certification (name/status/expiry), languages, service areas, ratings, welfare wallet JSON, emergency-pool flag | `cooperative` → Cooperative · `Booking[]` · `TrustReport[]` |
| `Customer` | Service consumer — household, society, school, hospital, hostel, business or govt | `Booking[]` · `SavedPlace[]` · `AmcContract[]` · `InstitutionRequest[]` |
| `SavedPlace` | Customer address book (labelled addresses, default flag) | `customer` → Customer |

### Bookings & the service engine

| Model | Purpose | Key relations |
|---|---|---|
| `Booking` | The core work order: refCode, category, area/address, urgency, mode (INSTANT/QUOTE), full status machine, quote & offer JSON, payment JSON, evidence JSON, rating + multi-factor rating JSON, timeline JSON, auto-advance timestamps, demo-script flag | `customer` → Customer · `worker` → Worker? · `cooperativeId` (soft ref) · `Complaint[]` via bookingId |

Booking status machine (driven server-side by `booking-engine.ts` auto-tick):
`REQUESTED → ACCEPTED → ON_THE_WAY → IN_PROGRESS → COMPLETED → PAID → REVIEWED`, with quote branches `QUOTE_REQUESTED → QUOTED → NEGOTIATING → REQUESTED` and terminal `CANCELLED`.

### Cooperative Service Exchange

| Model | Purpose | Key relations |
|---|---|---|
| `ExchangeRecommendation` | Cross-cooperative workforce transfer recommendation (skill, from/to coop, workers, distance, demand rationale, status PENDING/APPROVED/REJECTED, demo-script flag) | soft refs `fromCoopId`/`toCoopId` |

### Trust, complaints & audit

| Model | Purpose | Key relations |
|---|---|---|
| `Complaint` | Customer complaint register with the dispute ladder `OPEN → RESOLVING → RESOLVED` plus `ESCALATED` (Phase 6); severity LOW…SERIOUS; resolution note + timestamp | `cooperativeId` (soft) · `workerId?` · `bookingId?` (null for seeded walk-ins) |
| `TrustReport` | Worker-side report (unsafe environment, abusive behaviour, repeat cancellation, payment issue) with OPEN/REVIEWING/RESOLVED status | `worker` → Worker · optional `bookingId` |
| `AuditLog` | Phase 6 #57 transparency trail: who (actor + actorRole) did what (action) to which entity (+id), when, with a detail line. Written best-effort by `recordAudit()` at every governance-relevant mutation | standalone (append-only log) |

Audit actions in use: `WORKER_STATUS_CHANGE`, `TRAINING_ENROLLED`, `TRAINING_PROGRESS`, `BOOKING_CREATED`, `BOOKING_PAID`, `BOOKING_RATED`, `BOOKING_CANCELLED`, `PRICING_POLICY_UPDATED`, `ECONOMICS_UPDATED`, `AI_WEIGHTS_UPDATED`, `COMPLAINT_FILED`, `COMPLAINT_ACK`, `COMPLAINT_ESCALATED`, `COMPLAINT_RESOLVED`, `COMPLAINT_REOPENED`, `EXCHANGE_APPROVED`, `EXCHANGE_REJECTED`, `DEMO_RESET`.

**Complaint dispute ladder (Phase 6 #58):**

```
            ACK/REVIEW          RESOLVE (note ≥4 chars)
  OPEN ───────────────▶ RESOLVING ───────────────▶ RESOLVED
    │                        │                         ▲
    │      ESCALATE          │      ESCALATE          │ RESOLVE also
    └────────────▶ ESCALATED ◀────────────────────────┘ allowed from
                        │                          ESCALATED
                        │ REOPEN
                        └──────────▶ OPEN
```

- `REVIEW` ("Under Review") and `ACK` both move OPEN → RESOLVING (committee picked it up).
- `ESCALATE` (from OPEN or RESOLVING) → ESCALATED: the schema is frozen, so an optional escalation note is appended to `detail` as `— escalated: <note>` **and** captured authoritatively in the audit log.
- `RESOLVE` requires a note (≥4 chars) and is allowed from RESOLVING **or** ESCALATED.
- `REOPEN` returns RESOLVED/ESCALATED → OPEN (clears resolution note) — invalid transitions are 409s, and every transition is audit-logged.

### Welfare & training

| Model | Purpose | Key relations |
|---|---|---|
| `WelfareLedger` | Welfare wallet movements — CONTRIBUTION (matched) / BENEFIT payouts | `workerId` (soft) |
| `TrainingCourse` | NSQF-style upskilling catalog (provider, duration, mode, seats) | `TrainingEnrollment[]` |
| `TrainingEnrollment` | Worker progress through a course (0–100%, ENROLLED/IN_PROGRESS/COMPLETED) | `workerId` (soft) · `course` → TrainingCourse |

### Notifications & AI configuration

| Model | Purpose | Key relations |
|---|---|---|
| `Notification` | Role-scoped inbox messages (CUSTOMER/WORKER/COOP/TALUKA/DISTRICT/STATE) with INFO/SUCCESS/WARNING/EMERGENCY types | audience + audienceId (soft) |
| `MatchWeightConfig` | Single-row config of the six matching weights (skillMatch, certification, distance, availability, workload, serviceHistory) — admin-editable, audited | standalone (id = "default") |
| `IntegrationRegistry` | Designed/future external integrations (e-Shram, registries, welfare boards, open networks) with status + data-flow description | standalone |

### Phase 5 — institutional layer

| Model | Purpose | Key relations |
|---|---|---|
| `AmcContract` | Annual maintenance contract between a customer and a cooperative (units, services, SLA hours & attainment, allocated workers) | `customer` → Customer · `cooperative` → Cooperative |
| `InstitutionRequest` | Bulk / recurring / maintenance / emergency institutional service requests with schedule JSON | `customer` → Customer · optional `contractId` |

### Payment & economics configuration

| Model | Purpose | Key relations |
|---|---|---|
| `FeeConfig` | Single-row configurable settlement split: worker share / coop commission / welfare / platform (validated to total 100, worker ≥ 50) | standalone (id = "default") |
| `EconomicsConfig` | Single-row cooperative revenue-model canvas (JSON list of sources with price/unit/active) | standalone (id = "default") |

---

## 2. Core flows (ER-ish view of #70)

### Flow A — Household booking (customer → worker → settlement)

```
Customer ──1:N──▶ Booking ──N:1──▶ Worker ──N:1──▶ Cooperative ──N:1──▶ Taluka ──N:1──▶ District ──N:1──▶ Federation
                     │                 ▲
                     │ payment JSON     │ rating + ratingJson (two-sided trust)
                     ▼                 │
              FeeConfig split     TrustReport (worker-side reports)
        (worker / coop / welfare / platform)
```

### Flow B — Complaint & dispute ladder (customer voice → committee → escalation)

```
Customer ──files──▶ Complaint(cooperativeId, bookingId?, severity)
                          │ committee transitions (PATCH /api/complaints, audited)
                          ▼
        OPEN → RESOLVING → RESOLVED      ESCALATED ⇄ OPEN
                 └────────▶ ESCALATED ◀──────┘ (resolve allowed)
                          │
                          ▼
              AuditLog(COMPLAINT_*) + Notification(CUSTOMER / COOP)
```

### Flow C — Federation capacity balancing (demand signal → exchange → human approval)

```
District demand JSON ──▶ AI shortage detection ──▶ ExchangeRecommendation
        (fromCoop → toCoop, skill, workers, rationale)
                          │ humans approve/reject (district/federation)
                          ▼
        status APPROVED/REJECTED + AuditLog(EXCHANGE_*) + workers moved
```

---

*Prototype data — all entities are synthetic, labelled for authorized integration where a real registry would be consulted. See `README.md` for the security notes and data integrity statement.*
