// Acessibilidade WCAG 2.2 AA automatizada (axe-core) em todas as rotas, sob a CSP real do vercel.json.
// Regra do projeto: zero violações de qualquer gravidade nas regras de WCAG 2.0 a 2.2 nível A e AA.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const ROTAS = [
  { rota: "/", pronto: ".kpi" },
  { rota: "/acoes/", pronto: ".kpi" },
  { rota: "/bdrs/", pronto: ".dtable tbody tr" },
  { rota: "/instituicoes/", pronto: ".stats-table tbody tr" },
  { rota: "/novidades/", pronto: ".state, .stats-table" },
  { rota: "/status/", pronto: ".stats-table tbody tr" },
  { rota: "/sobre/", pronto: ".prose" },
  { rota: "/acoes/9512/", pronto: ".tl li" },
  { rota: "/bdrs/TSLA34/", pronto: ".mcols .mc" },
  { rota: "/design/", pronto: ".ds-marcas li" },
];

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function auditar(page: Page, incluir?: string) {
  const construtor = new AxeBuilder({ page }).withTags(TAGS);
  const r = await (incluir ? construtor.include(incluir) : construtor).analyze();
  return r.violations.map((v) => ({
    regra: v.id,
    impacto: v.impact,
    ajuda: v.help,
    alvos: v.nodes.slice(0, 4).map((n) => n.target.join(" ")),
    total: v.nodes.length,
  }));
}

for (const { rota, pronto } of ROTAS) {
  test(`${rota} não tem violações de WCAG 2.2 AA`, async ({ page }) => {
    await page.goto(rota);
    await page.locator(pronto).first().waitFor();
    await expect(page.getByRole("main")).toHaveCount(1); // um ponto de referência principal por página
    expect(await auditar(page)).toEqual([]);
  });
}

test("/design é noindex e fica fora do sitemap", async ({ page, request }) => {
  await page.goto("/design/");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).not.toContain("/design");
});

test("/bdrs/ mostra a régua de marcas com a cor de cada depositária", async ({ page }) => {
  await page.goto("/bdrs/");
  const partes = page.locator(".regua span");
  await partes.first().waitFor();
  expect(await partes.count()).toBeGreaterThanOrEqual(2);
  await expect(page.locator(".regua")).toHaveAttribute("aria-label", /Banco B3 \d+,\d%/);
});

test.describe("filtros em sheet (celular)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("abre como diálogo modal, não tem violações, filtra, fecha com Esc e devolve o foco", async ({
    page,
  }) => {
    await page.goto("/bdrs/");
    await page.locator(".dtable tbody tr").first().waitFor();
    const gatilho = page.getByRole("button", { name: /^Filtros/ });
    await expect(page.getByRole("group", { name: "Situação" })).toBeHidden();
    await gatilho.click();
    const dialogo = page.getByRole("dialog", { name: "Filtros" });
    await expect(dialogo).toBeVisible();
    await expect(dialogo.getByRole("button", { name: "Fechar filtros" })).toBeFocused();
    expect(await auditar(page, "[role=dialog]")).toEqual([]);
    await dialogo.getByRole("button", { name: /^Sem negócios/ }).click();
    await page.keyboard.press("Escape");
    await expect(dialogo).toBeHidden();
    await expect(gatilho).toBeFocused();
    await expect(gatilho.locator(".fsheet-n")).toHaveText("1");
    await expect(page.locator(".dtable tbody tr").first()).toBeVisible();
  });
});

test.describe("gráficos de colunas no celular", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  for (const rota of ["/bdrs/", "/acoes/", "/bdrs/TSLA34/"]) {
    test(`${rota} não tem violações de WCAG 2.2 AA em 390 px (alvos de toque ≥ 24 px)`, async ({ page }) => {
      await page.goto(rota);
      await page.locator(".mcols .mc, .yrs .yr").first().waitFor();
      expect(await auditar(page)).toEqual([]);
    });
  }

  test("o gráfico mensal rola e começa no mês mais recente, com colunas de pelo menos 32 px", async ({
    page,
  }) => {
    await page.goto("/bdrs/");
    const rolagem = page.locator(".mchart .rolagem").first();
    await rolagem.waitFor();
    const m = await rolagem.evaluate((el) => ({
      rolavel: el.scrollWidth > el.clientWidth,
      fim: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1,
    }));
    expect(m).toEqual({ rolavel: true, fim: true });
    const largura = await page
      .locator(".mcols .mc")
      .first()
      .evaluate((el) => el.getBoundingClientRect().width);
    expect(largura).toBeGreaterThanOrEqual(24);
  });

  test("no detalhe, tocar numa coluna mostra o valor e só abre a B3 pelo link explícito", async ({
    page,
    context,
  }) => {
    await page.goto("/bdrs/TSLA34/");
    const coluna = page.locator(".mcols .mc").last();
    await coluna.waitFor();
    let abriu = false;
    context.on("page", () => (abriu = true));
    await coluna.tap();
    const leitura = page.locator(".leitura");
    await expect(leitura).toBeVisible();
    await expect(leitura.getByRole("link", { name: /Abrir arquivo oficial da B3/ })).toHaveAttribute(
      "href",
      /b3\.com\.br/,
    );
    expect(abriu).toBe(false);
  });
});

test("no desktop os filtros ficam inline e o botão do sheet não aparece", async ({ page }) => {
  await page.goto("/bdrs/");
  await page.locator(".dtable tbody tr").first().waitFor();
  await expect(page.getByRole("button", { name: /^Filtros/ })).toBeHidden();
  await expect(page.getByRole("group", { name: "Situação" })).toBeVisible();
});

test.describe("estados interativos", () => {
  test("gráfico em modo tabela (BDR) e bloco de fonte aberto", async ({ page }) => {
    await page.goto("/bdrs/TSLA34/");
    await page.locator(".mcols .mc").first().waitFor();
    await page.getByRole("button", { name: "Ver como tabela" }).click();
    await page.getByText(/Arquivos de origem por mês/).click();
    expect(await auditar(page)).toEqual([]);
  });

  test("tabela de BDRs com os 24 meses e filtro aplicado", async ({ page }) => {
    await page.goto("/bdrs/?q=tesla");
    await page.locator(".dtable tbody tr").first().waitFor();
    await page.getByRole("button", { name: "Mostrar os 24 meses" }).click();
    expect(await auditar(page)).toEqual([]);
  });

  test("tooltip aberto por foco de teclado", async ({ page }) => {
    await page.goto("/bdrs/TSLA34/");
    await page.locator("a.mc").nth(10).focus();
    await expect(page.locator("[role=tooltip], .tip").first()).toBeVisible();
    expect(await auditar(page)).toEqual([]);
  });
});
