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

export default function EvaluationPeriods() {
  const [periods, setPeriods] = useState<EvaluationPeriod[]>([]);

  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

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
          setPeriods(data);
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving || loading) return;

    setError("");
    setSuccess("");

    const start = new Date(startDate);
    const end = new Date(endDate);

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

      const response = await fetch(
        "http://localhost:3000/evaluations/periods",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: name.trim(),
            startDate: start.toISOString(),
            endDate: end.toISOString(),
          }),
        },
      );

      if (!response.ok) {
        const data: { message?: string | string[] } = await response
          .json()
          .catch(() => ({}));

        const message = Array.isArray(data.message)
          ? data.message.join(" ")
          : data.message;

        throw new Error(message || "Não foi possível cadastrar o período.");
      }

      const createdPeriod: EvaluationPeriod = await response.json();

      setPeriods((previous) => [...previous, createdPeriod]);

      setName("");
      setStartDate("");
      setEndDate("");

      setSuccess("Período de avaliação cadastrado com sucesso!");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao cadastrar o período.",
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
        <h3>Cadastrar novo período</h3>

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
          {saving ? "Cadastrando..." : "Cadastrar período"}
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
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
