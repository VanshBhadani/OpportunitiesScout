import asyncio, httpx, sys
from bs4 import BeautifulSoup
sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "https://internshala.com"

async def get_deadline(client, detail_url):
    try:
        r = await client.get(detail_url, timeout=10)
        soup = BeautifulSoup(r.text, 'lxml')
        # Look for Apply by / deadline on detail page
        for el in soup.find_all(True):
            t = el.get_text(strip=True)
            if 'apply by' in t.lower() and len(t) < 80:
                print(f"  FOUND: <{el.name} class={el.get('class')}> -> {t!r}")
        # Also check any element with date in class name
        for sel in ['.apply_by', '.deadline', '[class*="apply"]', '[class*="deadline"]', '[class*="date"]']:
            found = soup.select(sel)
            for f in found[:3]:
                print(f"  SELECTOR {sel!r}: {f.get_text(strip=True)!r}")
    except Exception as e:
        print(f"  Error: {e}")

async def main():
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    async with httpx.AsyncClient(headers=headers, follow_redirects=True) as client:
        # Get listing
        r = await client.get(f'{BASE_URL}/internships/')
        soup = BeautifulSoup(r.text, 'lxml')
        cards = soup.select('.individual_internship')[:3]
        
        for card in cards:
            anchor = card.select_one('a.job-title-href') or card.select_one('a[href*="/internship/"]')
            if anchor:
                href = anchor['href']
                url = href if href.startswith('http') else f'{BASE_URL}{href}'
                print(f'\nChecking detail: {url}')
                await get_deadline(client, url)

asyncio.run(main())
