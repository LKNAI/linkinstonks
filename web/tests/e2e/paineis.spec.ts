import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const numero = (s: string | null): number => Number((s ?? "").replace(/\./g, "").match(/\d+/)?.[0]);

async function totalDaTabela(page: Page): Promise<number> {
  return numero(await page.locator(".count b").first().textContent());
}

async function csvBaixado(page: Page, botao: string): Promise<string[]> {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: botao }).click(),
  ]);
  const texto = readFileSync((await download.path()) as string, "utf8");
  expect(texto.charCodeAt(0)).toBe(0xfeff); // BOM para o Excel
  return texto.slice(1).split("\n");
}

test.describe("/acoes", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/acoes/");
    await expect(page.locator(".dtable tbody tr").first()).toBeVisible();
  });

  test("filtro cruzado: clicar num escriturador altera KPIs, gráficos e tabela", async ({ page }) => {
    const antes = await totalDaTabela(page);
    const kpiAntes = numero(await page.locator(".kpi .val").first().textContent());
    expect(kpiAntes).toBe(antes);

    const legenda = page.getByRole("group", { name: /participação por escriturador/i });
    await legenda.getByRole("button", { name: /Banco Bradesco/ }).click();

    const depois = await totalDaTabela(page);
    expect(depois).toBeLessThan(antes);
    expect(numero(await page.locator(".kpi .val").first().textContent())).toBe(depois);
    await expect(
      page.getByRole("button", { name: /Remover filtro Escriturador: Banco Bradesco/ }),
    ).toBeVisible();
    await expect(page.locator(".kpi .sub").nth(5)).toContainText("Banco Bradesco");
    // o donut de segmento passa a refletir o filtro
    const centroSegmento = await page.locator(".donut").nth(1).locator(".ctr-n").textContent();
    expect(numero(centroSegmento)).toBe(depois);
    // o próprio donut de escrituradores continua mostrando as demais instituições (ignora o próprio filtro)
    await expect(legenda.getByRole("button", { name: /Itaú Corretora/ })).toBeVisible();

    await page.getByRole("button", { name: "Limpar filtros" }).click();
    expect(await totalDaTabela(page)).toBe(antes);
  });

  test("o filtro vai para a URL e sobrevive a recarregar a página", async ({ page }) => {
    await page
      .getByRole("group", { name: /segmento de listagem/i })
      .getByRole("button", { name: /Novo Mercado/ })
      .click();
    await expect(page).toHaveURL(/mkt=NM/);
    const filtrado = await totalDaTabela(page);
    await page.reload();
    await expect(page.locator(".dtable tbody tr").first()).toBeVisible();
    expect(await totalDaTabela(page)).toBe(filtrado);
    await expect(page.getByRole("button", { name: /Remover filtro Segmento: Novo Mercado/ })).toBeVisible();
  });

  test("busca textual sem acento e ordenação por cabeçalho", async ({ page }) => {
    await page.getByRole("searchbox").fill("petrobras");
    await expect(page.locator(".dtable tbody tr").first()).toContainText("PETROBRAS");
    await expect(page).toHaveURL(/q=petrobras/);
    await page.getByRole("button", { name: "Limpar filtros" }).click();
    const cab = page.getByRole("columnheader", { name: "Empresa" });
    await expect(cab).toHaveAttribute("aria-sort", "ascending");
    // a barra de filtros fixa cobre o cabeçalho quando o Playwright rola até ele: dispara o clique direto
    await page.getByRole("button", { name: /^Empresa/ }).dispatchEvent("click");
    await expect(cab).toHaveAttribute("aria-sort", "descending");
  });

  test("o CSV baixado reflete a visão filtrada", async ({ page }) => {
    await page
      .getByRole("group", { name: /histórico na cvm/i })
      .getByRole("button", { name: /Trocou de escriturador/ })
      .click();
    const n = await totalDaTabela(page);
    const linhas = await csvBaixado(page, "Exportar CSV");
    expect(linhas[0]).toContain("Empresa;Razão social;Código;CNPJ");
    expect(linhas).toHaveLength(n + 1);
  });

  test("cada gráfico tem uma alternativa em tabela", async ({ page }) => {
    const botoes = page.getByRole("button", { name: "Ver como tabela" });
    expect(await botoes.count()).toBeGreaterThanOrEqual(6);
    await botoes.first().click();
    await expect(page.locator(".alt-table").first()).toBeVisible();
  });

  test("navegação por teclado nos filtros e na legenda dos gráficos", async ({ page }) => {
    await page.getByRole("searchbox").focus();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: /Somente negociadas/ })).toBeFocused();
    const botao = page
      .getByRole("group", { name: /segmento de listagem/i })
      .getByRole("button")
      .first();
    await botao.focus();
    await page.keyboard.press("Enter");
    await expect(botao).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Enter");
    await expect(botao).toHaveAttribute("aria-pressed", "false");
  });
});

