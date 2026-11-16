import { useEffect, useState, type FormEvent } from "react";

type Course = {
  id: string;
  code: string;
  name: string;
};

type AcademicCoursesProps = {
  role: "ADMIN" | "COORDINATOR";
};

export default function AcademicCourses({ role }: AcademicCoursesProps) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingCourseId, setDeletingCourseId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const canDeleteCourses = role === "ADMIN";

  useEffect(() => {
    const controller = new AbortController();

    async function loadCourses() {
      try {
        const token = sessionStorage.getItem("accessToken");

        if (!token) {
          throw new Error("Faça login novamente para continuar.");
        }

        const response = await fetch("http://localhost:3000/academic/courses", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Não foi possível carregar os cursos.");
        }

        const data: Course[] = await response.json();

        if (!controller.signal.aborted) {
          setCourses(data);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error ? err.message : "Erro ao carregar cursos.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadCourses();

    return () => controller.abort();
  }, []);

  function handleEdit(course: Course) {
    if (saving || deletingCourseId !== null) return;

    setEditingCourseId(course.id);
    setCode(course.code);
    setName(course.name);
    setError("");
    setSuccess("");
  }

  function handleCancelEdit() {
    if (saving || deletingCourseId !== null) return;

    setEditingCourseId(null);
    setCode("");
    setName("");
    setError("");
    setSuccess("");
  }

  async function handleDelete(course: Course) {
    if (!canDeleteCourses || saving || deletingCourseId !== null) {
      return;
    }

    const confirmed = window.confirm(
      `Tem certeza que deseja excluir o curso "${course.name}"?\n\nEssa ação não poderá ser desfeita.`,
    );

    if (!confirmed) return;

    setDeletingCourseId(course.id);
    setError("");
    setSuccess("");

    try {
      const token = sessionStorage.getItem("accessToken");

      if (!token) {
        throw new Error("Faça login novamente para continuar.");
      }

      const response = await fetch(
        `http://localhost:3000/academic/courses/${course.id}`,
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

        throw new Error(message || "Não foi possível excluir o curso.");
      }

      setCourses((previous) =>
        previous.filter((item) => item.id !== course.id),
      );

      if (editingCourseId === course.id) {
        setEditingCourseId(null);
        setCode("");
        setName("");
      }

      setSuccess("Curso excluído com sucesso!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir curso.");
    } finally {
      setDeletingCourseId(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving || deletingCourseId !== null) return;

    setError("");
    setSuccess("");
    setSaving(true);

    const courseIdToEdit = editingCourseId;

    try {
      const token = sessionStorage.getItem("accessToken");

      if (!token) {
        throw new Error("Faça login novamente para continuar.");
      }

      const isEditing = courseIdToEdit !== null;

      const url = isEditing
        ? `http://localhost:3000/academic/courses/${courseIdToEdit}`
        : "http://localhost:3000/academic/courses";

      const response = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          code: code.trim(),
          name: name.trim(),
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
              ? "Não foi possível atualizar o curso."
              : "Não foi possível cadastrar o curso."),
        );
      }

      const savedCourse: Course = await response.json();

      setCourses((previous) => {
        const updated = isEditing
          ? previous.map((course) =>
              course.id === courseIdToEdit ? savedCourse : course,
            )
          : [...previous, savedCourse];

        return updated.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      });

      setEditingCourseId(null);
      setCode("");
      setName("");

      setSuccess(
        isEditing
          ? "Curso atualizado com sucesso!"
          : "Curso cadastrado com sucesso!",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar o curso.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <h2>Gerenciamento de cursos</h2>

      <form onSubmit={handleSubmit} className="evaluation-card ui-form">
        <h3>{editingCourseId ? "Editar curso" : "Cadastrar novo curso"}</h3>

        <label htmlFor="course-code">Código do curso</label>
        <input
          id="course-code"
          type="text"
          placeholder="Ex.: EE"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          maxLength={30}
          required
          disabled={saving}
        />

        <label htmlFor="course-name">Nome do curso</label>
        <input
          id="course-name"
          type="text"
          placeholder="Ex.: Engenharia Elétrica"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={150}
          required
          disabled={saving}
        />

        <div className="ui-form__actions">
          <button
            type="submit"
            className="ui-btn ui-btn--primary"
            disabled={saving}
          >
            {saving
              ? editingCourseId
                ? "Salvando..."
                : "Cadastrando..."
              : editingCourseId
                ? "Salvar alterações"
                : "Cadastrar curso"}
          </button>

          {editingCourseId && (
            <button
              type="button"
              className="ui-btn ui-btn--secondary"
              onClick={handleCancelEdit}
              disabled={saving}
            >
              Cancelar edição
            </button>
          )}
        </div>
      </form>

      {error && (
        <p role="alert" className="ui-feedback ui-feedback--error">
          {error}
        </p>
      )}

      {success && (
        <p role="status" className="ui-feedback ui-feedback--success">
          {success}
        </p>
      )}

      <h3>Cursos cadastrados</h3>

      {loading ? (
        <p>Carregando cursos...</p>
      ) : courses.length === 0 ? (
        <p>Nenhum curso cadastrado.</p>
      ) : (
        <ul className="evaluation-list">
          {courses.map((course) => (
            <li key={course.id} className="evaluation-card ui-card">
              <h4 className="ui-card__title">{course.name}</h4>

              <p className="ui-card__meta">Código: {course.code}</p>

              <div className="ui-card__actions">
                <button
                  type="button"
                  className="ui-btn ui-btn--primary"
                  onClick={() => handleEdit(course)}
                  disabled={saving || deletingCourseId !== null}
                >
                  Editar
                </button>

                {canDeleteCourses && (
                  <button
                    type="button"
                    className="ui-btn ui-btn--danger"
                    onClick={() => void handleDelete(course)}
                    disabled={saving || deletingCourseId !== null}
                  >
                    {deletingCourseId === course.id
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
