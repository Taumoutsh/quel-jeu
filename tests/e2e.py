"""Test de bout en bout d'une partie solo dans Chrome headless.
Lancer depuis la racine du dépôt : python3 -m http.server 8765 & python3 tests/e2e.py
"""
import asyncio, sys, os
from playwright.async_api import async_playwright

OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/qj"
os.makedirs(OUT, exist_ok=True)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
        pg = await b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: m.type == "error" and errs.append(m.text))
        await pg.goto("http://localhost:8765/index.html")
        await pg.wait_for_timeout(800)
        await pg.screenshot(path=f"{OUT}/1-home.png")
        await pg.fill("#pseudo", "Testeur")
        await pg.click("#bSolo")
        await pg.wait_for_timeout(300)
        await pg.screenshot(path=f"{OUT}/2-lobby.png", full_page=True)
        await pg.click("#bStart")
        await pg.wait_for_timeout(1500)
        await pg.screenshot(path=f"{OUT}/3-game.png")
        # drag the panorama
        await pg.mouse.move(200, 300); await pg.mouse.down(); await pg.mouse.move(80, 330, steps=8); await pg.mouse.up()
        await pg.wait_for_timeout(500)
        ans = await pg.evaluate("QJ.A.R.game.t")
        series = await pg.evaluate("QJ.A.R.game.s ? QJ.A.matcher.seriesById[QJ.A.R.game.s].t : ''")
        print("réponse :", ans, "| série :", series)
        # mauvaise réponse
        await pg.fill("#gInput", "Minecraft"); await pg.press("#gInput", "Enter")
        await pg.wait_for_timeout(200)
        print("après faux :", await pg.inner_text("#fb"))
        if series:
            await pg.fill("#gInput", series.split(" ")[0] if "Astral" not in series else "astral"); await pg.press("#gInput", "Enter")
            await pg.wait_for_timeout(200)
            print("précision :", await pg.inner_text("#fb"))
            await pg.screenshot(path=f"{OUT}/4-precision.png")
        await pg.fill("#gInput", ans); await pg.press("#gInput", "Enter")
        await pg.wait_for_timeout(600)
        await pg.screenshot(path=f"{OUT}/5-map.png")
        box = await pg.locator("#mapPick").bounding_box()
        # vise la bonne position
        gx, gy = await pg.evaluate("[QJ.A.R.info.x, QJ.A.R.info.y]")
        print("cible :", gx, gy)
        await pg.mouse.click(box["x"] + box["width"] * 0.5, box["y"] + box["height"] * 0.5)
        await pg.wait_for_timeout(200)
        await pg.click("#bPin")
        await pg.wait_for_timeout(800)
        await pg.screenshot(path=f"{OUT}/6-reveal.png", full_page=True)
        print("résultat manche :", await pg.evaluate("JSON.stringify(QJ.A.res[0])"))
        # manches restantes : passer
        for k in range(1, 5):
            await pg.click("#bNext"); await pg.wait_for_timeout(900)
            if k == 2:
                await pg.screenshot(path=f"{OUT}/7-game{k}.png")
            await pg.evaluate("(() => { const R = QJ.A.R; QJ.submitGuess(R.game.t); })()")
            await pg.wait_for_timeout(400)
            await pg.evaluate("(() => { const R = QJ.A.R; R.pin = {x: R.info.x + 0.02, y: R.info.y}; QJ.validatePin(); })()")
            await pg.wait_for_timeout(700)
        await pg.click("#bNext"); await pg.wait_for_timeout(600)
        await pg.screenshot(path=f"{OUT}/8-final.png", full_page=True)
        print("total :", await pg.evaluate("QJ.A.res.reduce((t,x)=>t+(x?x[1]+x[2]:0),0)"))
        # bibliothèque
        await pg.click("#bHome"); await pg.click("#bLib"); await pg.wait_for_timeout(300)
        await pg.screenshot(path=f"{OUT}/9-lib.png", full_page=True)
        await pg.set_viewport_size({"width": 1280, "height": 800})
        await pg.click("#bLibBack"); await pg.click("#bSolo"); await pg.click("#bStart"); await pg.wait_for_timeout(1200)
        await pg.evaluate("QJ.submitGuess(QJ.A.R.game.t)"); await pg.wait_for_timeout(600)
        await pg.screenshot(path=f"{OUT}/10-desktop.png")
        print("erreurs JS :", errs or "aucune")
        await b.close()

asyncio.run(main())
