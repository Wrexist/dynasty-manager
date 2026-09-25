import { chromium } from 'playwright';
const browser = await chromium.launch({headless:true});
try {
 const page = await browser.newPage({viewport:{width:390,height:950},deviceScaleFactor:2});
 await page.addInitScript(() => {
  sessionStorage.setItem('dynasty-onboarding-draft',JSON.stringify({step:'club',nation:'England',league:'eng'}));
  history.replaceState({usr:{slot:3},key:'crest-preview',idx:0},'');
 });
 await page.goto('http://127.0.0.1:5180/#/select-club',{waitUntil:'networkidle'});
 await page.locator('img[src*="team-crests"]').first().waitFor({timeout:90000});
 await page.locator('img[src*="team-crests"]').evaluateAll(async images => {for(const img of images) img.loading='eager';await Promise.all(images.map(i=>i.decode()));});
 await page.screenshot({path:'artifacts/team-crest-rollout/review/game-now.png'});
 console.log(JSON.stringify({url:page.url(),crests:await page.locator('img[src*="team-crests"]').count()}));
} finally { await browser.close(); }
