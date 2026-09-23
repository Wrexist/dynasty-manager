import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage({viewport:{width:1160,height:1000},deviceScaleFactor:3});
 await page.goto('http://127.0.0.1:5180/artifacts/player-portrait-sample-25/van-dijk-backgrounds.html');
 const card=page.locator('article').nth(2);
 await page.locator('img').evaluateAll(imgs=>{for(const i of imgs)i.loading='eager';return Promise.all(imgs.map(i=>i.decode()));});
 await card.scrollIntoViewIfNeeded();
 await page.waitForTimeout(1000);
 await page.evaluate(()=>document.fonts.ready);
 await card.screenshot({path:'artifacts/player-portrait-sample-25/van-dijk-minimal-shadow.png'});
 console.log('Gold Van Dijk preview captured');
} finally {await browser.close();}

