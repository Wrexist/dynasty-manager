import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage({viewport:{width:1160,height:1000},deviceScaleFactor:2});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5180/artifacts/player-portrait-sample-25/van-dijk-backgrounds.html');
 await page.waitForSelector('section article img');
 await page.locator('img').evaluateAll(imgs=>{for(const i of imgs)i.loading='eager';return Promise.all(imgs.map(i=>i.decode()));});
 await page.evaluate(()=>document.fonts.ready);
 await page.screenshot({path:'artifacts/player-portrait-sample-25/van-dijk-backgrounds.png',fullPage:true});
 const count=await page.locator('section img[src*="player-portraits"]').count();
 if(count!==14||errors.length)throw Error(JSON.stringify({count,errors}));
 await page.getByRole('button').first().click();
 await page.waitForFunction(()=>document.querySelector('[role="button"]').getAttribute('aria-label').includes('profile'));
 await page.setViewportSize({width:375,height:812});
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
 if(overflow)throw Error('Mobile overflow');
 console.log(JSON.stringify({portraits:count,errors,cycle:'passed',mobileOverflow:overflow}));
} finally {await browser.close();}
