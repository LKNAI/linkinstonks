import { expect, test, type Page } from "@playwright/test";

const ROTAS = [
  { rota: "/", pronto: ".kpi" },
  { rota: "/acoes/", pronto: ".kpi" },
  { rota: "/acoes/tabela/", pronto: ".dtable tbody tr" },
  { rota: "/acoes/volume/", pronto: ".stats-table tbody tr" },
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

test.describe("cabeçalhos de segurança e cache (vercel.json)", () => {
  test("a CSP e os demais cabeçalhos estão presentes e o cache dos dados é curto", async ({ request }) => {
    const h = (await request.get("/acoes/")).headers();
    expect(h["content-security-policy"]).toContain("default-src 'self'");
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["content-security-policy"]).toContain("object-src 'none'");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["permissions-policy"]).toContain("camera=()");
    expect((await request.get("/data/acoes.json")).headers()["cache-control"]).toBe(
      "public, max-age=300, stale-while-revalidate=3600",
    );
    expect((await request.get("/feed.xml")).headers()["cache-control"]).toContain("max-age=300");
  });

  for (const rota of [
    "/",
    "/acoes/",
    "/acoes/tabela/",
    "/bdrs/",
    "/acoes/9512/",
    "/bdrs/TSLA34/",
    "/status/",
  ]) {
    test(`${rota} roda sem nenhuma violação da CSP, inclusive no download de CSV`, async ({ page }) => {
      await page.addInitScript(() => {
        (window as unknown as { __csp: string[] }).__csp = [];
        document.addEventListener("securitypolicyviolation", (e) =>
          (window as unknown as { __csp: string[] }).__csp.push(`${e.violatedDirective} ${e.blockedURI}`),
        );
      });
      await page.goto(rota);
      await expect(page.locator(".kpi, .tl li, .mcols, .stats-table tbody tr").first()).toBeVisible();
      if (rota === "/acoes/tabela/") {
        const [d] = await Promise.all([
          page.waitForEvent("download"),
          page.getByRole("button", { name: "Exportar CSV" }).click(),
        ]);
        expect(d.suggestedFilename()).toBe("escrituradores_b3_cvm.csv");
      }
      expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([]);
    });
  }
});
