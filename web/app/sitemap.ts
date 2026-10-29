import type { MetadataRoute } from "next";
import { SITE_URL, metaPublica, todasAcoes, todosBdrs } from "@/lib/servidor";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const meta = metaPublica();
  const datas = Object.values(meta.datasets)
    .map((d) => d.atualizado_em)
    .sort();
  const lastModified = datas.at(-1);
  const fixas = [
    "/",
    "/acoes/",
    "/acoes/tabela/",
    "/acoes/volume/",
    "/bdrs/",
    "/instituicoes/",
    "/novidades/",
    "/status/",
    "/sobre/",
  ];
  const caminhos = [
    ...fixas,
    ...todasAcoes().map((c) => `/acoes/${c.codigo_cvm}/`),
    ...todosBdrs().bdrs.map((b) => `/bdrs/${b.ticker}/`),
  ];
  return caminhos.map((c) => ({ url: `${SITE_URL}${c}`, lastModified }));
}
