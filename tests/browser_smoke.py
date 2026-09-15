from pathlib import Path
import re, time
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
html=(root/'index.html').read_text()
html=re.sub(r'<link[^>]+rel="preconnect"[^>]*>','',html)
html=re.sub(r'<link[^>]+href="https://fonts.googleapis.com[^"]*"[^>]*>','',html)
html=re.sub(r'<link[^>]+href="\./styles.css[^>]*>','',html)
html=re.sub(r'<script[^>]+src="\./[^"]+"[^>]*></script>','',html)
app=(root/'app.js').read_text().replace("    let path=(location.pathname||'/');","    let path='/';")
mock='''window.ethereum={_accounts:["0x1111111111111111111111111111111111111111"],request:async({method})=>{if(method==="eth_requestAccounts"||method==="eth_accounts")return window.ethereum._accounts;if(method==="eth_chainId")return "0x1237";if(method==="wallet_switchEthereumChain"||method==="wallet_addEthereumChain")return null;return null},on:()=>{}};'''

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page=browser.new_page(viewport={"width":1440,"height":1000})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(html,wait_until='commit',timeout=5000)
    page.add_style_tag(content=(root/'styles.css').read_text())
    page.add_script_tag(content=mock)
    page.add_script_tag(content=(root/'i18n.js').read_text())
    page.add_script_tag(content=(root/'token-artifact.js').read_text())
    page.add_script_tag(content=app)
    time.sleep(.25)
    assert page.evaluate('document.documentElement.dataset.appReady')=='true'
    assert page.locator('#homePage').is_visible()
    page.locator('#toolsToggle').click(timeout=2000); assert page.locator('#toolsMenu').is_visible()
    page.locator('#toolsToggle').click(timeout=2000); assert not page.locator('#toolsMenu').is_visible()
    page.locator('#themeToggle').click(timeout=2000); assert page.evaluate('document.documentElement.dataset.theme')=='light'
    page.locator('#languageToggle').click(timeout=2000); assert page.evaluate("window.NockraI18n.current()")=='zh'
    page.locator('#toolGrid [data-route-tool="token-creator"]').click(timeout=2000); time.sleep(.1)
    assert page.locator('#workspacePage').is_visible() and page.locator('#creatorForm').is_visible()
    page.locator('#workspaceBack').click(timeout=2000); time.sleep(.1)
    page.evaluate("location.hash=''"); time.sleep(.1)
    # wallet restore connects the mock account; click opens menu then disconnect/reconnect
    page.locator('#connectWallet').click(timeout=2000); time.sleep(.1)
    if page.locator('#walletMenu').is_visible():
        page.locator('#disconnectWallet').click(timeout=2000); time.sleep(.1)
    assert 'Connect' in page.locator('#walletLabel').inner_text() or '连接' in page.locator('#walletLabel').inner_text()
    page.locator('#connectWallet').click(timeout=2000); time.sleep(.1)
    assert '0x1111' in page.locator('#walletLabel').inner_text()
    page.locator('#connectWallet').click(timeout=2000); time.sleep(.05); assert page.locator('#walletMenu').is_visible()
    page.evaluate("location.hash='#tool/pons-v2'"); time.sleep(.1)
    assert page.locator('#ponsLogoFile').get_attribute('type')=='file'
    assert page.locator('input[placeholder*="ipfs" i]').count()==0
    assert not errors, errors
    browser.close()
print('Browser smoke passed: clicks, tools menu, theme, Chinese toggle, tool routing, wallet connect/disconnect, and Pons image picker.')
