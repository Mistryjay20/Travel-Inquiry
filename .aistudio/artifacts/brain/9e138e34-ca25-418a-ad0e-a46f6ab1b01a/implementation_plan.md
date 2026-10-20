# Travel Inquiry Dispatcher

Travel Inquiry Dispatcher is a specialized, mobile-first operations hub for a travel company owner to rapidly log inquiries, dispatch tailored quote requests to travel agents in one click without leaking client contact numbers, and maintain an atomic, Khatabook-style ledger for money held and disbursed.

> [!IMPORTANT]
> **Key Decisions & User Specifications Confirmed:**
> - **Folder Architecture:** Clear separation into `frontend/` (React + Tailwind CSS + Lucide icons + Vite) and `backend/` (Node.js + Express REST API).
> - **Data Persistence:** Server-side persistent document database with atomic updates, strictly avoiding temporary in-memory or browser-only primary storage.
> - **Email Dispatching:** Resend integration strictly on the backend. When live credentials are not yet configured, the system generates full HTML previews with clear "Test Mode - Not Dispatched" labels; once live keys are added to `.env`, real emails dispatch individually per agent.
> - **Privacy Firewall:** `client_phone` is strictly confined to the owner's database and UI; it is architecturally excluded from the email generator function and agent dispatch payloads.
> - **Initial State:** Starts with a clean blank database with the owner seeded from environment variables.

---

### 1. Overview & Core Concept

The owner of a travel agency receives high-frequency client requests across tour packages and flight tickets, needing to quickly distribute requests to trusted agents for competitive quotes without exposing the client's direct contact details.

**Primary Workflows:**
1. **Secure Access:** Single-user authentication (email/password seeded via environment variables, bcrypt hashing, JWT cookie/header session).
2. **Rapid Mobile Intake:** A lightning-fast, thumb-optimized 375px intake form supporting Tour Packages (with multi-stop nights) and Tickets (one-way / round-trip with dates, class, and airline preferences).
3. **One-Click Agent Dispatch:** Multi-select agent picker with search, "Select All", and instant dispatch. An isolated backend function renders individual emails per agent via Resend, recording detailed delivery status logs with one-tap retry for failures.
4. **Operations Tracker:** Live inquiry dashboard with fast status toggles (`I` = Inquiry, `C` = Confirmed, `X` = Cancelled), cascade deletion, and PDF generation.
5. **Khatabook Middleman Ledger:** Client payments received tracked against agent disbursements. Embedded disbursement sub-records with strict mathematical invariants: disbursements can never exceed received funds, and received amounts cannot be modified below what was already paid out.

---

### 2. User Experience & Visual Design

#### A. Mobile-First Ergonomics & Spatial Structure
- **Target Viewport:** Optimized for one-handed operation on a 375px smartphone screen, scaling gracefully to tablet and desktop.
- **Thumb Zone Design:** Critical action buttons (Save & Send, + Disburse, Status filters) sit in the natural lower thumb reach area with a minimum 44px touch target.
- **Bottom Navigation Anchor:** Clean, fixed bottom navigation bar with 4 core tabs:
  1. **Inquiries:** List of all active inquiries with quick filters (`All`, `Inquiry`, `Confirmed`, `Cancelled`).
  2. **New:** Fast inquiry capture drawer/form.
  3. **Ledger:** Khatabook middleman view with summary cards and inline disbursement expansion.
  4. **Agents:** Roster of partner travel agents with status toggles and contact details.

#### B. Visual Identity & Theme Tokens
- **Design Philosophy:** Utilitarian, crisp, high-density dashboard. No generic gradients or purple candy buttons.
- **Palette:**
  - Neutral Canvas: Crisp white (`#ffffff`) and soft slate background (`#f8fafc`).
  - Structural Surfaces: Pure white cards with subtle hairline dividers (`#e2e8f0`).
  - Text Hierarchy: Deep charcoal headline (`#0f172a`), muted secondary (`#64748b`), subtle micro-labels (`#94a3b8`).
  - Action Accent: Deep Indigo / Navy (`#1e293b` & `#2563eb`) for high-intent triggers.
  - Semantic Status:
    - Inquiry (`#f59e0b` amber text, unboxed).
    - Confirmed (`#10b981` emerald text, unboxed).
    - Cancelled (`#ef4444` rose text, unboxed).
