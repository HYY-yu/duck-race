import sys, time
from playwright.sync_api import sync_playwright
base = "http://127.0.0.1:5182/.zcode/tools/dbg.html"
out = sys.argv[1]
shots = sys.argv[2:] or ["preview"]
with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome", headless=True, args=["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"])
    pg = b.new_page(viewport={"width": 1200, "height": 760})
    logs = []
    pg.on("console", lambda m: logs.append(f"{m.type}: {m.text[:300]}") if m.type in ("warning", "error") else None)
    for spec in shots:
        pg.goto(f"{base}?{spec}")
        pg.wait_for_function("() => document.title === 'ready'", timeout=30000)
        name = spec.replace("&", "_").replace("=", "-") or "default"
        pg.screenshot(path=f"{out}-{name}.png")
    print("\n".join(logs[:10]) or "no warn/error")
    b.close()
