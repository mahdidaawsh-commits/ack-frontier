# Temporal-monitor proofs

Live receipts and complete checkpoint states will be recorded here after the published workflow completes. Direct tests use mocked web/model responses and explicitly execute validator callbacks; live proofs use real StudioNet consensus.

The proof plan deploys three monitors and advances ten checkpoints, then proves exhaustion rejects an extra advance. The independent verifier checks all fourteen receipts, exact deployed source, actual decoded calldata, votes, append-only histories, and full-state snapshots against whole-history response-window oracles.

`node scripts/verify-proofs.cjs` performs fresh RPC/CLI reads; `--offline` verifies downloaded artifacts. Set `GENLAYER_CLI_PATH` to pinned CLI 0.39.2 and use `ACK_ACCOUNT` for an existing CLI account for fresh read calls. Neither verifier mode submits transactions.
