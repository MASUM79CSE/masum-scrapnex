import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  chromium,
  expect,
  test,
  type BrowserContext,
  type Page,
} from "@playwright/test";
const build = resolve(".output/chrome-mv3");
let scratch: string;
let context: BrowserContext;
let server: Server;
let origin: string;
let extension: string;
let panel: Page;

// This test uses a COPY of the production build with a loopback-only test permission.
// The production manifest tests assert that the shipped build has no host grants.
test.beforeAll(async () => {
  scratch = await mkdtemp(join(tmpdir(), "scrapnex-picker-"));
  const copy = join(scratch, "extension");
  await cp(build, copy, { recursive: true });
  const path = join(copy, "manifest.json");
  const manifest: object = JSON.parse(await readFile(path, "utf8"));
  await writeFile(
    path,
    JSON.stringify({ ...manifest, host_permissions: ["http://127.0.0.1/*"] }),
  );
  server = createServer((req, res) => {
    if (req.url === "/photo.svg") {
      res
        .writeHead(200, { "Content-Type": "image/svg+xml" })
        .end(
          '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><rect width="40" height="20" fill="#249c79"/></svg>',
        );
      return;
    }
    const route = req.url?.match(/^\/(cards|table|strict)$/)?.[1];
    if (!route) {
      res.writeHead(404).end();
      return;
    }
    void readFile(
      resolve(
        `tests/fixtures/picker/${route === "strict" ? "table" : route}.html`,
      ),
    ).then(
      (body) =>
        res
          .writeHead(200, {
            "Content-Type": "text/html; charset=utf-8",
            ...(route === "strict"
              ? { "Content-Security-Policy": "default-src 'none'" }
              : {}),
          })
          .end(body),
      () => res.writeHead(500).end(),
    );
  });
  await new Promise<void>((done, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", done);
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("No fixture server address");
  origin = `http://127.0.0.1:${address.port}`;
  context = await chromium.launchPersistentContext(join(scratch, "profile"), {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${copy}`, `--load-extension=${copy}`],
  });
  const worker =
    context
      .serviceWorkers()
      .find((worker) => worker.url().endsWith("/background.js")) ??
    (await context.waitForEvent("serviceworker", {
      predicate: (worker) => worker.url().endsWith("/background.js"),
      timeout: 10000,
    }));
  extension = `chrome-extension://${new URL(worker.url()).host}`;
  panel = await context.newPage();
  await panel.goto(`${extension}/sidepanel.html`);
});

test.afterAll(async () => {
  if (context) await context.close();
  if (server) await new Promise<void>((done) => server.close(() => done()));
  if (scratch) await rm(scratch, { recursive: true, force: true });
});

const overlay = "[data-masum-picker-overlay]";
const picker = () =>
  panel.getByRole("region", { name: "Point-and-click picker" });
const preview = () =>
  panel.getByRole("table", { name: "Manual selection preview" });
const willPick = () => picker().getByText(/Hover and click an element/);
async function button(name: string) {
  await panel
    .getByRole("button", { name, exact: true })
    .evaluate((item) => (item as HTMLButtonElement).click());
}
async function open(route: "cards" | "table" | "strict") {
  const page = await context.newPage();
  await page.goto(`${origin}/${route}`);
  await page.bringToFront();
  await expect(
    panel.getByRole("button", { name: "Pick elements" }),
  ).toBeVisible();
  await expect(page.locator(overlay)).toHaveCount(0);
  await button("Pick elements");
  await expect(willPick()).toBeVisible();
  await expect(page.locator(overlay)).toHaveCount(1);
  return page;
}
async function field(kind: string) {
  await picker().getByLabel("Field type").selectOption(kind);
  await button("Pick field");
  await expect(
    picker().getByText("Pick the field inside the selected row."),
  ).toBeVisible();
}

test("picks repeated catalog cards, blocks link navigation, and confirms selected URL, alt and price fields", async () => {
  const page = await open("cards");
  try {
    const link = page.getByRole("link", { name: "Trail lamp" });
    await link.hover();
    if (process.env.PHASE6_HOVER)
      await page.screenshot({ path: process.env.PHASE6_HOVER, fullPage: true });
    await link.click();
    await expect(page).toHaveURL(`${origin}/cards`);
    await expect(picker().getByText(/3 similar rows/)).toBeVisible();
    await expect(preview()).toContainText("Camp stove");
    await field("link");
    await link.click();
    await expect(
      preview().getByRole("columnheader", { name: "Link URL" }),
    ).toBeVisible();
    await field("alt");
    await page.getByRole("img", { name: "Trail lamp thumbnail" }).click();
    await expect(preview().getByText("Camp stove thumbnail")).toBeVisible();
    await field("attribute");
    await page.locator("#lamp .price").click();
    await expect(
      preview().getByRole("cell", { name: "85.00", exact: true }),
    ).toBeVisible();
    await expect(preview()).not.toContainText(
      /private-picker|private-editable/,
    );
    await button("Confirm selection");
    await expect(picker().getByText(/Selection confirmed/)).toBeVisible();
    await expect(page.locator(overlay)).toHaveCount(0);
    if (process.env.PHASE6_PREVIEW) {
      await panel.setViewportSize({ width: 1250, height: 800 });
      await panel.evaluate(() => document.fonts.ready);
      await panel.screenshot({
        path: process.env.PHASE6_PREVIEW,
        fullPage: true,
      });
    }
    await link.click();
    await expect(page).toHaveURL(`${origin}/cards#details`);
    await expect(preview()).toHaveCount(0);
  } finally {
    await page.close();
  }
});

test("supports parent/child correction, field-relative columns and keyboard Escape on table rows", async () => {
  const page = await open("table");
  try {
    await page.getByRole("cell", { name: "সরঞ্জাম" }).click();
    await expect(preview()).toBeVisible();
    await button("Parent");
    await expect(picker().getByText(/3 similar rows/)).toBeVisible();
    await button("First child");
    await expect(picker().locator(".picker-selector code")).toContainText(
      "td:nth-of-type(1)",
    );
    await button("Parent");
    await expect(picker().locator(".picker-selector code")).toContainText(
      "tr:nth-of-type(1)",
    );
    await field("text");
    await page.getByRole("cell", { name: "সরঞ্জাম" }).click();
    await expect(preview().getByText("Camp mug")).toBeVisible();
    await expect(preview().getByText("সরঞ্জাম")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(overlay)).toHaveCount(0);
    await expect(picker()).toHaveCount(0);
  } finally {
    await page.close();
  }
});

test("refreshes same-document rows, invalidates removed selections, and removes the overlay on navigation", async () => {
  const page = await open("cards");
  try {
    await page.getByRole("link", { name: "Trail lamp" }).click();
    await expect(picker().getByText(/3 similar rows/)).toBeVisible();
    await page.evaluate(() =>
      document
        .getElementById("pack")
        ?.after(document.getElementById("pack")!.cloneNode(true)),
    );
    await expect(picker().getByText(/4 similar rows/)).toBeVisible();
    await page.evaluate(() => document.getElementById("lamp")?.remove());
    await expect(
      picker().getByText(/selected row is no longer available/),
    ).toBeVisible();
    await expect(preview()).toHaveCount(0);
    await page.goto(`${origin}/table`);
    await expect(page.locator(overlay)).toHaveCount(0);
    await expect(picker()).toHaveCount(0);
  } finally {
    await page.close();
  }
});

test("keyboard arrows can pick a row and panel cancellation cleans an unchanged page", async () => {
  const page = await open("table");
  try {
    await page.keyboard.press("ArrowDown"); // main -> section
    await page.keyboard.press("ArrowDown"); // section -> table
    await page.keyboard.press("ArrowDown"); // table -> thead
    await page.keyboard.press("ArrowRight"); // thead -> tbody
    await page.keyboard.press("ArrowDown"); // tbody -> first row
    await page.keyboard.press("Enter");
    await expect(picker().getByText(/3 similar rows/)).toBeVisible();
    await button("Cancel picker");
    await expect(page.locator(overlay)).toHaveCount(0);
    await expect(
      page.getByRole("table", { name: "Inventory" }).getByRole("row"),
    ).toHaveCount(4);
    await expect(picker()).toHaveCount(0);
  } finally {
    await page.close();
  }
});

test("strict page CSP leaves the isolated overlay usable; closing the panel disconnects and restores the page", async () => {
  const page = await open("strict");
  try {
    const before = await page
      .locator("body")
      .evaluate((body) => body.outerHTML);
    await page.getByRole("cell", { name: "সরঞ্জাম" }).hover();
    await expect(page.locator(overlay)).toHaveCSS("pointer-events", "none");
    expect(
      await page.locator(overlay).evaluate((host) => host.shadowRoot),
    ).toBe(null);
    await page.getByRole("cell", { name: "সরঞ্জাম" }).click();
    await expect(preview()).toBeVisible();
    await panel.close();
    await expect(page.locator(overlay)).toHaveCount(0);
    expect(await page.locator("body").evaluate((body) => body.outerHTML)).toBe(
      before,
    );
  } finally {
    await page.close();
    panel = await context.newPage();
    await panel.goto(`${extension}/sidepanel.html`);
  }
});
