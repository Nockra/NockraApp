import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--disable-dev-shm-usage','--no-sandbox'])
        page = await browser.new_page()
        errors=[]
        page.on('pageerror', lambda e: errors.append(str(e)))
        await page.add_init_script('''
          window.ethereum = {
            _accounts: [],
            request: async ({method, params}) => {
              if (method === 'eth_requestAccounts') { window.ethereum._accounts=['0x1111111111111111111111111111111111111111']; return window.ethereum._accounts; }
              if (method === 'eth_accounts') return window.ethereum._accounts;
              if (method === 'eth_chainId') return '0x1237';
              if (method === 'wallet_switchEthereumChain') return null;
              if (method === 'wallet_addEthereumChain') return null;
              return null;
            },
            on: () => {}
          };
        ''')
        await page.goto('http://127.0.0.1:8765/', wait_until='domcontentloaded')
        await page.locator('summary.nav-button').click()
        assert await page.locator('.tools-mega').is_visible()
        await page.locator('[data-theme-toggle]').click()
        assert await page.locator('html').get_attribute('data-theme') == 'light'
        await page.locator('[data-lang-toggle]').click()
        assert await page.locator('html').get_attribute('lang') == 'zh-Hans'
        await page.locator('[data-wallet-button]').click()
        assert '0x1111' in await page.locator('[data-wallet-button]').inner_text()
        await page.locator('[data-wallet-button]').click()
        assert await page.locator('[data-wallet-menu]').is_visible()
        await page.locator('[data-wallet-disconnect]').click()
        assert '连接钱包' in await page.locator('[data-wallet-button]').inner_text()
        # tools page filter
        await page.goto('http://127.0.0.1:8765/tools.html', wait_until='domcontentloaded')
        await page.locator('#toolSearch').fill('Pons')
        visible = await page.locator('.tool-row:visible').count()
        assert visible == 1
        # direct static tool route page
        await page.goto('http://127.0.0.1:8765/tools/token-creator/', wait_until='domcontentloaded')
        assert await page.locator('#creatorForm').is_visible()
        # switch another tool route
        await page.goto('http://127.0.0.1:8765/tools/pons-v2/', wait_until='domcontentloaded')
        assert await page.locator('#ponsImage').is_visible()
        # coin static route
        await page.goto('http://127.0.0.1:8765/nockra/', wait_until='domcontentloaded')
        assert await page.locator('#coinName').inner_text() == 'Nockra'
        print('PASS', {'errors': errors})
        assert not errors, errors
        await browser.close()

asyncio.run(main())
