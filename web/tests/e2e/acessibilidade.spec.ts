// Acessibilidade WCAG 2.2 AA automatizada (axe-core) em todas as rotas, sob a CSP real do vercel.json.
// Regra do projeto: zero violações de qualquer gravidade nas regras de WCAG 2.0 a 2.2 nível A e AA.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const ROTAS = [
  { rota: "/", pronto: ".kpi" },
  { rota: "/acoes/", pronto: ".kpi" },
  { rota: "/acoes/tabela/", pronto: ".dtable tbody tr" },
  { rota: "/acoes/volume/", pronto: ".stats-table tbody tr" },
  { rota: "/bdrs/", pronto: ".dtable tbody tr" },
  { rota: "/instituicoes/", pronto: ".stats-table tbody tr" },
  { rota: "/novidades/", pronto: ".state, .stats-table" },
  { rota: "/status/", pronto: ".stats-table tbody tr" },
  { rota: "/sobre/", pronto: ".prose" },
  { rota: "/acoes/9512/", pronto: ".tl li" },
  { rota: "/bdrs/TSLA34/", pronto: ".mcols .mc" },
];

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function auditar(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
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
