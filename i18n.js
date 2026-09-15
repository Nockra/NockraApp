(() => {
  'use strict';
  const ZH = {
    skip:'跳到主要内容',home:'首页',docs:'文档',tools:'工具',buy:'购买',connectWallet:'连接钱包',connectWalletLower:'连接钱包',connectedWallet:'已连接钱包',copyAddress:'复制地址',viewExplorer:'在区块浏览器查看',disconnect:'断开连接',theme:'主题',allTools:'全部工具',toolSuite:'NOCKRA 工具套件',toolMenuTitle:'覆盖代币全生命周期的一体化工作区。',searchTools:'搜索工具',build:'构建',launch:'发行',manage:'管理',heroTitle:'面向<span>更明亮链上未来</span>的代币工具。',heroLead:'Nockra 是专为 Solana 打造的 ERC-20 工作区。可在同一界面部署代币、通过 Pump.fun 发行、管理合约权限、发送资产，并使用 Uniswap V3 流动性工具。',launchPons:'通过 Pump.fun 发行',exploreTools:'浏览全部工具',directSigning:'钱包直接签名',preflight:'交易前模拟',confirmation:'链上确认',network:'网络',connecting:'连接中',latestBlock:'最新区块',ponsGate:'Pump.fun 发行权限',checking:'检查中',ponsFee:'Pons 发行费用',wallet:'钱包',notConnected:'未连接',projectAccess:'项目入口',contract:'合约',copyCa:'复制合约地址',ecosystem:'NOCKRA 工具生态',toolsHeadline:'严肃的代币操作，<br><span>集中在一个清晰的工作区。</span>',toolsNote:'工具直接调用 Solana 合约。支持的写入操作会先进行兼容性检查和模拟。',featuredLaunch:'精选发行路径',ponsTitle:'Pump.fun。<br><span>使用实时经济参数发行。</span>',ponsLead:'通过当前 Pump.fun 工厂发行。签名前，Nockra 会读取发行资格、实时费用、可用配置、获批交易对资产和当前发行购买转发器。',openPons:'打开 Pump.fun 发行',ponsLaunchpad:'Pons 发行平台',configure:'配置',configureDesc:'代币信息与创建者设置',pinEconomics:'锁定经济参数',pinEconomicsDesc:'实时工厂预览哈希',simulate:'模拟',simulateDesc:'广播前模拟准确调用',launchDesc:'钱包签署实时交易',howWorks:'NOCKRA 如何工作',readablePowerful:'先清晰，再强大。',transactionDiscipline:'每个工具都遵循同一套交易流程。',loadContract:'加载合约',loadContractDesc:'输入代币、池或仓位。Nockra 首先读取实时状态。',reviewAction:'检查操作',reviewActionDesc:'金额、地址、权限和协议目标保持清晰可见。',simulateWhere:'尽可能先模拟',simulateWhereDesc:'在发送状态更改交易前发现已知回退。',signConfirm:'签名并确认',signConfirmDesc:'仅在链上交易回执确认后显示成功。',protocolSurface:'协议合约',knowSigning:'清楚你正在签署什么。',protocolDesc:'Nockra 展示核心合约目标，便于将钱包提示与预期协议进行核对。',oneChain:'一条链。<br>一套专注工具。',nonCustodial:'Nockra 不托管资金或私钥。代币权限由各自合约定义，外部协议操作受其当前规则约束。',startBuilding:'开始构建',protocolContracts:'协议合约',focusedTooling:'专注的代币工具，面向',navigate:'导航',legal:'法律',privacy:'隐私政策',terms:'使用条款',disclaimer:'免责声明',cookies:'Cookie 政策',footerRisk:'非托管界面。签名前请检查每笔交易。'
  };
  const EN = Object.fromEntries(Object.keys(ZH).map(k => [k, null]));
  const EXACT = new Map([
    ['Token Creator','代币创建器'],['Buy on Pump.fun','Pump.fun 发行'],['Multisender','批量发送'],['Revoke Ownership','撤销所有权'],['Mint Tokens','增发代币'],['Burn Tokens','销毁代币'],['Create Liquidity Pool','创建流动性池'],['Add Liquidity','添加流动性'],['Remove Liquidity','移除流动性'],['Pause Token','暂停代币'],['Unpause Token','恢复代币'],['Block Account','屏蔽账户'],['Unblock Account','解除屏蔽'],['Token Page','代币页面'],
    ['Create','创建'],['Launch','发行'],['Liquidity','流动性'],['Distribution','分发'],['Controls','控制'],['Inspect','查看'],['All','全部'],
    ['Deploy token','部署代币'],['Token name','代币名称'],['Symbol','代币符号'],['Initial supply','初始供应量'],['Website','网站'],['X / Twitter','X / Twitter'],['Telegram','Telegram'],['Discord','Discord'],['Description','描述'],['Farcaster','Farcaster'],['Launch config','发行配置'],['Pair asset','交易对资产'],['Creator fee recipient','创建者费用接收地址'],['Creator tax','创建者税率'],['Buyback enabled','启用回购'],['Enable buyback','启用回购'],['Optional initial creator buy','可选创建者首次购买'],['Pair asset amount','交易对资产数量'],['Minimum tokens out','最少获得代币数量'],['Snipe-tax exemptions','开盘税豁免地址'],['Live Pump.fun terms','实时 Pump.fun 参数'],['Launch review','发行检查'],['Refresh live terms','刷新实时参数'],['Review & launch','检查并发行'],['Connect wallet & check eligibility','连接钱包并检查资格'],
    ['Before you sign','签名前'],['Important','重要'],['Network','网络'],['Wallet','钱包'],['Decimals','小数位'],['Contract model','合约模型'],['Load token','加载代币'],['Token contract','代币合约'],['Read live token','读取实时代币'],['Copy CA','复制合约地址'],['Copied','已复制'],['Connect Wallet','连接钱包'],['Connect wallet','连接钱包'],['Not connected','未连接'],['Online','在线'],['Unavailable','不可用'],['Enabled','已启用'],['Restricted','受限'],['Checking','检查中'],['Eligible','有资格'],['Not eligible','无资格'],['Yes','是'],['No','否'],
    ['Privacy Policy','隐私政策'],['Terms of Use','使用条款'],['Disclaimer','免责声明'],['Cookie Policy','Cookie 政策'],['Project Information','项目信息'],['How to Buy','如何购买'],['Community','社区'],['Important Links','重要链接'],['Introduction','简介'],['About','关于'],['Coin Information','代币信息'],['Risk Information','风险信息'],['FAQ','常见问题'],['Project','项目'],['Ticker','代币符号'],['Contract','合约'],['Docs','文档'],['Buy','购买'],['Open X','打开 X'],['Open launchpad','打开发行平台'],['Project documentation','项目文档'],['View contract','查看合约'],['Return home','返回首页'],
    ['Search tools','搜索工具'],['No tool matches that search.','没有匹配的工具。'],['Start a token journey.','开始你的代币创建流程。'],['Go live through Pump.fun.','通过 Pump.fun 上线。'],['Work with Uniswap V3.','使用 Uniswap V3。'],['Send assets to holders.','向持有者发送资产。'],['Use permissions defined by a token.','使用代币合约定义的权限。'],['Read live token state.','读取实时代币状态。'],
    ['Add at least one recipient.','请至少添加一个接收地址。'],['Recipient address','接收地址'],['Amount','数量'],['Fee tier','费率档位'],['Price','价格'],['Position token ID','仓位代币 ID'],['Liquidity to remove','要移除的流动性'],['Account','账户'],['Owner','所有者'],['Admin','管理员'],['Minter','增发角色'],['Pauser','暂停角色']
  ]);
  const storageGet=(k,f='')=>{try{return window.localStorage?.getItem(k)??f}catch{return f}};
  const storageSet=(k,v)=>{try{window.localStorage?.setItem(k,v)}catch{}};
  let lang = storageGet('nockra:lang') === 'zh' ? 'zh' : 'en';
  let applying = false;

  function setTextByKey(el,key,html=false){
    if(!el.dataset.i18nOriginal) el.dataset.i18nOriginal = html ? el.innerHTML : el.textContent;
    const original = el.dataset.i18nOriginal;
    const value = lang === 'zh' ? (ZH[key] || original) : original;
    if(html){if(el.innerHTML!==value)el.innerHTML=value;}else if(el.textContent!==value)el.textContent=value;
  }
  function translateExact(root){
    if(lang !== 'zh') return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const nodes=[];while(walker.nextNode()) nodes.push(walker.currentNode);
    for(const n of nodes){
      if(n.parentElement?.closest('script,style')) continue;
      const raw=n.nodeValue; const trimmed=raw.trim(); if(!trimmed) continue;
      const z=EXACT.get(trimmed); if(!z) continue;
      const left=raw.match(/^\s*/)?.[0]||'', right=raw.match(/\s*$/)?.[0]||'';
      if(!n.parentElement.dataset.originalExact) n.parentElement.dataset.originalExact=trimmed;
      n.nodeValue=left+z+right;
    }
  }
  function restoreExact(root){
    root.querySelectorAll?.('[data-original-exact]').forEach(el=>{
      if(el.childNodes.length===1 && el.firstChild.nodeType===Node.TEXT_NODE){el.textContent=el.dataset.originalExact;delete el.dataset.originalExact}
    });
  }
  function apply(root=document){
    if(applying) return; applying=true;
    try{
      document.documentElement.lang=lang==='zh'?'zh-CN':'en';
      root.querySelectorAll?.('[data-i18n]').forEach(el=>setTextByKey(el,el.dataset.i18n,false));
      root.querySelectorAll?.('[data-i18n-html]').forEach(el=>setTextByKey(el,el.dataset.i18nHtml,true));
      root.querySelectorAll?.('[data-i18n-placeholder]').forEach(el=>{
        if(!el.dataset.i18nPlaceholderOriginal)el.dataset.i18nPlaceholderOriginal=el.getAttribute('placeholder')||'';
        const v=lang==='zh'?(ZH[el.dataset.i18nPlaceholder]||el.dataset.i18nPlaceholderOriginal):el.dataset.i18nPlaceholderOriginal; if(el.getAttribute('placeholder')!==v)el.setAttribute('placeholder',v);
      });
      if(lang==='zh') translateExact(root); else restoreExact(root);
      const label=document.getElementById('languageLabel');if(label)label.textContent=lang==='zh'?'EN':'中文';
      const mobile=document.getElementById('mobileLanguageToggle');if(mobile)mobile.textContent=lang==='zh'?'EN':'中文';
    } finally { applying=false; }
  }
  function set(next){lang=next==='zh'?'zh':'en';storageSet('nockra:lang',lang);apply(document);document.dispatchEvent(new CustomEvent('nockra:language',{detail:{lang}}));}
  function toggle(){set(lang==='zh'?'en':'zh')}
  function current(){return lang}
  const observer=new MutationObserver(muts=>{if(applying)return;for(const m of muts){for(const n of m.addedNodes){if(n.nodeType===Node.ELEMENT_NODE){apply(n)}else if(n.nodeType===Node.TEXT_NODE&&n.parentElement){apply(n.parentElement)}}}});
  document.addEventListener('DOMContentLoaded',()=>{apply(document);observer.observe(document.body,{subtree:true,childList:true})});
  window.NockraI18n={apply,toggle,set,current,zh:ZH};
})();
