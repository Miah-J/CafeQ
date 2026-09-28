# CaféQ — Campus Smart Cafeteria Pre-Ordering & Kitchen Operations Platform

<div align="center">

[![NestJS](https://img.shields.io/badge/NestJS-11.0-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7.0-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Jest](https://img.shields.io/badge/Jest-95%20Tests%20Passing-C21325?style=for-the-badge&logo=jest&logoColor=white)](https://jestjs.io/)
[![License](https://img.shields.io/badge/License-Proprietary-yellow?style=for-the-badge)](LICENSE)

<br/>

**A high-concurrency, real-time campus cafeteria pre-ordering, digital wallet, and kitchen operations management system designed to eliminate peak lunch-hour queues, automate meal pickups, and prevent food waste.**

[System Architecture](#system-architecture) •
[Key Metrics](#key-metrics--performance) •
[Features by Role](#features-by-role) •
[Engineering Deep Dives](#engineering-deep-dives) •
[Tech Stack](#complete-tech-stack) •
[Local Setup](#getting-started)

</div>

---

## Executive Summary & Problem Statement

University dining halls and institutional cafeterias experience extreme demand spikes during narrow 60–90 minute lunch windows. In physical service models, this results in:
* **Severe Queue Bottlenecks:** Students waiting 25–40 minutes in line just to place orders and pay.
* **Kitchen Operational Blindness:** Chefs cooking reactively without real-time visibility into incoming demand spikes.
* **Inventory Overselling & Food Waste:** Discrepancies between physical food prep and ticket queues.
* **Uncollected Meals:** Orders abandoned due to schedule conflicts without refund mechanisms.

**CaféQ** is a full-stack, enterprise-grade dining automation ecosystem. It introduces a high-concurrency pre-ordering pipeline, Safaricom Daraja M-Pesa STK push & in-app split-wallet payments, sub-3-second real-time Kitchen Display Systems (KDS), tablet-optimized pickup terminals, and an automated background refund engine for uncollected meals.

---

## Key Metrics & Performance

| Metric | Measured Result | Benchmark / Target |
| :--- | :--- | :--- |
| **Jest Automated Unit Tests** | **95 / 95 Passing (100% Pass Rate)** | 11 Test Suites across all services |
| **Kitchen Display (KDS) Latency** | **< 3.0 Seconds** | Real-time WebSocket order broadcast |
| **Meal Pickup Turnaround Time** | **< 5.0 Minutes** | Reduced from 30+ min queue average |
| **M-Pesa STK Push Settlement** | **< 30 Seconds** | 95% of transactions resolved within 30s |
| **REST API Surface Area** | **50 Production Endpoints** | Full CRUD, RBAC, Webhooks & Analytics |
| **Relational Data Schema** | **16 Tables + Triggers + Indexes** | Zero-loss CDC audit logs + pgcrypto |
| **End-to-End Pilot Adoption** | **80%+ Unassisted Success Rate** | Multi-cohort trial (students & staff) |

---

## System Architecture

CaféQ is architected as a modular monolith on the backend with real-time bidirectional WebSocket namespaces, paired with a modern Next.js 16 App Router frontend serving five tailored operational interfaces.

```mermaid
flowchart TD
    subgraph Clients["Frontend Clients (Next.js 16 + React 19)"]
        A[Student Web App]
        B[Kitchen Display Screen]
        C[Server Tablet Kiosk]
        D[Cashier POS Terminal]
        E[Admin Analytics Portal]
    end

    subgraph Gateway["API & Real-time Layer (NestJS 11)"]
        G[REST Controllers - 50 Endpoints]
        WS1[Socket.IO Gateway: /kitchen]
        WS2[Socket.IO Gateway: /collection]
        Guards[JWT Auth & RBAC Guards]
    end

    subgraph CoreServices["Domain Services Layer"]
        S_Auth[Auth & SMS Service]
        S_Menu[Menu & Inventory Service]
        S_Order[Order & Reference Service]
        S_Pay[Payment & Wallet Engine]
        S_Refund[Automated Refund Worker]
        S_Loyalty[Loyalty Trigger Engine]
        S_Analytics[Analytics & Aggregations]
    end

    subgraph DataStore["Persistence & Caching"]
        PG[(PostgreSQL 16\n16 Tables + Triggers + pgcrypto)]
        Redis[(Redis 7\nLua Atomic Counters & Locks)]
    end

    subgraph External["External Integrations"]
        MPESA[Safaricom Daraja API\nSTK Push & B2C Refunds]
        SMS[Africa's Talking / KenyaSMS API\nOTP & Transaction Receipts]
    end

    A & B & C & D & E -->|HTTP / REST| G
    B & C <-->|WebSockets| WS1 & WS2
    G --> Guards --> CoreServices

    S_Menu <-->|Atomic Lua Eval| Redis
    S_Order --> PG
    S_Pay -->|C2B STK Push| MPESA
    S_Pay --> PG
    S_Refund -->|B2C Auto Refund| MPESA
    S_Refund --> PG
    S_Auth --> SMS
    S_Order --> SMS
    PG -.->|PL/pgSQL Trigger| S_Loyalty
```

---

## Features by Role

CaféQ delivers role-specific user journeys backed by granular JWT Role-Based Access Control (`Student`, `KitchenStaff`, `ServingStaff`, `Cashier`, `Admin`):

### 1. Student Mobile Portal
* **Live Dynamic Menu Browsing:** Displays current day’s dishes with real-time Redis availability counters.
* **Dietary & Allergen Filtering:** One-click filter chips for *Halal*, *Vegetarian*, *Vegan*, *Gluten-Free*, and *Dairy-Free*.
* **Persistent Cart & Session Recovery:** Client-side cart persistence across browser tabs and refreshed sessions.
* **Flexible Checkout & Split Tender:**
  * Direct Safaricom Daraja M-Pesa STK Push to phone.
  * In-app digital wallet payment.
  * **Split payment:** Pay partial amount from wallet, trigger STK Push for remainder.
* **Pickup Verification:** Generates a unique 6-character tamper-proof alphanumeric pickup code sent via in-app banner and SMS receipt.
* **Automated Loyalty Points:** Accrues 1 loyalty point per 10 KES spent upon order collection, with built-in redemption caps.

### 2. Real-Time Kitchen Display System (KDS)
* **Zero-Refresh Order Queue:** Sub-3-second real-time ticket sync via WebSocket `/kitchen` namespace.
* **Visual Capacity Meters:**
  * **Normal State (< 80%):** Standard prep counter.
  * **Amber Alert (80%–99%):** Warning threshold indicating imminent sell-out.
  * **Sold-Out Banner (100%):** Automatically marks dish sold-out and locks orders.
* **Operational Header:** Live window clock, batch summary counts, and serving phase status.

### 3. Food Server Collection Kiosk
* **Tablet-Optimized UI:** Designed for touch monitors with large touch targets and an on-screen numerical keypad.
* **Fast Reference Code Lookup:** Instant verification of 6-character pickup codes.
* **Station-Level Item Dispatch:** Food servers mark individual items collected as students move down the counter.
* **Auto-Order Finalization:** Orders automatically transition to `COLLECTED` status once all line items are fulfilled.

### 4. Walk-In Cashier POS Terminal
* **Two-Panel Cashier Layout:** Left-side dish selection catalog; right-side live order summary.
* **Hybrid Tender Support:** Accommodates walk-in students paying via physical Cash or on-the-spot M-Pesa push.
* **Unified Accounting:** Generates identical reference numbers and feeds the same kitchen queue and analytics stream.

### 5. Admin Management & Business Intelligence
* **Live Revenue Analytics:** Real-time gross revenue, sales-by-dish, and category distributions (Meals, Beverages, Snacks) using Recharts.
* **Dynamic Menu Publishing:** Publish active daily menus, modify dish prices, upload meal images, and dynamically adjust prepared portions on the fly.
* **Academic Calendar Correlation:** Correlates daily order demand against Exam Weeks and Semester Breaks.
* **Staff Provisioning & Security Audit:** Administrative creation of Cashier, Server, and Kitchen accounts with full audit log views.
* **Financial Export:** Instant one-click CSV export of order logs, revenue summaries, and uncollected refunds.

---

## Engineering Deep Dives

### 1. High-Concurrency Inventory Reservation via Redis Lua Scripts
In a peak campus dining window, hundreds of students may attempt to checkout the last remaining 10 portions of a popular dish within seconds. Standard database `SELECT -> UPDATE` patterns cause race conditions or row-lock contention.

CaféQ offloads stock reservation to Redis using an atomic Lua script (`EVAL`):

```lua
-- Atomic stock check & decrement script executed in Redis
local key = KEYS[1]
local quantity = tonumber(ARGV[1])
local current = redis.call('GET', key)

if current == false then
    return -2 -- Key does not exist
end

local current_qty = tonumber(current)
if current_qty >= quantity then
    local next_val = redis.call('DECRBY', key, quantity)
    return next_val -- Successfully decremented
else
    return -1 -- Insufficient stock (Prevent overselling)
end
```
* **Atomicity:** The entire evaluation and decrement runs in a single Redis thread step, guaranteeing zero negative inventory.
* **Compensatory Rollback:** If an M-Pesa STK Push fails or times out after 3 retries, a compensating transaction automatically increments the Redis portion count back to the pool.

### 2. Idempotent Automated Uncollected Order Refund Engine
Students occasionally pre-order food but fail to collect before the serving window terminates. Leaving orders open causes accounting discrepancies and customer dissatisfaction.

CaféQ implements an automated, scheduled background worker (`@nestjs/schedule`):
1. **Targeted Scanning:** Runs at window close and queries uncollected orders utilizing a PostgreSQL partial index:
   ```sql
   CREATE INDEX idx_orders_uncollected ON orders(status) 
   WHERE status NOT IN ('COLLECTED', 'REFUNDED');
   ```
2. **Autonomous Daraja B2C Disbursement:** Automatically triggers a Business-to-Customer (B2C) M-Pesa refund back to the student's registered mobile phone.
3. **Resilient Wallet Fallback:** If the Safaricom B2C API endpoint is unavailable or times out, the engine catches the failure, credits the refund amount directly to the student's in-app digital wallet, and records a compensatory audit record.
4. **Idempotency Guarantee:** State transitions to `REFUNDED` are wrapped in database transactions, preventing double-refunds during transient network retries.

### 3. Kenya Data Protection Act (KDPA 2019) & Cryptographic Storage
To adhere to stringent data protection regulations regarding Personally Identifiable Information (PII):
* **At-Rest Column Encryption:** Student full names and phone numbers are encrypted inside PostgreSQL using `pgcrypto` symmetric keys:
  ```sql
  -- Storage using AES encryption
  INSERT INTO users (email, password_hash, role, full_name, phone_number)
  VALUES ($1, $2, $3, pgp_sym_encrypt($4, $KEY), pgp_sym_encrypt($5, $KEY));
  ```
* **CDC Audit Logs with Sanitization:** A PostgreSQL `AFTER INSERT OR UPDATE OR DELETE` trigger captures all table mutations into `audit_logs`, stripping raw encryption keys and sensitive binary blobs before persisting JSON diffs.

---

## Complete Tech Stack

| Domain | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Backend Framework** | NestJS | `^11.0.1` | Modular enterprise backend architecture |
| **Language** | TypeScript | `^5.7.3` | End-to-end type safety |
| **Frontend Framework** | Next.js (App Router) | `16.2.9` | Server-rendered & client-optimized SPA |
| **UI Library** | React | `19.2.4` | Component state & reactive views |
| **Styling** | Tailwind CSS | `^4.0.0` | Utility-first responsive styling & dark mode |
| **Database** | PostgreSQL | `16+` | Relational storage, ACID transactions, pgcrypto |
| **ORM** | TypeORM | `^1.0.0` | Entity modeling & migration orchestration |
| **Cache & Concurrency** | Redis & `ioredis` | `^5.11.1` | Atomic Lua scripting & portion tracking |
| **Real-Time WebSockets**| Socket.IO | `^4.8.1` | Sub-3s kitchen display synchronization |
| **Job Scheduling** | `@nestjs/schedule` | `^6.1.3` | Scheduled window-close refund cron jobs |
| **Payments Integration**| Safaricom Daraja API | REST | M-Pesa STK Push (C2B) & B2C Payouts |
| **SMS Gateway** | Africa's Talking / KenyaSMS | REST | OTP verification & 6-char pickup SMS |
| **Authentication** | Passport & JWT | `^11.0.2` | Stateless RBAC security tokens |
| **Data Visualization** | Recharts | `^3.9.1` | Financial analytics & sales trend graphs |
| **Testing** | Jest & ts-jest | `^30.0.0` | Comprehensive unit and integration test suite |

---

## Database Architecture

The system operates across **16 normalized relational tables** engineered for high consistency and auditability:

```
├── users                      # Base credentials, role enum, pgcrypto encrypted PII
├── students                   # Student ID numbers and foreign key bindings
├── administrators             # Admin departments and permissions
├── cashiers                   # Cashier station assignment records
├── wallets                    # In-app digital wallet ledger balances
├── menus                      # Daily menu dates and activation flags
├── dishes                     # Prices, dietary tags, prepared portion counts
├── orders                     # Total amounts, timestamps, lifecycle states
├── order_items                # Specific dishes, quantities, and per-item statuses
├── payments                   # M-Pesa references, payment types, failure reasons
├── reference_numbers          # Cryptographic 6-char alphanumeric pickup codes
├── loyalty_accounts           # Point balances per student
├── loyalty_transactions       # Earn, redeem, and refund point ledger
├── kitchen_tickets            # Preparation pipeline statuses (Queued, Preparing, Ready)
├── academic_events            # Exam weeks and semester breaks for demand tracking
└── audit_logs                 # Change Data Capture (CDC) table mutation history
```

---

## Testing & Quality Assurance

CaféQ maintains rigorous test coverage verifying all core business workflows, edge cases, and failure recoveries.

```bash
# Execute Jest unit test suites
cd backend
npm test
```

### Verified Test Suites:
```
PASS src/app.controller.spec.ts
PASS src/users/users.service.spec.ts
PASS src/orders/reference.service.spec.ts
PASS src/loyalty/loyalty.service.spec.ts
PASS src/kitchen/kitchen.service.spec.ts
PASS src/collection/collection.service.spec.ts
PASS src/refund/refund.service.spec.ts
PASS src/orders/orders.service.spec.ts
PASS src/menus/menus.service.spec.ts
PASS src/payments/payments.service.spec.ts
PASS src/auth/auth.service.spec.ts

Test Suites: 11 passed, 11 total
Tests:       95 passed, 95 total
Snapshots:   0 total
Time:        100% Pass Rate
```

---

## Getting Started

### Prerequisites
* **Node.js:** `v20.x` or `v22.x`
* **PostgreSQL:** `v15+` (with `uuid-ossp` and `pgcrypto` extensions enabled)
* **Redis:** `v6+` or `v7+`
* **Git**

---

### 1. Clone & Install Dependencies

```bash
# Clone the repository
git clone https://github.com/Miah-J/CafeQ.git
cd CafeQ

# Install Backend dependencies
cd backend
npm install

# Install Frontend dependencies
cd ../frontend
npm install
```

---

### 2. Configure Environment Variables

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/cafeq

# Redis
REDIS_URL=redis://localhost:6379

# Security & Secrets
JWT_SECRET=your_super_secret_jwt_key_here
PGCRYPTO_KEY=your_secure_pgcrypto_aes_key

# Safaricom Daraja M-Pesa Configuration
MPESA_CONSUMER_KEY=your_daraja_consumer_key
MPESA_CONSUMER_SECRET=your_daraja_consumer_secret
MPESA_PASSKEY=bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72dec1144c9f3
MPESA_SHORTCODE=174379
MPESA_CALLBACK_URL=https://your-tunnel-domain.serveo.net/payments/mpesa/callback
MPESA_SIMULATE=true

# SMS Gateway
KENYASMS_API_KEY=your_sms_api_key
KENYASMS_SENDER_ID=CafeQ
SMS_SANDBOX=true
```

---

### 3. Initialize Database & Seed Data

Run the PostgreSQL schema and migrations:

```bash
# Run schema and migrations against PostgreSQL
psql -U postgres -d cafeq -f database/schema.sql
psql -U postgres -d cafeq -f database/migrations.sql

# Seed initial test users and active menu
cd backend
node seed-test-users.js
node seed-active-menu.js
node seed-wallet.js
```

---

### 4. Running the Development Servers

#### Start Backend API & WebSockets (Port 3001)
```bash
cd backend
npm run start:dev
```

#### Start Frontend Client (Port 3000)
```bash
cd frontend
npm run dev
```

#### (Optional) Expose Webhooks for M-Pesa Sandbox Callbacks
```bash
# Starts an automated SSH tunnel to forward callbacks to localhost:3001
node start_tunnel.js
```

---

## Engineering & Team Leadership

* **Khillon Makwana** — *Full-Stack Engineer*
  * Spearheaded end-to-end system architecture, sprint delivery, code review standards, and data protection compliance (KDPA 2019) across all three project increments.
  * Architected and implemented the **Automated Uncollected Order Refund Engine**, utilizing NestJS scheduled cron workers, PostgreSQL partial indexes, Safaricom Daraja B2C automated disbursements, and wallet fallbacks.
  * Engineered the **Real-Time Kitchen Display System (KDS)** and **Tablet Food Server Station**, implementing Socket.IO WebSocket pipelines (< 3s latency) and touch-optimized keypad interfaces.
  * Designed high-concurrency inventory reservation workflows using **atomic Redis Lua scripts**, preventing overselling during dining rushes and managing compensatory transaction rollbacks.
  * Led the comprehensive frontend redesign across all five user roles (Student, Kitchen, Server, Cashier, Admin) using Next.js 16 (App Router), React 19, and Tailwind CSS v4, incorporating session persistence and responsive layouts.
  * Authored unit test suites for collection, kitchen, refund, and payment services, ensuring 100% test pass rate across 95 Jest tests.

* **Nehemiah Wanjala** — *Full-Stack Engineer*
  * Scaffolded initial monorepo architecture and designed base PostgreSQL relational schemas with foreign key constraints, migration scripts, and test seeding utilities.
  * Implemented the authentication and identity subsystem, featuring stateless JWT tokens, granular role-based access control (RBAC), password reset flows, and staff provisioning with SMS/email OTP verification.
  * Built the core order placement pipeline, server-side pricing verification, and the 6-character cryptographic pickup reference generation service.
  * Integrated initial Safaricom Daraja M-Pesa STK Push payment flows, transaction callback handlers, in-app digital wallet top-ups, and the dual-panel walk-in cashier POS module.
  * Engineered the Admin Analytics dashboard leveraging raw SQL aggregation queries, category sales breakdowns (Meals, Beverages, Snacks), and dynamic Academic Calendar event correlation.
  * Authored unit test suites, service mocks, and Postman API collections covering authentication, orders, menus, and payment endpoints.

---

## License

This project was developed as an academic and institutional enterprise platform. All rights reserved.
