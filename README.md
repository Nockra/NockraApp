# Nockra final pack

Production-oriented static application for Robinhood Chain token tooling and Pons V2 launching.

## Public configuration
Edit only `config.json` for public project values such as coin name, ticker, network label, contract address, X URL and Pons Family buy URL template. No private keys or secrets belong in this file.

The buy URL is generated from `buyUrlTemplate` by replacing `{ca}` with `contractAddress`. Invalid or missing public values are omitted from the public UI without setup or developer notices.

## Routes
- `/`
- `/{ticker in lowercase}` via the SPA rewrite, e.g. `/nockra`
- `/docs`
- `/privacy`
- `/terms`
- `/disclaimer`
- `/cookies`
- custom 404 for all other routes
- tool workspace via `/#tool/<tool-id>`

## Hosting
`vercel.json` is included for Vercel. `_redirects` is included for Netlify-compatible static hosting. Any other host must rewrite application routes to `/index.html` while serving static assets normally.

## Local review
Run a local static server from this folder, for example `python -m http.server 8080`, then open `http://localhost:8080/`.

## Wallet actions
All writes require an injected EVM wallet, the Robinhood Chain network, live RPC access and user approval. Test with a suitable wallet and funds before production release.
