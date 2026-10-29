import { expect, test } from "@playwright/test";

test("a capa renderiza sem erro de console e com o rodapé obrigatório", async ({ page }) => {
  const erros: string[] = [];
  page.on("console", (m) => m.type() === "error" && erros.push(m.text()));
  page.on("pageerror", (e) => erros.push(e.message));

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Painel B3" })).toBeVisible();
  await expect(page.getByRole("contentinfo")).toContainText("Não é recomendação de investimento");
  expect(erros).toEqual([]);
});

test("viewport de 360 px não rola na horizontal", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  const larguras = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(larguras.scroll).toBeLessThanOrEqual(larguras.client);
});
