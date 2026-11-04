import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const campo = (page: import("@playwright/test").Page) =>
  page.getByRole("combobox", { name: /Buscar companhia/ });

test.describe("busca global (8.8)", () => {
  test("Ctrl+K abre, ticker exato vem primeiro, Enter navega", async ({ page }) => {
    await page.goto("/novidades/");
    await page.keyboard.press("Control+k");
    await expect(campo(page)).toBeFocused();
    await campo(page).fill("petr4");
    const primeira = page.getByRole("option").first();
    await expect(primeira).toContainText("PETROBRAS");
    await expect(primeira).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/acoes\/9512\/$/);
  });

  test("/ abre fora de campos de texto; Esc fecha e devolve o foco", async ({ page }) => {
    await page.goto("/sobre/");
    await page.getByRole("button", { name: "Buscar" }).focus();
    await page.keyboard.press("/");
    await expect(page.getByRole("dialog", { name: "Busca global" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Busca global" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Buscar" })).toBeFocused();
  });

  test("setas navegam, Tab fica preso e o histórico guarda a busca", async ({ page }) => {
    await page.goto("/sobre/");
    await page.getByRole("button", { name: "Buscar" }).click();
    await campo(page).fill("banco");
    await expect(page.getByRole("option").nth(1)).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("option").nth(1)).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Fechar busca" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(campo(page)).toBeFocused();
    await page.keyboard.press("Enter");
    await page.waitForURL((u) => !u.pathname.startsWith("/sobre"));
    await page.keyboard.press("Control+k");
    await expect(page.getByRole("group", { name: "Buscas recentes" })).toContainText("banco");
  });

  test("sem violações sérias com resultados abertos; tela cheia no celular", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto("/sobre/");
    await page.getByRole("button", { name: "Buscar" }).click();
    await campo(page).fill("itau");
    await expect(page.getByRole("option").first()).toBeVisible();
    const caixa = await page.getByRole("dialog", { name: "Busca global" }).boundingBox();
    expect(caixa?.width).toBe(390);
    expect(caixa?.height).toBe(800);
    const r = await new AxeBuilder({ page }).include(".busca").analyze();
    expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  });
});

test.describe("lista de acompanhamento (8.9)", () => {
  test("marca na página de detalhe, aparece na lista e sai dela", async ({ page }) => {
    await page.goto("/acoes/9512/");
    await page.getByRole("button", { name: "Acompanhar PETROBRAS" }).click();
    await expect(page.getByRole("button", { name: "Remover PETROBRAS da lista" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const nomes = await new AxeBuilder({ page })
      .withRules(["label-content-name-mismatch"])
      .include(".estrela-texto")
      .analyze();
    expect(nomes.violations).toEqual([]); // "Na sua lista" visível precisa estar no nome lido
    await page.goto("/acompanhamento/");
    await expect(page.getByRole("link", { name: "PETROBRAS" })).toBeVisible();
    await expect(page.getByText(/fica só neste navegador/)).toBeVisible();
    await expect(page.locator("td", { hasText: "Escriturador:" })).toBeVisible();
    await page.getByRole("button", { name: "Remover PETROBRAS da lista" }).click();
    await expect(page.getByText("Sua lista está vazia.")).toBeVisible();
    const r = await new AxeBuilder({ page }).analyze();
    expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  });

  test("novidade conta desde a última visita e o filtro restringe /novidades", async ({ page }) => {
    await page.goto("/sobre/"); // /novidades registraria a visita enquanto a lista é gravada
    const ev = await page.evaluate(async () => (await (await fetch("/data/eventos.json")).json()).eventos[0]);
    const tipo = ev.dataset === "acoes" ? "companhia" : "bdr";
    await page.evaluate(
      ([t, c]) =>
        localStorage.setItem(
          "painelb3:acompanhamento:v1",
          JSON.stringify({ itens: [{ tipo: t, chave: c, nome: "Item" }], ultima_visita: "2000-01-01" }),
        ),
      [tipo, ev.chave],
    );
    await page.goto("/sobre/");
    await expect(page.locator(".contador-lista").first()).toContainText(/novidades? na sua lista/);
    await page.goto("/novidades/");
    await page.getByLabel("Só da minha lista").check();
    await expect(page.locator("tbody tr").first()).toHaveClass(/da-lista/);
    await expect(page.locator("tbody tr:not(.da-lista)")).toHaveCount(0);
  });

  test("exporta e importa em JSON; formato errado mostra mensagem", async ({ page }) => {
    await page.goto("/acompanhamento/");
    await page.getByLabel("Arquivo da lista").setInputFiles({
      name: "lista.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({ itens: [{ tipo: "bdr", chave: "TSLA34", nome: "TSLA34" }] })),
    });
    await expect(page.getByText("Lista importada com 1 item(ns).")).toBeVisible();
    const baixar = page.waitForEvent("download");
    await page.getByRole("button", { name: "Exportar JSON" }).click();
    expect((await baixar).suggestedFilename()).toBe("linkinstonks-acompanhamento.json");
    await page.getByLabel("Arquivo da lista").setInputFiles({
      name: "x.json",
      mimeType: "application/json",
      buffer: Buffer.from("{}"),
    });
    await expect(page.getByText(/não tem o formato/)).toBeVisible();
  });

  test("sem localStorage, a tela explica e não quebra", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new Error("bloqueado");
        },
      });
    });
    await page.goto("/acompanhamento/");
    await expect(page.getByText("A lista está desativada neste navegador.")).toBeVisible();
  });
});
