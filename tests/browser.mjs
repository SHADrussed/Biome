import {chromium,devices} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
for(const mobile of [false,true]){
 const context=await browser.newContext(mobile?{...devices['Pixel 7']}:{viewport:{width:1440,height:1100}});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.TEST_URL||'http://localhost:5173/');await page.waitForTimeout(800);
 await page.locator('#pause').click();await page.locator('#reset').click();assert.equal(await page.locator('#total').textContent(),'100');
 await page.locator('[data-tool="herbivore"]').click();const canvas=page.locator('#world');const box=await canvas.boundingBox();
 if(mobile)await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);else await canvas.click({position:{x:box.width/2,y:box.height/2}});
 assert.equal(await page.locator('#total').textContent(),'101');
 await page.locator('[data-tool="inspect"]').click();await canvas.click({position:{x:box.width/2,y:box.height/2}});assert.equal(await page.locator('#inspector').isVisible(),true);
 await page.locator('#close-inspect').click();await page.locator('[data-tool="food"]').click();await canvas.click({position:{x:80,y:80}});assert.equal(await page.locator('#food-count').textContent(),'436');
 await page.locator('[data-disaster="cold"]').click();assert.equal(await page.locator('#temperature-value').textContent(),'0 °C');
 await page.locator('[data-disaster="drought"]').click();assert.equal(await page.locator('#abundance-value').textContent(),'15%');
 await page.locator('[data-disaster="meteor"]').click();assert.match(await page.locator('#event').textContent(),/Метеорит/);
 await page.locator('#help').click();assert.equal(await page.locator('dialog').isVisible(),true);await page.locator('#close-help').click();
 await page.locator('[data-speed="5"]').click();await page.locator('#pause').click();await page.waitForTimeout(1200);assert.notEqual(await page.locator('#time-label').textContent(),'0 с');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);assert.deepEqual(errors,[]);
 await page.locator('#pause').click();await page.locator('#reset').click();await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:`/workspace/biome/${mobile?'mobile':'desktop'}.png`,fullPage:true});
 console.log(`${mobile?'Android touch':'Desktop'}: controls, simulation, disasters, inspector, layout passed`);await context.close();
}
await browser.close();
