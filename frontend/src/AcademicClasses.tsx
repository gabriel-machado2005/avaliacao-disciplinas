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

type AcademicClassesProps = {
  role: "ADMIN" | "COORDINATOR";
};

export default function AcademicClasses({ role }: AcademicClassesProps) {
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [terms, setTerms] = useState<AcademicTerm[]>([]);

  const [code, setCode] = useState("");
  const [disciplineId, setDisciplineId] = useState("");
  const [professorId, setProfessorId] = useState("");
  const [academicTermId, setAcademicTermId] = useState("");
  const [editingClassId, setEditingClassId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingClassId, setDeletingClassId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const canDeleteClasses = role === "ADMIN";

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

  function clearForm() {
    setCode("");
    setDisciplineId("");
    setProfessorId("");
    setAcademicTermId("");
    setEditingClassId(null);
  }

  function handleEdit(item: ClassGroup) {
    if (saving) return;

    setEditingClassId(item.id);
    setCode(item.code);
    setDisciplineId(item.discipline?.id ?? item.disciplineId ?? "");
    setProfessorId(item.professor?.id ?? item.professorId ?? "");
    setAcademicTermId(item.academicTerm?.id ?? item.academicTermId ?? "");

    setError("");
    setSuccess("");

    document.getElementById("class-code")?.focus();
  }

  function handleCancelEdit() {
    if (saving) return;

    clearForm();
    setError("");
    setSuccess("");
  }

  async function handleDelete(item: ClassGroup) {
    if (!canDeleteClasses || saving || deletingClassId !== null) {
      return;
    }

    const confirmed = window.confirm(
      `Deseja realmente excluir a turma "${item.code}"?\n\n` +
        "Esta operação não poderá ser desfeita.",
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");
    setDeletingClassId(item.id);

    try {
      const token = sessionStorage.getItem("accessToken");

      if (!token) {
        throw new Error("Faça login novamente para continuar.");
      }

      const response = await fetch(
        `http://localhost:3000/academic/classes/${item.id}`,
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

        throw new Error(message || "Não foi possível excluir a turma.");
      }

      setClasses((previous) =>
        previous.filter((classGroup) => classGroup.id !== item.id),
      );

      if (editingClassId === item.id) {
        clearForm();
      }

      setSuccess("Turma excluída com sucesso!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir turma.");
    } finally {
      setDeletingClassId(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      saving ||
      deletingClassId !== null ||
      !disciplineId ||
      !professorId ||
      !academicTermId
    ) {
      return;
    }

    const isEditing = editingClassId !== null;

    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const token = sessionStorage.getItem("accessToken");

      if (!token) {
        throw new Error("Faça login novamente para continuar.");
      }

      const url = isEditing
        ? `http://localhost:3000/academic/classes/${editingClassId}`
        : "http://localhost:3000/academic/classes";

      const response = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
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

        throw new Error(
          message ||
            (isEditing
              ? "Não foi possível atualizar a turma."
              : "Não foi possível cadastrar a turma."),
        );
      }

      const savedClass: ClassGroup = await response.json();

      const displayClass: ClassGroup = {
        ...savedClass,
        discipline:
          savedClass.discipline ??
          disciplines.find((item) => item.id === disciplineId),
        professor:
          savedClass.professor ??
          professors.find((item) => item.id === professorId),
        academicTerm:
          savedClass.academicTerm ??
          terms.find((item) => item.id === academicTermId),
      };

      setClasses((previous) => {
        if (isEditing) {
          return previous.map((item) =>
            item.id === savedClass.id ? displayClass : item,
          );
        }

        return [...previous, displayClass];
      });

      clearForm();

      setSuccess(
        isEditing
          ? "Turma atualizada com sucesso!"
          : "Turma cadastrada com sucesso!",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar turma.");
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
        <h3>{editingClassId ? "Editar turma" : "Cadastrar nova turma"}</h3>

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
          {saving
            ? "Salvando..."
            : editingClassId
              ? "Salvar alterações"
              : "Cadastrar turma"}
        </button>

        {editingClassId && (
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

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: canDeleteClasses
                    ? "repeat(2, minmax(0, 1fr))"
                    : "1fr",
                  gap: "16px",
                  width: "100%",
                  marginTop: "16px",
                }}
              >
                <button
                  type="button"
                  onClick={() => handleEdit(item)}
                  disabled={saving || deletingClassId !== null}
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

                {canDeleteClasses && (
                  <button
                    type="button"
                    onClick={() => void handleDelete(item)}
                    disabled={saving || deletingClassId !== null}
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
                    {deletingClassId === item.id ? "Excluindo..." : "Excluir"}
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
