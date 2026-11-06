import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
const paths=['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'];
const executablePath=process.env.CHROME_PATH||paths.find(existsSync);
assert.ok(executablePath,'Chromium unavailable');
const js=readFileSync('app/public/paymo-spending-threshold.js','utf8');
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
let apiOnline=false;
let slowPost=false;
let posts=[];
let remote={threshold:30000,enabled:true};
const origin='https://paymo-test.local';
const html='<!doctype html><html lang="ja"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>'+
'<main><button id="openNotifications">通知設定</button><div id="notificationSettings"></div>'+
'<div id="paymoNotificationSaveStatus"></div></main>'+
'<script>window.paymoCurrentUser={id:"test-user"};window.paymoGetAuthToken=()=>"demo-token";</script>'+
'<script src="/paymo-spending-threshold.js"></script></body></html>';
await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname==='/')return route.fulfill({status:200,contentType:'text/html',body:html});
  if(url.pathname==='/paymo-spending-threshold.js')
    return route.fulfill({status:200,contentType:'application/javascript',body:js});
  if(url.pathname==='/api/spending-threshold-settings'){
    if(!apiOnline)return route.fulfill({status:404,contentType:'application/json',body:'{"error":"not found"}'});
    if(route.request().method()==='POST'){
      const sent=route.request().postDataJSON();
      if(slowPost)await new Promise(resolve=>setTimeout(resolve,260));
      posts.push(sent);
      remote={threshold:sent.threshold,enabled:sent.enabled};
      return route.fulfill({status:200,contentType:'application/json',
        body:JSON.stringify({ok:true,settings:{...remote}})});
    }
    return route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({settings:{...remote}})});
  }
  return route.fulfill({status:404,body:'not found'});
});
const loc='#paymoSpendingThresholdAmount';
const toggle='#paymoSpendingThresholdEnabled';
const key='paymo-spending-threshold-settings-v2:test-user';
const read=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'null'),key);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try{
  await page.goto(origin);
  await page.locator(loc).waitFor();
  assert.equal(await page.locator(loc).inputValue(),'30,000','default value');
  assert.equal(await page.locator(toggle).isChecked(),true,'default ON');

  // On mobile, the amount must persist even before blur and while API is unavailable.
  await page.locator(loc).fill('55,000');
  const immediate=await read();
  assert.equal(immediate?.threshold,55000,'immediate local save while typing');
  assert.equal(immediate?.pending,true,'pending state retained');
  await sleep(650);
  const offlineText=await page.locator('#paymoSpendingThresholdStatus').innerText();
  assert.ok(offlineText.includes('未反映'),'server failure clearly marked');
  await page.reload();
  assert.equal(await page.locator(loc).inputValue(),'55,000','value survives reload offline');
  assert.equal((await read())?.pending,true,'pending survives reload');

  // Recovering server should sync cached edits and confirm the canonical amount.
  apiOnline=true;
  await page.evaluate(()=>window.dispatchEvent(new Event('online')));
  await page.waitForFunction(k=>{
    const x=JSON.parse(localStorage.getItem(k)||'null');
    return x?.threshold===55000&&x?.pending===false;
  },key,{timeout:5000});
  assert.equal(remote.threshold,55000,'server receives pending edit');
  await page.reload();
  assert.equal(await page.locator(loc).inputValue(),'55,000','remote-confirmed amount survives reload');

  await page.locator(toggle).uncheck();
  await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).pending===false,key);
  assert.equal(remote.enabled,false,'OFF state saved');
  await page.reload();
  assert.equal(await page.locator(toggle).isChecked(),false,'OFF state persists');

  await page.locator(toggle).check();
  await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).pending===false,key);
  assert.equal(remote.enabled,true,'ON state saved again');

  // Out-of-order changes while a request is in flight must not restore the old amount.
  slowPost=true;
  await page.locator(loc).fill('60,000');
  await page.locator(loc).dispatchEvent('change');
  await sleep(35);
  await page.locator(loc).fill('70,000');
  await page.locator(loc).dispatchEvent('change');
  await page.waitForFunction(k=>{
    const x=JSON.parse(localStorage.getItem(k)||'null');
    return x?.threshold===70000&&x?.pending===false;
  },key,{timeout:7000});
  assert.equal(remote.threshold,70000,'last user edit wins');
  await page.reload();
  assert.equal(await page.locator(loc).inputValue(),'70,000','latest amount after reload');

  console.log('PASS: ¥30,000 ON default; immediate entry persistence; offline saved/pending state; reload restore; server recovery sync; ON/OFF saved; racing changes preserve newest value');
} finally{
  await browser.close();
}
