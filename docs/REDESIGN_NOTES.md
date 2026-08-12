# Redesign Notes — Running Decision Log

A first-person, narrative log of redesign decisions for the Persea OS, kept alongside the planning docs for continuity — in the same spirit as `09-session-log-2026-07-15.md`, but meant to grow over time rather than record a single session.

**Convention:** new entries are appended **at the top**, newest first, dated `## YYYY-MM-DD — Title`. Past entries are never rewritten — if a decision changes later, a new entry records the change and links back to the entry it supersedes.

**Entry shape** (a loose recommended template, not a rigid schema):

```
## YYYY-MM-DD — Short title

Narrative paragraph(s), first person, what prompted this.

**What already exists** (bullets, only if relevant to this entry)
**What's still missing / not decided** (bullets)
**Decision made this pass** (paragraph or bullets)
**Next steps** (bullets)
```

---

## 2026-08-12 — Correction: CPF/address ARE collected by Persea OS

The entry directly below this one ("Real contracts reviewed; CPF/address excluded from Persea OS") was a misreading of an instruction to keep the two *sample* contracts' real PII out of the documentation — not an instruction to exclude CPF/address from Persea OS's actual data model. They're the opposite: the client inputs CPF and address *through* Persea OS as real contract data, same as every other field in §2.1. Persea OS does need to store them; only the example contracts used to derive this spec shouldn't have their real values sitting in the docs (they never did — confirmed clean).

**Superseded:** the "data-minimization principle" and the CRM Engine table row change from the entry below are reverted. `PERSEA_METHODOLOGY.md` §2.1 and `01-architecture.md` §9.1 are both back to listing CPF/CNPJ and address as fields Persea OS collects and stores, alongside the other client-info fields. The rest of that entry's findings (Semestral/Anual template differences, PF/PJ as an independent selector, nested payment-block structure) still stand — only the storage decision was wrong.

---

## 2026-08-12 — Real contracts reviewed; CPF/address excluded from Persea OS

Reviewed two real PERSEA mentorship contracts (Semestral and Anual) to ground the `PERSEA_METHODOLOGY.md` §2.1/§2.2 field lists in reality instead of guesses. This replaces the earlier entry's generic client-info field list with a concrete one and adds a real decision, so it's recorded as its own entry rather than silently editing the one below.

