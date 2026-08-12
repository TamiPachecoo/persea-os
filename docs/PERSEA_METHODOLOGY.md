# PERSEA Methodology — Client Lifecycle & Onboarding Workflow

This is the canonical, human-readable spec for how a lead becomes a fully onboarded PERSEA mentorship client — corrected from the earlier framing (still visible in `01-architecture.md`'s original text and in the `app/` prototype) where the client journey appeared to start at Phase 1 ("Identity").

**Documentation only.** No code, schema, or UI changes are authorized by this document. See `01-architecture.md` §9 for how this workflow maps onto the engines already planned there, and `REDESIGN_NOTES.md` for the audit and decision trail behind it.

This file is distinct from two other things it might be confused with:
- `persea/methodology/` — currently an empty folder. It is the *future machine-readable config* (`phase-1-identity.json` etc.) that will eventually implement pieces of what's described here. This file is the human-readable spec that config will eventually serve; they are not the same artifact.
- `05-user-flows.md`'s existing **"Flow 1 — Client Onboarding"** — that flow describes something narrower: admin invites a client, the client sets a password, and lands on the dashboard (account activation only). The "Client Onboarding Workflow" described here is the broader pre-mentorship process this document defines. The two aren't yet reconciled — see §5 and §7.

## 1. Corrected Client Lifecycle

The client journey does not begin at Phase 1. It begins the moment a lead becomes a client:

**Lead → Client → Onboarding → Mentorship Access → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Ongoing Support**

```
Lead ──(becomes client)──▶ Onboarding (6 steps, §2) ──▶ Mentorship Access ──▶ Phase 1 ──▶ Phase 2 ──▶ Phase 3 ──▶ Phase 4 ──▶ Ongoing Support
```

Both `01-architecture.md` (in its original form) and the `app/` mock-data prototype implicitly treat "Identity" (Phase 1) as the starting point of the client experience. Neither previously accounted for what happens between someone agreeing to join the mentorship and their first Phase 1 task unlocking. This document names that gap and gives it structure.

**Note on "Phase 1–4":** the `app/` prototype's `TIER_PHASES` constant gives Premium-tier clients 4 phases (Identidade, Imagem, Comportamento, Visibilidade) and Essential-tier clients 3 (Identidade, Imagem, Visibilidade). This document uses "Phase 1–4" as the general frame, but the tier-based phase-count difference is **not reconciled here** — flagged as an open question in §5.

## 2. The Onboarding Workflow

Everything in this section is conceptual. Field lists, status names, and integration boundaries are all subject to revision as the redesign proceeds.

### 2.1 Client Information Collection

**Purpose:** capture the information required for the client's PERSEA contract.

**What happens:** when a new client joins the mentorship, they submit the information needed to populate their contract, before any contract exists yet, including their party type — see below. This is genuinely sensitive personal data (CPF, address) flowing through Persea OS, since it's the actual field data the contract needs, not sample/placeholder data — handle it with the same care as any other regulated PII the system holds (see the LGPD note the contract itself already carries).

**Fields collected and stored in Persea OS (client-editable, draft):**
- Full legal name
- Party type: **PF** (pessoa física) or **PJ** (pessoa jurídica) — determines which contract template variant is used (see §2.2)
- CPF or CNPJ
- Company name / razão social — only shown/required when party type is PJ
- Address
- Email
- Phone / WhatsApp
- Other contract-specific fields, to be identified later

**Architectural note:** the client submits *editable* information that will later populate an *existing* Persea contract template. Persea OS is not generating the contract template — only collecting the values that go into one that already exists outside this system.

**Not decided yet:** the exact, final field list beyond what's listed above, and any validation rules.

### 2.2 Contract Preparation

**Purpose:** turn submitted client information into a contract ready for signature.

**Pipeline:** Client information → Contract preparation → Contract ready for signature.

Persea already has existing contract templates — confirmed to be more than one. **No contract-generation engine is being built in this pass** — the pipeline above describes an eventual workflow, not something implemented now.

**Contract template selection.** Reviewing two real PERSEA mentorship contracts surfaced two independent selectors, not one:
- **Duration/tier** — e.g. "Semestral" (6 months) vs. "Anual" (12 months) confirmed so far, extensible to others later. This isn't just a number that changes — it changes which clauses exist at all: number of encontros, the specific scope/bonus items, price, the payment-installment structure, and whether an extended no-penalty cancellation clause is present (seen in Anual, absent in Semestral).
- **Party type** — PF or PJ, captured from the client in §2.1, changing which identity fields the printed contract shows for the CONTRATANTE.

Both selectors, together, determine which boilerplate template is used; only the admin-entered values below get filled into it.

**Admin-entered business terms (draft, per contract):**
- Duration/tier selection (Semestral, Anual, …)
- Total contract value
- Payment schedule — not a flat installment count; the real contracts show it as one or more *blocks*, each with its own total, installment count, per-installment amount, and start date (a block's payments can run longer than the service term itself)
- Contract start date — its own trigger rule differs by template: tied to confirmed first payment in one template seen, tied to the signature date itself in another
- Which execution-track/scope option applies, where the template offers a mutually-exclusive choice (seen in the Anual template only)

**Admin requirement:** the admin should be able to see the status of this process at a glance. This is stated as a requirement, not a UI spec.

**Conceptual contract-status vocabulary** (not final, refinable later):

| Status | Meaning |
|---|---|
| Information Pending | Client hasn't submitted their information yet |
| Information Received | Client submitted information, not yet used to prepare a contract |
| Contract Prepared | Contract template populated with the client's information |
| Sent for Signature | Contract handed to the external e-signature platform |
| Awaiting Signature | Client hasn't signed yet |
| Signed | Client has signed externally |
| Contract Uploaded / Completed | Signed contract is back inside Persea OS |

### 2.3 External Contract Signature

**What happens:** the actual signature happens through an external signing platform. **No integration with a signing platform is being built in this pass.**

**Expected workflow:**
1. Client submits their contract information inside Persea OS.
2. The contract is prepared.
3. The contract is sent to the external signing platform.
4. The client signs externally.
5. The signed contract returns to the Persea team.
6. The signed contract is uploaded into Persea OS.

**Architectural note:** this should leave room for a future API/integration if PERSEA chooses to automate this later. See `01-architecture.md` §9.3 for the corresponding non-integration callout.

### 2.4 Signed Contract Access

**Storage:** once signed, the signed contract is stored within the client's profile in Persea OS — part of their permanent record.

**Admin:** can upload and manage the signed contract.

**Client:** can access their completed contract from their own interface.

This is conceptually analogous to how the (already-planned) Playbook Engine gates published content to the client — not being reused literally yet, just the closest existing pattern for "admin publishes, client reads."

### 2.5 WhatsApp Community / Group

**What happens:** after the contract is signed, the client is added to the mentorship's WhatsApp group.

**For now, this is treated as an onboarding milestone, not an automated integration.**

**Admin visibility:** the admin interface should eventually make it easy to identify whether a client has been:
- Added to the WhatsApp group
- Not yet added
- Pending another onboarding requirement

**Not decided yet:** whether this remains a manual admin action or becomes partially automated.

### 2.6 Online Classes / Initial Resources

**What happens:** once onboarding requirements are complete, the client receives access to the mentorship's online classes and resources.

**Content types:** online classes, recorded lessons, supporting materials, documents, links, initial orientation content, and other resources associated with the program.

**Not decided yet:** whether classes are hosted directly inside Persea OS or Persea OS provides access to content hosted elsewhere. This document does not make that architectural decision.

This is a plausible extension of the already-planned, currently unused generic `resources` table (`docs/02-database-schema.md`) — noted here as a possibility, not a decision.

## 3. Client-Facing Onboarding Experience (Future — Not Built This Pass)

From the client's perspective, onboarding should eventually feel like a clear journey, not a set of disconnected administrative tasks. A possible conceptual progression:

**Welcome → Complete Your Information → Contract → Signature → WhatsApp Community → Classes & Resources → Begin Mentorship**

A future prototype pass will explore what this onboarding experience could look like visually. That exploration is explicitly out of scope for this document.

## 4. Admin-Side Onboarding Visibility (Concept)

The admin dashboard should eventually be able to answer, at a glance, how many clients are at each onboarding stage — for example:

> "3 clients onboarding / 1 awaiting contract / 2 ready to start Phase 1"

This is a first-class admin concern, equally important as the client-facing onboarding experience — not an afterthought bolted onto the CRM. This is stated here as a requirement to design toward; no dashboard changes are made in this pass.

## 5. Open Questions (Consolidated)

- Any additional fields beyond the §2.1 list (e.g. profession, marital status — common in Brazilian individual-party contracts but not seen in the two contracts reviewed so far).
- Whether other contract tiers exist beyond the two confirmed (Semestral, Anual), and whether both PF and PJ variants exist for each.
- Final contract-status vocabulary — the table in §2.2 is conceptual, not final.
- Manual vs. partially automated WhatsApp group membership tracking (§2.5).
- Where online classes/resources are ultimately hosted (§2.6).
- Reconciling "Phase 1–4" with the Premium (4-phase) vs. Essential (3-phase) tier difference already present in the `app/` prototype (§1) — and now also with the Semestral/Anual contract-tier naming, which doesn't obviously map onto Premium/Essential.
- Reconciling this document's "Client Onboarding Workflow" with `05-user-flows.md`'s existing, narrower "Flow 1 — Client Onboarding" (account activation only).

## 6. Non-Goals for This Document

- No onboarding UI is being built in this pass.
- No integration with a signature platform.
- No integration with WhatsApp.
- No learning management system (LMS) is being built.
- No decision on where classes will ultimately be hosted.
- No contract-generation engine.
- No changes to `docs/05-user-flows.md` or `docs/02-database-schema.md` in this pass — flagged as follow-up work in `01-architecture.md` §9.4.

## 7. Related Documents

- [`01-architecture.md`](01-architecture.md) §9 — how this workflow maps onto the engines already planned in this repo.
- [`REDESIGN_NOTES.md`](REDESIGN_NOTES.md) — the decision log and audit trail behind this document.
- [`05-user-flows.md`](05-user-flows.md), [`02-database-schema.md`](02-database-schema.md) — flagged, not yet updated; a follow-up pass is required to reconcile the existing "Flow 1" naming and add concrete schema fields.
- `persea/methodology/` — the future machine-readable config home for this content; empty today.
