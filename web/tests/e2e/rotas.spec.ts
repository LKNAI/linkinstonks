import { expect, test, type Page } from "@playwright/test";

const ROTAS = [
  { rota: "/", pronto: ".kpi" },
  { rota: "/acoes/", pronto: ".kpi" },
  { rota: "/acoes/tabela/", pronto: ".dtable tbody tr" },
  { rota: "/bdrs/", pronto: ".kpi" },
  { rota: "/instituicoes/", pronto: ".stats-table tbody tr" },
  { rota: "/novidades/", pronto: ".state, .stats-table" },
  { rota: "/status/", pronto: ".stats-table tbody tr" },
  { rota: "/sobre/", pronto: ".prose" },
  { rota: "/acoes/9512/", pronto: ".tl li" },
  { rota: "/bdrs/TSLA34/", pronto: ".mcols .mc" },
];

function ouvirErros(page: Page): string[] {
  const erros: string[] = [];
  page.on("console", (m) => m.type() === "error" && erros.push(m.text()));
  page.on("pageerror", (e) => erros.push(e.message));
  page.on("response", (r) => r.status() >= 400 && erros.push(`HTTP ${r.status()} ${r.url()}`));
  return erros;
}

for (const { rota, pronto } of ROTAS) {
  test(`${rota} renderiza sem erro de console e com o rodapé obrigatório`, async ({ page }) => {
    const erros = ouvirErros(page);
    await page.goto(rota);
    await expect(page.locator(pronto).first()).toBeVisible();
    const rodape = page.getByRole("contentinfo");
    await expect(rodape).toContainText("Fontes: B3 e CVM (dados públicos)");
    await expect(rodape).toContainText(/Última atualização: \d{2}\/\d{2}\/\d{4}/);
    await expect(rodape).toContainText("Não é recomendação de investimento");
    expect(erros).toEqual([]);
  });

  test(`${rota} em 360 px não rola na horizontal`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(rota);
    await expect(page.locator(pronto).first()).toBeVisible();
    const l = await page.evaluate(() => ({
      html: document.documentElement.scrollWidth,
      corpo: document.body.scrollWidth,
      janela: document.documentElement.clientWidth,
    }));
    expect(l.html).toBeLessThanOrEqual(l.janela);
    expect(l.corpo).toBeLessThanOrEqual(l.janela); // `overflow-x: clip` esconderia um estouro; o corpo não pode passar
  });
}

test("a navegação por clique leva às páginas sem erro", async ({ page }) => {
  const erros = ouvirErros(page);
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Principal" })
    .getByRole("link", { name: "Ações", exact: true })
    .click();
  await expect(page).toHaveURL(/\/acoes\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("quem escritura cada empresa");
  await page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "BDRs" }).click();
  await expect(page).toHaveURL(/\/bdrs\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("BDRs na B3");
  expect(erros).toEqual([]);
});

test("a página ativa é marcada no menu", async ({ page }) => {
  await page.goto("/bdrs/");
  await expect(page.getByRole("link", { name: "BDRs" })).toHaveAttribute("aria-current", "page");
});
