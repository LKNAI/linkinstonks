import { describe, expect, it } from "vitest";
import { contraste, legivelSobreBranco, textoSobre } from "@/lib/palette";

describe("contraste WCAG", () => {
  it("calcula as razões de referência", () => {
    expect(contraste("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contraste("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    expect(contraste("#6250d6", "#ffffff")).toBeCloseTo(5.77, 1);
  });

  it("textoSobre escolhe branco ou grafite com contraste AA sobre cada cor de categoria", () => {
    for (const fundo of ["#6250d6", "#1baf7a", "#eda100", "#8f80e6", "#4a3aa7", "#e87ba4", "#c4bcf3"]) {
      expect(contraste(textoSobre(fundo), fundo), fundo).toBeGreaterThanOrEqual(4.5);
    }
    expect(textoSobre("#6250d6")).toBe("#ffffff");
    expect(textoSobre("#eda100")).toBe("#16152b");
  });

  it("legivelSobreBranco escurece só o necessário", () => {
    expect(legivelSobreBranco("#1baf7a")).not.toBe("#1baf7a");
    expect(contraste(legivelSobreBranco("#1baf7a"), "#ffffff")).toBeGreaterThanOrEqual(3);
    expect(legivelSobreBranco("#4a3aa7")).toBe("#4a3aa7"); // já passa
  });
});
