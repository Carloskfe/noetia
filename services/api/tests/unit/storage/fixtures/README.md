# Test-only TLS fixtures (PO-047)

Throwaway certificates for `storage.service.s2-read.spec.ts`. They protect nothing and are used nowhere else.

| File | Purpose |
|---|---|
| `ca.pem` | Test CA (its key was deleted after signing) |
| `server.pem` / `server.key` | Server certificate for 127.0.0.1, signed by the test CA. Used by the trusted-HTTPS success test, via a test-only agent that trusts `ca.pem` |
| `selfsigned.pem` / `selfsigned.key` | Untrusted self-signed certificate. Proves the production agent rejects TLS that fails verification |

Regenerate with `openssl` (validity 100 years). The procedure is in the PO-047 report.
