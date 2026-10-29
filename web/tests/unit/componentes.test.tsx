import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChartCard } from "@/components/charts/ChartCard";
import { Donut, tamanhoCentro } from "@/components/charts/Donut";
import { Divergentes } from "@/components/charts/Divergentes";
import { Busca } from "@/components/filters/Controles";
import { DataTable, type ColunaSpec } from "@/components/table/DataTable";

const itens = [
  { k: "a", label: "Itaú Corretora", n: 60, color: "#EC7000" },
  { k: "b", label: "Banco Bradesco", n: 40, color: "#CC092F" },
];

describe("Donut", () => {
  it("mostra total no centro, legenda com % e filtra ao clicar", () => {
    const onSel = vi.fn();
    const { container } = render(
      <Donut
        itens={itens}
        selecionado={null}
        onSelecionar={onSel}
        centro="empresas"
        rotuloValor="Empresas"
        rotuloAria="Participação"
      />,
    );
    expect(container.querySelector(".ctr-n")?.textContent).toBe("100");
    const botao = screen.getByRole("button", { name: /Itaú Corretora/ });
    expect(botao).toHaveTextContent("60%");
    fireEvent.click(botao);
    expect(onSel).toHaveBeenCalledWith("a");
    expect(screen.getByRole("img", { name: "Participação" })).toBeInTheDocument();
  });

  it("com seleção, o centro passa a mostrar a participação do item", () => {
    const { container } = render(
      <Donut
        itens={itens}
        selecionado="b"
        onSelecionar={() => {}}
        centro="empresas"
        rotuloValor="Empresas"
        rotuloAria="x"
      />,
    );
    expect(container.querySelector(".ctr-n")?.textContent).toBe("40");
    expect(container.querySelector(".ctr-l")?.textContent).toBe("40%");
    expect(screen.getByRole("button", { name: /Banco Bradesco/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("o texto central encolhe quando não cabe no anel", () => {
    expect(tamanhoCentro("100", 190)).toBe(28);
    expect(tamanhoCentro("R$ 538 bi", 168)).toBeLessThan(28);
  });
});

describe("ChartCard", () => {
  it("alterna entre o gráfico e a tabela equivalente", () => {
    render(
      <ChartCard
        coluna="c4"
        titulo="Segmento"
        tabela={{ cabecalho: ["Segmento", "Empresas"], linhas: [["Novo Mercado", 179]] }}
      >
        <p>conteudo-do-grafico</p>
      </ChartCard>,
    );
    expect(screen.getByText("conteudo-do-grafico")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver como tabela" }));
    expect(screen.queryByText("conteudo-do-grafico")).not.toBeInTheDocument();
    const tabela = screen.getByRole("table");
    expect(within(tabela).getByText("Novo Mercado")).toBeInTheDocument();
    expect(within(tabela).getByText("179")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver gráfico" }));
    expect(screen.getByText("conteudo-do-grafico")).toBeInTheDocument();
  });
});

describe("Divergentes", () => {
  it("separa perdeu e conquistou e desabilita lado zerado", () => {
    const onPerdeu = vi.fn();
    const onGanhou = vi.fn();
    render(
      <Divergentes
        linhas={[{ nome: "BTG Pactual", cor: "#0B3D91", perdeu: 0, ganhou: 66 }]}
        selPerdeu={null}
        selGanhou={null}
        onPerdeu={onPerdeu}
        onGanhou={onGanhou}
      />,
    );
    expect(screen.getByRole("button", { name: /perdeu 0/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /conquistou 66/ }));
    expect(onGanhou).toHaveBeenCalledWith("BTG Pactual");
    expect(onPerdeu).not.toHaveBeenCalled();
  });
});

describe("Busca", () => {
  afterEach(() => vi.useRealTimers());

  it("aplica debounce de 120 ms e entrega o texto normalizado", () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(<Busca valor="" onChange={onChange} placeholder="Buscar" />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar" }), {
      target: { value: "  Itaú CORRETORA " },
    });
    expect(onChange).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(119));
    expect(onChange).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(2));
    expect(onChange).toHaveBeenCalledWith("itau corretora");
  });

  it("ressincroniza o campo quando o filtro é limpo de fora", () => {
    const { rerender } = render(<Busca valor="petr" onChange={() => {}} placeholder="Buscar" />);
    expect(screen.getByRole("searchbox")).toHaveValue("petr");
    rerender(<Busca valor="" onChange={() => {}} placeholder="Buscar" />);
    expect(screen.getByRole("searchbox")).toHaveValue("");
  });
});

interface Linha {
  id: string;
  nome: string;
}
const colunas: ColunaSpec<Linha>[] = [
  { id: "nome", titulo: "Nome", celula: (l) => l.nome },
  { id: "id", titulo: "Código", ordenavel: false, celula: (l) => l.id },
];

describe("DataTable", () => {
  it("cabeçalhos ordenáveis expõem aria-sort e disparam a ordenação", () => {
    const onOrdenar = vi.fn();
    render(
      <DataTable
        dados={[{ id: "1", nome: "Ana" }]}
        colunas={colunas}
        chave={(l) => l.id}
        ordem={{ k: "nome", dir: -1 }}
        onOrdenar={onOrdenar}
        rotulo="Pessoas"
      />,
    );
    expect(screen.getByRole("columnheader", { name: "Nome" })).toHaveAttribute("aria-sort", "descending");
    expect(screen.getByRole("columnheader", { name: "Código" })).not.toHaveAttribute("aria-sort");
    fireEvent.click(screen.getByRole("button", { name: "Nome" }));
    expect(onOrdenar).toHaveBeenCalledWith("nome");
    expect(screen.getByRole("region", { name: "Pessoas" })).toBeInTheDocument();
  });

  it("sem linhas mostra a mensagem de vazio", () => {
    render(
      <DataTable
        dados={[]}
        colunas={colunas}
        chave={(l) => l.id}
        ordem={{ k: "nome", dir: 1 }}
        onOrdenar={() => {}}
        rotulo="Pessoas"
        vazio="Nada aqui."
      />,
    );
    expect(screen.getByText("Nada aqui.")).toBeInTheDocument();
  });
});
