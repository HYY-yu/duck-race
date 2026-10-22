import sys, time
from playwright.sync_api import sync_playwright
out = sys.argv[1]; url = sys.argv[2] if len(sys.argv) > 2 else "http://127.0.0.1:5182/?waterfall"
with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome", headless=True, args=["--use-angle=metal","--enable-gpu","--ignore-gpu-blocklist"])
    pg = b.new_page(viewport={"width":1440,"height":900})
    logs = []
    pg.on("console", lambda m: logs.append(f"{m.type}: {m.text[:160]}") if m.type in ("warning","error") else None)
    pg.goto(url); pg.wait_for_timeout(5000)
    pg.screenshot(path=f"{out}-idle.png")
    pg.click("#start"); 
    for t in (13.5, 15.2, 17.5):
        pg.wait_for_function(f"() => true"); 
    # race time runs after 3s countdown; sample at wall-clock offsets
    start = time.time()
    for label, at in (("fall", 14.0), ("splash", 16.0), ("after", 19.0)):
        pg.wait_for_timeout(max(0, (at - (time.time()-start)) * 1000))
        pg.screenshot(path=f"{out}-{label}.png")
    print("\n".join(logs[:20]) or "no warn/error")
    b.close()
