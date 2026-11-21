// Noetia prototype screenshots (DESIGN TOOLING ONLY; not a project dependency).
// Requires a local playwright-core with a downloaded Chromium, passed via PLAYWRIGHT_CORE (path to the package).
// Usage (from docs/design/ecosystem-ux/prototypes): PLAYWRIGHT_CORE=/path/to/playwright-core node tools/capture.js [pageFilter]
const path = require('path');
const fs = require('fs');
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');

const SRC = path.resolve(__dirname, '..', 'src');
const OUT = path.resolve(__dirname, '..', 'screenshots');
const VIEWPORTS = [['desktop', { width: 1440, height: 900 }, false], ['mobile', { width: 390, height: 844 }, true]];
const filter = process.argv[2] || '';

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const pages = fs.readdirSync(SRC).filter((f) => f.endsWith('.html') && !f.startsWith('index.') && f.includes(filter));
  const browser = await chromium.launch();
  for (const [vname, viewport, mobile] of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    for (const f of pages) {
      await page.goto('file://' + path.join(SRC, f), { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      const [name, lang] = f.replace('.html', '').split('.');
      await page.screenshot({ path: path.join(OUT, `${name}--${lang}--${vname}.jpg`), fullPage: true, type: 'jpeg', quality: 72 });
    }
    await ctx.close();
  }
  await browser.close();
  console.log(`captured ${pages.length * VIEWPORTS.length} screenshots to ${OUT}`);
})().catch((e) => { console.error(e.message); process.exit(1); });
