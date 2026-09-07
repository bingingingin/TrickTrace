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
  assert.deepEqual(await choices.allTextContents(), ["32", "64", "128", "256"]);
  assert.equal(await page.getByLabel("自定义模拟次数").inputValue(), "128");

  await page.getByRole("button", { name: /创建单明手副本/ }).click();
  assert.equal(await page.locator(".unknown-hand").count(), 3);
  await page.getByLabel("自定义模拟次数").fill("16");
  await page.getByRole("button", { name: "开始首攻分析", exact: true }).click();
  await page.locator(".lead-ranking").waitFor({ timeout: 300000 });
  assert.equal(await page.locator(".lead-ranking .sample-move").count(), 13);
  assert.match(await page.locator(".lead-ranking-head").innerText(), /16 个有效分布/);
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
  const report = {
    url,
    passed: true,
    samples: 16,
    leadCount: 13,
    defaultEnabled: false,
    countChoices: [32, 64, 128, 256],
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
