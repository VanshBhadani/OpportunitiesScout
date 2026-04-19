import sys; sys.stdout.reconfigure(encoding='utf-8')
from backend.scrapers.internshala import _parse_internshala_date

tests = ["APPLY BY17 May' 26", "APPLY BY16 May' 26", "17 May' 26", "3 Jun 2026", "APPLY BY3 Jun' 26"]
for t in tests:
    print(repr(t), '->', repr(_parse_internshala_date(t)))
