# Nockra production pack

This build was repaired from the uploaded `NockraApp-main.zip` rather than from an older generated copy.

## Interaction fix

The previous package had two reliability problems that could make a deployed page look complete while JavaScript controls did not respond:

1. Runtime configuration was awaited before the application attached its interface handlers.
2. Core CSS/JS assets used domain-root paths, which break when the site is served from a repository/subdirectory or opened through physical route fallbacks.

This pack fixes both.

- UI handlers attach immediately. Configuration, RPC reads and wallet-library loading run afterward in the background.
- `app.js` resolves `config.json` from the directory that actually served the application script.
- Root pages use relative CSS/JS/assets.
- Physical `/docs/`, `/nockra/`, and legal fallback pages use project-root relative assets.
- Internal links are normalized to the detected project base, so repository/subdirectory hosting is supported.
- Event binding is defensive. One unavailable optional element cannot stop the rest of the interface from becoming clickable.
- Static application assets and `config.json` use no-store headers on Vercel to prevent an older broken JavaScript build from remaining cached.
- RPC/config work never blocks page interaction.

## Verified interactions

The included browser smoke test checks real DOM interaction in Chromium for:

- Tools menu open/close
- Tool search workspace routing
- Dark/light theme
- English/Chinese toggle
- Token Creator workspace
- Wallet Connect
- Wallet menu
- Disconnect and reconnect
- Pons V2 image file picker
- No browser page errors during the test

Run:

```bash
node tests/qa.mjs
python tests/browser_smoke.py
```

## Deployment

Deploy the **contents of this directory as the site root**. Do not deploy an additional parent folder above `index.html`.

The pack supports:

- Vercel root deployment
- Netlify/static deployment using `_redirects`
- repository/subdirectory hosting for the core interface and physical route fallbacks

For Vercel, keep `vercel.json` at the deployment root.

## Public configuration

`config.json` is the public source of truth for project values, including the ticker, Robinhood Chain label, contract address, X URL, and Pons Family Buy URL template.

The Buy URL template remains:

`https://ponsfamily.com/launchpad/{ca}`

No private keys, seed phrases, API secrets, or wallet credentials belong in `config.json`.

## Wallet behavior

Connect Wallet talks to the injected EVM wallet first and does not wait for RPC reads. When connected, clicking the wallet control opens Copy Address, View on Explorer, and Disconnect.

Blockchain contract actions load ethers when needed. The general website UI remains usable if a third-party library CDN or public RPC is slow.

## Pons V2 image upload

Pons V2 uses an image file picker for PNG, JPEG or WebP. The browser previews and optimizes the image, then sends it to `/api/upload` for persistent IPFS storage.

The included Vercel upload function requires a server-side `PINATA_JWT` environment variable. Do not put this secret in `config.json`.

## Mainnet transactions

No mainnet transaction is automatically broadcast. Writes require a compatible wallet, Robinhood Chain gas, the necessary token permissions, and explicit wallet approval.
