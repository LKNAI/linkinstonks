import { describe, expect, it } from "vitest";
import { corEscriturador, coresDoConjunto } from "@/lib/colors";

describe("coresDoConjunto", () => {
  it("mantém a cor de marca quando o par confuso não aparece junto", () => {
    const cor = coresDoConjunto(["Banco Santander", "Banco do Brasil"]);
    expect(cor("Banco Santander")).toBe(corEscriturador("Banco Santander"));
  });

  it("aplica a variante só ao membro ajustado quando o par aparece junto", () => {
    const cor = coresDoConjunto(["Banco Bradesco", "Banco Santander", "Itaú Corretora", "Itaú Unibanco"]);
    expect(cor("Banco Santander")).toBe("#FF493E");
    expect(cor("Itaú Unibanco")).toBe("#F8AB5F");
    expect(cor("Banco Bradesco")).toBe(corEscriturador("Banco Bradesco"));
    expect(cor("Itaú Corretora")).toBe(corEscriturador("Itaú Corretora"));
  });
});
