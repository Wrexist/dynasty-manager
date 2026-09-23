import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1380,height:1000},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5180/artifacts/player-portrait-rollout/pl-01/cards.html');
 await page.waitForSelector('img[src*="player-portraits"]');
 await page.locator('img').evaluateAll(imgs=>{for(const i of imgs)i.loading='eager';return Promise.all(imgs.map(i=>i.decode()));});
 await page.evaluate(()=>document.fonts.ready);
 await page.screenshot({path:fileURLToPath(new URL('./cards-preview.png',import.meta.url)),fullPage:true});
 const count=await page.locator('.portrait-preview-grid img[src*="player-portraits"]').count();
 if(count!==25||errors.length)throw Error(JSON.stringify({count,errors}));
 await page.getByRole('button').first().click();
 await page.waitForFunction(()=>document.querySelector('[role="button"]').getAttribute('aria-label').includes('profile'));
 await page.setViewportSize({width:375,height:812});
  await page.screenshot({path:fileURLToPath(new URL('./cards-mobile.png',import.meta.url)),fullPage:true});
 console.log(JSON.stringify({portraits:count,errors,cycle:'passed',mobileOverflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)}));
}finally{await browser.close();}
