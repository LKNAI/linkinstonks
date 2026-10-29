import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatInt, formatPct } from "@/lib/format";

describe("formatação pt-BR", () => {
  it("separa milhares com ponto", () => {
    expect(formatInt(1143)).toBe("1.143");
    expect(formatInt(1234567)).toBe("1.234.567");
  });

  it("formata percentuais com vírgula e trata total zero", () => {
    expect(formatPct(1026, 1143)).toBe("89,8%");
    expect(formatPct(1, 0)).toBe("0%");
  });

  it("converte data ISO sem deslocar o dia", () => {
    expect(formatDate("2026-10-29")).toBe("29/10/2026");
    expect(formatDate("2026-01-01")).toBe("01/01/2026");
    expect(formatDate("lixo")).toBe("");
  });

  it("converte instante UTC para o horário de Brasília", () => {
    expect(formatDateTime("2026-10-29T01:23:00Z")).toBe("28/10/2026 22:23");
    expect(formatDateTime("nao-e-data")).toBe("");
  });
});
