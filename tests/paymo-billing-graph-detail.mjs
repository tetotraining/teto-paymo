import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const chrome = process.env.CHROME_PATH || ['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(existsSync);
assert.ok(chrome,'Chromium is needed for the free UI regression tests');
const browser = await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox']});
const page = await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const fixture=[
  {id:'split',payee:'食費',usageDate:'2026-11-03',date:'2026-11-05',amount:15000,installments:[{date:'2026-11-05',amount:5000},{date:'2026-11-20',amount:10000}]},
  {id:'train',payee:'交通',usageDate:'2026-11-02',date:'2026-11-10',amount:5000},
  {id:'paid',payee:'家賃',usageDate:'2026-11-01',date:'2026-11-05',amount:20000,paid:true},
  {id:'future',payee:'食費',usageDate:'2026-11-09',date:'2026-12-01',amount:6000},
  {id:'rent',payee:'家賃',usageDate:'2026-11-01',date:'2026-11-25',amount:30000},
  {id:'extra',payee:'食費',usageDate:'2026-11-02',date:'2026-11-20',amount:2000}
];
const chart=(id)=>'<div id="'+id+'">'+Array.from({length:5},()=>'<div class="bar-wrap"><button class="stack-segment" type="button">item</button></div>').join('')+'</div>';
try {
  await page.setContent('<!DOCTYPE html><html lang="ja"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>'+
    chart('homeChart')+chart('graphChart')+'<div id="expenseHistoryRows"></div></body></html>');
  await page.addScriptTag({content:[
    'var expenses='+JSON.stringify(fixture)+';',
    'var PAYEES=[{name:"食費",color:"#ff0000"},{name:"交通",color:"#00ff00"},{name:"家賃",color:"#0000ff"}];',
    'var ym=(date)=>String(date).slice(0,7);',
    'var yen=(amount)=>"¥"+Number(amount).toLocaleString("ja-JP");',
    'var monthKey=(offset=0)=>{const date=new Date(2026,10+offset,1);return date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0")};',
    'window.paymoOpenHistoryEditor=id=>window.__edited=id;'
  ].join('\n')});
  await page.addScriptTag({path:'app/public/paymo-graph-detail.js'});
  await page.addScriptTag({path:'app/public/paymo-graph-detail-edit.js'});
  await page.addScriptTag({path:'app/public/paymo-graph-detail-size.js'});

  await page.locator('#homeChart .bar-wrap').nth(2).locator('.stack-segment').click();
  await page.locator('#paymoGraphDetail.is-open').waitFor({timeout:3000});
  assert.equal(await page.locator('#paymoGraphDetailTitle').innerText(),'月別支払額','billing detail');
  assert.equal(await page.locator('#paymoGraphDetailActions').isVisible(),true,'buttons shown in billing');
  assert.equal(await page.locator('#paymoGraphDetailMonth').innerText(),'11月');
  assert.equal(await page.locator('#paymoGraphDetailTotal').innerText(),'¥52,000','splits counted and paid excluded');

  const names=()=>page.locator('.paymo-graph-detail-group-name').allInnerTexts();
  const foodDue20Order=()=>page.locator('.paymo-graph-detail-group')
    .filter({has:page.locator('.paymo-graph-detail-group-name', {hasText:'食費'})})
    .locator('.paymo-graph-detail-row[data-part-index],.paymo-graph-detail-row[data-expense-index="5"]')
    .evaluateAll(rows => rows.filter(r => r.textContent.includes('11/20')).map(r => r.dataset.expenseId));
  const due20Order=()=>page.locator('.paymo-graph-detail-group')
    .filter({has:page.locator('.paymo-graph-detail-group-name', {hasText:'11/20'})})
    .locator('.paymo-graph-detail-row').evaluateAll(rows => rows.map(r => r.dataset.expenseId));
  assert.deepEqual(await names(),['家賃','食費','交通'],'default billing groups sorted descending');
  assert.deepEqual(await foodDue20Order(),['split','extra'],'same due date: newer usage first, not insertion order');
  await page.locator('#paymoGraphDetailToggleSort').click();
  assert.deepEqual(await names(),['交通','食費','家賃'],'billing ascending item totals');
  assert.deepEqual(await foodDue20Order(),['extra','split'],'same due date: older usage first');
  await page.locator('#paymoGraphDetailToggleSort').click();
  assert.deepEqual(await names(),['家賃','食費','交通'],'billing descending item totals');

  await page.locator('#paymoGraphDetailToggleView').click();
  assert.equal(await page.locator('#paymoGraphDetail').getAttribute('data-grouping'),'date');
  assert.equal(await page.locator('#paymoGraphDetailToggleView').getAttribute('aria-label'),'項目別表示に切り替え');
  assert.deepEqual(await page.locator('.paymo-graph-detail-group-name').allInnerTexts(),
    ['11/25','11/20','11/10','11/5'],'payment-due-date grouped descending');
  assert.deepEqual(await due20Order(),['split','extra'],'due-date group: newer usage first');
  assert.equal(await page.locator('#paymoGraphDetailTotal').innerText(),'¥52,000','billing unchanged by grouping');
  assert.equal(await page.locator('#paymoGraphDetail .paymo-graph-detail-item').count(),5,'five unpaid payment parts');
  const split = page.locator('.paymo-graph-detail-row[data-expense-index="0"][data-part-index="1"]');
  assert.equal(await split.count(),1,'second installment retained');
  assert.ok((await split.innerText()).includes('11/20'),'installment due date shown accurately');
  assert.ok((await split.innerText()).includes('10,000'),'installment amount shown accurately');
  assert.equal(await split.getAttribute('data-expense-id'),'split','installment editor matched');
  await split.click();
  assert.equal(await page.evaluate(()=>window.__edited),'split','editing existing expense unchanged');

  await page.locator('#paymoGraphDetailToggleSort').click();
  assert.deepEqual(await page.locator('.paymo-graph-detail-group-name').allInnerTexts(),
    ['11/5','11/10','11/20','11/25'],'due-date ascending');
  assert.deepEqual(await due20Order(),['extra','split'],'due-date group: older usage first');
  assert.equal(await page.locator('#paymoGraphDetailTotal').innerText(),'¥52,000','sorting does not change totals');
  await page.locator('#paymoGraphDetailToggleView').click();
  assert.equal(await page.locator('#paymoGraphDetail').getAttribute('data-grouping'),'item');
  assert.deepEqual(await names(),['家賃','食費','交通'],'switch back to independent item sort');

  await page.locator('#paymoGraphDetailBack').click();
  await page.waitForFunction(() => !document.querySelector('#paymoGraphDetail')?.classList.contains('is-visible'),
    null,{timeout:2500});
  await page.locator('#graphChart .bar-wrap').nth(2).locator('.stack-segment').click();
  await page.locator('#paymoGraphDetail.is-open').waitFor({timeout:3000});
  assert.equal(await page.locator('#paymoGraphDetailTitle').innerText(),'支出推移');
  assert.equal(await page.locator('#paymoGraphDetailActions').isVisible(),true,'existing trend buttons preserved');
  assert.equal(await page.locator('#paymoGraphDetailToggleView').getAttribute('aria-label'),'支出日別表示に切り替え');
  await page.locator('#paymoGraphDetailToggleView').click();
  assert.equal(await page.locator('#paymoGraphDetail').getAttribute('data-grouping'),'date');
  assert.deepEqual(errors,[],'no browser JavaScript errors');
  console.log('PASS billing+trend buttons, grouping, amount sorting, due-date and usage-date tie-break in both directions, paid filter, split amounts, edit IDs, totals, independent sort state');
} finally {
  await browser.close();
}
