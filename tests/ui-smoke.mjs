import { _electron as electron } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const app = await electron.launch({ args: ["."], cwd: process.cwd() });
const page = await app.firstWindow();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.getByText("SAP-Wissen. Einfach erklärt.").waitFor();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
  await page.waitForTimeout(300); // Let theme color transitions settle before visual capture.
  await mkdir("test-results", { recursive: true });
  await page.screenshot({ path: "test-results/dashboard.png" });
  await page.getByRole("button", { name: "Aufnahme", exact: true }).click();
  await page.getByText("Zeig, wie es geht.").waitFor();
  const sources = await page.evaluate(() => window.studio.sources());
  console.log(
    "Native sources:",
    sources.map((s) => s.name),
  );
  await page.screenshot({ path: "test-results/recorder.png" });
  await page.getByRole("button", { name: "Videoeditor", exact: true }).click();
  await page.getByText("Deine Geschichte beginnt hier.").waitFor();
  await page.screenshot({ path: "test-results/editor.png" });
  await page
    .getByRole("button", { name: "Einstellungen", exact: true })
    .click();
  await page.getByRole("combobox").selectOption("light");
  await page.screenshot({ path: "test-results/settings-light.png" });
  await page.getByRole("combobox").selectOption("dark");
  assert.deepEqual(errors, []);
  console.log("UI smoke passed; no renderer errors.");
  await writeFile(
    "test-results/ui.json",
    JSON.stringify({ errors, sources: sources.map((s) => s.name) }, null, 2),
  );
} finally {
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().forEach((w) => w.removeAllListeners("close")),
  );
  await app.close();
}
