# Temporal-monitor proofs

Completed on gasless **StudioNet, chain 61999**. All fourteen canonical receipts are FINALIZED with MAJORITY_AGREE: thirteen successful executions and one expected exhaustion rejection. Exact deployed source, actual decoded calldata, final votes, append-only histories and fresh full-state reads match the independent whole-history response-window oracle. Direct tests use mocked web/model responses and explicitly execute validator callbacks; they are separate from live consensus proofs.

The proof plan deploys three monitors and advances ten checkpoints, then proves exhaustion rejects an extra advance. The independent verifier checks all fourteen receipts, exact deployed source, actual decoded calldata, votes, append-only histories, and full-state snapshots against whole-history response-window oracles.

`node scripts/verify-proofs.cjs` performs fresh RPC/CLI reads; `--offline` verifies downloaded artifacts. Set `GENLAYER_CLI_PATH` to pinned CLI 0.39.2 and use `ACK_ACCOUNT` for an existing CLI account for fresh read calls. Neither verifier mode submits transactions.

## Deployed monitors

| Timeline | Contract explorer | Final result |
| --- | --- | --- |
| Timely responses | [0x6311A98C82b4e9d39c9b0D0E6DD0d2F2B58605F4](https://explorer-studio.genlayer.com/address/0x6311A98C82b4e9d39c9b0D0E6DD0d2F2B58605F4) | CLEAR; both channels idle, one possible state |
| Repeated alarm, late acknowledgement | [0xfe29B9B2efe7E50711989535F2b4AdB6b939a801](https://explorer-studio.genlayer.com/address/0xfe29B9B2efe7E50711989535F2b4AdB6b939a801) | VIOLATED; amber's historical breach survives late acknowledgement |
| Incomplete alarm observation | [0x30969a034964e0E6F9b5EB7182CB7ed29bC5f9DA](https://explorer-studio.genlayer.com/address/0x30969a034964e0E6F9b5EB7182CB7ed29bC5f9DA) | AT_RISK; one idle state and one historically breached state |

Each monitor has a two-checkpoint response deadline. In the frontier pairs below, columns are amber/blue; `-1` means idle, `0` or `1` means oldest unanswered-alarm age, and `2` means an absorbing historical breach.

| Timeline | Checkpoint | Complete frontier after advancement | Summary |
| --- | --- | --- | --- |
| Timely | 0 | `[[0,0]]` | PENDING |
| Timely | 1 | `[[-1,1]]` | PENDING |
| Timely | 2 | `[[-1,-1]]` | CLEAR; blue acknowledgement at exact deadline |
| Repeated | 0 | `[[0,-1]]` | PENDING |
| Repeated | 1 | `[[1,-1]]` | PENDING; new alarm does not reset age |
| Repeated | 2 | `[[2,-1]]` | VIOLATED |
| Repeated | 3 | `[[2,-1]]` | VIOLATED; late human acknowledgement cannot erase breach |
| Uncertain | 0 | `[[-1,-1],[0,-1]]` | PENDING |
| Uncertain | 1 | `[[-1,-1],[1,-1]]` | PENDING |
| Uncertain | 2 | `[[-1,-1],[2,-1]]` | AT_RISK; ambiguity never becomes an all-clear assertion |

All three lifecycles are EXHAUSTED at completion. Exhaustion is independent of the documentary result. A further advance of the timely monitor rejects with exact UserError `[EXPECTED] Timeline exhausted` and leaves the final state unchanged.

## Finalized transactions

Votes are **agree / disagree / idle for the recorded final voting set**, including the leader. The verifier checks that the set contains exactly one leader plus all canonical validator receipts, that no vote category is omitted, and that agree exceeds half this complete final set. Initial requested committee size is not substituted for a smaller rotated final set. These are majority outcomes, not claims of unanimous agreement.

| Operation | Explorer transaction | Execution | Final votes |
| --- | --- | --- | --- |
| Timely deploy | [0xc0420e94…](https://explorer-studio.genlayer.com/tx/0xc0420e94f6525ed6670d9128ebda47adf91b3b4c11f54c61029e2b1749b99100) | SUCCESS | 3 / 0 / 2 |
| Timely checkpoint 0 | [0x3deeaf52…](https://explorer-studio.genlayer.com/tx/0x3deeaf52d40c9c17e1e4b79419ee944aef0f5af2e085c349de1c1cddabd5e2ed) | SUCCESS | 3 / 1 / 1 |
| Timely checkpoint 1 | [0x7b3c4c46…](https://explorer-studio.genlayer.com/tx/0x7b3c4c4660185489ae546304fdbe25301500098c6be0690f8e65ac73fedfef5e) | SUCCESS | 3 / 1 / 1 |
| Timely checkpoint 2 | [0x13f4c470…](https://explorer-studio.genlayer.com/tx/0x13f4c470046f39253ffe2d4fb9750c83407e12f0f2802e7f3c0e994bae402665) | SUCCESS | 3 / 0 / 2 |
| Timely exhausted advance | [0x07a25b9f…](https://explorer-studio.genlayer.com/tx/0x07a25b9f73863d83837ab82872dfa3f00cf8a1f01941bb2494ea85098c17726a) | Expected ERROR | 3 / 0 / 2 |
| Repeated deploy | [0xd31391d2…](https://explorer-studio.genlayer.com/tx/0xd31391d2cc3d5f38f4b8874d8d265a34b1db4d6fc08aefe255432e111db3be94) | SUCCESS | 3 / 0 / 2 |
| Repeated checkpoint 0 | [0x33da7e93…](https://explorer-studio.genlayer.com/tx/0x33da7e936f7c9c3fe448fe9cb18dd4a0526ecad193be3927e11aecbb0a153f00) | SUCCESS | 3 / 1 / 1 |
| Repeated checkpoint 1 | [0x28ec7027…](https://explorer-studio.genlayer.com/tx/0x28ec70278a8cb81c16a7b1fc15fd3c20dc38c622b6be5c8b912315b506d06f93) | SUCCESS | 3 / 0 / 2 |
| Repeated checkpoint 2 | [0xb9e3c63e…](https://explorer-studio.genlayer.com/tx/0xb9e3c63e56bbc56404f530f9c4f58adfe3bea8ac3c46168739f0d51ba4dc68e0) | SUCCESS | **2 / 0 / 1** after two leader rotations |
| Repeated checkpoint 3 | [0xd212a9af…](https://explorer-studio.genlayer.com/tx/0xd212a9af71e4c1369c28fb6561153170064ecd468c1cfedbd694ceceb7b2ab19) | SUCCESS | 3 / 1 / 1 |
| Uncertain deploy | [0x5e1100f8…](https://explorer-studio.genlayer.com/tx/0x5e1100f8961b1e0fb1afaa14f8eaccc3bb73b83debc81b0acadf3fea0c8a2122) | SUCCESS | 5 / 0 / 0 |
| Uncertain checkpoint 0 | [0x7fb190fc…](https://explorer-studio.genlayer.com/tx/0x7fb190fcbe9b08b61bbe89c69af852ac7facc83c6246b9b41af2c6bf19abf2eb) | SUCCESS | 3 / 0 / 2 |
| Uncertain checkpoint 1 | [0xe040d8f8…](https://explorer-studio.genlayer.com/tx/0xe040d8f8e9cb9eacfcef074ced20e455986e100e414656029a9551106639b6d7) | SUCCESS | 3 / 0 / 2 |
| Uncertain checkpoint 2 | [0x86635c42…](https://explorer-studio.genlayer.com/tx/0x86635c42f0d2f1541f0ae65425fa5ab56f5fc32f7241209f1e7a2f7e1f542765) | SUCCESS | **3 / 2 / 0** after one leader rotation |

Repeated checkpoint 2 initially requested five validators. Its receipt preserves two `Leader Rotation` rounds and a final `Accepted` round whose voting set contains the leader and two validator receipts. Its final 2/0/1 tally means two of three recorded final voters agreed, not five-validator agreement. Uncertain checkpoint 2 preserves its rotation and two final dissenting votes. Full consensus histories remain in the sanitized receipts.

## Reproducibility and limits

- [Passing direct-test CI](https://github.com/mahdidaawsh-commits/ack-frontier/actions/runs/39255531490): 67 tests, no failures.
- [Passing deployment and proof workflow](https://github.com/mahdidaawsh-commits/ack-frontier/actions/runs/39255528095): 67 hosted tests; fourteen finalized receipts; full temporal-history verification.
- Source/fixture revision: `21690c4ac5964cdf530414fca778c8e2cfd282d7`. Workflow revision: `b71aa3eb6a29be0e8d5e747377ef44211a41a433`.
- Exact deployed source SHA-256: `e45ef3ca3147a9ef7edefd482e01aa6ed8fecb58391b54f532a17b5a250a2c8d`.
- [Hosted verification](cloud-verification.json), [independent fresh verification](verification.json), [deployment suite](suite.json), [transaction journal](transactions.json), [local tests](local-direct-tests.xml), [hosted tests](cloud-direct-tests.xml).
- Three exhaustive tests each evaluate all 729 one-channel three-checkpoint ternary observation patterns for one deadline. Twelve seeded tests check 120 generated two-channel histories. These are subcases within the 67 pytest tests, not additional pytest counts. A separate JavaScript whole-history oracle checks every direct and live snapshot.

The final local verifier additionally checks complete final voting-set cardinality against the canonical leader plus validator receipt count and records rotation/round counts. The contract source and its deployed behavior remain unchanged.

All report contents were synthetic, public and fixed before deployment. This is a retrospective audit of documentary checkpoint semantics, not a live alerting system or proof of physical operations, acknowledgement identity, wall-clock response time or service delivery. No wallet private keys, passwords or validator node configuration are published.
