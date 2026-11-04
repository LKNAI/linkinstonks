import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const dados = <T>(arq: string): T =>
  JSON.parse(readFileSync(join(__dirname, "..", "..", "..", "data", "public", arq), "utf8")) as T;
const acoes = dados<{ companhias: { liquidez: { categoria: string } | null }[] }>("acoes.json").companhias;
const bdrs = dados<{ bdrs: { ticker: string; volume_24m: number }[] }>("bdrs.json").bdrs;
const maior = [...bdrs].sort((a, b) => b.volume_24m - a.volume_24m)[0].ticker;

const mapa = (page: Page) => page.locator(".mapa-area").first();

test.describe("/bdrs/mapa", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/bdrs/mapa/");
    await expect(page.locator(".mapa-svg")).toBeVisible();
  });

  test("começa com 50 linhas em intensidade e 24 meses, do maior volume para o menor", async ({ page }) => {
    await expect(page.locator(".mapa-rotulos li")).toHaveCount(50);
    await expect(page.locator(".mapa-mes")).toHaveCount(24);
    await expect(page.locator(".mapa-rotulos li").first()).toContainText(maior);
  });

  test("variação mostra só os 12 meses com referência e a legenda muda", async ({ page }) => {
    await page.getByRole("button", { name: "Variação contra a média" }).click();
    await expect(page.locator(".mapa-mes")).toHaveCount(12);
    await expect(page.getByText("×1 = igual à média dos 12 meses anteriores")).toBeVisible();
    await expect(page).toHaveURL(/modo=variacao/);
  });

  test("o número de linhas e os filtros ficam na URL e voltam ao recarregar", async ({ page }) => {
    await page.getByRole("group", { name: "Número de linhas" }).getByRole("button", { name: "25" }).click();
    await expect(page.locator(".mapa-rotulos li")).toHaveCount(25);
    await page.getByRole("combobox", { name: "Tipo" }).selectOption("DRE");
    await expect(page).toHaveURL(/type=DRE/);
    await page.reload();
    await expect(page.locator(".mapa-rotulos li")).toHaveCount(25);
    await expect(page.getByRole("button", { name: /Remover filtro Tipo/ })).toBeVisible();
  });

  test("as setas percorrem as células, lendo o valor, e Esc sai", async ({ page }) => {
    await mapa(page).focus();
    await page.keyboard.press("ArrowLeft");
    const aviso = page.locator(".mapa [aria-live=polite]");
    await expect(aviso).toContainText(maior);
    await page.keyboard.press("ArrowDown");
    await expect(aviso).not.toContainText(maior);
    await expect(page.locator(".mapa-foco-b")).toHaveCount(1);
    await expect(page.locator("#tip")).toHaveClass(/on/);
    await page.keyboard.press("Escape");
    await expect(page.locator(".mapa-foco-b")).toHaveCount(0);
  });

  test("o tooltip mostra ticker, mês, volume e o valor da escala", async ({ page }) => {
    const r = await page.locator(".mapa-svg").boundingBox();
    await page.mouse.move(r!.x + r!.width - 5, r!.y + 5);
    const tip = page.locator("#tip");
    await expect(tip).toContainText(maior);
    await expect(tip).toContainText("Volume");
    await expect(tip).toContainText("Negócios");
    await expect(tip).toContainText("do pico do BDR");
  });

  test("clicar numa linha abre o BDR em nova aba", async ({ page, context }) => {
    const r = await page.locator(".mapa-svg").boundingBox();
    const [nova] = await Promise.all([context.waitForEvent("page"), page.mouse.click(r!.x + 20, r!.y + 5)]);
    await nova.waitForLoadState();
    expect(nova.url()).toContain(`/bdrs/${maior}/`);
    await nova.close();
  });

  test("'Ver como tabela' traz o valor de cada mês", async ({ page }) => {
    await page.getByRole("button", { name: "Ver como tabela" }).click();
    const t = page.locator(".alt-table");
    await expect(t.locator("thead th")).toHaveCount(26);
    await expect(t.locator("tbody tr").first()).toContainText(maior);
  });

  test("com todos os BDRs, só o trecho visível é desenhado", async ({ page }) => {
    await page
      .getByRole("group", { name: "Número de linhas" })
      .getByRole("button", { name: "Todos" })
      .click();
    await expect(page.locator(".mapa-corpo")).toHaveJSProperty("offsetHeight", bdrs.length * 20);
    expect(await page.locator(".mapa-rotulos li").count()).toBeLessThan(150);
    await page.evaluate(() => window.scrollTo(0, 15000));
    await expect(page.locator(".mapa-rotulos li").first()).not.toContainText(maior);
  });

  test("desenha 100 × 24 células depressa", async ({ page }) => {
    const ms = await page.evaluate(async () => {
      const b = [
        ...document.querySelectorAll<HTMLButtonElement>('[aria-label="Número de linhas"] button'),
      ].find((x) => x.textContent === "100")!;
      const t = performance.now();
      b.click();
      while (document.querySelectorAll(".mapa-rotulos li").length !== 100)
        await new Promise((r) => requestAnimationFrame(r));
      return performance.now() - t;
    });
    console.log(`100 x 24: ${ms.toFixed(0)} ms`);
    expect(ms).toBeLessThan(400); // alvo de 100 ms na máquina de referência; margem para a CI
  });

  test("em 390 px: 12 meses, primeira coluna fixa e rolagem dentro do bloco", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto("/bdrs/mapa/");
    await expect(page.locator(".mapa-mes")).toHaveCount(12);
    await expect(page.locator(".mapa-sub").first()).toBeHidden();
    const rol = page.locator(".mapa-rolagem");
    await rol.evaluate((el) => (el.scrollLeft = 200));
    const x = await page.locator(".mapa-rotulos").boundingBox();
    expect(x!.x).toBeGreaterThanOrEqual(0);
    expect(x!.x).toBeLessThan(60);
    await page
      .getByRole("group", { name: "Meses visíveis" })
      .getByRole("button", { name: "24 meses" })
      .click();
    await expect(page.locator(".mapa-mes")).toHaveCount(24);
  });
});

