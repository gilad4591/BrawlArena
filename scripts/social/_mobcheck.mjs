import puppeteer from 'puppeteer-core';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = process.env.CHK_URL || 'https://brawlarena-1.onrender.com/';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setUserAgent('Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36');
await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
page.on('requestfailed', (r) => logs.push(`[reqfail] ${r.url()} — ${r.failure()?.errorText}`));
await page.goto(URL, { waitUntil: 'networkidle2', timeout: 45000 }).catch((e) => logs.push(`[goto] ${e.message}`));
await new Promise((r) => setTimeout(r, 4000));
await page.screenshot({ path: 'scripts/social/mobcheck.png' });
const state = await page.evaluate(() => ({
  splash: !!document.getElementById('boot-splash'),
  splashHidden: document.getElementById('boot-splash')?.classList.contains('hide') ?? null,
  appHtmlLen: document.getElementById('app')?.innerHTML.length ?? -1,
  bodyText: document.body.innerText.slice(0, 200),
}));
console.log('STATE', JSON.stringify(state, null, 2));
console.log('LOGS\n' + logs.join('\n'));
await browser.close();
process.exit(0);
