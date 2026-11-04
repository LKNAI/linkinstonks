import AxeBuilder from "@axe-core/playwright";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const raiz = join(__dirname, "..", "..", "..", "data");
const snapshot = (mes: string, nome: string) =>
  JSON.parse(readFileSync(join(raiz, "snapshots_site", mes, `${nome}.json`), "utf8")) as {
    reconstituido: boolean;
    coletado_em: string | null;
    meses?: string[];
    colunas: string[];
    linhas: unknown[][];
  };
const inteiro = (n: number) => new Intl.NumberFormat("pt-BR").format(n);
// Os meses saem do site com a retenção (ADR 0011): os testes escolhem nos dados, sem data fixa.
const noSite = readdirSync(join(raiz, "snapshots_site")).sort().slice(-36);
const comBdrs = (m: string) => existsSync(join(raiz, "snapshots_site", m, "bdrs.json"));
const mesReal = noSite.find((m) => !snapshot(m, "acoes").reconstituido);
const mesReconstituido = noSite.findLast((m) => snapshot(m, "acoes").reconstituido);
const mesSemBdrs = noSite.find((m) => !comBdrs(m));
const dataBr = (iso: string) => iso.split("-").reverse().join("/");
const fimDoMes = (mes: string) => {
  const [a, m] = mes.split("-").map(Number);
  return dataBr(new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10));
};
const semViolacoes = async (page: Page) => {
  const r = await new AxeBuilder({ page }).analyze();
  expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
};

