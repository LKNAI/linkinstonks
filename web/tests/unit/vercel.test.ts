// O ignoreCommand do vercel.json decide se a Vercel constrói o site (exit 1) ou pula (exit 0).
// Um erro aqui já cancelou o primeiro deploy, então a lógica é testada de verdade, num repositório Git temporário.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const config = JSON.parse(readFileSync(join(__dirname, "..", "..", "vercel.json"), "utf8"));
const temSh = spawnSync("sh", ["-c", "git --version"]).status === 0;

describe.skipIf(!temSh)("ignoreCommand da Vercel", { timeout: 60_000 }, () => {
  let repo: string;
  const git = (...a: string[]) => execFileSync("git", a, { cwd: repo, stdio: "pipe" }).toString().trim();
  const commit = (arquivo: string, texto: string, msg: string) => {
    mkdirSync(join(repo, arquivo, ".."), { recursive: true });
    writeFileSync(join(repo, arquivo), texto);
    git("add", "-A");
    git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", msg);
    return git("rev-parse", "HEAD");
  };
  /** Exit code do ignoreCommand rodando em repo/web, como a Vercel (Root Directory = web). */
  const rodar = (anterior: string | undefined) =>
    spawnSync("sh", ["-c", config.ignoreCommand], {
      cwd: join(repo, "web"),
      env: { ...process.env, VERCEL_GIT_PREVIOUS_SHA: anterior ?? "" },
    }).status;

  beforeAll(() => {
    repo = mkdtempSync(join(tmpdir(), "ign-"));
    git("init", "-q", "-b", "main");
  });
  afterAll(() => rmSync(repo, { recursive: true, force: true }));

  it("primeiro deploy (sem SHA anterior) sempre constrói", () => {
    commit("web/a.txt", "1", "base");
    expect(rodar(undefined)).toBe(1);
    expect(rodar("")).toBe(1);
  });

  it("commit só de documentação não constrói, mesmo que seja o último de vários", () => {
    const base = commit("web/b.txt", "1", "site");
    commit("docs/x.md", "1", "docs 1");
    commit("docs/y.md", "2", "docs 2");
    expect(rodar(base)).toBe(0);
  });

  it("mudança em web/, em data/public ou em schemas constrói, mesmo que não seja o último commit", () => {
    for (const alvo of ["web/c.txt", "data/public/acoes.json", "schemas/acoes.schema.json"]) {
      const base = commit("docs/z.md", alvo, `antes ${alvo}`);
      commit(alvo, "novo", `mexe em ${alvo}`);
      commit("docs/w.md", alvo, "depois, só docs"); // com HEAD^ HEAD isto esconderia a mudança
      expect(rodar(base), alvo).toBe(1);
    }
  }, 60_000); // vários commits num repositório temporário: lento no Windows

  it("SHA anterior desconhecido (clone raso) constrói por segurança", () => {
    expect(rodar("0123456789012345678901234567890123456789")).not.toBe(0);
  });
});