- **Zero-Pill Discipline:** Metadata (dates, passenger counts, statuses) rendered as clean typography separated by middle dots (`·`) instead of stacked pill capsules.
- **Tabular Figures:** Monospace tabular numerals (`tabular-nums font-mono`) for all monetary values, phone numbers, and dates.

---

### 3. Key Product Decisions & Trade-Offs

#### Architectural Separation (`frontend/` & `backend/`)
- **Structure:** Distinct subdirectories with dedicated `package.json`, environment configurations, and build steps.
- **API Boundary:** Strict REST JSON contract over HTTP. The React frontend never touches backend secrets, environment keys, or file storage directly.

#### Server-Authoritative Storage
- **Choice:** Persistent JSON document store with atomic file swapping and file locking on the Node/Express backend.
- **Invariants:**
  - Foreign key integrity: Deleting an inquiry unlinks it from ledger records (setting `inquiryId = null`) and cascades deletion to stops and dispatches.
  - Over-send protection: Atomic updates verify that `sum(disbursements) <= amountReceived` before committing any ledger edit.

#### Privacy Firewall for Client Phone
- **Implementation:** The email compilation function accepts only an `AgentEmailPayload` type that strictly excludes `client_phone`. Even if a developer attempts to pass client phone data, the TypeScript interface and backend sanitization layer strip it before email template compilation.

#### Resend Emailing & Previews
- **Dual Mode:** When `RESEND_API_KEY` is empty, dispatch entries are logged as `test_preview`, exposing the generated subject and HTML body directly in the UI status drawer with a prominent "Test Mode - Key Not Configured" indicator.
- **Live Mode:** When `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are supplied, the backend invokes Resend's REST API individually for each agent to guarantee recipient privacy.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────┐
│                   React Frontend                       │
│  (Vite + Tailwind CSS + Lucide + jsPDF AutoTable)      │
└──────────────┬─────────────────────────▲───────────────┘
               │ JSON / REST             │ JSON Responses
               │ (JWT Bearer Token)      │
┌──────────────▼─────────────────────────┴───────────────┐
│                 Express REST API                       │
│  (Auth Middleware, Rate Limiter, Zod Schemas)          │
├────────────────────────────────────────────────────────┤
│  /api/auth/*     - Login, Current Session, Logout      │
│  /api/agents/*   - Agent CRUD & Status                 │
│  /api/inquiries  - Validation, Save & Dispatch Engine  │
│  /api/ledger/*   - Khatabook Atomic Balance Updates    │
│  /api/config/*   - Resend Test/Live Status             │
└──────────────┬─────────────────────────┬───────────────┘
               │                         │
┌──────────────▼───────────┐  ┌──────────▼───────────────┐
│ Persistent Data Storage  │  │ Resend Email Provider    │
│ (Atomic Document Store)  │  │ (One per agent, no phone)│
└──────────────────────────┘  └──────────────────────────┘
```

#### Core Data Entities
1. **Owner (`users`):** `id`, `email`, `password_hash`, `created_at`.
2. **Agent (`agents`):** `id`, `name`, `phone`, `email`, `active`, `created_at`.
3. **Inquiry (`inquiries`):** `id`, `inquiry_number`, `type` (`package` | `ticket`), `trip_type` (`single` | `return` | null), `client_name`, `client_phone`, `destination`, `pickup`, `drop`, `date_mode` (`fixed` | `anytime`), `start_date`, `end_date`, `return_date`, `adults`, `children`, `travel_class`, `airline_pref`, `notes`, `status` (`inquiry` | `confirmed` | `cancelled`), `created_at`.
4. **Inquiry Stop (`inquiry_stops`):** `id`, `inquiry_id`, `place`, `nights`, `sequence_order`.
5. **Dispatch Record (`dispatches`):** `id`, `inquiry_id`, `agent_id`, `status` (`pending` | `sent` | `failed` | `test_preview`), `error_text`, `sent_at`, `email_subject`, `email_preview_html`.
6. **Ledger Record (`ledger_records`):** `id`, `client_name`, `amount_received`, `date`, `note`, `inquiry_id` (optional), `disbursements` (embedded array: `id`, `agent_name`, `agent_id`, `amount`, `created_at`).

#### Export Capabilities
- **Client-Side PDF Generation:** Instant generation of professional inquiry summaries and Khatabook ledger reports formatted in Indian numbering (`Rs. XX,XXX`), complete with timestamps and zero company branding.
