import { useState } from "react";
import ProfessorEvaluations from "./ProfessorEvaluations";
import AcademicCourses from "./AcademicCourses";
import AcademicDisciplines from "./AcademicDisciplines";
import AcademicTerms from "./AcademicTerms";
import AcademicClasses from "./AcademicClasses";

type Props = {
  role: "ADMIN" | "COORDINATOR";
};

type Section = "evaluations" | "courses" | "disciplines" | "terms" | "classes";

export default function AdministrativePanel({ role }: Props) {
  const [activeSection, setActiveSection] = useState<Section>("evaluations");

  return (
    <div>
      <nav
        aria-label="Navegação administrativa"
        style={{
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
          marginBottom: "24px",
        }}
      >
        <button
          type="button"
          aria-pressed={activeSection === "evaluations"}
          onClick={() => setActiveSection("evaluations")}
        >
          Avaliações
        </button>

        <button
          type="button"
          aria-pressed={activeSection === "courses"}
          onClick={() => setActiveSection("courses")}
        >
          Gerenciar cursos
        </button>

        <button
          type="button"
          aria-pressed={activeSection === "disciplines"}
          onClick={() => setActiveSection("disciplines")}
        >
          Gerenciar disciplinas
        </button>

        <button
          type="button"
          aria-pressed={activeSection === "terms"}
          onClick={() => setActiveSection("terms")}
        >
          Gerenciar semestres
        </button>

        <button
          type="button"
          aria-pressed={activeSection === "classes"}
          onClick={() => setActiveSection("classes")}
        >
          Gerenciar turmas
        </button>
      </nav>

      {activeSection === "evaluations" ? (
        <ProfessorEvaluations role={role} />
      ) : activeSection === "courses" ? (
        <AcademicCourses />
      ) : activeSection === "disciplines" ? (
        <AcademicDisciplines />
      ) : activeSection === "terms" ? (
        <AcademicTerms />
      ) : (
        <AcademicClasses />
      )}
    </div>
  );
}
