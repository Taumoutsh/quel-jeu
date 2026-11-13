"""Partie à deux joueurs avec une salle simulée (tests/mock-room.js)."""
import asyncio, sys
from playwright.async_api import async_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/qj"
MOCK = open("tests/mock-room.js").read()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844})
        await ctx.add_init_script(MOCK)
        errs = []
        h = await ctx.new_page(); g = await ctx.new_page()
        for pg in (h, g): pg.on("pageerror", lambda e: errs.append(str(e)))
        await h.goto("http://localhost:8765/index.html"); await g.goto("http://localhost:8765/index.html")
        await h.wait_for_timeout(600)
        await h.fill("#pseudo", "Hôte"); await h.click("#bHost"); await h.wait_for_timeout(400)
        code = await h.inner_text("#codeBox"); print("code :", code)
        await h.click("#settings [data-step='-1']"); await h.click("#settings [data-step='-1']"); await h.click("#settings [data-step='-1']")  # 2 manches
        await h.click("#settings .seg[data-k='time'] button[data-v='0']")  # temps illimité : l'hôte peut terminer la manche
        await g.fill("#pseudo", "Ami"); await g.fill("#joinCode", code); await g.click("#bJoin"); await g.wait_for_timeout(800)
        print("joueurs (invité) :", await g.inner_text("#playersList"))
        print("manches vues par l'invité :", await g.inner_text("#sRounds"))
        await g.screenshot(path=f"{OUT}/m1-guest-lobby.png")
        await g.click("#bReady"); await g.wait_for_timeout(300); await h.click("#bReady"); await h.wait_for_timeout(3800)  # tout le monde prêt, décompte
        print("invité sur :", await g.evaluate("QJ.A.screen"), "| même vue :", await h.evaluate("QJ.A.R.sid") == await g.evaluate("QJ.A.R.sid"))
        # l'hôte trouve, l'invité se trompe puis passe
        await h.evaluate("QJ.submitGuess(QJ.A.R.game.t)"); await h.wait_for_timeout(300)
        await h.evaluate("(()=>{const R=QJ.A.R; R.pin={x:R.info.x,y:R.info.y}; QJ.validatePin();})()"); await h.wait_for_timeout(500)
        await h.screenshot(path=f"{OUT}/m2-host-wait.png")
        print("hôte encore en jeu :", await h.evaluate("QJ.A.st.ph"))
        await g.evaluate("QJ.submitGuess('Minecraft')"); await g.wait_for_timeout(200)
        await g.evaluate("QJ.submitGuess(QJ.A.R.game.t)"); await g.wait_for_timeout(300)
        await g.evaluate("(()=>{const R=QJ.A.R; R.pin={x:R.info.x+0.1,y:R.info.y}; QJ.validatePin();})()"); await g.wait_for_timeout(1200)
        print("phase hôte/invité :", await h.evaluate("QJ.A.st.ph"), await g.evaluate("QJ.A.st.ph"))
        await g.screenshot(path=f"{OUT}/m3-guest-reveal.png", full_page=True)
        await h.click("#bNext"); await g.wait_for_timeout(1500)
        print("manche 2 invité :", await g.evaluate("QJ.A.st.i"), await g.evaluate("QJ.A.screen"))
        await h.click("#bForce") if await h.is_visible("#bForce") else None
        await h.evaluate("QJ.submitGuess(QJ.A.R.game.t)"); await h.wait_for_timeout(300)
        await h.evaluate("(()=>{const R=QJ.A.R; R.pin={x:R.info.x,y:R.info.y+0.05}; QJ.validatePin();})()"); await h.wait_for_timeout(400)
        await h.click("#bForce"); await h.wait_for_timeout(800)
        await h.click("#bNext"); await h.wait_for_timeout(1000)
        print("fin :", await h.evaluate("QJ.A.screen"), await g.evaluate("QJ.A.screen"))
        await g.screenshot(path=f"{OUT}/m4-guest-final.png", full_page=True)
        print("erreurs JS :", errs or "aucune")
        await b.close()
asyncio.run(main())
