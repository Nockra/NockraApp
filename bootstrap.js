(() => {
  'use strict';

  const defaults = {
    coinName: '', ticker: '', network: '', contractAddress: '', xUrl: '', buyUrlTemplate: '', description: '', imageUploadEndpoint: '/api/upload',
    chain: { id: 4663, hexId: '0x1237', name: 'Solana', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrl: 'https://api.mainnet-beta.solana.com', explorerUrl: 'https://solscan.io' },
    ponsV2: { factory: '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e', usdG: '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168', publicSite: 'https://www.ponsfamily.com/launchpad' },
    uniswapV3: { factory: '0x1f7d7550B1b028f7571E69A784071F0205FD2EfA', positionManager: '0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3', swapRouter: '0xCaf681a66D020601342297493863E78C959E5cb2', quoterV2: '0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7', weth: '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73' }
  };

  const merge = (a,b) => ({...a,...b,chain:{...a.chain,...(b?.chain||{}),nativeCurrency:{...a.chain.nativeCurrency,...(b?.chain?.nativeCurrency||{})}},ponsV2:{...a.ponsV2,...(b?.ponsV2||{})},uniswapV3:{...a.uniswapV3,...(b?.uniswapV3||{})}});
  const safeText = v => typeof v === 'string' ? v.trim() : '';
  const placeholder = v => /^(?:CA_GOES_HERE|COIN NAME|ABC|YOUR_X_URL|YOUR_USERNAME|PLACEHOLDER|TODO|TBD|REPLACE_ME|\{ca\})$/i.test(safeText(v));

  const loadScript = (src, timeoutMs=5000) => new Promise((resolve,reject) => {
    const s=document.createElement('script');
    let settled=false;
    const finish=(ok,err)=>{if(settled)return;settled=true;clearTimeout(timer);s.onload=null;s.onerror=null;ok?resolve():reject(err||new Error('load failed'))};
    const timer=setTimeout(()=>finish(false,new Error('timeout')),timeoutMs);
    s.src=src; s.async=true; s.onload=()=>finish(true); s.onerror=()=>finish(false,new Error('load failed')); document.head.appendChild(s);
  });

  const fetchConfig = async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1800);
    try {
      const r = await fetch('/config.json', {cache:'no-store', signal:controller.signal});
      return r.ok ? await r.json() : {};
    } catch { return {}; }
    finally { clearTimeout(timer); }
  };

  const loadEthersInBackground = async () => {
    if(window.ethers) return window.ethers;
    const sources=[
      'https://cdnjs.cloudflare.com/ajax/libs/ethers/6.13.5/ethers.umd.min.js',
      'https://cdn.jsdelivr.net/npm/ethers@6.13.5/dist/ethers.umd.min.js',
      'https://unpkg.com/ethers@6.13.5/dist/ethers.umd.min.js'
    ];
    try {
      await Promise.any(sources.map(src => loadScript(src, 4000).then(() => {
        if(!window.ethers) throw new Error('library missing');
        return window.ethers;
      })));
    } catch {}
    return window.ethers || null;
  };

  const boot = async () => {
    const raw = await fetchConfig();
    const cfg = merge(defaults, raw || {});
    for (const k of ['coinName','ticker','network','contractAddress','xUrl']) if (placeholder(cfg[k])) cfg[k] = '';
    window.NOCKRA_CONFIG = Object.freeze(cfg);
    document.documentElement.dataset.configReady = 'true';

    // Crucial: blockchain libraries load in the background. The public UI never waits
    // for a CDN, so navigation, menus, theme, language and page routing remain clickable.
    window.NOCKRA_ETHERS_READY = loadEthersInBackground();

    try { await loadScript('/token-artifact.js', 2500); } catch {}
    try {
      await loadScript('/app.js', 2500);
      document.documentElement.dataset.appReady = 'true';
    } catch {
      document.documentElement.dataset.appReady = 'false';
    }
  };

  boot();
})();
