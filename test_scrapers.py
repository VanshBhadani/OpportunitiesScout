import asyncio, sys
sys.stdout.reconfigure(encoding='utf-8')

async def test():
    from backend.scrapers.internshala import IntershalaScraper
    from backend.scrapers.unstop import UnstopScraper
    from backend.scrapers.devpost import DevpostScraper

    print('=== Internshala ===')
    s = IntershalaScraper()
    r = await s.scrape()
    await s.close()
    print('  Total:', len(r))
    if r:
        first = r[0]
        print('  Title:', first['title'])
        print('  URL:  ', first['url'])
        print('  Co:   ', first['company'])
        print('  Tags: ', first['tags'][:3])
    with_url = [x for x in r if x['url']]
    print('  With URL:', len(with_url), 'of', len(r))

    print()
    print('=== Unstop ===')
    s2 = UnstopScraper()
    r2 = await s2.scrape()
    await s2.close()
    print('  Total:', len(r2))
    if r2:
        print('  First:', r2[0]['title'])
        print('  URL:  ', r2[0]['url'][:70])

    print()
    print('=== Devpost ===')
    s3 = DevpostScraper()
    r3 = await s3.scrape()
    await s3.close()
    print('  Total:', len(r3))
    if r3:
        print('  First:', r3[0]['title'])
        print('  Prize:', r3[0]['stipend'])
        print('  Deadline:', r3[0]['deadline'])

asyncio.run(test())
