import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const dados = <T>(arq: string): T =>
  JSON.parse(readFileSync(join(__dirname, "..", "..", "..", "data", "public", arq), "utf8")) as T;
const acoes = dados<{
  companhias: {
    codigo_cvm: string;
    pregao: string;
    divergente_b3_cvm: boolean;
    escriturador_cvm: { anterior: string | null } | null;
  }[];
}>("acoes.json").companhias;
const bdrs = dados<{ bdrs: { ticker: string; depositaria: string }[] }>("bdrs.json").bdrs;

function ouvirErros(page: Page): string[] {
  const erros: string[] = [];
  page.on("console", (m) => m.type() === "error" && erros.push(m.text()));
  page.on("pageerror", (e) => erros.push(e.message));
  page.on("response", (r) => r.status() >= 400 && erros.push(`HTTP ${r.status()} ${r.url()}`));
  return erros;
}

test.describe("página da companhia", () => {
  test("mostra escriturador, tickers e a linha do tempo (Petrobras)", async ({ page }) => {
    const erros = ouvirErros(page);
    await page.goto("/acoes/9512/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("PETROBRAS");
    await expect(page).toHaveTitle(/PETROBRAS: escriturador · linkinstonks/);
    await expect(page.getByRole("heading", { name: "Linha do tempo de escrituradores" })).toBeVisible();
    await expect(page.locator(".tk", { hasText: "PETR4" })).toBeVisible();
    await expect(page.locator(".tl li").first()).toBeVisible();
    expect(erros).toEqual([]);
  });

  test("a divergência B3 × CVM aparece como aviso explicado", async ({ page }) => {
    const c = acoes.find((a) => a.divergente_b3_cvm)!;
    await page.goto(`/acoes/${c.codigo_cvm}/`);
    await expect(page.getByText("B3 e CVM divergem")).toBeVisible();
  });

  test("empresa com troca mostra o escriturador anterior na linha do tempo", async ({ page }) => {
    const c = acoes.find((a) => a.escriturador_cvm?.anterior)!;
    await page.goto(`/acoes/${c.codigo_cvm}/`);
    expect(await page.locator(".tl li").count()).toBeGreaterThanOrEqual(2);
    await expect(page.locator(".tl .badge.ok")).toHaveCount(1);
  });

  test("o nome na tabela leva à página e o código desconhecido dá 404", async ({ page }) => {
    await page.goto("/acoes/tabela/");
    await page.locator(".dtable tbody .co a").first().click();
    await expect(page).toHaveURL(/\/acoes\/\d+\/$/);
    const r = await page.goto("/acoes/00000/");
    expect(r?.status()).toBe(404);
  });
});

test.describe("página do BDR", () => {
  test("mostra depositária, fonte e o volume de 24 meses mais o mês parcial (TSLA34)", async ({ page }) => {
    const erros = ouvirErros(page);
    await page.goto("/bdrs/TSLA34/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("TSLA34");
    await expect(page.locator(".dep", { hasText: "Banco B3" })).toBeVisible();
    await expect(page.getByText("Banco B3 (finservices)")).toBeVisible();
    await expect(page.locator(".mcols .mc")).toHaveCount(25); // 24 meses fechados + mês corrente parcial
    await page.getByRole("button", { name: "Ver como tabela" }).click();
    await expect(page.locator(".alt-table tbody tr")).toHaveCount(25);
    expect(erros).toEqual([]);
  });

  test("BDR sem depositária explica a ausência", async ({ page }) => {
    const b = bdrs.find((x) => x.depositaria === "Não identificado")!;
    await page.goto(`/bdrs/${b.ticker}/`);
    await expect(page.getByText("Não encontrada nas listas consultadas")).toBeVisible();
  });

  test("o ticker na tabela leva à página do BDR", async ({ page }) => {
    await page.goto("/bdrs/");
    await expect(page.locator(".dtable tbody tr").first()).toBeVisible();
    await page.locator(".dtable tbody a.tk").first().click();
    await expect(page).toHaveURL(/\/bdrs\/[A-Z0-9]+\/$/);
  });
});

test.describe("instituições", () => {
  test("ranking de escrituradores e depositárias, com período das trocas", async ({ page }) => {
    await page.goto("/instituicoes/");
    const tabela = page.getByRole("table").first();
    await expect(tabela.getByRole("row", { name: /Itaú Corretora/ })).toBeVisible();
    const conquistas = async () =>
      (await page.getByRole("table").first().locator("tbody tr td:nth-child(4)").allTextContents()).join("|");
    const todas = await conquistas();
    await page.getByRole("combobox", { name: "Período das trocas" }).selectOption("1");
    expect(await conquistas()).not.toBe(todas);
    await expect(
      page
        .getByRole("table")
        .nth(1)
        .getByRole("row", { name: /Banco B3/ }),
    ).toBeVisible();
  });
});

test.describe("novidades, feed e status", () => {
  test("novidades mostra o estado vazio e o link do feed", async ({ page }) => {
    await page.goto("/novidades/");
    await expect(page.getByText("Nenhuma mudança registrada ainda.")).toBeVisible();
    await expect(page.getByRole("link", { name: "feed Atom" })).toHaveAttribute("href", "/feed.xml");
  });

  test("o feed Atom é servido e é XML válido", async ({ request }) => {
    const r = await request.get("/feed.xml");
    expect(r.status()).toBe(200);
    const xml = await r.text();
    expect(xml.startsWith('<?xml version="1.0" encoding="utf-8"?>')).toBe(true);
    expect(xml).toContain('<feed xmlns="http://www.w3.org/2005/Atom"');
    expect(xml).toContain("</feed>");
  });

  test("status lista as 7 fontes e os BDRs sem depositária", async ({ page }) => {
    await page.goto("/status/");
    await expect(page.getByRole("heading", { name: "Fontes" })).toBeVisible();
    await expect(page.getByRole("table").first().locator("tbody tr")).toHaveCount(7);
    await expect(page.getByRole("link", { name: "INBR34" })).toBeVisible();
  });
});

test.describe("sobre, sitemap e robots", () => {
  test("sobre traz fontes, aviso legal e downloads que respondem", async ({ page, request }) => {
    await page.goto("/sobre/");
    await expect(page.getByRole("heading", { name: "Aviso legal" })).toBeVisible();
    await expect(
      page.locator(".prose strong", { hasText: /recomenda.{1,3}o de investimento/ }),
    ).toBeVisible();
    const hrefs = await page
      .locator('a[href^="/data/"], a[href="/feed.xml"]')
      .evaluateAll((a) => a.map((x) => x.getAttribute("href")!));
    expect(hrefs.length).toBeGreaterThanOrEqual(7);
    for (const h of hrefs) expect((await request.get(h)).status(), h).toBe(200);
  });

  test("sitemap inclui as páginas de detalhe e o robots aponta para ele", async ({ request }) => {
    const sm = await (await request.get("/sitemap.xml")).text();
    expect(sm).toContain("<loc>https://linkinstonks.vercel.app/acoes/9512/</loc>");
    expect(sm).toContain("<loc>https://linkinstonks.vercel.app/bdrs/TSLA34/</loc>");
    expect(sm.match(/<loc>/g)!.length).toBeGreaterThan(1700);
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Sitemap: https://linkinstonks.vercel.app/sitemap.xml");
  });

  test("o título do site usa o nome do projeto", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/linkinstonks/);
    await expect(page.getByRole("banner").getByRole("link", { name: "linkinstonks" })).toBeVisible();
  });
});
