# AckFrontier

A standalone GenLayer **retrospective bounded-response monitor with uncertain observations**. It independently acquires archived prose checkpoint logs, reaches consensus on four event atoms, and advances a bounded set of possible temporal states. It preserves uncertainty instead of pretending an incomplete log proves that nothing happened.

Two channels, amber and blue, have alarm and human-acknowledgement events. Every alarm must receive an acknowledgement in its checkpoint or within a fixed number of later checkpoints. Repeated alarms do not restart the oldest deadline. An acknowledgement after a missed deadline cannot erase the historical breach.

Validators independently fetch full commit-pinned reports, verify SHA-256 and checkpoint order, derive each YES/NO/UNKNOWN event and compare exact classifications. A separate validator audit checks positive, negative and unknown decisions against materially supporting source clauses. Actual agreed events change pending obligations and the monitor's `CLEAR`, `PENDING`, `AT_RISK` or `VIOLATED` result.

## Run

Python 3.13, Node 24:

```sh
pip install -r requirements-dev.txt
genvm-lint download --version v0.2.16
genvm-lint check contracts/ack_frontier.py --json
python -m pytest tests/direct -q
```

Public methods: permissionless `advance()` consumes exactly the next frozen checkpoint; `get_state()` returns configuration, cursor, frontier, summary and append-only history. Constructor fixes the repository, series, deadline of 1–3 checkpoints, and up to 16 ordered URL/hash commitments. No administrator can skip, replace or reset a checkpoint. No certificates or one-time authorization tokens are issued.

All report contents must exist before deployment because their exact hashes and commit URLs are frozen. This audits an archived process run; it does not ingest future operational reports or act as a live alerting system.

[Contract](contracts/ack_frontier.py) · [Formal semantics and trust boundary](docs/design.md) · [Onchain proofs](proofs/README.md) · [Submission text](docs/submission.md).

Deployed on gasless StudioNet: [primary contract explorer](https://explorer-studio.genlayer.com/address/0x6311A98C82b4e9d39c9b0D0E6DD0d2F2B58605F4). **67 tests passed; fourteen finalized MAJORITY_AGREE receipts** cover three complete timelines and an expected exhaustion rejection. Fresh source, actual calldata, final votes and full histories match independent verification. Proofs explicitly preserve dissent, leader rotations and a smaller final voting set.

The monitor tests compare its incremental state machine with independently enumerated **complete event histories** evaluated by response-window predicates. This is different from testing another copy of the transition function. A separate JavaScript oracle checks every direct/live timeline snapshot.

Set-based monitoring under partial observation is established formal-methods work. The contribution here is this bounded GenLayer implementation with independently validated prose events, exact uncertainty propagation and replayable temporal proofs; no claim is made to invent runtime verification. Generic CLI transport and the Windows direct-test workaround reuse MIT-licensed infrastructure from [RegretCart](https://github.com/mahdidaawsh-commits/regret-cart) and [VectorReserve](https://github.com/gabrieladash123-bit/vector-reserve). This monitor architecture and its temporal oracles are new code.

Reports are synthetic. The contract monitors documented events in discrete checkpoints; it does not prove physical activity, measure wall-clock response time, enforce acknowledgement identity or deliver a service. It holds and transfers no funds.
