import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const binaries=['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'];
const path=process.env.CHROME_PATH||binaries.find(existsSync);
assert.ok(path,'Chromium binary must be installed');
const browser=await chromium.launch({executablePath:path,headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const tabs=['home','graph','categorySpend','menu'];
const labels={home:'ホーム',graph:'グラフ',categorySpend:'項目別履歴',menu:'メニュー'};
const icon='<svg viewBox="0 0 24 24"><path d="M3 3h18v18H3z"/></svg>';
const button=id=>'<button class="nav-btn'+(id==='home'?' active':'')+'" data-view="'+id+'" aria-label="'+labels[id]+'">'+icon+'</button>';
const html=[
 '<!doctype html><html lang="ja"><head><style>',
 ':root{--accent:#B9F486;--surface:#101310;--theme-muted:#9ca198}*{box-sizing:border-box}',
 'body{margin:0;background:#050605;color:#f5f5f3}.app{height:100dvh;overflow-y:auto;overflow-x:hidden}',
 '.view{display:none;min-height:1500px}.view.active{display:block}',
 '.bottom-nav{position:fixed;left:0;bottom:0;width:100%;height:92px;display:flex;align-items:stretch;justify-content:space-around;z-index:20;background:var(--surface)}',
 '.nav-btn,.add-btn{appearance:none;border:0;background:none;width:20%;height:92px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;margin:0;color:var(--theme-muted)}',
 '.nav-btn.active{color:var(--accent)}.nav-btn svg{width:45px;height:45px;flex:0 0 45px;fill:currentColor}',
 '.nav-btn::after{content:"";height:12px;display:block}.add-btn span{display:block;width:65px;height:65px;border-radius:50%;background:var(--accent)}',
 '</style></head><body><div class="app">',
 '<section id="home" class="view active"><h1>HOME</h1></section>',
 '<section id="graph" class="view"><h1>GRAPH</h1></section>',
 '<section id="categorySpend" class="view"><h1>CATEGORY</h1></section>',
 '<section id="menu" class="view"><h1>MENU</h1></section>',
 '</div><nav class="bottom-nav">',
 button('home'),button('graph'),
 '<button class="add-btn" id="addBtn" aria-label="支出を追加"><span></span></button>',
 button('categorySpend'),button('menu'),
 '</nav></body></html>'
].join('');

try {
  await page.setContent(html);
  await page.evaluate(()=>{
    window.__switches=0;window.__adds=0;
    document.querySelectorAll('.nav-btn').forEach(btn=>btn.onclick=()=>{
      window.__switches++;
      document.querySelectorAll('.nav-btn').forEach(el=>el.classList.toggle('active',el===btn));
      document.querySelectorAll('.view').forEach(el=>el.classList.toggle('active',el.id===btn.dataset.view));
    });
    document.getElementById('addBtn').onclick=()=>window.__adds++;
  });
  await page.addStyleTag({path:'app/public/paymo-sliding-pill.css'});
  await page.addScriptTag({path:'paymo-nav-scroll-top.js'});
  await page.addScriptTag({path:'app/public/paymo-sliding-pill.js'});
  assert.equal(await page.locator('.paymo-sliding-pill').count(),1,'one pill');
  assert.equal(await page.locator('.paymo-pill-label').count(),4,'four labels');
  const selected=()=>page.locator('.nav-btn.active').getAttribute('data-view');
  async function center(id) {
    const r=await page.locator('.nav-btn[data-view="'+id+'"]').boundingBox();
    return {x:r.x+r.width/2,y:r.y+r.height/2};
  }
  async function pillCenter() {
    const r=await page.locator('.paymo-sliding-pill').boundingBox();
    return r.x+r.width/2;
  }
  async function matches(id) {
    const c=await center(id),p=await pillCenter();
    assert.ok(Math.abs(c.x-p)<3,'pill aligned with '+id+': '+p+' vs '+c.x);
  }
  for(const id of ['graph','categorySpend','menu','home']) {
    await page.locator('.nav-btn[data-view="'+id+'"]').click();
    await delay(570);
    assert.equal(await selected(),id,'tap '+id);
    await matches(id);
    const fits=await page.locator('.nav-btn[data-view="'+id+'"]').evaluate(btn=>{
      const p=document.querySelector('.paymo-sliding-pill').getBoundingClientRect();
      const i=btn.querySelector('svg').getBoundingClientRect();
      const t=btn.querySelector('.paymo-pill-label').getBoundingClientRect();
      return i.top>=p.top-1&&i.bottom<=p.bottom+1&&t.top>=p.top-1&&t.bottom<=p.bottom+1&&t.left>=p.left-1&&t.right<=p.right+1;
    });
    assert.equal(fits,true,'icon and label inside pill: '+id);
  }
  await page.locator('.app').evaluate(el=>el.scrollTop=350);
  assert.ok(await page.locator('.app').evaluate(el=>el.scrollTop)>200);
  await page.locator('.nav-btn[data-view="home"]').click();
  await delay(780);
  assert.ok((await page.locator('.app').evaluate(el=>el.scrollTop))<4,'re-tap scrolls to top');

  // Unselected item can initiate a drag; view stays put until release.
  const start=await center('categorySpend'),target=await center('menu');
  await page.mouse.move(start.x,start.y);await page.mouse.down();
  const middle=start.x+(target.x-start.x)*.55;
  await page.mouse.move(middle,start.y,{steps:5});
  assert.equal(await selected(),'home','no early switch');
  assert.ok(Math.abs(await pillCenter()-middle)<4,'pill follows finger from unselected');
  await page.mouse.move(target.x,target.y,{steps:5});await page.mouse.up();
  await delay(570);
  assert.equal(await selected(),'menu','unselected drag snaps to closest');
  await matches('menu');

  const chosen=await center('menu'),graph=await center('graph');
  await page.mouse.move(chosen.x,chosen.y);await page.mouse.down();
  await page.mouse.move(graph.x,graph.y,{steps:14});
  assert.equal(await selected(),'menu','selected drag does not switch early');
  await page.mouse.up();await delay(570);
  assert.equal(await selected(),'graph','selected drag snaps to closest');
  await matches('graph');

  // Dragging within the same tab must suppress the browser's extra click.
  await page.locator('.app').evaluate(el=>el.scrollTop=350);
  const before=await page.evaluate(()=>window.__switches),g=await center('graph');
  await page.mouse.move(g.x,g.y);await page.mouse.down();
  await page.mouse.move(g.x+18,g.y,{steps:4});await page.mouse.up();
  await delay(570);
  assert.equal(await page.evaluate(()=>window.__switches),before,'no extra click');
  assert.ok((await page.locator('.app').evaluate(el=>el.scrollTop))>200,'drag does not re-tap scroll');
  await matches('graph');

  const g2=await center('graph');
  await page.mouse.move(g2.x,g2.y);await page.mouse.down();
  await page.mouse.move(g2.x-65,g2.y,{steps:8});
  await page.evaluate(()=>document.dispatchEvent(new PointerEvent('pointercancel',{
    bubbles:true,pointerId:1,pointerType:'mouse',isPrimary:true,clientX:50,clientY:500
  })));
  await page.mouse.up();await delay(570);
  assert.equal(await selected(),'graph','pointer cancel retains selection');
  await matches('graph');

  const g3=await center('graph');
  await page.mouse.move(g3.x,g3.y);await page.mouse.down();
  await page.mouse.move(g3.x+2,g3.y-35,{steps:6});await page.mouse.up();
  await delay(100);
  assert.equal(await selected(),'graph','vertical movement retains selected tab');
  await matches('graph');

  await delay(550);
  await page.locator('#addBtn').click();
  assert.equal(await page.evaluate(()=>window.__adds),1,'add button unchanged');
  assert.equal(await selected(),'graph','add did not change tab');
  await page.setViewportSize({width:320,height:844});await delay(100);
  await matches('graph');
  await page.evaluate(()=>{
    document.documentElement.style.setProperty('--accent','#E63946');
    document.documentElement.style.setProperty('--surface','#fff');
  });
  const pillColor=await page.locator('.paymo-sliding-pill').evaluate(el=>getComputedStyle(el).backgroundColor);
  assert.ok(pillColor&&pillColor!=='rgba(0, 0, 0, 0)','theme background');
  for(const id of ['home','menu','graph','categorySpend','home']) {
    await page.locator('.nav-btn[data-view="'+id+'"]').click();
  }
  await delay(570);
  assert.equal(await selected(),'home','rapid switches');
  await matches('home');
  console.log('PASS all 4 taps, labels, icon fit, re-tap, selected+unselected drag, drag follow, snap, no early switch, native-click suppression, cancel, vertical, add, resize, themes, rapid taps');
} finally {
  await browser.close();
}
