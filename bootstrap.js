(() => {
  'use strict';
  const defaults = {
    coinName: '', ticker: '', network: '', contractAddress: '', xUrl: '', buyUrlTemplate: '', description: '',
    chain: { id: 4663, hexId: '0x1237', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrl: 'https://rpc.mainnet.chain.robinhood.com', explorerUrl: 'https://robinhoodchain.blockscout.com' },
    ponsV2: { factory: '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e', usdG: '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168', publicSite: 'https://www.ponsfamily.com/launchpad' },
    uniswapV3: { factory: '0x1f7d7550B1b028f7571E69A784071F0205FD2EfA', positionManager: '0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3', swapRouter: '0xCaf681a66D020601342297493863E78C959E5cb2', quoterV2: '0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7', weth: '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73' }
  };
  const merge = (a,b) => ({...a,...b,chain:{...a.chain,...(b?.chain||{}),nativeCurrency:{...a.chain.nativeCurrency,...(b?.chain?.nativeCurrency||{})}},ponsV2:{...a.ponsV2,...(b?.ponsV2||{})},uniswapV3:{...a.uniswapV3,...(b?.uniswapV3||{})}});
  const load = src => new Promise((resolve,reject) => { const s=document.createElement('script'); s.src=src; s.onload=resolve; s.onerror=reject; document.head.appendChild(s); });
  const safeText = v => typeof v === 'string' ? v.trim() : '';
  const placeholder = v => /^(?:CA_GOES_HERE|COIN NAME|ABC|YOUR_X_URL|YOUR_USERNAME|PLACEHOLDER|TODO|TBD|REPLACE_ME|\{ca\})$/i.test(safeText(v));
  const boot = async () => {
    let raw = {};
    try { const r = await fetch('/config.json', {cache:'no-store'}); if (r.ok) raw = await r.json(); } catch {}
    const cfg = merge(defaults, raw || {});
    if (placeholder(cfg.coinName)) cfg.coinName = '';
    if (placeholder(cfg.ticker)) cfg.ticker = '';
    if (placeholder(cfg.network)) cfg.network = '';
    if (placeholder(cfg.contractAddress)) cfg.contractAddress = '';
    if (placeholder(cfg.xUrl)) cfg.xUrl = '';
    window.NOCKRA_CONFIG = Object.freeze(cfg);
    document.documentElement.dataset.configReady = 'true';
    try {
      await load('https://cdnjs.cloudflare.com/ajax/libs/ethers/6.13.5/ethers.umd.min.js');
      await load('/token-artifact.js');
      await load('/app.js');
    } catch {
      document.documentElement.dataset.appReady = 'false';
    }
  };
  boot();
})();
