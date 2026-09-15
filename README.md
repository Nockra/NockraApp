# RHC Factory

A static, self-hostable Robinhood Chain token interface styled from the supplied CoinFactory reference and integrated directly with Pons V2.

## What is actually implemented

- Robinhood Chain wallet connection through an injected EIP-1193 wallet.
- Automatic add/switch to Robinhood Chain mainnet, chain ID `4663`.
- Live RPC reads. No hard-coded block numbers, token balances, fees, success messages, or launch addresses.
- Pons V2 token creation through the live factory at `0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e`.
- Live `canLaunch(wallet)` eligibility check. The UI will not pretend a launch is available when the protocol gate rejects the connected wallet.
- Live enumeration of enabled Pons V2 launch configurations through `launchConfigCount()` and `getLaunchConfig()`.
- Live `launchFee`, `maxCreatorTaxBps`, `previewLaunchEconomics`, approved-pair and launch-forwarder reads.
- Direct launch via the three-argument Pons V2 `launchToken` entry point.
- Launch with explicit snipe-tax exemptions via the four-argument `launchToken` entry point.
- Atomic launch + developer buy through the factory's current `launchForwarder()`.
- Native ETH developer buy sends exactly `launchFee + quoteIn` as value.
- ERC-20 developer buy sends only `launchFee`, checks balance/allowance, and approves the current Pons forwarder when necessary.
- Exact ERC-20 approvals. For tokens that reject non-zero-to-non-zero approval changes, the UI clears the old allowance first.
- Preflight `eth_call` simulation before every launch, developer buy, transfer, burn, and approval transaction where applicable.
- Pons launch salt generated with `crypto.getRandomValues`.
- Creator fee recipient goes directly into Pons V2 launch params. There is **no charity distributor, charity split, donation contract, remit service, or charity route** in this project.
- Token manager for standard ERC-20 reads, transfers, `burn(uint256)` when supported, and `wallet_watchAsset`.
- Search, responsive navigation, live network status, transaction/token links, and actual post-confirmation result screens.

## Run locally

This project has no build step.

```bash
cd rhc-factory
python3 -m http.server 8080
```

Open `http://localhost:8080` in a browser with an EVM wallet.

Do not open `index.html` as a `file://` URL. Wallets and browser security policies are more reliable over `http://localhost` or HTTPS.

## Production RPC

`config.js` uses Robinhood Chain's public RPC so the site runs without credentials:

```js
window.RHC_FACTORY_CONFIG = {
  rpcUrl: 'https://rpc.mainnet.chain.robinhood.com'
};
```

Robinhood's own documentation says the public endpoint is rate-limited and recommends a provider endpoint for production traffic. Replace `rpcUrl` with your dedicated Robinhood Chain RPC before a public launch.

No RPC secret should be embedded in a public static site if your provider treats it as a sensitive credential. Use a provider key that supports origin restrictions, or put RPC access behind infrastructure you control.

## Pons V2 behavior

The integration reads live protocol state before signing rather than assuming the factory remains open or its economics remain unchanged. Pons V2 can restrict launchers, change launch configuration terms, rotate the launch-and-buy forwarder, change the launch fee, and change approved quote assets. The app handles those as live contract state.

The advanced launch form supports:

- enabled launch config selection
- native ETH, USDG, or another live-approved Pons pair token
- creator fee recipient
- creator tax, checked against the live cap
- buyback flag
- optional atomic developer buy
- optional raw `minTokensOut` floor
- up to 32 explicit opening-tax exemption addresses
- creator metadata and all five Pons social fields

For a developer buy against an ERC-20 pair, the browser approves the **current live Pons launch forwarder**, because the direct Pons router pulls the quote asset from the wallet that calls it.

## Security model

- This website never requests a seed phrase or private key.
- Transactions are signed in the user's wallet.
- Launch terms are pinned with `previewLaunchEconomics` immediately before simulation and signing.
- A launch result is shown only after the transaction receipt reports success.
- A developer-buy token result comes from the simulated return value of the exact transaction call and is only surfaced after the real transaction confirms.
- The interface does not bypass Pons launch gating. If `canLaunch(account)` is false, launch controls remain blocked.
- Third-party smart contracts and wallets can still contain bugs. Pons is an external protocol and Robinhood Chain is an external network.

## Files

- `index.html` — complete interface and semantic markup
- `styles.css` — responsive CoinFactory-inspired visual system
- `app.js` — wallet, RPC, Pons V2 and ERC-20 logic
- `config.js` — deploy-time RPC setting
- `assets/favicon.svg` — independent RHC Factory mark

## Dependency

The page loads Ethers v6.17.0 from the pinned jsDelivr URL in `index.html`. If you require a zero-third-party static bundle, vendor that exact browser build into your deployment and change the script `src` to the local file.

## Important current protocol note

Pons V2 documentation currently says public launches are gated and tells integrations to check `canLaunch(address)`. This site does that. A wallet that is not eligible cannot be made eligible by frontend code, and the UI does not claim otherwise.

## Independence

RHC Factory is an independent interface. It is not affiliated with or endorsed by Robinhood Markets, Inc. or Pons. The names are used only to identify the chain and protocol being integrated.
