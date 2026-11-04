import { useEffect, useState, type FormEvent } from "react";

type Discipline = {
  id: string;
  code: string;
  name: string;
};

type Professor = {
  id: string;
  name: string;
};

type AcademicTerm = {
  id: string;
  code: string;
};

type ClassGroup = {
  id: string;
  code: string;
  discipline?: Discipline;
  professor?: Professor;
  academicTerm?: AcademicTerm;
  disciplineId?: string;
  professorId?: string;
  academicTermId?: string;
};

export default function AcademicClasses() {
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [terms, setTerms] = useState<AcademicTerm[]>([]);

  const [code, setCode] = useState("");
  const [disciplineId, setDisciplineId] = useState("");
  const [professorId, setProfessorId] = useState("");
  const [academicTermId, setAcademicTermId] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadData() {
      try {
        const token = sessionStorage.getItem("accessToken");

        if (!token) {
          throw new Error("Faça login novamente para continuar.");
        }

        const headers = {
          Authorization: `Bearer ${token}`,
        };

        const [
          disciplinesResponse,
          professorsResponse,
          termsResponse,
          classesResponse,
        ] = await Promise.all([
          fetch("http://localhost:3000/academic/disciplines", {
            headers,
            signal: controller.signal,
          }),
          fetch("http://localhost:3000/users/professors", {
            headers,
            signal: controller.signal,
          }),
          fetch("http://localhost:3000/academic/terms", {
            headers,
            signal: controller.signal,
          }),
          fetch("http://localhost:3000/academic/classes", {
            headers,
            signal: controller.signal,
          }),
        ]);

        if (
          !disciplinesResponse.ok ||
          !professorsResponse.ok ||
          !termsResponse.ok ||
          !classesResponse.ok
        ) {
          throw new Error("Não foi possível carregar os dados das turmas.");
        }

        const disciplinesData: Discipline[] = await disciplinesResponse.json();

        const professorsData: Professor[] = await professorsResponse.json();

        const termsData: AcademicTerm[] = await termsResponse.json();

        const classesData: ClassGroup[] = await classesResponse.json();

        if (!controller.signal.aborted) {
          setDisciplines(disciplinesData);
          setProfessors(professorsData);
          setTerms(termsData);
          setClasses(classesData);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error ? err.message : "Erro ao carregar as turmas.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadData();

    return () => controller.abort();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving || !disciplineId || !professorId || !academicTermId) {
      return;
    }

    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const token = sessionStorage.getItem("accessToken");

      if (!token) {
        throw new Error("Faça login novamente para continuar.");
      }

      const response = await fetch("http://localhost:3000/academic/classes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          code: code.trim(),
          disciplineId,
          professorId,
          academicTermId,
        }),
      });

      if (!response.ok) {
        const data: { message?: string | string[] } = await response
          .json()
          .catch(() => ({}));

        const message = Array.isArray(data.message)
          ? data.message.join(" ")
          : data.message;

        throw new Error(message || "Não foi possível cadastrar a turma.");
      }

      const createdClass: ClassGroup = await response.json();

      setClasses((previous) => [
        ...previous,
        {
          ...createdClass,
          discipline: disciplines.find((item) => item.id === disciplineId),
          professor: professors.find((item) => item.id === professorId),
          academicTerm: terms.find((item) => item.id === academicTermId),
        },
      ]);

      setCode("");
      setDisciplineId("");
      setProfessorId("");
      setAcademicTermId("");

      setSuccess("Turma cadastrada com sucesso!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao cadastrar turma.");
    } finally {
      setSaving(false);
    }
  }

  function getDisciplineName(item: ClassGroup) {
    return (
      item.discipline?.name ??
      disciplines.find((d) => d.id === item.disciplineId)?.name ??
      "Não informada"
    );
  }

  function getProfessorName(item: ClassGroup) {
    return (
      item.professor?.name ??
      professors.find((p) => p.id === item.professorId)?.name ??
      "Não informado"
    );
  }

  function getTermCode(item: ClassGroup) {
    return (
      item.academicTerm?.code ??
      terms.find((t) => t.id === item.academicTermId)?.code ??
      "Não informado"
    );
  }

  const canCreate =
    !loading &&
    disciplines.length > 0 &&
    professors.length > 0 &&
    terms.length > 0;

  return (
    <section>
      <h2>Gerenciamento de turmas</h2>

      <form
        onSubmit={handleSubmit}
        className="evaluation-card"
        style={{ display: "grid", gap: "12px" }}
      >
        <h3>Cadastrar nova turma</h3>

        <label htmlFor="class-code">Código da turma</label>

        <input
          id="class-code"
          type="text"
          placeholder="Ex.: REDES-2027-1-A"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          maxLength={30}
          required
          disabled={saving}
        />

        <label htmlFor="class-discipline">Disciplina</label>

        <select
          id="class-discipline"
          value={disciplineId}
          onChange={(event) => setDisciplineId(event.target.value)}
          required
          disabled={saving || !canCreate}
        >
          <option value="">Selecione uma disciplina</option>

          {disciplines.map((discipline) => (
            <option key={discipline.id} value={discipline.id}>
              {discipline.name} ({discipline.code})
            </option>
          ))}
        </select>

        <label htmlFor="class-professor">Professor responsável</label>

        <select
          id="class-professor"
          value={professorId}
          onChange={(event) => setProfessorId(event.target.value)}
          required
          disabled={saving || !canCreate}
        >
          <option value="">Selecione um professor</option>

          {professors.map((professor) => (
            <option key={professor.id} value={professor.id}>
              {professor.name}
            </option>
          ))}
        </select>

        <label htmlFor="class-term">Semestre letivo</label>

        <select
          id="class-term"
          value={academicTermId}
          onChange={(event) => setAcademicTermId(event.target.value)}
          required
          disabled={saving || !canCreate}
        >
          <option value="">Selecione um semestre</option>

          {terms.map((term) => (
            <option key={term.id} value={term.id}>
              {term.code}
            </option>
          ))}
        </select>

        {!canCreate && !loading && !error && (
          <p>
            É necessário ter disciplinas, professores e semestres cadastrados
            para criar uma turma.
          </p>
        )}

        <button type="submit" disabled={saving || !canCreate}>
          {saving ? "Cadastrando..." : "Cadastrar turma"}
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

      <h3>Turmas cadastradas</h3>

      {loading ? (
        <p>Carregando turmas...</p>
      ) : classes.length === 0 ? (
        <p>Nenhuma turma cadastrada.</p>
      ) : (
        <ul className="evaluation-list">
          {classes.map((item) => (
            <li key={item.id} className="evaluation-card">
              <strong>{item.code}</strong>

              <p>Disciplina: {getDisciplineName(item)}</p>
              <p>Professor: {getProfessorName(item)}</p>
              <p>Semestre: {getTermCode(item)}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