test.describe("/bdrs", () => {
  test("prévia do mapa, histograma com aviso de estimativa e filtro por faixa", async ({ page }) => {
    await page.goto("/bdrs/");
    await expect(page.locator(".dtable tbody tr").first()).toBeVisible();
    await expect(page.locator(".mapa-rotulos li")).toHaveCount(25);
    await expect(page.locator(".hist-barra").first()).toBeVisible();
    await expect(
      page
        .getByText("Estimativa baseada no tamanho médio dos negócios; não identifica investidores.")
        .first(),
    ).toBeVisible();
    await page.getByRole("button", { name: /^Ticket alto:/ }).click();
    await expect(page).toHaveURL(/faixa=ticket_alto/);
    await expect(page.getByRole("button", { name: /Remover filtro Faixa de ticket/ })).toBeVisible();
  });

  test("clicar num mês do mapa define o mês do ranking", async ({ page }) => {
    await page.goto("/bdrs/");
    await page.locator("button.mapa-mes").nth(5).click();
    await expect(page).toHaveURL(/mes=5/);
    await expect(page.getByRole("button", { name: /Remover filtro Mês do ranking/ })).toBeVisible();
  });

  test("o detalhe do BDR mostra o ticket mensal, a faixa e o aviso", async ({ page }) => {
    await page.goto(`/bdrs/${maior}/`);
    await expect(page.getByRole("heading", { name: "Ticket médio mensal" })).toBeVisible();
    await expect(page.getByText("Faixa de ticket (estimativa)")).toBeVisible();
    await expect(page.getByRole("link", { name: "Metodologia" }).first()).toHaveAttribute(
      "href",
      "/sobre/#metodologia-ticket",
    );
  });
});

test.describe("/acoes", () => {
  test("seção Negociação: presença filtra o painel e a composição filtra por segmento", async ({ page }) => {
    await page.goto("/acoes/");
    await expect(page.getByRole("heading", { name: "Negociação" })).toBeVisible();
    await page.getByRole("button", { name: /Novo Mercado, \d+ empresas/ }).click();
    await expect(page).toHaveURL(/mkt=NM/);
    await page.getByRole("button", { name: /Remover filtro Segmento/ }).click();
    await page.getByRole("button", { name: "Mostrar liquidez" }).click();
    await expect(page.getByRole("columnheader", { name: "Presença 6m" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Listada desde" })).toBeVisible();
    await expect(page).toHaveURL(/lq=1/);
  });
});

test.describe("/acoes/liquidez", () => {
  test("filtra por categoria, ordena e baixa o CSV da visão filtrada", async ({ page }) => {
    await page.goto("/acoes/liquidez/");
    await expect(page.locator(".dtable tbody tr").first()).toBeVisible();
    await page.getByRole("combobox", { name: "Categoria" }).selectOption("presenca_baixa");
    await expect(page).toHaveURL(/liq=presenca_baixa/);
    const esperadas = acoes.filter((c) => c.liquidez?.categoria === "presenca_baixa").length;
    await expect(page.locator(".count b")).toHaveText(String(esperadas));
    await expect(page.locator(".dtable tbody tr").first()).toContainText("Negociou em");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Exportar CSV" }).click(),
    ]);
    const csv = readFileSync((await download.path()) as string, "utf8");
    expect(csv.trim().split("\n")).toHaveLength(esperadas + 1);
    expect(csv).toContain("Presença baixa");
  });
});

test("o detalhe da companhia mostra presença em painel separado, listagem e a tabela mensal", async ({
  page,
}) => {
  await page.goto("/acoes/9512/");
  await expect(page.getByRole("heading", { name: "Presença mensal" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Listagem" })).toBeVisible();
  await expect(page.getByText("Listada desde")).toBeVisible();
  await page
    .locator("section", { hasText: "Presença mensal" })
    .getByRole("button", { name: "Ver como tabela" })
    .click();
  await expect(page.getByRole("table", { name: "Presença mensal" }).locator("thead")).toContainText(
    "Dias com negócio",
  );
});

test("/sobre tem a metodologia, com as âncoras usadas pelos links", async ({ page }) => {
  await page.goto("/sobre/");
  for (const a of ["liquidez", "categorias", "negocios", "ticket", "mapa", "listagem"])
    await expect(page.locator(`#metodologia-${a}`)).toBeVisible();
});
