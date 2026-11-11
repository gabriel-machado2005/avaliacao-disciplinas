import { useEffect, useState, type FormEvent } from "react";

type AcademicTerm = {
  id: string;
  code: string;
  startDate: string;
  endDate: string;
  active: boolean;
};

type AcademicTermsProps = {
  role: "ADMIN" | "COORDINATOR";
};

function formatDate(date: string) {
  const [year, month, day] = date.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function sortTerms(terms: AcademicTerm[]) {
  return [...terms].sort((a, b) => b.startDate.localeCompare(a.startDate));
}

export default function AcademicTerms({ role }: AcademicTermsProps) {
  const [terms, setTerms] = useState<AcademicTerm[]>([]);

  const [code, setCode] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [editingTermId, setEditingTermId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingTermId, setDeletingTermId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const canDeleteTerms = role === "ADMIN";

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
          setTerms(sortTerms(data));
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

  function clearForm() {
    setCode("");
    setStartDate("");
    setEndDate("");
    setEditingTermId(null);
  }

  function handleEdit(term: AcademicTerm) {
    if (saving) return;

    setEditingTermId(term.id);
    setCode(term.code);
    setStartDate(term.startDate.slice(0, 10));
    setEndDate(term.endDate.slice(0, 10));

    setError("");
    setSuccess("");

    document.getElementById("term-code")?.focus();
  }

  function handleCancelEdit() {
    if (saving) return;

    clearForm();
    setError("");
    setSuccess("");
  }

  async function handleDelete(term: AcademicTerm) {
    if (!canDeleteTerms || saving || deletingTermId !== null) {
      return;
    }

    const confirmed = window.confirm(
      `Deseja realmente excluir o semestre "${term.code}"?\n\n` +
        "Esta operação não poderá ser desfeita.",
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");
    setDeletingTermId(term.id);

    try {
      const token = sessionStorage.getItem("accessToken");

      if (!token) {
        throw new Error("Faça login novamente para continuar.");
      }

      const response = await fetch(
        `http://localhost:3000/academic/terms/${term.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        const data: { message?: string | string[] } = await response
          .json()
          .catch(() => ({}));

        const message = Array.isArray(data.message)
          ? data.message.join(" ")
          : data.message;

        throw new Error(message || "Não foi possível excluir o semestre.");
      }

      setTerms((previous) => previous.filter((item) => item.id !== term.id));

      if (editingTermId === term.id) {
        clearForm();
      }

      setSuccess("Semestre letivo excluído com sucesso!");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao excluir semestre.",
      );
    } finally {
      setDeletingTermId(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving || deletingTermId !== null) return;

    setError("");
    setSuccess("");

    if (!startDate || !endDate || endDate <= startDate) {
      setError("A data de encerramento deve ser posterior à data de início.");
      return;
    }

    const isEditing = editingTermId !== null;

    setSaving(true);

    try {
      const token = sessionStorage.getItem("accessToken");

      if (!token) {
        throw new Error("Faça login novamente para continuar.");
      }

      const url = isEditing
        ? `http://localhost:3000/academic/terms/${editingTermId}`
        : "http://localhost:3000/academic/terms";

      const response = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
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

        throw new Error(
          message ||
            (isEditing
              ? "Não foi possível atualizar o semestre."
              : "Não foi possível cadastrar o semestre."),
        );
      }

      const savedTerm: AcademicTerm = await response.json();

      setTerms((previous) => {
        if (isEditing) {
          return sortTerms(
            previous.map((term) =>
              term.id === savedTerm.id ? savedTerm : term,
            ),
          );
        }

        return sortTerms([...previous, savedTerm]);
      });

      clearForm();

      setSuccess(
        isEditing
          ? "Semestre letivo atualizado com sucesso!"
          : "Semestre letivo cadastrado com sucesso!",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar semestre.");
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
        <h3>
          {editingTermId ? "Editar semestre letivo" : "Cadastrar novo semestre"}
        </h3>

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
          {saving
            ? "Salvando..."
            : editingTermId
              ? "Salvar alterações"
              : "Cadastrar semestre"}
        </button>

        {editingTermId && (
          <button type="button" onClick={handleCancelEdit} disabled={saving}>
            Cancelar edição
          </button>
        )}
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

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: canDeleteTerms
                    ? "repeat(2, minmax(0, 1fr))"
                    : "1fr",
                  gap: "16px",
                  width: "100%",
                  marginTop: "16px",
                }}
              >
                <button
                  type="button"
                  onClick={() => handleEdit(term)}
                  disabled={saving || deletingTermId !== null}
                  style={{
                    backgroundColor: "#2563eb",
                    color: "#ffffff",
                    border: "1px solid #2563eb",
                    borderRadius: "12px",
                    padding: "12px 16px",
                    fontSize: "18px",
                    fontWeight: 700,
                  }}
                >
                  Editar
                </button>

                {canDeleteTerms && (
                  <button
                    type="button"
                    onClick={() => void handleDelete(term)}
                    disabled={saving || deletingTermId !== null}
                    style={{
                      backgroundColor: "#fff1f2",
                      color: "#be123c",
                      border: "1px solid #fecaca",
                      borderRadius: "12px",
                      padding: "12px 16px",
                      fontSize: "18px",
                      fontWeight: 700,
                    }}
                  >
                    {deletingTermId === term.id ? "Excluindo..." : "Excluir"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
