import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const url = process.env.TRICKTRACE_URL || "http://127.0.0.1:5173/";
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => localStorage.clear());
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });

  const feature = page.getByRole("switch", { name: /单明手最佳首攻/ });
  assert.equal(await feature.getAttribute("aria-checked"), "false");
  assert.equal(await page.getByRole("button", { name: "首攻", exact: true }).count(), 0);

  await feature.click();
  assert.equal(await feature.getAttribute("aria-checked"), "true");
  await page.getByRole("button", { name: "首攻", exact: true }).waitFor();
  const choices = page.locator(".count-options > button");
  assert.deepEqual(await choices.allTextContents(), ["250", "1000", "2500", "5000"]);
  assert.equal(await page.getByLabel("自定义模拟次数").inputValue(), "1000");
  await page.getByLabel('首攻分析叫牌').fill('P P 1NT P 3NT P P P');
  await page.getByRole('button',{name:/用开叫模板填充/}).click();
  assert.equal(await page.getByLabel('S 大牌点',{exact:true}).inputValue(),'15-17');
  await page.getByRole('button',{name:'清空叫牌',exact:true}).click();
  await page.getByRole('button',{name:'不叫',exact:true}).click();
  await page.getByRole('button',{name:'不叫',exact:true}).click();
  await page.getByRole('button',{name:'1NT',exact:true}).click();
  assert.equal(await page.getByLabel('首攻分析叫牌').inputValue(),'P P 1NT');
  const mode=process.env.LEAD_TEST_MODE||'beat';
  await page.getByLabel('首攻求解模式').selectOption(mode);

  await page.getByRole("button", { name: /创建单明手副本/ }).click();
  assert.equal(await page.locator(".unknown-hand").count(), 3);
  await page.getByLabel('S 大牌点',{exact:true}).fill('20-10');
  await page.getByLabel('S 大牌点',{exact:true}).blur();
  assert.equal(await page.getByRole('button',{name:'开始首攻分析',exact:true}).isDisabled(),true);
  await page.getByLabel('S 大牌点',{exact:true}).fill('15-17');
  await page.getByLabel('S 大牌点',{exact:true}).blur();
  const sampleCount=Number(process.env.LEAD_TEST_COUNT||16);
  await page.getByLabel("自定义模拟次数").fill(String(sampleCount));
  const started=Date.now();
  await page.getByRole("button", { name: "开始首攻分析", exact: true }).click();
  await page.locator(".lead-ranking").waitFor({ timeout: 300000 });
  assert.equal(await page.locator(".lead-ranking .sample-move").count(), 13);
  assert.ok((await page.locator(".lead-ranking-head").innerText()).includes(`${sampleCount} 个有效分布`));
  const elapsedMs=Date.now()-started;
  const timing=await page.locator('.lead-ranking-head small').innerText();
  assert.equal(await page.getByText('快速模式不计算墩数',{exact:true}).count(),mode==='beat'?13:0);
  assert.equal(await page.locator(".best-lead em").innerText(), "首选");

  await page.setViewportSize({ width: 390, height: 844 });
  await fs.mkdir("artifacts", { recursive: true });
  await page.screenshot({ path: "artifacts/opening-lead-mobile.png", fullPage: true });
  const overflow = await page.evaluate(() => ({
    innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    elements: [...document.querySelectorAll("body *")]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName,
          className: element.className,
          left: Math.round(rect.left),
          right: Math.round(rect.right),
        };
      })
      .filter((item) => item.left < 0 || item.right > innerWidth)
      .slice(0, 20),
  }));
  assert.equal(
    overflow.scrollWidth > overflow.innerWidth,
    false,
    JSON.stringify(overflow),
  );
  assert.deepEqual(errors, []);
  await page.getByRole('button',{name:'关闭首攻分析 · 返回原牌局',exact:true}).click();
  assert.equal(await page.locator('.unknown-hand').count(),0);
  assert.equal(await feature.getAttribute('aria-checked'),'false');
  await page.waitForFunction(()=>!document.querySelector('.play-button').disabled);
  await page.getByRole('button',{name:'开始',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.playback>span')?.textContent==='1 / 52 张');
  const report = {
    url,
    passed: true,
    samples: sampleCount,
    elapsedMs,
    mode,
    timing,
    returnToOriginal: true,
    leadCount: 13,
    defaultEnabled: false,
    countChoices: [250, 1000, 2500, 5000],
    errors,
  };
  await fs.writeFile(
    "artifacts/opening-lead-report.json",
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(report);
} finally {
  await browser.close();
}
