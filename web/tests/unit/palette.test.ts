import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COR_ESCRITURADOR } from "@/lib/colors";
import { CAT_ALT_COR, CAT_COR, COR_TEXTO, contraste, legivelSobreBranco, textoSobre } from "@/lib/palette";

describe("contraste WCAG", () => {
  it("calcula as razões de referência", () => {
    expect(contraste("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contraste("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    expect(contraste("#6250d6", "#ffffff")).toBeCloseTo(5.77, 1);
  });

  it("textoSobre escolhe branco ou grafite com contraste AA sobre cada cor de categoria", () => {
    for (const fundo of [...CAT_COR, ...CAT_ALT_COR]) {
      expect(contraste(textoSobre(fundo), fundo), fundo).toBeGreaterThanOrEqual(4.5);
    }
    expect(textoSobre(CAT_COR[0])).toBe("#ffffff");
    expect(textoSobre(CAT_COR[3])).toBe(COR_TEXTO);
  });

  it("textoSobre cobre todas as cores de marca com AA", () => {
    for (const cor of Object.values(COR_ESCRITURADOR)) {
      expect(contraste(textoSobre(cor), cor), cor).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("legivelSobreBranco escurece só o necessário", () => {
    expect(legivelSobreBranco("#1baf7a")).not.toBe("#1baf7a");
    expect(contraste(legivelSobreBranco("#1baf7a"), "#ffffff")).toBeGreaterThanOrEqual(3);
    expect(legivelSobreBranco(CAT_COR[0])).toBe(CAT_COR[0]); // já passa
  });
});

describe("palette.ts espelha styles/tokens.css", () => {
  const css = readFileSync(join(__dirname, "../../styles/tokens.css"), "utf-8");
  const token = (nome: string) => css.match(new RegExp(`--${nome}: *(#[0-9a-fA-F]{6})`))?.[1].toLowerCase();

  it("rampa de categorias, neutros e texto", () => {
    expect(CAT_COR).toEqual([token("cat-1"), token("cat-2"), token("cat-3"), token("cat-none")]);
    expect(CAT_ALT_COR).toEqual([1, 2, 3, 4].map((i) => token(`cat-alt-${i}`)));
    expect(COR_TEXTO).toBe(token("text"));
  });
});
