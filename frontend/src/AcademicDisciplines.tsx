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

export default function AcademicDisciplines() {
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [courseId, setCourseId] = useState("");

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving || !courseId) return;

    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const token = sessionStorage.getItem("accessToken");

      if (!token) {
        throw new Error("Faça login novamente para continuar.");
      }

      const response = await fetch(
        "http://localhost:3000/academic/disciplines",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            code: code.trim(),
            name: name.trim(),
            courseId,
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

        throw new Error(message || "Não foi possível cadastrar a disciplina.");
      }

      const createdDiscipline: Discipline = await response.json();

      setDisciplines((previous) => [
        ...previous,
        {
          ...createdDiscipline,
          course:
            createdDiscipline.course ??
            courses.find((course) => course.id === courseId),
          courseId,
        },
      ]);

      setCode("");
      setName("");
      setCourseId("");
      setSuccess("Disciplina cadastrada com sucesso!");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao cadastrar disciplina.",
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
        <h3>Cadastrar nova disciplina</h3>

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
          {saving ? "Cadastrando..." : "Cadastrar disciplina"}
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
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