test.describe("/acoes/tabela", () => {
  test("filtros independentes e CSV com a coluna Código CVM", async ({ page }) => {
    await page.goto("/acoes/tabela/");
    await expect(page.locator(".dtable tbody tr").first()).toBeVisible();
    const todas = await totalDaTabela(page);
    await page.getByRole("combobox", { name: "Histórico" }).selectOption("Trocou de escriturador");
    const trocaram = await totalDaTabela(page);
    expect(trocaram).toBeLessThan(todas);
    await expect(page).toHaveURL(/hist=/);
    const linhas = await csvBaixado(page, "Exportar CSV");
    expect(linhas[0].split(";")).toContain("Código CVM");
    expect(linhas).toHaveLength(trocaram + 1);
    await expect(page.getByRole("columnheader", { name: "Cód. CVM" })).toBeVisible();
  });
});

test.describe("/bdrs", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/bdrs/");
    await expect(page.locator(".dtable tbody tr").first()).toBeVisible();
  });

  test("a situação filtra e os KPIs acompanham", async ({ page }) => {
    expect(numero(await page.locator(".kpi .val").first().textContent())).toBe(1152);
    await page.getByRole("button", { name: /^Negociadas em/ }).click();
    expect(numero(await page.locator(".kpi .val").first().textContent())).toBe(966);
    await expect(page).toHaveURL(/st=on/);
  });

  test("clicar num mês do gráfico define o mês do ranking", async ({ page }) => {
    await expect(page.getByText("Volume acumulado em 24 meses")).toBeVisible();
    await page.getByRole("group", { name: "Colunas selecionáveis" }).getByRole("button").nth(5).click();
    await expect(page.getByRole("button", { name: /Remover filtro Mês do ranking/ })).toBeVisible();
    await expect(
      page.locator(".card .desc").filter({ hasText: /^Volume em [a-z]{3}\/\d{2} · cor = depositária/ }),
    ).toBeVisible();
    await expect(page).toHaveURL(/mes=5/);
  });

  test("mostrar os 24 meses acrescenta uma coluna por mês", async ({ page }) => {
    const antes = await page.locator(".dtable thead th").count();
    await page.getByRole("button", { name: "Mostrar os 24 meses" }).click();
    expect(await page.locator(".dtable thead th").count()).toBe(antes + 24);
    await page.getByRole("button", { name: "Ocultar meses" }).click();
    expect(await page.locator(".dtable thead th").count()).toBe(antes);
  });

  test("tabela virtualizada: só renderiza as linhas visíveis", async ({ page }) => {
    const linhas = await page.locator(".dtable tbody tr[data-index]").count();
    expect(linhas).toBeGreaterThan(5);
    expect(linhas).toBeLessThan(120); // 1.152 BDRs no total
    await page
      .locator(".tbl-wrap")
      .last()
      .evaluate((e) => (e.scrollTop = 20000));
    await expect(page.locator(".dtable tbody tr[data-index]").first()).not.toHaveAttribute("data-index", "0");
  });

  test("o CSV baixado tem as linhas esperadas", async ({ page }) => {
    await page
      .getByRole("group", { name: /depositária/i })
      .getByRole("button", { name: /Banco Bradesco/ })
      .click();
    const n = await totalDaTabela(page);
    const linhas = await csvBaixado(page, "Exportar CSV");
    expect(linhas[0].split(";")).toHaveLength(14 + 24);
    expect(linhas).toHaveLength(n + 1);
  });

  test("clicar numa barra do ranking filtra a tabela por aquele BDR", async ({ page }) => {
    await page.locator(".bars.rank .brow").first().click();
    await expect(page.getByRole("searchbox")).toHaveValue("tsla34");
    expect(await totalDaTabela(page)).toBe(1);
  });
});
