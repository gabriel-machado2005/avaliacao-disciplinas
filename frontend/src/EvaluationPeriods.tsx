import { useEffect, useState, type FormEvent } from "react";

type EvaluationPeriod = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  active: boolean;
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function toDateTimeLocal(value: string) {
  const date = new Date(value);

  const pad = (number: number) => String(number).padStart(2, "0");

  return (
    `${date.getFullYear()}-` +
    `${pad(date.getMonth() + 1)}-` +
    `${pad(date.getDate())}T` +
    `${pad(date.getHours())}:` +
    `${pad(date.getMinutes())}`
  );
}

function sortPeriods(periods: EvaluationPeriod[]) {
  return [...periods].sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
  );
}

export default function EvaluationPeriods({
  role,
}: {
  role: "ADMIN" | "COORDINATOR";
}) {
  const [periods, setPeriods] = useState<EvaluationPeriod[]>([]);

  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadPeriods() {
      try {
        const token = sessionStorage.getItem("accessToken");

        if (!token) {
          throw new Error("Faça login novamente para continuar.");
        }

        const response = await fetch(
          "http://localhost:3000/evaluations/periods",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          throw new Error(
            "Não foi possível carregar os períodos de avaliação.",
          );
        }

        const data: EvaluationPeriod[] = await response.json();

        if (!controller.signal.aborted) {
          setPeriods(sortPeriods(data));
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error
              ? err.message
              : "Erro ao carregar os períodos.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadPeriods();

    return () => controller.abort();
  }, []);

  function clearForm() {
    setName("");
    setStartDate("");
    setEndDate("");
    setEditingPeriodId(null);
  }

  function handleEdit(period: EvaluationPeriod) {
    if (saving) return;

    setEditingPeriodId(period.id);
    setName(period.name);
    setStartDate(toDateTimeLocal(period.startDate));
    setEndDate(toDateTimeLocal(period.endDate));

    setError("");
    setSuccess("");

    document.getElementById("period-name")?.focus();
  }

  function handleCancelEdit() {
    if (saving) return;

    clearForm();
    setError("");
    setSuccess("");
  }

  async function handleDelete(period: EvaluationPeriod) {
    if (saving || loading || role !== "ADMIN") return;

    const confirmed = window.confirm(
      `Tem certeza de que deseja excluir o período "${period.name}"?\n\n` +
        "Esta operação não poderá ser desfeita.",
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const token = sessionStorage.getItem("accessToken");

      if (!token) {
        throw new Error("Faça login novamente para continuar.");
      }

      const response = await fetch(
        `http://localhost:3000/evaluations/periods/${period.id}`,
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

        throw new Error(
          message || "Não foi possível excluir o período de avaliação.",
        );
      }

      setPeriods((previous) =>
        previous.filter((item) => item.id !== period.id),
      );

      if (editingPeriodId === period.id) {
        clearForm();
      }

      setSuccess("Período de avaliação excluído com sucesso!");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao excluir o período de avaliação.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving || loading) return;

    setError("");
    setSuccess("");

    const isEditing = editingPeriodId !== null;

    const originalPeriod = isEditing
      ? periods.find((period) => period.id === editingPeriodId)
      : undefined;

    if (isEditing && !originalPeriod) {
      setError("Período de avaliação não encontrado.");
      return;
    }

    const startUnchanged =
      originalPeriod !== undefined &&
      startDate === toDateTimeLocal(originalPeriod.startDate);

    const endUnchanged =
      originalPeriod !== undefined &&
      endDate === toDateTimeLocal(originalPeriod.endDate);

    const start =
      startUnchanged && originalPeriod
        ? new Date(originalPeriod.startDate)
        : new Date(startDate);

    const end =
      endUnchanged && originalPeriod
        ? new Date(originalPeriod.endDate)
        : new Date(endDate);

    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
      setError("Informe datas e horários válidos.");
      return;
    }

    if (end <= start) {
      setError("O encerramento deve ser posterior ao início do período.");
      return;
    }

    setSaving(true);

    try {
      const token = sessionStorage.getItem("accessToken");

      if (!token) {
        throw new Error("Faça login novamente para continuar.");
      }

      const url = isEditing
        ? `http://localhost:3000/evaluations/periods/${editingPeriodId}`
        : "http://localhost:3000/evaluations/periods";

      const payload: {
        name: string;
        startDate?: string;
        endDate?: string;
      } = {
        name: name.trim(),
      };

      if (!isEditing || !startUnchanged) {
        payload.startDate = start.toISOString();
      }

      if (!isEditing || !endUnchanged) {
        payload.endDate = end.toISOString();
      }

      const response = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
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
              ? "Não foi possível atualizar o período."
              : "Não foi possível cadastrar o período."),
        );
      }

      const savedPeriod: EvaluationPeriod = await response.json();

      setPeriods((previous) => {
        if (isEditing) {
          return sortPeriods(
            previous.map((period) =>
              period.id === savedPeriod.id ? savedPeriod : period,
            ),
          );
        }

        return sortPeriods([...previous, savedPeriod]);
      });

      clearForm();

      setSuccess(
        isEditing
          ? "Período de avaliação atualizado com sucesso!"
          : "Período de avaliação cadastrado com sucesso!",
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao salvar o período.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <h2>Gerenciamento de períodos de avaliação</h2>

      <form
        onSubmit={handleSubmit}
        className="evaluation-card"
        style={{ display: "grid", gap: "12px" }}
      >
        <h3>
          {editingPeriodId
            ? "Editar período de avaliação"
            : "Cadastrar novo período"}
        </h3>

        <label htmlFor="period-name">Nome do período</label>

        <input
          id="period-name"
          type="text"
          placeholder="Ex.: Avaliação de Disciplinas 2027/1"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={150}
          required
          disabled={saving}
        />

        <label htmlFor="period-start">Data e horário de início</label>

        <input
          id="period-start"
          type="datetime-local"
          value={startDate}
          onChange={(event) => setStartDate(event.target.value)}
          required
          disabled={saving}
        />

        <label htmlFor="period-end">Data e horário de encerramento</label>

        <input
          id="period-end"
          type="datetime-local"
          value={endDate}
          min={startDate || undefined}
          onChange={(event) => setEndDate(event.target.value)}
          required
          disabled={saving}
        />

        <button type="submit" disabled={saving || loading}>
          {saving
            ? "Salvando..."
            : editingPeriodId
              ? "Salvar alterações"
              : "Cadastrar período"}
        </button>

        {editingPeriodId && (
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

      <h3>Períodos cadastrados</h3>

      {loading ? (
        <p>Carregando períodos...</p>
      ) : periods.length === 0 ? (
        <p>Nenhum período cadastrado.</p>
      ) : (
        <ul className="evaluation-list">
          {periods.map((period) => (
            <li key={period.id} className="evaluation-card">
              <strong>{period.name}</strong>

              <p>Início: {formatDateTime(period.startDate)}</p>

              <p>Encerramento: {formatDateTime(period.endDate)}</p>

              <p>Situação: {period.active ? "Ativo" : "Inativo"}</p>

              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  marginTop: "16px",
                }}
              >
                <button
                  type="button"
                  onClick={() => handleEdit(period)}
                  disabled={saving}
                  style={{
                    flex: 1,
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

                {role === "ADMIN" && (
                  <button
                    type="button"
                    onClick={() => void handleDelete(period)}
                    disabled={saving}
                    style={{
                      flex: 1,
                      backgroundColor: "#fef2f2",
                      color: "#b91c1c",
                      border: "1px solid #fecaca",
                      borderRadius: "12px",
                      padding: "12px 16px",
                      fontSize: "18px",
                      fontWeight: 700,
                    }}
                  >
                    Excluir
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
