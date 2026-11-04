import { useEffect, useState, type FormEvent } from "react";

type AcademicTerm = {
  id: string;
  code: string;
  startDate: string;
  endDate: string;
  active: boolean;
};

function formatDate(date: string) {
  const [year, month, day] = date.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

export default function AcademicTerms() {
  const [terms, setTerms] = useState<AcademicTerm[]>([]);

  const [code, setCode] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadTerms() {
      try {
        const token = sessionStorage.getItem("accessToken");

        if (!token) {
          throw new Error("Faça login novamente para continuar.");
        }

        const response = await fetch("http://localhost:3000/academic/terms", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Não foi possível carregar os semestres.");
        }

        const data: AcademicTerm[] = await response.json();

        if (!controller.signal.aborted) {
          setTerms(data);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error ? err.message : "Erro ao carregar semestres.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadTerms();

    return () => controller.abort();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) return;

    setError("");
    setSuccess("");

    if (endDate <= startDate) {
      setError("A data de encerramento deve ser posterior à data de início.");
      return;
    }

    setSaving(true);

    try {
      const token = sessionStorage.getItem("accessToken");

      if (!token) {
        throw new Error("Faça login novamente para continuar.");
      }

      const response = await fetch("http://localhost:3000/academic/terms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          code: code.trim(),
          startDate,
          endDate,
        }),
      });

      if (!response.ok) {
        const data: { message?: string | string[] } = await response
          .json()
          .catch(() => ({}));

        const message = Array.isArray(data.message)
          ? data.message.join(" ")
          : data.message;

        throw new Error(message || "Não foi possível cadastrar o semestre.");
      }

      const createdTerm: AcademicTerm = await response.json();

      setTerms((previous) => [...previous, createdTerm]);

      setCode("");
      setStartDate("");
      setEndDate("");

      setSuccess("Semestre letivo cadastrado com sucesso!");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao cadastrar semestre.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <h2>Gerenciamento de semestres letivos</h2>

      <form
        onSubmit={handleSubmit}
        className="evaluation-card"
        style={{ display: "grid", gap: "12px" }}
      >
        <h3>Cadastrar novo semestre</h3>

        <label htmlFor="term-code">Código do semestre</label>
        <input
          id="term-code"
          type="text"
          placeholder="Ex.: 2027/1"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          maxLength={20}
          required
          disabled={saving}
        />

        <label htmlFor="term-start">Data de início</label>
        <input
          id="term-start"
          type="date"
          value={startDate}
          onChange={(event) => setStartDate(event.target.value)}
          required
          disabled={saving}
        />

        <label htmlFor="term-end">Data de encerramento</label>
        <input
          id="term-end"
          type="date"
          value={endDate}
          min={startDate || undefined}
          onChange={(event) => setEndDate(event.target.value)}
          required
          disabled={saving}
        />

        <button type="submit" disabled={saving || loading}>
          {saving ? "Cadastrando..." : "Cadastrar semestre"}
        </button>
      </form>

      {error && (
        <p role="alert" style={{ color: "#dc2626" }}>
          {error}
        </p>
      )}

      {success && (
        <p role="status" style={{ color: "#15803d" }}>
          {success}
        </p>
      )}

      <h3>Semestres cadastrados</h3>

      {loading ? (
        <p>Carregando semestres...</p>
      ) : terms.length === 0 ? (
        <p>Nenhum semestre cadastrado.</p>
      ) : (
        <ul className="evaluation-list">
          {terms.map((term) => (
            <li key={term.id} className="evaluation-card">
              <strong>{term.code}</strong>

              <p>Início: {formatDate(term.startDate)}</p>
              <p>Encerramento: {formatDate(term.endDate)}</p>
              <p>Situação: {term.active ? "Ativo" : "Inativo"}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
