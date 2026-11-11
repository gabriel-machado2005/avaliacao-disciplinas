import { useState } from "react";
import ProfessorEvaluations from "./ProfessorEvaluations";
import AcademicCourses from "./AcademicCourses";
import AcademicDisciplines from "./AcademicDisciplines";
import AcademicTerms from "./AcademicTerms";
import AcademicClasses from "./AcademicClasses";
import EvaluationPeriods from "./EvaluationPeriods";
import EvaluationManagement from "./EvaluationManagement";
import QuestionnaireManagement from "./QuestionnaireManagement";
import EvaluationEligibilities from "./EvaluationEligibilities";

type Props = {
  role: "ADMIN" | "COORDINATOR";
};

type Section =
  | "evaluations"
  | "courses"
  | "disciplines"
  | "terms"
  | "classes"
  | "periods"
  | "questionnaires"
  | "eligibilities";

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

        <button
          type="button"
          aria-pressed={activeSection === "periods"}
          onClick={() => setActiveSection("periods")}
        >
          Gerenciar períodos
        </button>

        <button
          type="button"
          aria-pressed={activeSection === "questionnaires"}
          onClick={() => setActiveSection("questionnaires")}
        >
          Gerenciar questionários
        </button>
        <button
          type="button"
          aria-pressed={activeSection === "eligibilities"}
          onClick={() => setActiveSection("eligibilities")}
        >
          Gerenciar estudantes habilitados
        </button>
      </nav>

      {activeSection === "evaluations" ? (
        <>
          <EvaluationManagement />

          <h2 style={{ marginTop: "32px" }}>Avaliações cadastradas</h2>

          <ProfessorEvaluations role={role} />
        </>
      ) : activeSection === "courses" ? (
        <AcademicCourses role={role} />
      ) : activeSection === "disciplines" ? (
        <AcademicDisciplines role={role} />
      ) : activeSection === "terms" ? (
        <AcademicTerms role={role} />
      ) : activeSection === "classes" ? (
        <AcademicClasses />
      ) : activeSection === "periods" ? (
        <EvaluationPeriods />
      ) : activeSection === "eligibilities" ? (
        <EvaluationEligibilities />
      ) : (
        <QuestionnaireManagement />
      )}
    </div>
  );
}