test.describe("relatório mensal (8.7)", () => {
  test("lista, relatório com links, seção vazia e feed", async ({ page, request }) => {
    await page.goto("/relatorios/");
    await page.getByRole("link", { name: "Relatório de outubro de 2026" }).click();
    await expect(page).toHaveURL(/\/relatorios\/2026-10\/$/);
    await expect(page.getByRole("heading", { level: 1, name: "Relatório de outubro de 2026" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Resumo em números" })).toBeVisible();
    await expect(page.getByText("Nenhuma ocorrência no mês.").first()).toBeVisible();
    await semViolacoes(page);
    const feed = await (await request.get("/feed.xml")).text();
    expect(feed).toContain("/relatorios/2026-10/");
  });

  test("impressão esconde o menu e mostra fonte e data", async ({ page }) => {
    await page.goto("/relatorios/2026-10/");
    await page.emulateMedia({ media: "print" });
    await expect(page.locator(".site-header")).toBeHidden();
    await expect(page.locator(".relatorio-rodape")).toContainText("Fontes: B3 e CVM");
    await expect(page.locator(".relatorio-cabecalho")).toContainText("Relatório de outubro de 2026");
  });
});

test.describe("ver mês passado (8.6)", () => {
  test("com snapshot real, os KPIs batem com os números do arquivo", async ({ page }) => {
    test.skip(!mesReal, "nenhum snapshot real dentro da retenção");
    const doc = snapshot(mesReal!, "acoes");
    await page.goto(`/acoes/?em=${mesReal}`);
    await expect(page.locator(".em-faixa")).toContainText(`posição coletada em ${dataBr(doc.coletado_em!)}`);
    await expect(page.locator(".em-faixa")).not.toContainText("reconstituída");
    const kpi = page.locator(".kpi").first();
    // o filtro padrão de /acoes mostra só companhias com ticker
    const iTickers = doc.colunas.indexOf("tickers");
    const comTicker = doc.linhas.filter((l) => (l[iTickers] as unknown[]).length).length;
    await expect(kpi.locator(".val")).toHaveText(inteiro(comTicker));
    await expect(kpi.locator(".sub")).toContainText(/desde então|Igual a hoje/);
    await expect(page.locator(".em-faixa")).toContainText(
      `${inteiro(doc.linhas.length)} companhias nesta posição`,
    );
    await expect(page.locator(".kpi").nth(1).locator(".val")).toHaveText(inteiro(comTicker));
    await expect(page.locator("#volume")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Negociação" })).toHaveCount(0);
    await expect(page.getByText("esta seção só aparece na posição de hoje")).toBeVisible();
    await semViolacoes(page);
  });

  test("reconstituição aparece como tal, e Voltar para hoje limpa a URL", async ({ page }) => {
    test.skip(!mesReconstituido, "nenhum mês reconstituído dentro da retenção");
    const doc = snapshot(mesReconstituido!, "acoes");
    await page.goto(`/acoes/?em=${mesReconstituido}`);
    await expect(page.locator(".em-faixa")).toContainText(
      `posição de ${fimDoMes(mesReconstituido!)} [reconstituída]`,
    );
    await expect(page.locator(".em-faixa")).toContainText("Não é foto da época");
    const iTickers = doc.colunas.indexOf("tickers");
    const comTicker = doc.linhas.filter((l) => (l[iTickers] as unknown[]).length).length;
    await expect(page.locator(".kpi").first().locator(".val")).toHaveText(inteiro(comTicker));
    await page.getByRole("button", { name: "Voltar para hoje" }).click();
    await expect(page).not.toHaveURL(/em=/);
    await expect(page.getByRole("heading", { name: "Negociação" })).toBeVisible();
    await expect(page.locator(".em-faixa")).toHaveCount(0);
  });

  test("o seletor troca o mês e os filtros mantêm o parâmetro", async ({ page }) => {
    await page.goto("/bdrs/");
    const mes = noSite.at(-1)!;
    await page.getByLabel("Ver como em").selectOption(mes);
    await expect(page).toHaveURL(new RegExp(`em=${mes}`));
    await expect(page.locator(".em-faixa")).toBeVisible();
    const doc = snapshot(mes, "bdrs");
    await expect(page.locator(".kpi").first().locator(".val")).toHaveText(inteiro(doc.linhas.length));
    await page.getByLabel("Busca", { exact: false }).first().fill("TSLA");
    await expect(page).toHaveURL(new RegExp(`em=${mes}`));
    await semViolacoes(page);
  });

  test("/instituicoes aceita o mês, e mês sem BDRs avisa", async ({ page }) => {
    await page.goto(`/instituicoes/?em=${noSite.at(-1)}`);
    await expect(page.locator(".em-faixa")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Depositárias de BDR" })).toBeVisible();
    test.skip(!mesSemBdrs, "todos os meses dentro da retenção têm BDRs");
    await page.goto(`/instituicoes/?em=${mesSemBdrs}`);
    await expect(page.getByText("Não há posição de BDRs guardada para este mês.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Depositárias de BDR" })).toBeHidden();
  });

  test("mês sem arquivo explica e oferece a volta", async ({ page }) => {
    await page.goto("/acoes/?em=1999-01");
    await expect(page.getByText("Não há posição guardada para este mês.")).toBeVisible();
    await page.getByRole("button", { name: "Voltar para hoje" }).click();
    await expect(page.locator(".kpi").first()).toBeVisible();
  });

  test("/bdrs com janela curta não inventa comparação e diz quantos meses mostra", async ({ page }) => {
    const mes = noSite.findLast((m) => comBdrs(m) && snapshot(m, "bdrs").meses!.length < 13);
    test.skip(!mes, "nenhum mês com janela curta dentro da retenção");
    const n = snapshot(mes!, "bdrs").meses!.length;
    const erros: string[] = [];
    page.on("pageerror", (e) => erros.push(e.message));
    await page.goto(`/bdrs/?em=${mes}&faixa=ticket_alto`);
    await expect(page.locator(".em-faixa")).toContainText("[reconstituída]");
    const kpis = page.locator(".kpis").first();
    await expect(kpis).toContainText(`Volume em ${n} meses`);
    await expect(kpis).toContainText("sem o mesmo mês do ano anterior");
    await expect(kpis).not.toContainText("undefined");
    await expect(kpis).not.toContainText("100%");
    await expect(page.locator(".kpi").first().locator(".val")).toHaveText(
      inteiro(snapshot(mes!, "bdrs").linhas.length),
    );
    await expect(page.getByLabel("Faixa de ticket")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Padrão de negociação" })).toHaveCount(0);
    await expect(page.getByText("esta seção só aparece na posição de hoje")).toBeVisible();
    expect(erros).toEqual([]);
    await semViolacoes(page);
  });
});
