from pathlib import Path
import json,re
root=Path(__file__).resolve().parents[1]
required=['index.html','tools.html','tool.html','coin.html','docs.html','privacy.html','terms.html','disclaimer.html','cookies.html','404.html','core.js','tool.js','coin.js','styles.css','config.json','vercel.json','token-artifact.js','api/upload.js']
for f in required: assert (root/f).exists(),f
cfg=json.loads((root/'config.json').read_text())
assert cfg['network']=='Robinhood Chain'
assert cfg['buyUrlTemplate']=='https://ponsfamily.com/launchpad/{ca}'
assert cfg['chain']['id']==4663
assert cfg['ponsV2']['factory'].lower()=='0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e'
html='\n'.join(p.read_text() for p in root.glob('*.html'))
for bad in ['CA_GOES_HERE','YOUR_X_URL','TODO','TBD','Update config.json','Contract address not configured','→','↗','➡']:
    assert bad not in html,bad
assert 'Poppins' in (root/'styles.css').read_text()
assert 'data-theme-toggle' in html and 'data-lang-toggle' in html and 'data-wallet-button' in html
for tool in ['token-creator','pons-v2','multisender','revoke','mint','burn','create-pool','add-liquidity','remove-liquidity','pause','unpause','block','unblock','token-page']:
    assert (root/'tools'/tool/'index.html').exists(),tool
assert 'type="file"' in (root/'tool.js').read_text()
assert 'Logo URI' not in (root/'tool.js').read_text()
print('Static QA passed.')
