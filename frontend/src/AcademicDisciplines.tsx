import { useEffect, useState, type FormEvent } from "react";

type Course = {
  id: string;
  code: string;
  name: string;
};

type Discipline = {
  id: string;
  code: string;
  name: string;
  course?: Course;
  courseId?: string;
};

type AcademicDisciplinesProps = {
  role: "ADMIN" | "COORDINATOR";
};

export default function AcademicDisciplines({
  role,
}: AcademicDisciplinesProps) {
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [courseId, setCourseId] = useState("");

  const [editingDisciplineId, setEditingDisciplineId] = useState<string | null>(
    null,
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingDisciplineId, setDeletingDisciplineId] = useState<
    string | null
  >(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const canDeleteDisciplines = role === "ADMIN";

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

        const [coursesResponse, disciplinesResponse] = await Promise.all([
          fetch("http://localhost:3000/academic/courses", {
            headers,
            signal: controller.signal,
          }),
          fetch("http://localhost:3000/academic/disciplines", {
            headers,
            signal: controller.signal,
          }),
        ]);

        if (!coursesResponse.ok || !disciplinesResponse.ok) {
          throw new Error("Não foi possível carregar os dados acadêmicos.");
        }

        const coursesData: Course[] = await coursesResponse.json();
        const disciplinesData: Discipline[] = await disciplinesResponse.json();

        if (!controller.signal.aborted) {
          setCourses(coursesData);
          setDisciplines(disciplinesData);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error ? err.message : "Erro ao carregar os dados.",
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

  function handleEdit(discipline: Discipline) {
    if (saving || deletingDisciplineId !== null) return;

    const selectedCourseId = discipline.course?.id ?? discipline.courseId ?? "";

    if (!selectedCourseId) {
      setError("Não foi possível identificar o curso desta disciplina.");
      return;
    }

    setEditingDisciplineId(discipline.id);
    setCode(discipline.code);
    setName(discipline.name);
    setCourseId(selectedCourseId);
    setError("");
    setSuccess("");

    document.getElementById("discipline-code")?.focus();
  }

  function handleCancelEdit() {
    if (saving || deletingDisciplineId !== null) return;

    setEditingDisciplineId(null);
    setCode("");
    setName("");
    setCourseId("");
    setError("");
    setSuccess("");
  }

  async function handleDelete(discipline: Discipline) {
    if (!canDeleteDisciplines || saving || deletingDisciplineId !== null) {
      return;
    }

    const confirmed = window.confirm(
      `Tem certeza que deseja excluir a disciplina "${discipline.name}"?\n\nEssa ação não poderá ser desfeita.`,
    );

    if (!confirmed) return;

    setDeletingDisciplineId(discipline.id);
    setError("");
    setSuccess("");

    try {
      const token = sessionStorage.getItem("accessToken");

      if (!token) {
        throw new Error("Faça login novamente para continuar.");
      }

      const response = await fetch(
        `http://localhost:3000/academic/disciplines/${discipline.id}`,
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

        throw new Error(message || "Não foi possível excluir a disciplina.");
      }

      setDisciplines((previous) =>
        previous.filter((item) => item.id !== discipline.id),
      );

      if (editingDisciplineId === discipline.id) {
        setEditingDisciplineId(null);
        setCode("");
        setName("");
        setCourseId("");
      }

      setSuccess("Disciplina excluída com sucesso!");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao excluir disciplina.",
      );
    } finally {
      setDeletingDisciplineId(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving || deletingDisciplineId !== null || !courseId) return;

    setError("");
    setSuccess("");
    setSaving(true);

    const disciplineIdToEdit = editingDisciplineId;
    const isEditing = disciplineIdToEdit !== null;

    try {
      const token = sessionStorage.getItem("accessToken");

      if (!token) {
        throw new Error("Faça login novamente para continuar.");
      }

      const url = isEditing
        ? `http://localhost:3000/academic/disciplines/${disciplineIdToEdit}`
        : "http://localhost:3000/academic/disciplines";

      const response = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          code: code.trim(),
          name: name.trim(),
          courseId,
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
              ? "Não foi possível atualizar a disciplina."
              : "Não foi possível cadastrar a disciplina."),
        );
      }

      const savedDiscipline: Discipline = await response.json();

      const normalizedDiscipline: Discipline = {
        ...savedDiscipline,
        course:
          savedDiscipline.course ??
          courses.find((course) => course.id === courseId),
        courseId,
      };

      setDisciplines((previous) => {
        const updated = isEditing
          ? previous.map((discipline) =>
              discipline.id === disciplineIdToEdit
                ? normalizedDiscipline
                : discipline,
            )
          : [...previous, normalizedDiscipline];

        return updated.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      });

      setEditingDisciplineId(null);
      setCode("");
      setName("");
      setCourseId("");

      setSuccess(
        isEditing
          ? "Disciplina atualizada com sucesso!"
          : "Disciplina cadastrada com sucesso!",
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao salvar a disciplina.",
      );
    } finally {
      setSaving(false);
    }
  }

  function getCourseName(discipline: Discipline) {
    if (discipline.course) {
      return discipline.course.name;
    }

    const course = courses.find((item) => item.id === discipline.courseId);

    return course?.name ?? "Curso não informado";
  }

  return (
    <section>
      <h2>Gerenciamento de disciplinas</h2>

      <form
        onSubmit={handleSubmit}
        className="evaluation-card"
        style={{ display: "grid", gap: "12px" }}
      >
        <h3>
          {editingDisciplineId
            ? "Editar disciplina"
            : "Cadastrar nova disciplina"}
        </h3>

        <label htmlFor="discipline-code">Código da disciplina</label>

        <input
          id="discipline-code"
          type="text"
          placeholder="Ex.: REDES"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          maxLength={30}
          required
          disabled={saving}
        />

        <label htmlFor="discipline-name">Nome da disciplina</label>

        <input
          id="discipline-name"
          type="text"
          placeholder="Ex.: Redes de Computadores"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={150}
          required
          disabled={saving}
        />

        <label htmlFor="discipline-course">Curso</label>

        <select
          id="discipline-course"
          value={courseId}
          onChange={(event) => setCourseId(event.target.value)}
          required
          disabled={saving || loading || courses.length === 0}
        >
          <option value="">Selecione um curso</option>

          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.name} ({course.code})
            </option>
          ))}
        </select>

        {courses.length === 0 && !loading && (
          <p>Cadastre um curso antes de criar disciplinas.</p>
        )}

        <button
          type="submit"
          disabled={saving || loading || courses.length === 0}
        >
          {saving
            ? editingDisciplineId
              ? "Salvando..."
              : "Cadastrando..."
            : editingDisciplineId
              ? "Salvar alterações"
              : "Cadastrar disciplina"}
        </button>

        {editingDisciplineId && (
          <button
            type="button"
            onClick={handleCancelEdit}
            disabled={saving}
            style={{
              backgroundColor: "#e2e8f0",
              color: "#334155",
              border: "1px solid #cbd5e1",
              borderRadius: "10px",
              padding: "10px 16px",
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
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

      <h3>Disciplinas cadastradas</h3>

      {loading ? (
        <p>Carregando disciplinas...</p>
      ) : disciplines.length === 0 ? (
        <p>Nenhuma disciplina cadastrada.</p>
      ) : (
        <ul className="evaluation-list">
          {disciplines.map((discipline) => (
            <li key={discipline.id} className="evaluation-card">
              <strong>{discipline.name}</strong>
              <p>Código: {discipline.code}</p>
              <p>Curso: {getCourseName(discipline)}</p>

              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  marginTop: "16px",
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  onClick={() => handleEdit(discipline)}
                  disabled={saving || deletingDisciplineId !== null}
                  style={{
                    flex: "1 1 140px",
                    width: "auto",
                    marginTop: 0,
                    padding: "10px 18px",
                    borderRadius: "10px",
                    cursor: "pointer",
                  }}
                >
                  Editar
                </button>

                {canDeleteDisciplines && (
                  <button
                    type="button"
                    onClick={() => void handleDelete(discipline)}
                    disabled={saving || deletingDisciplineId !== null}
                    style={{
                      flex: "1 1 140px",
                      width: "auto",
                      marginTop: 0,
                      padding: "10px 18px",
                      borderRadius: "10px",
                      backgroundColor: "#fff1f2",
                      color: "#be123c",
                      border: "1px solid #fecdd3",
                      cursor: "pointer",
                    }}
                  >
                    {deletingDisciplineId === discipline.id
                      ? "Excluindo..."
                      : "Excluir"}
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
