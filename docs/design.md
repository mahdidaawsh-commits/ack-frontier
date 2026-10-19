# Bounded response with partial observation

## Boundary

The deployer freezes a reporter repository, series, deadline `w` in 1..3 and 1..16 ordered commit-pinned report URLs/SHA-256 hashes. Applications may publish real operational checkpoint reports and consume the resulting monitor status. The contract owns report acquisition, independent validator classification, exact temporal propagation and immutable history. The publisher owns the underlying observations; consensus cannot establish that a dishonest publisher reported physical reality truthfully.

Each source is UTF-8 JSON with exactly `{series, checkpoint, clauses}` and 1..12 prose clauses. `checkpoint` must equal the current zero-based cursor. Raw bytes are hash checked, limited to 16 KB and parsed with duplicate-key rejection. A missing or mismatched report reverts; it never becomes a fabricated all-NO checkpoint. Calling advance is permissionless, but the caller cannot provide event labels or change the report descriptor.

The schema's period/index is deterministic. Interpreting the prose is consequential nondeterministic work: was an alarm actually raised, was a human acknowledgement actually made, does a transport receipt merely report delivery, is an earlier alarm historical, and is an event's absence explicitly established? Validators independently acquire and classify the full source; storing only a hash or verifying a leader's JSON shape is insufficient.

## Event abstraction and consensus

The exact ordered atoms are `amber_alarm, amber_ack, blue_alarm, blue_ack`. Each has YES, NO or UNKNOWN and 1..3 material zero-based source-clause anchors. YES requires actual event occurrence in the current checkpoint. NO requires explicit absence or an explicitly exhaustive inventory excluding the event. Silence in an incomplete log, conflicting statements and unresolved occurrence require UNKNOWN. Transport delivery, future promises, examples and historical events are distinguished from actual current human acknowledgements.

The leader returns the complete fetched source and all four classifications. Each validator re-fetches and hash-checks the source, independently derives all four values, requires exact agreement including NO and UNKNOWN, and runs a second full-source audit of every material decision and anchor. No confidence score or tolerance can cross a decision boundary. Anchor choices may differ if valid and substantively supported. Network errors, malformed model responses and source mismatches leave state unchanged. The custom validator rejects non-returning leader outcomes rather than accepting unverified failures; outages may require retry or leader rotation.

Unknown atoms independently take either Boolean value. This deliberately defines an **over-approximation** if real events have correlations not represented by those four atoms; the contract never infers those correlations from prose. Claims of possible or definite violation refer to this explicit abstraction. Correlated model mistakes, prompt injection and publisher dishonesty remain limitations despite independent derivation and auditing.

## Temporal semantics

For either channel, an alarm at checkpoint `t` is satisfied by any human acknowledgement in the inclusive discrete window `[t, t+w]`. Multiple alarms coalesce while an older alarm remains unanswered. An acknowledgement discharges all currently pending alarms in that channel, including alarms in the same checkpoint. Within-checkpoint event order and per-alarm acknowledgement IDs are outside this coarse policy; an acknowledgement is treated as dominating all alarms in that checkpoint. The policy does not claim it occurred after each alarm in physical time.

The initial state is idle (`-1`) on both channels. A nonnegative age below `w` is the age of the oldest unanswered alarm. Value `w` means a **historical breached deadline**, an absorbing state. For a non-breached state, increment any prior pending age, open a new age-zero obligation only if none is pending, process acknowledgement, then record a breach if any remaining age reaches `w`. This lets an acknowledgement at the exact deadline satisfy the obligation, prevents repeated alarms from resetting the deadline, and preserves a breach after late acknowledgement.

The frontier is the sorted deduplicated set of all possible channel-state pairs after the observed prefix. Each step propagates every state through every Boolean expansion of UNKNOWN values. There are at most `(w+2)^2 <= 25` pairs, independent of the timeline's length. No probabilistic weighting, model confidence or majority vote between these possible worlds occurs.

Summary classification over the prefix:

- **VIOLATED:** every possible state contains a historical channel breach.
- **AT_RISK:** some possible states contain a breach and some do not.
- **PENDING:** none contains a breach, but at least one has an unfinished obligation.
- **CLEAR:** every state is idle with no recorded historical breach.

Per-channel summaries use the same interpretation. CLEAR concerns the consumed prefix only; it is not a promise about future events. Consuming the last supplied report changes lifecycle from ACTIVE to EXHAUSTED; it does not create additional ticks, assume missing acknowledgements, or close pending obligations. Historical violations remain immutable. No owner override, deadline reset, source amendment, certificate lifecycle, graph proposal or certificate consumption path exists.

Each history item stores the source commitment, complete source, agreed event classifications, frontier before/after and summary. Storage uses JSON strings for configuration/frontier, a u256 cursor and a typed append-only DynArray of history JSON. No wall clock, user-supplied trace text at advancement, native value or external settlement contract is involved.

## Independent tests and proofs

The Python oracle enumerates entire concrete Boolean histories. It checks each actual alarm directly: if its deadline has elapsed, does an acknowledgement occur in its inclusive response window? It computes pending age from alarms after the last acknowledgement only when no historical deadline failed. It never calls or duplicates the contract's incremental transition function. A separate JavaScript oracle checks every history item and complete state.

For each of three deadlines, direct tests cover all 729 one-channel ternary three-checkpoint observation patterns. Twelve seeded tests cover 120 generated two-channel histories up to six checkpoints. Other tests explicitly exercise validator callbacks, each disagreeing event atom, UNKNOWN versus YES/NO, full-source re-fetch, substantive anchor audits, malformed committed reports, configuration limits, atomic failure, pending obligations at exhaustion, repeated alarms and late acknowledgements.

Live proof fixtures are synthetic and include historical alarms, hypothetical instructions, transport receipts and future promises as decoys. Three instances demonstrate (1) timely acknowledgements including the exact deadline, (2) repeated alarms failing to reset a deadline followed by a late acknowledgement preserving the breach, and (3) uncertainty producing both a safe and a breached possible world. A fourth attempted advance after the timely timeline is exhausted must reject atomically.

Background: [Symbolic Runtime Verification for Monitoring under Uncertainties and Assumptions](https://arxiv.org/abs/2207.05678) studies monitoring with partial knowledge of observed runs. AckFrontier is a smaller explicitly specified bounded-response monitor, not an implementation of that paper's general symbolic framework and not a formal proof of the GenLayer code.
