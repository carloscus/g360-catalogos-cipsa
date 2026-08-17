import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={'width': 1920, 'height': 1080})

        for i in range(1, 6):
            url = f'http://localhost:8080/catalogo-{i}.html'
            print(f"Navigating to {url}...")
            await page.goto(url)
            await page.wait_for_timeout(2000)
            await page.screenshot(path=f'/tmp/cat_{i}_desktop.png')

        # Also test mobile
        mobile_page = await browser.new_page(viewport={'width': 375, 'height': 667})
        for i in range(1, 6):
            url = f'http://localhost:8080/catalogo-{i}.html'
            await mobile_page.goto(url)
            await mobile_page.wait_for_timeout(2000)
            await mobile_page.screenshot(path=f'/tmp/cat_{i}_mobile.png')

        await browser.close()

asyncio.run(run())
