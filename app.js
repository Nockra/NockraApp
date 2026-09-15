(() => {
  'use strict';

  const CONFIG = window.RHC_FACTORY_CONFIG || {};
  const CHAIN_ID = 4663;
  const CHAIN_HEX = '0x1237';
  const RPC = CONFIG.rpcUrl || 'https://rpc.mainnet.chain.robinhood.com';
  const EXPLORER = 'https://robinhoodchain.blockscout.com';
  const PONS_SITE = 'https://www.ponsfamily.com/launchpad';
  const PONS_FACTORY = '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e';
  const USDG = '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168';
  const ZERO = '0x0000000000000000000000000000000000000000';

  const FACTORY_READ_ABI = [
    'function launchEnabled() view returns (bool)',
    'function canLaunch(address launcher) view returns (bool)',
    'function launchConfigCount() view returns (uint256)',
    'function getLaunchConfig(uint256 id) view returns ((uint256 supply,uint256 curveFeeBps,uint256 phantomQuote,uint256 graduationThreshold,uint24 poolFee,int24 tickSpacing,bool enabled))',
    'function launchFee() view returns (uint256)',
    'function maxCreatorTaxBps() view returns (uint256)',
    'function approvedPairTokens(address pairToken) view returns (bool)',
    'function previewLaunchEconomics(uint256 launchConfigId,address pairToken) view returns (bytes32)',
    'function launchForwarder() view returns (address)'
  ];
  const FACTORY_PLAIN_ABI = [
    'function launchToken((string name,string symbol,string logo,string description,(string twitter,string telegram,string discord,string website,string farcaster) socials,address creatorFeeRecipient,uint16 creatorTaxBps,bool buybackEnabled,bytes32 expectedEconomics,bytes32 salt) params,uint256 launchConfigId,address pairToken) payable returns (address token,address curve)'
  ];
  const FACTORY_EXEMPT_ABI = [
    'function launchToken((string name,string symbol,string logo,string description,(string twitter,string telegram,string discord,string website,string farcaster) socials,address creatorFeeRecipient,uint16 creatorTaxBps,bool buybackEnabled,bytes32 expectedEconomics,bytes32 salt) params,uint256 launchConfigId,address pairToken,address[] snipeTaxExemptions) payable returns (address token,address curve)'
  ];
  const FORWARDER_ABI = [
    'function launchAndBuy((string name,string symbol,string logo,string description,(string twitter,string telegram,string discord,string website,string farcaster) socials,address creatorFeeRecipient,uint16 creatorTaxBps,bool buybackEnabled,bytes32 expectedEconomics,bytes32 salt) params,uint256 launchConfigId,address pairToken,uint256 quoteIn,uint256 minTokensOut,address recipient,address[] snipeTaxExemptions) payable returns (address token,address curve,uint256 tokensOut)'
  ];
  const ERC20_ABI = [
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)',
    'function totalSupply() view returns (uint256)',
    'function balanceOf(address) view returns (uint256)',
    'function allowance(address,address) view returns (uint256)',
    'function approve(address,uint256) returns (bool)',
    'function transfer(address,uint256) returns (bool)',
    'function burn(uint256)'
  ];

  const state = {
    e: window.ethers || null,
    publicProvider: null,
    browserProvider: null,
    signer: null,
    account: null,
    pons: null,
    launchConfigs: [],
    loadedToken: null,
    pairCheckToken: 0
  };

  const $ = (id) => document.getElementById(id);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function shortAddress(value, front = 6, back = 4) {
    if (!value || value.length < front + back + 3) return value || '—';
    return `${value.slice(0, front)}…${value.slice(-back)}`;
  }

  function showToast(message, type = 'info') {
    const node = document.createElement('div');
    node.className = `toast ${type}`;
    node.textContent = message;
    $('toastHost').appendChild(node);
    setTimeout(() => node.remove(), 5200);
  }

  function setMessage(id, message, type = 'info') {
    const el = $(id);
    if (!el) return;
    if (!message) {
      el.hidden = true;
      el.textContent = '';
      el.className = 'form-message';
      return;
    }
    el.hidden = false;
    el.textContent = message;
    el.className = `form-message ${type}`;
  }

  function explainError(error) {
    const candidates = [
      error?.shortMessage,
      error?.reason,
      error?.info?.error?.message,
      error?.error?.message,
      error?.data?.message,
      error?.message
    ].filter(Boolean);
    let msg = candidates[0] || 'Unknown wallet or RPC error.';
    msg = String(msg).replace(/^Error:\s*/i, '').replace('ethers-user-denied:', '');
    if (/user rejected|user denied|ACTION_REJECTED/i.test(msg)) return 'Transaction was rejected in the wallet.';
    if (/insufficient funds/i.test(msg)) return 'The wallet does not have enough ETH to cover the transaction and gas.';
    if (/could not coalesce error/i.test(msg) && candidates[1]) return String(candidates[1]);
    return msg.length > 360 ? `${msg.slice(0, 357)}…` : msg;
  }

  function setButtonBusy(button, busy, busyText, normalText) {
    if (!button) return;
    button.disabled = busy;
    if (busy) {
      button.dataset.originalText = button.textContent;
      button.textContent = busyText;
    } else {
      button.textContent = normalText || button.dataset.originalText || button.textContent;
    }
  }

  function byteLength(text) {
    return new TextEncoder().encode(text).length;
  }

  function validateLogo(value) {
    const v = value.trim();
    if (!v) throw new Error('A logo URL is required. Use an https:// or ipfs:// URI.');
    if (!/^https:\/\//i.test(v) && !/^ipfs:\/\//i.test(v)) throw new Error('Logo URL must start with https:// or ipfs://.');
    if (byteLength(v) > 512) throw new Error('Logo URL is longer than 512 bytes. Use a shorter HTTPS or IPFS URI.');
    return v;
  }

  function validateMetadata(prefix) {
    const name = $(`${prefix}Name`).value.trim();
    const symbol = $(`${prefix}Symbol`).value.trim().toUpperCase();
    const logo = validateLogo($(`${prefix}Logo`).value);
    const description = $(`${prefix}Description`).value.trim();
    if (!name || name.length > 64) throw new Error('Token name must be between 1 and 64 characters.');
    if (!/^[A-Z0-9]{2,11}$/.test(symbol)) throw new Error('Symbol must be 2 to 11 letters or numbers.');
    return { name, symbol, logo, description };
  }

  function randomSalt() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return state.e.hexlify(bytes);
  }

  function formatEth(value) {
    if (value == null || !state.e) return '—';
    const n = state.e.formatEther(value);
    const parts = n.split('.');
    if (parts.length === 1) return `${n} ETH`;
    const frac = parts[1].replace(/0+$/, '').slice(0, 8);
    return `${parts[0]}${frac ? `.${frac}` : ''} ETH`;
  }

  function percentFromBps(bps) {
    const n = Number(bps) / 100;
    return Number.isInteger(n) ? `${n}%` : `${n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}%`;
  }

  async function initProviders() {
    if (!state.e) {
      markInfrastructureUnavailable('The pinned ethers library could not load. Check this site’s network access before using wallet actions.');
      return;
    }
    state.publicProvider = new state.e.JsonRpcProvider(RPC);
    await refreshAllLiveState();
  }

  function markInfrastructureUnavailable(message) {
    ['homeRpcDot', 'homeFactoryDot', 'createStatusDot'].forEach((id) => $(id)?.classList.add('bad'));
    if ($('homeBlock')) $('homeBlock').textContent = 'Unavailable';
    if ($('homeFactoryState')) $('homeFactoryState').textContent = 'Unavailable';
    if ($('networkRpcState')) $('networkRpcState').textContent = 'Unavailable';
    if ($('networkPonsState')) $('networkPonsState').textContent = 'Unavailable';
    if ($('ponsEnabled')) $('ponsEnabled').textContent = 'Unavailable';
    if ($('simpleFee')) $('simpleFee').textContent = 'Unavailable';
    showToast(message, 'error');
  }

  async function readPonsState() {
    if (!state.publicProvider) throw new Error('Public provider is not available.');
    const f = new state.e.Contract(PONS_FACTORY, FACTORY_READ_ABI, state.publicProvider);
    const requests = [f.launchEnabled(), f.launchFee(), f.maxCreatorTaxBps(), f.launchForwarder(), state.publicProvider.getBlockNumber(), f.launchConfigCount()];
    if (state.account) requests.push(f.canLaunch(state.account));
    const [enabled, fee, maxTax, forwarder, block, configCount, canLaunch] = await Promise.all(requests);
    const count = Number(configCount);
    if (!Number.isSafeInteger(count) || count < 0 || count > 128) throw new Error(`Unexpected Pons launch config count: ${configCount}`);
    const configsRaw = await Promise.all(Array.from({ length: count }, (_, i) => f.getLaunchConfig(i)));
    const configs = configsRaw.map((cfg, i) => ({
      id: BigInt(i), enabled: Boolean(cfg.enabled), curveFeeBps: BigInt(cfg.curveFeeBps),
      supply: BigInt(cfg.supply), graduationThreshold: BigInt(cfg.graduationThreshold),
      poolFee: BigInt(cfg.poolFee), tickSpacing: BigInt(cfg.tickSpacing)
    })).filter((cfg) => cfg.enabled);
    return { enabled, fee, maxTax, forwarder, block, canLaunch: state.account ? Boolean(canLaunch) : null, configs };
  }

  async function refreshAllLiveState() {
    if (!state.publicProvider) return;
    try {
      const p = await readPonsState();
      state.pons = p;
      state.launchConfigs = p.configs;
      renderLaunchConfigs();
      $('homeRpcDot').className = 'status-dot good';
      $('homeFactoryDot').className = `status-dot ${p.enabled ? 'good' : 'warn'}`;
      $('createStatusDot').className = `status-dot ${state.account ? (p.canLaunch ? 'good' : 'warn') : (p.enabled ? 'good' : 'warn')}`;
      $('homeBlock').textContent = `Block ${p.block.toLocaleString()}`;
      $('homeFactoryState').textContent = p.enabled ? 'Public gate open' : 'Public gate restricted';
      $('simpleFee').textContent = formatEth(p.fee);
      $('simpleConfig').textContent = p.configs.length ? `#${p.configs[0].id}` : 'No enabled config';
      $('ponsEnabled').textContent = p.enabled ? 'Public gate open' : (state.account ? (p.canLaunch ? 'Wallet eligible' : 'Restricted') : 'Restricted');
      $('ponsFee').textContent = formatEth(p.fee);
      $('ponsMaxTax').textContent = percentFromBps(p.maxTax);
      $('ponsForwarder').textContent = p.forwarder === ZERO ? 'Unavailable' : shortAddress(p.forwarder, 8, 6);
      $('ponsForwarder').title = p.forwarder;
      $('ponsBlock').textContent = p.block.toLocaleString();
      $('networkBlock').textContent = p.block.toLocaleString();
      $('networkRpcState').textContent = 'Responding';
      $('networkPonsState').textContent = p.enabled ? 'Public gate open' : 'Public gate restricted';
      $('networkFee').textContent = formatEth(p.fee);
      $('networkTax').textContent = percentFromBps(p.maxTax);
      updateLaunchButtons();
      updateValuePreview();
    } catch (error) {
      state.pons = null;
      state.launchConfigs = [];
      renderLaunchConfigs();
      markInfrastructureUnavailable(`Live Robinhood/Pons read failed: ${explainError(error)}`);
      updateLaunchButtons();
    }
  }

  async function ensureRobinhoodNetwork() {
    if (!window.ethereum) throw new Error('No injected EVM wallet was found in this browser. Install or open a wallet that supports Robinhood Chain.');
    let current = await window.ethereum.request({ method: 'eth_chainId' });
    if (String(current).toLowerCase() === CHAIN_HEX) return;
    try {
      await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_HEX }] });
    } catch (error) {
      if (error?.code !== 4902 && !/Unrecognized chain|not added/i.test(error?.message || '')) throw error;
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: CHAIN_HEX,
          chainName: 'Robinhood Chain',
          nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
          rpcUrls: [RPC],
          blockExplorerUrls: [EXPLORER]
        }]
      });
      current = await window.ethereum.request({ method: 'eth_chainId' });
      if (String(current).toLowerCase() !== CHAIN_HEX) throw new Error('Wallet is not connected to Robinhood Chain.');
    }
  }

  async function connectWallet() {
    if (!state.e) throw new Error('The ethers library did not load. Wallet actions are disabled.');
    if (!window.ethereum) throw new Error('No injected EVM wallet was found. Use a browser wallet that supports custom EVM networks.');
    await window.ethereum.request({ method: 'eth_requestAccounts' });
    await ensureRobinhoodNetwork();
    state.browserProvider = new state.e.BrowserProvider(window.ethereum);
    state.signer = await state.browserProvider.getSigner();
    state.account = await state.signer.getAddress();
    updateWalletUi();
    await refreshAllLiveState();
    await refreshLoadedTokenBalance();
    return state.account;
  }

  function updateWalletUi() {
    $('walletButtonLabel').textContent = state.account ? shortAddress(state.account) : 'Connect wallet';
    if (state.account) {
      if (!$('simpleRecipient').value.trim()) $('simpleRecipient').value = state.account;
      if (!$('advRecipient').value.trim()) $('advRecipient').value = state.account;
    }
    updateLaunchButtons();
  }

  function updateLaunchButtons() {
    const eligible = Boolean(state.account && state.pons?.canLaunch && state.launchConfigs.length);
    $('simpleLaunchButton').textContent = !state.account ? 'Connect wallet to check eligibility' : !state.pons ? 'Live terms unavailable' : !eligible ? 'This wallet is not launch-eligible' : 'Launch token';
    $('advancedLaunchButton').textContent = !state.account ? 'Connect wallet to check eligibility' : !state.pons ? 'Live terms unavailable' : !eligible ? 'This wallet is not launch-eligible' : 'Review and launch';
    $('simpleLaunchButton').disabled = Boolean(state.account && !eligible);
    $('advancedLaunchButton').disabled = Boolean(state.account && !eligible);
  }

  async function requireWalletAndPons() {
    if (!state.account || !state.signer) await connectWallet();
    await ensureRobinhoodNetwork();
    const fresh = await readPonsState();
    state.pons = fresh;
    if (!fresh.canLaunch) throw new Error('The live Pons V2 launch gate does not currently allow this wallet to create a launch.');
    if (!fresh.configs.length) throw new Error('Pons V2 currently reports no enabled launch configurations.');
    return fresh;
  }

  async function economicsFor(pairToken, configId) {
    const f = new state.e.Contract(PONS_FACTORY, FACTORY_READ_ABI, state.publicProvider);
    return f.previewLaunchEconomics(configId, pairToken);
  }

  function renderLaunchConfigs() {
    const select = $('advConfig');
    if (!select) return;
    const current = select.value;
    if (!state.launchConfigs.length) {
      select.innerHTML = '<option value="">No enabled launch configs</option>';
      $('advConfigReview').textContent = 'None enabled';
      return;
    }
    select.innerHTML = state.launchConfigs.map((cfg) => `<option value="${cfg.id}">Config #${cfg.id} • curve fee ${percentFromBps(cfg.curveFeeBps)}</option>`).join('');
    if (state.launchConfigs.some((cfg) => String(cfg.id) === current)) select.value = current;
    $('advConfigReview').textContent = `#${select.value}`;
  }

  function selectedConfigId() {
    const raw = $('advConfig')?.value;
    if (raw === undefined || raw === '') throw new Error('No enabled Pons V2 launch configuration is available.');
    return BigInt(raw);
  }

  function makeParams(meta, socials, recipient, taxBps, buyback, economics) {
    return [
      meta.name,
      meta.symbol,
      meta.logo,
      meta.description,
      [socials.twitter || '', socials.telegram || '', socials.discord || '', socials.website || '', socials.farcaster || ''],
      recipient,
      taxBps,
      buyback,
      economics,
      randomSalt()
    ];
  }

  async function handleSimpleLaunch(event) {
    event.preventDefault();
    const button = $('simpleLaunchButton');
    setMessage('simpleMessage', '');
    try {
      if (!state.account) {
        await connectWallet();
        if (!state.pons?.canLaunch) return;
      }
      setButtonBusy(button, true, 'Reading live launch terms…');
      const fresh = await requireWalletAndPons();
      const meta = validateMetadata('simple');
      const recipientRaw = $('simpleRecipient').value.trim() || state.account;
      if (!state.e.isAddress(recipientRaw)) throw new Error('Creator fee recipient is not a valid EVM address.');
      const recipient = state.e.getAddress(recipientRaw);
      const configId = fresh.configs[0].id;
      const economics = await economicsFor(ZERO, configId);
      const params = makeParams(meta, {
        twitter: $('simpleTwitter').value.trim(),
        telegram: $('simpleTelegram').value.trim(),
        website: $('simpleWebsite').value.trim()
      }, recipient, 0, false, economics);

      setButtonBusy(button, true, 'Simulating launch…');
      setMessage('simpleMessage', 'Simulating the exact Pons V2 launch before your wallet is asked to sign.', 'info');
      const contract = new state.e.Contract(PONS_FACTORY, FACTORY_PLAIN_ABI, state.signer);
      const prediction = await contract.launchToken.staticCall(params, configId, ZERO, { value: fresh.fee });

      setButtonBusy(button, true, 'Confirm in wallet…');
      const tx = await contract.launchToken(params, configId, ZERO, { value: fresh.fee });
      setMessage('simpleMessage', `Transaction submitted: ${tx.hash}. Waiting for confirmation…`, 'info');
      setButtonBusy(button, true, 'Waiting for confirmation…');
      const receipt = await tx.wait();
      if (!receipt || receipt.status !== 1) throw new Error('The transaction was mined but did not succeed.');
      setMessage('simpleMessage', `Confirmed. Token ${prediction[0]} was launched on Robinhood Chain.`, 'success');
      showLaunchResult(prediction[0], prediction[1], tx.hash);
      showToast('Token launch confirmed on Robinhood Chain.', 'success');
    } catch (error) {
      setMessage('simpleMessage', explainError(error), 'error');
    } finally {
      setButtonBusy(button, false, null, state.account && state.pons?.canLaunch ? 'Launch token' : 'Connect wallet to check eligibility');
      updateLaunchButtons();
    }
  }

  function currentPairAddress() {
    const mode = $('advPair').value;
    if (mode === 'native') return ZERO;
    if (mode === 'usdg') return USDG;
    return $('advCustomPair').value.trim();
  }

  async function getPairInfo(pairAddress, requireApproved = true) {
    if (pairAddress === ZERO) return { address: ZERO, symbol: 'ETH', decimals: 18, approved: true };
    if (!state.e.isAddress(pairAddress)) throw new Error('Pair token address is not a valid EVM address.');
    const normalized = state.e.getAddress(pairAddress);
    const factory = new state.e.Contract(PONS_FACTORY, FACTORY_READ_ABI, state.publicProvider);
    const token = new state.e.Contract(normalized, ERC20_ABI, state.publicProvider);
    const [approved, symbol, decimals] = await Promise.all([
      factory.approvedPairTokens(normalized),
      token.symbol(),
      token.decimals()
    ]);
    if (requireApproved && !approved) throw new Error(`${symbol} is not currently approved as a Pons V2 pair token.`);
    return { address: normalized, symbol, decimals: Number(decimals), approved };
  }

  async function updatePairCheck() {
    const seq = ++state.pairCheckToken;
    $('customPairLabel').hidden = $('advPair').value !== 'custom';
    const pairAddress = currentPairAddress();
    const box = $('pairCheck');
    try {
      if ($('advPair').value === 'custom' && !pairAddress) {
        box.textContent = 'Enter a custom pair address. It will be checked against the Pons V2 factory.';
        box.className = 'inline-status';
        return;
      }
      box.textContent = 'Checking pair against Pons V2…';
      box.className = 'inline-status';
      const info = await getPairInfo(pairAddress, false);
      if (seq !== state.pairCheckToken) return;
      if (info.address === ZERO) {
        box.textContent = 'ETH is the native Pons V2 pair.';
        box.className = 'inline-status good';
      } else if (info.approved) {
        box.textContent = `${info.symbol} is approved by the Pons V2 factory (${info.decimals} decimals).`;
        box.className = 'inline-status good';
      } else {
        box.textContent = `${info.symbol} is not currently approved by the Pons V2 factory.`;
        box.className = 'inline-status bad';
      }
    } catch (error) {
      if (seq !== state.pairCheckToken) return;
      box.textContent = explainError(error);
      box.className = 'inline-status bad';
    }
    updateValuePreview();
  }

  function parseDecimal(value, decimals, fieldName) {
    const v = String(value || '').trim();
    if (!v) return 0n;
    if (!/^\d+(\.\d+)?$/.test(v)) throw new Error(`${fieldName} must be a positive decimal number.`);
    return state.e.parseUnits(v, decimals);
  }

  function parseExemptions() {
    const values = $('advExemptions').value.split(/[\n,]+/).map((x) => x.trim()).filter(Boolean);
    if (values.length > 32) throw new Error('Pons V2 accepts at most 32 explicit snipe-tax exemption addresses.');
    const out = [];
    const seen = new Set();
    for (const value of values) {
      if (!state.e.isAddress(value)) throw new Error(`Invalid exemption address: ${value}`);
      const a = state.e.getAddress(value);
      const key = a.toLowerCase();
      if (!seen.has(key)) { seen.add(key); out.push(a); }
    }
    return out;
  }

  function parseMinOutRaw() {
    const v = $('advMinOut').value.trim();
    if (!v) return 0n;
    if (!/^\d+$/.test(v)) throw new Error('Minimum tokens out must be an integer in raw token units.');
    return BigInt(v);
  }

  async function ensurePairAllowance(pair, amount, spender) {
    if (pair.address === ZERO || amount === 0n) return;
    const read = new state.e.Contract(pair.address, ERC20_ABI, state.publicProvider);
    const [balance, allowance] = await Promise.all([read.balanceOf(state.account), read.allowance(state.account, spender)]);
    if (balance < amount) throw new Error(`Your wallet holds ${state.e.formatUnits(balance, pair.decimals)} ${pair.symbol}, but the developer buy needs ${state.e.formatUnits(amount, pair.decimals)} ${pair.symbol}.`);
    if (allowance >= amount) return;

    setMessage('advancedMessage', `Approval required. Approve exactly ${state.e.formatUnits(amount, pair.decimals)} ${pair.symbol} for the current Pons launch forwarder.`, 'info');
    const token = new state.e.Contract(pair.address, ERC20_ABI, state.signer);

    // Some ERC-20s reject changing a non-zero allowance directly to another non-zero value.
    // If that pattern is detected, clear the old allowance first and then set the exact amount.
    if (allowance > 0n) {
      try {
        await token.approve.staticCall(spender, amount);
      } catch {
        const clearTx = await token.approve(spender, 0n);
        setMessage('advancedMessage', `Clearing the previous ${pair.symbol} allowance: ${clearTx.hash}.`, 'info');
        const clearReceipt = await clearTx.wait();
        if (!clearReceipt || clearReceipt.status !== 1) throw new Error('Could not clear the existing pair-token allowance. Nothing was launched.');
      }
    }
    await token.approve.staticCall(spender, amount);
    const approval = await token.approve(spender, amount);
    setMessage('advancedMessage', `Approval submitted: ${approval.hash}. Waiting for confirmation…`, 'info');
    const receipt = await approval.wait();
    if (!receipt || receipt.status !== 1) throw new Error('The pair-token approval did not succeed. Nothing was launched.');
  }

  async function handleAdvancedLaunch(event) {
    event.preventDefault();
    const button = $('advancedLaunchButton');
    setMessage('advancedMessage', '');
    try {
      if (!state.account) {
        await connectWallet();
        if (!state.pons?.canLaunch) return;
      }
      setButtonBusy(button, true, 'Reading live terms…');
      const fresh = await requireWalletAndPons();
      const meta = validateMetadata('adv');
      const pair = await getPairInfo(currentPairAddress(), true);
      const recipientRaw = $('advRecipient').value.trim() || state.account;
      if (!state.e.isAddress(recipientRaw)) throw new Error('Creator fee recipient is not a valid EVM address.');
      const recipient = state.e.getAddress(recipientRaw);
      const taxPercent = Number($('advTax').value || 0);
      if (!Number.isFinite(taxPercent) || taxPercent < 0) throw new Error('Creator tax cannot be negative.');
      const taxBps = Math.round(taxPercent * 100);
      if (taxBps > Number(fresh.maxTax)) throw new Error(`Creator tax exceeds the live Pons maximum of ${percentFromBps(fresh.maxTax)}.`);
      const buyback = $('advBuyback').checked;
      const quoteIn = parseDecimal($('advDevBuy').value, pair.decimals, 'Developer buy');
      const minTokensOut = parseMinOutRaw();
      const exemptions = parseExemptions();
      if (quoteIn === 0n && minTokensOut > 0n) throw new Error('Minimum tokens out is only used when a developer buy is greater than zero.');

      const configId = selectedConfigId();
      const liveConfig = fresh.configs.find((cfg) => cfg.id === configId);
      if (!liveConfig) throw new Error(`Pons launch config #${configId} is no longer enabled. Refresh and choose an enabled config.`);
      const economics = await economicsFor(pair.address, configId);
      const params = makeParams(meta, {
        twitter: $('advTwitter').value.trim(), telegram: $('advTelegram').value.trim(),
        discord: $('advDiscord').value.trim(), website: $('advWebsite').value.trim(), farcaster: $('advFarcaster').value.trim()
      }, recipient, taxBps, buyback, economics);

      let predictedToken;
      let predictedCurve;
      let tx;
      if (quoteIn > 0n) {
        if (!fresh.forwarder || fresh.forwarder === ZERO) throw new Error('Pons V2 does not currently expose a launch-and-buy forwarder, so developer buy is unavailable.');
        if (pair.address !== ZERO) {
          setButtonBusy(button, true, 'Checking pair-token allowance…');
          await ensurePairAllowance(pair, quoteIn, fresh.forwarder);
        }
        const value = pair.address === ZERO ? fresh.fee + quoteIn : fresh.fee;
        const forwarder = new state.e.Contract(fresh.forwarder, FORWARDER_ABI, state.signer);
        setButtonBusy(button, true, 'Simulating launch + buy…');
        setMessage('advancedMessage', 'Simulating the exact atomic Pons V2 launch-and-buy call.', 'info');
        const prediction = await forwarder.launchAndBuy.staticCall(params, configId, pair.address, quoteIn, minTokensOut, state.account, exemptions, { value });
        [predictedToken, predictedCurve] = prediction;
        setButtonBusy(button, true, 'Confirm launch in wallet…');
        tx = await forwarder.launchAndBuy(params, configId, pair.address, quoteIn, minTokensOut, state.account, exemptions, { value });
      } else if (exemptions.length) {
        const factory = new state.e.Contract(PONS_FACTORY, FACTORY_EXEMPT_ABI, state.signer);
        setButtonBusy(button, true, 'Simulating launch…');
        setMessage('advancedMessage', 'Simulating the Pons V2 launch with your exemption list.', 'info');
        const prediction = await factory.launchToken.staticCall(params, configId, pair.address, exemptions, { value: fresh.fee });
        [predictedToken, predictedCurve] = prediction;
        setButtonBusy(button, true, 'Confirm launch in wallet…');
        tx = await factory.launchToken(params, configId, pair.address, exemptions, { value: fresh.fee });
      } else {
        const factory = new state.e.Contract(PONS_FACTORY, FACTORY_PLAIN_ABI, state.signer);
        setButtonBusy(button, true, 'Simulating launch…');
        setMessage('advancedMessage', 'Simulating the direct Pons V2 launch.', 'info');
        const prediction = await factory.launchToken.staticCall(params, configId, pair.address, { value: fresh.fee });
        [predictedToken, predictedCurve] = prediction;
        setButtonBusy(button, true, 'Confirm launch in wallet…');
        tx = await factory.launchToken(params, configId, pair.address, { value: fresh.fee });
      }

      setMessage('advancedMessage', `Submitted ${tx.hash}. Waiting for Robinhood Chain confirmation…`, 'info');
      setButtonBusy(button, true, 'Waiting for confirmation…');
      const receipt = await tx.wait();
      if (!receipt || receipt.status !== 1) throw new Error('The launch transaction was mined but did not succeed.');
      setMessage('advancedMessage', `Confirmed. Token ${predictedToken} is live on Robinhood Chain.`, 'success');
      showLaunchResult(predictedToken, predictedCurve, tx.hash);
      showToast('Pons V2 launch confirmed.', 'success');
      await refreshAllLiveState();
    } catch (error) {
      setMessage('advancedMessage', explainError(error), 'error');
    } finally {
      setButtonBusy(button, false, null, state.account && state.pons?.canLaunch ? 'Review and launch' : 'Connect wallet to check eligibility');
      updateLaunchButtons();
    }
  }

  function showLaunchResult(token, curve, hash) {
    const panel = $('launchResult');
    panel.hidden = false;
    $('resultToken').href = `${EXPLORER}/address/${token}`;
    $('resultToken').textContent = token;
    $('resultCurve').href = `${EXPLORER}/address/${curve}`;
    $('resultCurve').textContent = curve;
    $('resultTx').href = `${EXPLORER}/tx/${hash}`;
    $('resultTx').textContent = shortAddress(hash, 12, 10);
    $('resultPons').href = `${PONS_SITE}/${token}`;
    if (location.hash !== '#launchpad') location.hash = '#launchpad';
    setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
  }

  function updateValuePreview() {
    if (!state.pons || !$('advValuePreview')) return;
    const pair = currentPairAddress();
    const buy = $('advDevBuy')?.value.trim() || '';
    if (pair === ZERO && buy && /^\d+(\.\d+)?$/.test(buy)) {
      try {
        const total = state.pons.fee + state.e.parseUnits(buy, 18);
        $('advValuePreview').textContent = `${formatEth(total)} total`;
      } catch { $('advValuePreview').textContent = 'Check amount'; }
    } else {
      $('advValuePreview').textContent = `${formatEth(state.pons.fee)} native value`;
    }
  }

  async function loadToken() {
    setMessage('managerMessage', '');
    if (!state.e || !state.publicProvider) return setMessage('managerMessage', 'Blockchain library or RPC is unavailable.', 'error');
    const raw = $('managerAddress').value.trim();
    if (!state.e.isAddress(raw)) return setMessage('managerMessage', 'Enter a valid Robinhood Chain contract address.', 'error');
    const address = state.e.getAddress(raw);
    const button = $('loadTokenButton');
    setButtonBusy(button, true, 'Loading…');
    try {
      const code = await state.publicProvider.getCode(address);
      if (code === '0x') throw new Error('No contract code exists at that address on Robinhood Chain.');
      const token = new state.e.Contract(address, ERC20_ABI, state.publicProvider);
      const [name, symbol, decimals, supply] = await Promise.all([token.name(), token.symbol(), token.decimals(), token.totalSupply()]);
      state.loadedToken = { address, name, symbol, decimals: Number(decimals), supply };
      $('tokenDashboard').hidden = false;
      $('tokenAvatar').textContent = String(symbol || 'T').slice(0, 1).toUpperCase();
      $('tokenName').textContent = name;
      $('tokenSymbol').textContent = symbol;
      $('tokenAddressShort').textContent = shortAddress(address, 10, 8);
      $('tokenAddressShort').title = address;
      $('tokenDecimals').textContent = String(decimals);
      $('tokenSupply').textContent = `${formatTokenAmount(supply, Number(decimals))} ${symbol}`;
      $('tokenExplorerLink').href = `${EXPLORER}/address/${address}`;
      await refreshLoadedTokenBalance();
      setMessage('managerMessage', `Loaded ${name} (${symbol}) from Robinhood Chain.`, 'success');
    } catch (error) {
      state.loadedToken = null;
      $('tokenDashboard').hidden = true;
      setMessage('managerMessage', explainError(error), 'error');
    } finally { setButtonBusy(button, false, null, 'Load token'); }
  }

  function formatTokenAmount(value, decimals) {
    if (!state.e) return String(value);
    const raw = state.e.formatUnits(value, decimals);
    const [whole, frac = ''] = raw.split('.');
    const compact = frac.replace(/0+$/, '').slice(0, 8);
    return Number(whole).toLocaleString('en-US') + (compact ? `.${compact}` : '');
  }

  async function refreshLoadedTokenBalance() {
    if (!state.loadedToken) return;
    if (!state.account || !state.publicProvider) {
      $('tokenBalance').textContent = 'Connect wallet';
      return;
    }
    try {
      const token = new state.e.Contract(state.loadedToken.address, ERC20_ABI, state.publicProvider);
      const balance = await token.balanceOf(state.account);
      $('tokenBalance').textContent = `${formatTokenAmount(balance, state.loadedToken.decimals)} ${state.loadedToken.symbol}`;
    } catch { $('tokenBalance').textContent = 'Unable to read'; }
  }

  async function handleTransfer(event) {
    event.preventDefault();
    setMessage('transferMessage', '');
    try {
      if (!state.loadedToken) throw new Error('Load a token first.');
      if (!state.account) await connectWallet();
      await ensureRobinhoodNetwork();
      const toRaw = $('transferRecipient').value.trim();
      if (!state.e.isAddress(toRaw)) throw new Error('Recipient is not a valid EVM address.');
      const amount = parseDecimal($('transferAmount').value, state.loadedToken.decimals, 'Transfer amount');
      if (amount <= 0n) throw new Error('Transfer amount must be greater than zero.');
      const token = new state.e.Contract(state.loadedToken.address, ERC20_ABI, state.signer);
      await token.transfer.staticCall(state.e.getAddress(toRaw), amount);
      const tx = await token.transfer(state.e.getAddress(toRaw), amount);
      setMessage('transferMessage', `Submitted ${tx.hash}. Waiting for confirmation…`, 'info');
      const receipt = await tx.wait();
      if (!receipt || receipt.status !== 1) throw new Error('The transfer did not succeed.');
      setMessage('transferMessage', `Transfer confirmed. ${shortAddress(tx.hash, 12, 10)}`, 'success');
      await refreshLoadedTokenBalance();
    } catch (error) { setMessage('transferMessage', explainError(error), 'error'); }
  }

  async function handleBurn(event) {
    event.preventDefault();
    setMessage('burnMessage', '');
    try {
      if (!state.loadedToken) throw new Error('Load a token first.');
      if (!state.account) await connectWallet();
      await ensureRobinhoodNetwork();
      const amount = parseDecimal($('burnAmount').value, state.loadedToken.decimals, 'Burn amount');
      if (amount <= 0n) throw new Error('Burn amount must be greater than zero.');
      const token = new state.e.Contract(state.loadedToken.address, ERC20_ABI, state.signer);
      await token.burn.staticCall(amount);
      const tx = await token.burn(amount);
      setMessage('burnMessage', `Submitted ${tx.hash}. Waiting for confirmation…`, 'info');
      const receipt = await tx.wait();
      if (!receipt || receipt.status !== 1) throw new Error('The burn transaction did not succeed.');
      setMessage('burnMessage', 'Burn confirmed on Robinhood Chain.', 'success');
      await loadToken();
    } catch (error) { setMessage('burnMessage', explainError(error), 'error'); }
  }

  async function watchAsset() {
    setMessage('watchMessage', '');
    try {
      if (!state.loadedToken) throw new Error('Load a token first.');
      if (!window.ethereum) throw new Error('No injected wallet is available.');
      const accepted = await window.ethereum.request({
        method: 'wallet_watchAsset',
        params: { type: 'ERC20', options: { address: state.loadedToken.address, symbol: state.loadedToken.symbol, decimals: state.loadedToken.decimals } }
      });
      setMessage('watchMessage', accepted ? 'Wallet accepted the token request.' : 'Wallet did not add the token.', accepted ? 'success' : 'info');
    } catch (error) { setMessage('watchMessage', explainError(error), 'error'); }
  }

  function route() {
    const page = (location.hash || '#home').slice(1);
    const allowed = ['home', 'create', 'launchpad', 'manager', 'network'];
    const target = allowed.includes(page) ? page : 'home';
    document.querySelectorAll('.page-section').forEach((el) => el.classList.toggle('active-page', el.id === `page-${target}`));
    document.querySelectorAll('.dropdown-menu').forEach((el) => { el.hidden = true; });
    $('mobileNav').hidden = true;
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (target === 'network' || target === 'launchpad') refreshAllLiveState();
  }

  function setupMenus() {
    document.querySelectorAll('.dropdown-trigger').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const target = $(button.dataset.menu);
        document.querySelectorAll('.dropdown-menu').forEach((menu) => { if (menu !== target) menu.hidden = true; });
        target.hidden = !target.hidden;
      });
    });
    document.addEventListener('click', () => document.querySelectorAll('.dropdown-menu').forEach((menu) => { menu.hidden = true; }));
    $('mobileMenuButton').addEventListener('click', () => { $('mobileNav').hidden = !$('mobileNav').hidden; });
  }

  function setupSearch() {
    const items = [
      { title: 'Create Robinhood Chain token', sub: 'Simple direct Pons V2 launch', href: '#create' },
      { title: 'Pons V2 Launchpad', sub: 'Pair, tax, buyback, developer buy and exemptions', href: '#launchpad' },
      { title: 'Token Manager', sub: 'Inspect, transfer, burn and watch ERC-20 tokens', href: '#manager' },
      { title: 'Network Status', sub: 'RPC, chain ID and live factory terms', href: '#network' }
    ];
    const input = $('siteSearch');
    const results = $('searchResults');
    const render = () => {
      const q = input.value.trim().toLowerCase();
      if (!q) { results.hidden = true; results.innerHTML = ''; return; }
      const matches = items.filter((x) => `${x.title} ${x.sub}`.toLowerCase().includes(q));
      results.innerHTML = matches.length ? matches.map((x) => `<a href="${x.href}"><strong>${x.title}</strong><small>${x.sub}</small></a>`).join('') : '<a><strong>No matching tool</strong><small>Try “launch”, “token”, or “network”.</small></a>';
      results.hidden = false;
    };
    input.addEventListener('input', render);
    input.addEventListener('focus', render);
    document.addEventListener('click', (e) => { if (!$('searchShell').contains(e.target)) results.hidden = true; });
    results.addEventListener('click', () => { results.hidden = true; input.value = ''; });
  }

  function setupEvents() {
    window.addEventListener('hashchange', route);
    $('connectButton').addEventListener('click', async () => {
      try { await connectWallet(); showToast(`Connected ${shortAddress(state.account)} on Robinhood Chain.`, 'success'); }
      catch (error) { showToast(explainError(error), 'error'); }
    });
    $('simpleLaunchForm').addEventListener('submit', handleSimpleLaunch);
    $('advancedLaunchForm').addEventListener('submit', handleAdvancedLaunch);
    $('refreshPonsButton').addEventListener('click', refreshAllLiveState);
    $('networkRefreshButton').addEventListener('click', refreshAllLiveState);
    $('advConfig').addEventListener('change', () => { $('advConfigReview').textContent = `#${$('advConfig').value}`; });
    $('advPair').addEventListener('change', updatePairCheck);
    $('advCustomPair').addEventListener('input', () => { clearTimeout($('advCustomPair')._timer); $('advCustomPair')._timer = setTimeout(updatePairCheck, 450); });
    $('advDevBuy').addEventListener('input', updateValuePreview);
    $('loadTokenButton').addEventListener('click', loadToken);
    $('managerAddress').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); loadToken(); } });
    $('transferForm').addEventListener('submit', handleTransfer);
    $('burnForm').addEventListener('submit', handleBurn);
    $('watchAssetButton').addEventListener('click', watchAsset);

    if (window.ethereum?.on) {
      window.ethereum.on('accountsChanged', async (accounts) => {
        state.account = accounts?.[0] ? state.e.getAddress(accounts[0]) : null;
        if (state.account && state.browserProvider) state.signer = await state.browserProvider.getSigner();
        updateWalletUi();
        refreshAllLiveState();
        refreshLoadedTokenBalance();
      });
      window.ethereum.on('chainChanged', async () => {
        state.browserProvider = null;
        state.signer = null;
        state.account = null;
        updateWalletUi();
        try {
          const chain = await window.ethereum.request({ method: 'eth_chainId' });
          if (String(chain).toLowerCase() === CHAIN_HEX) {
            state.browserProvider = new state.e.BrowserProvider(window.ethereum);
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts?.[0]) { state.signer = await state.browserProvider.getSigner(); state.account = await state.signer.getAddress(); updateWalletUi(); await refreshAllLiveState(); }
          }
        } catch {}
      });
    }
  }

  function patchMinOutLabel() {
    const input = $('advMinOut');
    if (!input) return;
    const label = input.closest('label');
    label.childNodes[0].textContent = 'Minimum tokens out (raw units) ';
    const help = label.querySelector('.help');
    if (help) help.textContent = 'Optional integer passed directly to Pons V2. Leave blank for 0.';
  }

  async function boot() {
    setupMenus();
    setupSearch();
    setupEvents();
    patchMinOutLabel();
    route();
    await initProviders();
    await updatePairCheck();
    if (window.ethereum && state.e) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        const chain = await window.ethereum.request({ method: 'eth_chainId' });
        if (accounts?.[0] && String(chain).toLowerCase() === CHAIN_HEX) {
          state.browserProvider = new state.e.BrowserProvider(window.ethereum);
          state.signer = await state.browserProvider.getSigner();
          state.account = await state.signer.getAddress();
          updateWalletUi();
          await refreshAllLiveState();
        }
      } catch {}
    }
  }

  boot();
})();
