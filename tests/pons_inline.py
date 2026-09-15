from pathlib import Path
import re,time
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
html=(root/'tool.html').read_text();html=re.sub(r'<link[^>]+rel="stylesheet"[^>]*>','',html);html=re.sub(r'<script[^>]+src="[^"]+"[^>]*></script>','',html);html=html.replace('<base href="/">','')
js=(root/'tool.js').read_text().replace("return new URLSearchParams(location.search).get('tool') || 'token-creator';","return new URLSearchParams(location.search).get('tool') || 'pons-v2';")
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page();errs=[];page.on('pageerror',lambda e:errs.append(str(e)))
 page.set_content(html,wait_until='commit');page.add_script_tag(content='window.ethereum={request:async()=>[],on:()=>{}}');page.add_script_tag(content=(root/'core.js').read_text());page.add_script_tag(content=(root/'token-artifact.js').read_text());page.add_script_tag(content=js);time.sleep(.1)
 assert page.locator('#ponsForm').is_visible();assert page.locator('#ponsImage').get_attribute('type')=='file';assert page.locator('input[placeholder*="ipfs" i]').count()==0
 assert not errs,errs
 b.close()
print('PASS: Pons V2 page renders without URI input and with a real image picker.')
