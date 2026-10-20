PROJECT: Travel Inquiry Dispatcher, a private web app for one user (a travel company owner). Developer: Jaykumar Mistry. Deadline: 3 days.

PROBLEM: The owner gets client inquiries (tour packages, tickets) and forwards each one by hand to selected travel agents.

FEATURES
1. Auth: single owner login. No public signup.
2. Agents: CRUD (name, phone, email, active).
3. Inquiry form: Package or Ticket radio. Ticket also has Single way or Going and return. Client name; client phone (stored, NEVER emailed); destination; Package: stops list (place + nights, many); pickup; drop; dates: Fixed or "Anytime between" start/end (dates only, no time); return date for round trip; adults; children; Ticket optional class and airline; notes.
4. Agent checklist with search and select all. Save & Send saves the inquiry, emails each selected agent separately via Resend, records per-agent status (pending, sent, failed) and allows retry of failures.
5. Inquiry list: status I = Inquiry, C = Confirmed, x = Cancelled; change status; hard delete (app and database) with confirmation, cascading to stops and dispatches; Export PDF.
6. Ledger (Khatabook style, owner is the middle person): a ledger record = money received from a client (client name, amount, date, note, optional inquiry link). "+ Send" on a record adds a sent amount (agent name, amount) INSIDE that record, never a new row. Balance held = received minus sum of sent. Sent total can never exceed received. Edit and delete a record; edit and remove each sent amount; totals (received, sent, balance); Export PDF.

OUT OF SCOPE: WhatsApp, agent login, agent replies in-app, multi-user, advanced reports.

STACK: Next.js (App Router, TypeScript) static export, Tailwind + shadcn/ui, React Hook Form + Zod, Supabase (Postgres, Auth, RLS, Edge Functions), Resend, jsPDF + jspdf-autotable. Hosting: GoDaddy static files.

CONSTRAINTS
- No Node server on GoDaddy: no Next.js API routes or server actions.
- Resend API key only in Supabase Edge Function secrets, never in frontend code or git.
- The email is built by ONE server-side function. client_phone is never passed to it.
- Resend free plan: 3,000 emails/month and a daily cap (verify current limits). One email per agent so agents never see each other.
- Currency INR. PDFs use "Rs." unless a font with the rupee symbol is embedded.

ASSUMPTIONS (flag if wrong)
- Deleting an inquiry keeps its ledger record and unlinks it.
- The client's name is included in the agent email.
- GoDaddy plan can host static files and DNS records can be added for Resend.