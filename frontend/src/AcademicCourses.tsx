import { useEffect, useState, type FormEvent } from "react";

type Course = {
  id: string;
  code: string;
  name: string;
};

export default function AcademicCourses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) return;

    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const token = sessionStorage.getItem("accessToken");

      if (!token) {
        throw new Error("Faça login novamente para continuar.");
      }

      const response = await fetch("http://localhost:3000/academic/courses", {
        method: "POST",
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

        throw new Error(message || "Não foi possível cadastrar o curso.");
      }

      const createdCourse: Course = await response.json();

      setCourses((previous) => [...previous, createdCourse]);
      setCode("");
      setName("");
      setSuccess("Curso cadastrado com sucesso!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao cadastrar curso.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <h2>Gerenciamento de cursos</h2>

      <form
        onSubmit={handleSubmit}
        className="evaluation-card"
        style={{ display: "grid", gap: "12px" }}
      >
        <h3>Cadastrar novo curso</h3>

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

        <button type="submit" disabled={saving}>
          {saving ? "Cadastrando..." : "Cadastrar curso"}
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

      <h3>Cursos cadastrados</h3>

      {loading ? (
        <p>Carregando cursos...</p>
      ) : courses.length === 0 ? (
        <p>Nenhum curso cadastrado.</p>
      ) : (
        <ul className="evaluation-list">
          {courses.map((course) => (
            <li key={course.id} className="evaluation-card">
              <strong>{course.name}</strong>
              <p>Código: {course.code}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