**What the two real contracts confirmed**
- The CONTRATANTE block (client identity) varies per client: full legal name, CPF, address, phone/WhatsApp, email. The CONTRATADA block (Persea/Fator N's own identity) is identical on every contract — confirms it belongs in tenant-level config, not a per-contract field either side fills in.
- "Contract duration" isn't one field — Semestral (6 months) and Anual (12 months) are genuinely distinct templates: different encontro counts, different scope/bonus items, different price, different payment-installment structure, and Anual has an extended no-penalty cancellation clause that Semestral doesn't.
- Party type (PF vs. PJ) is a second, independent selector from duration — one reviewed contract was labeled PJ, the other PF, unrelated to which duration tier each was.
- Real payment terms are nested, not flat: Semestral's price is split into two installment *blocks*, each with its own total, count, per-installment amount, and start date — one block's payments run past the 6-month service term itself.

**Decision made this pass:** Persea OS will not store CPF/CNPJ or the client's full address, even though the contract text legally requires both. These are sensitive/LGPD-governed fields the *contract* needs but Persea OS has no operational need to persist — storing them anyway would duplicate sensitive PII across two systems for no benefit. Left open: how/where these two fields actually reach the contract if Persea OS isn't the system that stores them.

**Updated:** `PERSEA_METHODOLOGY.md` §2.1 (field list, data-minimization principle), §2.2 (template-selector concept, nested payment terms), §5 (new open questions). `01-architecture.md` §9.1's CRM Engine row corrected to match — no longer lists CPF/address as fields the engine would store.

**Still open:** where CPF/address are captured if not in Persea OS; whether other contract tiers/party-type combinations exist beyond the two reviewed; reconciling Semestral/Anual naming with the existing Premium/Essential tier naming in the `app/` prototype (these don't obviously map onto each other one-to-one).

See [`PERSEA_METHODOLOGY.md`](PERSEA_METHODOLOGY.md) §2.1–§2.2 for the updated spec.

---

## 2026-08-12 — Client journey doesn't start at Phase 1

Realized that the redesigned Persea OS has been implicitly framing the client journey as starting at "Identity" (Phase 1) — both in `01-architecture.md`'s original text and in the `app/` mock-data prototype. In reality there's a whole pre-mentorship process (a lead becoming a client, submitting contract information, getting a contract signed externally, joining the WhatsApp community, getting access to onboarding classes/resources) that wasn't documented anywhere. This is important enough to treat as a defined onboarding workflow, not a future feature footnote — it's a structural correction to how the whole client lifecycle is framed.

**What already exists**
- CRM Engine — `clients.status` enum (`invited/active/paused/completed/churned`, `docs/02-database-schema.md`), but no pre-"active" onboarding granularity.
- Journey Engine — a generic program → phases → steps state machine (`programs`/`program_phases`/`journey_steps`/`client_journey_progress`). `01-architecture.md:99` already states "new consulting phases = new rows, not new tables or new code paths" — this already covers modeling "Onboarding" as a phase/program preceding "Identity," with no new engine required.
- Document Engine, with Playbook Engine already documented as "a thin specialization" of it (`10-platform-architecture-review.md` §5) — the natural analogy for a future Contract specialization.
- A generic `resources` table (`step_id` nullable, "can be general") — schema'd, unused so far.
- A generic `notifications` table (free-text `type`) — could carry future onboarding-milestone notices without new tables.

**What's still missing / not decided**
- No contract concept anywhere (no fields, no status, no mention in docs or `app/`).
- No CPF/CNPJ or legal-data fields anywhere.
- No e-signature platform mention anywhere.
- No WhatsApp-group tracking — the only WhatsApp reference in the repo is an unrelated marketing lead-capture field on the public landing page.
- No onboarding-stage vocabulary distinct from `clients.status`. `app/shared/mock-db.js` hardcodes `profile.status = 'active'` for all three seeded clients, so the prototype can't represent "still onboarding" even informally today.
- No classes/resources/LMS UI anywhere.
- A naming collision: `05-user-flows.md` already has a section titled **"Flow 1 — Client Onboarding,"** but it means something narrower — admin invite → client sets password → dashboard redirect (account activation only). Not reconciled with the broader workflow defined this pass.

**Decision made this pass**
Documentation only — no code, schema, or UI changes:
- New `docs/PERSEA_METHODOLOGY.md` — the canonical spec for the corrected lifecycle and the 6-step onboarding workflow.
- This log, `docs/REDESIGN_NOTES.md` (new).
- `docs/01-architecture.md` extended with a new §9 mapping the workflow onto existing/planned engines, plus a short addendum to §1 stating the corrected lifecycle.
- `docs/05-user-flows.md` and `docs/02-database-schema.md` deliberately left untouched this pass — flagged as follow-up work rather than edited prematurely.

**Still open** (mirrors `PERSEA_METHODOLOGY.md` §5)
- Exact client-information field list.
- Final contract-status vocabulary.
- Manual vs. partially automated WhatsApp group-membership tracking.
- Where classes/resources are ultimately hosted.
- Premium (4-phase) vs. Essential (3-phase) tier reconciliation against the "Phase 1–4" framing.
- The `05-user-flows.md` "Flow 1" naming collision.

**Next steps**
- Follow-up pass on `docs/05-user-flows.md`: add a concrete onboarding flow, and reconcile/rename the existing "Flow 1 — Client Onboarding" so it isn't confused with the broader workflow.
- Follow-up pass on `docs/02-database-schema.md`: add client legal/contact fields, a contract-status field or table, and a WhatsApp-milestone flag, once the open questions above are resolved.
- A future prototype pass to explore the client-facing onboarding UX (the `PERSEA_METHODOLOGY.md` §3 progression bar) visually — explicitly not part of this pass.

See [`PERSEA_METHODOLOGY.md`](PERSEA_METHODOLOGY.md) for the full workflow spec this entry is about, and [`01-architecture.md`](01-architecture.md) §9 for the engine mapping it motivated.
