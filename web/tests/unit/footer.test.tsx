import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Footer } from "@/components/layout/Footer";

describe("Footer", () => {
  it("traz fontes, aviso legal e a data informada", () => {
    render(<Footer atualizadoEm="29/10/2026 22:23" />);
    const t = screen.getByRole("contentinfo");
    expect(t).toHaveTextContent("Fontes: B3 e CVM (dados públicos)");
    expect(t).toHaveTextContent("Última atualização: 29/10/2026 22:23");
    expect(t).toHaveTextContent("Não é recomendação de investimento");
  });

  it("não inventa data quando não há atualização", () => {
    render(<Footer />);
    expect(screen.getByRole("contentinfo")).toHaveTextContent("Última atualização: —");
  });
});
