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

  test("o nome na tabela abre a página da empresa em nova aba e o código desconhecido dá 404", async ({
    page,
    context,
  }) => {
    await page.goto("/acoes/");
    await expect(page.locator(".dtable tbody tr").first()).toBeVisible();
    const [nova] = await Promise.all([
      context.waitForEvent("page"),
      page.locator(".dtable tbody .co a").first().click(),
    ]);
    await expect(nova).toHaveURL(/\/acoes\/\d+\/$/);
    await expect(page).toHaveURL(/\/acoes\/$/); // a lista continua aberta
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
    const grafico = page.locator("section", { hasText: "Volume financeiro mensal" });
    await expect(grafico.locator(".alt-table tbody tr")).toHaveCount(25);
    expect(erros).toEqual([]);
  });

  test("a barra do volume mensal abre o arquivo oficial da B3 daquele mês (rastreabilidade)", async ({
    page,
  }) => {
    await page.goto("/bdrs/TSLA34/");
    const barras = page.locator("a.mc");
    await expect(barras).toHaveCount(25);
    const mensal = barras.nth(23); // último mês fechado
    await expect(mensal).toHaveAttribute("href", /\/InstDados\/SerHist\/COTAHIST_M\d{6}\.ZIP$/);
    await expect(mensal).toHaveAttribute("target", "_blank");
    await expect(mensal).toHaveAttribute("rel", /noopener/);
    await expect(mensal).toHaveAttribute("aria-label", /TSLA34, .*Abrir a fonte oficial na B3/);
    // o mês parcial soma arquivos diários: o clique vai à página oficial da B3
    await expect(barras.nth(24)).toHaveAttribute("href", /^https:\/\/www\.b3\.com\.br\//);
    // o clique de fato abre uma nova aba com a URL da fonte
    // (o pedido ao domínio da B3 é interceptado: o teste não sai da máquina, e um ZIP viraria download)
    await page
      .context()
      .route("**/COTAHIST_*.ZIP", (r) =>
        r.fulfill({ status: 200, contentType: "text/html", body: "arquivo oficial" }),
      );
    const [aba] = await Promise.all([page.waitForEvent("popup"), mensal.click()]);
    await aba.waitForLoadState();
    expect(aba.url()).toMatch(/COTAHIST_M\d{6}\.ZIP$/);
    await aba.close();
  });

  test("o bloco Fonte do volume lista os arquivos de cada mês e como conferir", async ({ page }) => {
    await page.goto("/bdrs/TSLA34/");
    const bloco = page.locator("section", { hasText: "Fonte do volume e como conferir" });
    await expect(bloco).toContainText("VOLTOT");
    await expect(bloco).toContainText("TSLA34F");
    await bloco.getByText(/Arquivos de origem por mês/).click();
    await expect(bloco.locator("tbody tr")).toHaveCount(25);
    await expect(bloco.locator("tbody a[href*='COTAHIST_M']").first()).toBeVisible();
    await page.getByRole("button", { name: "Ver como tabela" }).click();
    await expect(page.locator(".alt-table a.fonte-link").first()).toHaveAttribute(
      "href",
      /COTAHIST|b3\.com\.br/,
    );
  });

  test("na tabela de BDRs, a célula do volume mensal é um link para a fonte oficial", async ({ page }) => {
    await page.goto("/bdrs/");
    await expect(page.locator(".dtable tbody tr").first()).toBeVisible();
    await page.getByRole("button", { name: "Mostrar os 24 meses" }).click();
    const celula = page.locator(".dtable tbody a.fonte-cel").first();
    await expect(celula).toBeVisible();
    await expect(celula).toHaveAttribute("href", /COTAHIST_M\d{6}\.ZIP$/);
    await expect(celula).toHaveAttribute("target", "_blank");
    await expect(celula).toHaveAttribute("aria-label", /Abrir a fonte oficial na B3/);
  });

  test("detalhe de companhia mostra o volume mensal dos tickers com link para a fonte (Petrobras)", async ({
    page,
  }) => {
    await page.goto("/acoes/9512/");
    const grafico = page.locator("section", { hasText: "Volume negociado das ações" }).first();
    await expect(grafico.locator("a.mc")).toHaveCount(25);
    await expect(grafico.locator("a.mc").nth(23)).toHaveAttribute(
      "aria-label",
      /PETR3 PETR4, .*Abrir a fonte/,
    );
    await expect(page.locator("section", { hasText: "Fonte do volume e como conferir" })).toContainText(
      "PETR4",
    );
  });

  test("BDR sem depositária explica a ausência", async ({ page }) => {
    const b = bdrs.find((x) => x.depositaria === "Não identificado")!;
    await page.goto(`/bdrs/${b.ticker}/`);
    await expect(page.getByText("Não encontrada nas listas consultadas")).toBeVisible();
  });

  test("o ticker na tabela abre a página do BDR em nova aba", async ({ page, context }) => {
    await page.goto("/bdrs/");
    await expect(page.locator(".dtable tbody tr").first()).toBeVisible();
    const [nova] = await Promise.all([
      context.waitForEvent("page"),
      page.locator(".dtable tbody a.tk").first().click(),
    ]);
    await expect(nova).toHaveURL(/\/bdrs\/[A-Z0-9]+\/$/);
    await expect(page).toHaveURL(/\/bdrs\/$/); // a lista continua aberta
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
  test("novidades mostra os eventos (ou o estado vazio) e o link do feed", async ({ page }) => {
    await page.goto("/novidades/");
    await expect(page.locator(".stats-table, .state").first()).toBeVisible();
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

  test("status lista as 8 fontes e os BDRs sem depositária", async ({ page }) => {
    await page.goto("/status/");
    await expect(page.getByRole("heading", { name: "Fontes" })).toBeVisible();
    await expect(page.getByRole("table").first().locator("tbody tr")).toHaveCount(8);
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
