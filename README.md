# Nockra rebuilt package

This package is a ground-up rebuild intended to eliminate the page-freeze problem from the previous single-page implementation.

## Architecture

The homepage, public token page, documentation and tool catalog do **not** load a blockchain library or make RPC calls during startup. Wallet connection uses the injected wallet provider directly. Ethers is loaded only when a user actually starts a blockchain action inside a tool.

Every tool has its own route and lightweight workspace:

- `/tools/token-creator`
- `/tools/pons-v2`
- `/tools/multisender`
- `/tools/revoke`
- `/tools/mint`
- `/tools/burn`
- `/tools/create-pool`
- `/tools/add-liquidity`
- `/tools/remove-liquidity`
- `/tools/pause`
- `/tools/unpause`
- `/tools/block`
- `/tools/unblock`
- `/tools/token-page`

Public routes include `/`, `/{ticker}`, `/docs`, `/privacy`, `/terms`, `/disclaimer`, `/cookies`, and a custom 404 page.

## Configuration

Public project values live in `config.json`. The Pons Family buy URL is generated from `buyUrlTemplate` and `contractAddress`. If the CA or X URL is empty or invalid, the related public control is silently omitted.

## Pons V2 image upload

The Pons V2 form uses a real image file picker. `/api/upload.js` sends the selected image to Pinata and returns an IPFS URI internally to the Pons launch contract. Set `PINATA_JWT` as a server-side Vercel environment variable for this upload function. Never place that credential in `config.json`.

## Deployment

Deploy the **contents** of this folder at the hosting root. On Vercel, keep `vercel.json` in the root. Do not nest the package inside an extra folder.

The included UI smoke test intentionally tests menus, theme, language, wallet connection and the token form without making network or mainnet transactions.

## Transaction testing

The interface uses real wallet and contract transaction paths. Mainnet deployment, token launch and liquidity writes are not automatically broadcast by the included tests because doing so would spend real funds and require an authorized wallet signature.
