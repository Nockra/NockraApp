from pathlib import Path
import re, time
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]

def clean_html(name):
    html=(root/name).read_text()
    html=re.sub(r'<link[^>]+rel="stylesheet"[^>]*>','',html)
    html=re.sub(r'<script[^>]+src="[^"]+"[^>]*></script>','',html)
    html=html.replace('<base href="/">','')
    return html
mock='''window.ethereum={_accounts:[],request:async({method})=>{if(method==="eth_requestAccounts"){window.ethereum._accounts=["0x1111111111111111111111111111111111111111"];return window.ethereum._accounts}if(method==="eth_accounts")return window.ethereum._accounts;if(method==="eth_chainId")return "0x1237";if(method==="wallet_switchEthereumChain"||method==="wallet_addEthereumChain")return null;return null},on:()=>{}};'''
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':1000})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(clean_html('index.html'),wait_until='commit',timeout=5000)
    page.add_script_tag(content=mock)
    page.add_script_tag(content=(root/'core.js').read_text())
    time.sleep(.15)
    page.locator('summary.nav-button').click(timeout=2000)
    assert page.locator('.tools-mega').is_visible()
    page.locator('[data-theme-toggle]').click(timeout=2000)
    assert page.evaluate('document.documentElement.dataset.theme')=='light'
    page.locator('[data-lang-toggle]').click(timeout=2000)
    assert page.evaluate('document.documentElement.lang')=='zh-Hans'
    page.locator('[data-wallet-button]').click(timeout=2000);time.sleep(.05)
    assert '0x1111' in page.locator('[data-wallet-button]').inner_text()
    page.locator('[data-wallet-button]').click(timeout=2000);assert page.locator('[data-wallet-menu]').is_visible()
    page.locator('[data-wallet-disconnect]').click(timeout=2000)
    assert '连接钱包' in page.locator('[data-wallet-button]').inner_text()
    assert not errors, errors

    page2=browser.new_page(viewport={'width':1440,'height':1000})
    errors2=[];page2.on('pageerror',lambda e:errors2.append(str(e)))
    page2.set_content(clean_html('tool.html'),wait_until='commit',timeout=5000)
    page2.add_script_tag(content=mock)
    page2.add_script_tag(content=(root/'core.js').read_text())
    page2.add_script_tag(content=(root/'token-artifact.js').read_text())
    page2.add_script_tag(content=(root/'tool.js').read_text())
    time.sleep(.1)
    assert page2.locator('#creatorForm').is_visible()
    page2.locator('#tokenName').fill('Test Token')
    page2.locator('#tokenSymbol').fill('TEST')
    page2.locator('#creatorAck').check()
    assert not errors2, errors2
    browser.close()
print('PASS: homepage remains interactive; tools dropdown, theme, Chinese toggle, wallet connect/disconnect and token form all respond.')
