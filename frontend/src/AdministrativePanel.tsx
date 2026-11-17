import { useEffect, useState } from "react";
import AcademicCourses from "./AcademicCourses";
import AcademicDisciplines from "./AcademicDisciplines";
import AcademicTerms from "./AcademicTerms";
import AcademicClasses from "./AcademicClasses";
import EvaluationPeriods from "./EvaluationPeriods";
import EvaluationManagement from "./EvaluationManagement";
import EvaluationAnalysis from "./EvaluationAnalysis";
import ImprovementPlans from "./ImprovementPlans";
import QuestionnaireManagement from "./QuestionnaireManagement";
import EvaluationEligibilities from "./EvaluationEligibilities";
import "./AdministrativePanel.css";

type Props = {
  role: "ADMIN" | "COORDINATOR";
};

type Section =
  | "evaluations"
  | "analysis"
  | "improvement-plans"
  | "courses"
  | "disciplines"
  | "terms"
  | "classes"
  | "periods"
  | "questionnaires"
  | "eligibilities";

const VALID_SECTIONS: Section[] = [
  "evaluations",
  "analysis",
  "improvement-plans",
  "courses",
  "disciplines",
  "terms",
  "classes",
  "periods",
  "questionnaires",
  "eligibilities",
];

type MenuItem = {
  section: Section;
  title: string;
  description: string;
};

const MENU_GROUPS: { title: string; items: MenuItem[] }[] = [
  {
    title: "Avaliações e questionários",
    items: [
      {
        section: "evaluations",
        title: "Avaliações",
        description: "Cadastrar e consultar avaliações",
      },
      {
        section: "analysis",
        title: "Análise de resultados",
        description: "Consultar resultados e comparar períodos",
      },
      {
        section: "improvement-plans",
        title: "Planos de melhoria",
        description: "Registrar ações e acompanhar prazos",
      },
      {
        section: "periods",
        title: "Períodos",
        description: "Gerenciar períodos de avaliação",
      },
      {
        section: "questionnaires",
        title: "Questionários",
        description: "Organizar perguntas e dimensões",
      },
      {
        section: "eligibilities",
        title: "Estudantes habilitados",
        description: "Controlar quem pode responder",
      },
    ],
  },
  {
    title: "Estrutura acadêmica",
    items: [
      {
        section: "courses",
        title: "Cursos",
        description: "Cadastrar e gerenciar cursos",
      },
      {
        section: "disciplines",
        title: "Disciplinas",
        description: "Organizar disciplinas",
      },
      {
        section: "terms",
        title: "Semestres",
        description: "Gerenciar semestres letivos",
      },
      {
        section: "classes",
        title: "Turmas",
        description: "Cadastrar e gerenciar turmas",
      },
    ],
  },
];

function MenuIcon({ section }: { section: Section }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {section === "evaluations" && (
        <>
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <path d="M9 8h6M9 12h6M9 16h3" />
        </>
      )}

      {section === "analysis" && (
        <path d="M4 4v16h16M9 16v-4m5 4V8m5 8V5" />
      )}

      {section === "improvement-plans" && (
        <>
          <rect x="5" y="4" width="14" height="16" rx="2" />
          <path d="m8 12 3 3 5-6" />
        </>
      )}

      {section === "periods" && (
        <>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M7 3v4M17 3v4M3 10h18" />
          <circle cx="12" cy="15" r="2" />
        </>
      )}

      {section === "questionnaires" && (
        <>
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <path d="M9 8h6M9 12h6M9 16h2" />
          <circle cx="15" cy="16" r="1" />
        </>
      )}

      {section === "eligibilities" && (
        <>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 20v-2a6 6 0 0 1 9-5.2" />
          <path d="m14 17 2 2 5-5" />
        </>
      )}

      {section === "courses" && (
        <>
          <path d="m2 9 10-5 10 5-10 5L2 9Z" />
          <path d="M6 11v6c3 3 9 3 12 0v-6" />
          <path d="M22 9v7" />
        </>
      )}

      {section === "disciplines" && (
        <>
          <path d="M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1" />
          <path d="M12 6c3-2 6-2 9-1v14c-3-1-6-1-9 1" />
          <path d="M12 6v14" />
        </>
      )}

      {section === "terms" && (
        <>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M7 3v4M17 3v4M3 10h18" />
          <path d="M8 14h3M14 14h3M8 18h3" />
        </>
      )}

      {section === "classes" && (
        <>
          <circle cx="12" cy="7" r="3" />
          <path d="M6 20v-2a6 6 0 0 1 12 0v2" />
          <path d="M4 11a3 3 0 0 0-2 5v4" />
          <path d="M20 11a3 3 0 0 1 2 5v4" />
        </>
      )}
    </svg>
  );
}

export default function AdministrativePanel({ role }: Props) {
  const [activeSection, setActiveSection] = useState<Section>(() => {
    const savedSection = sessionStorage.getItem(
      `administrative-panel-section:${role}`,
    );

    return (
      VALID_SECTIONS.find((section) => section === savedSection) ??
      "evaluations"
    );
  });

  useEffect(() => {
    sessionStorage.setItem(
      `administrative-panel-section:${role}`,
      activeSection,
    );
  }, [activeSection, role]);

  const [menuExpanded, setMenuExpanded] = useState(() => {
    const saved = sessionStorage.getItem(
      `administrative-panel-menu-expanded:${role}`,
    );

    return saved !== "false";
  });

  useEffect(() => {
    sessionStorage.setItem(
      `administrative-panel-menu-expanded:${role}`,
      String(menuExpanded),
    );
  }, [menuExpanded, role]);

  const activeSectionLabel =
    MENU_GROUPS.flatMap((group) => group.items).find(
      (item) => item.section === activeSection,
    )?.title ?? "Avaliações";

  return (
    <div>
      <div className="admin-menu__toolbar">
        <span>
          Área atual: <strong>{activeSectionLabel}</strong>
        </span>

        <button
          type="button"
          className="admin-menu__toggle"
          aria-expanded={menuExpanded}
          aria-controls="admin-panel-navigation"
          onClick={() => setMenuExpanded((previous) => !previous)}
        >
          {menuExpanded ? "Ocultar menu" : "Mostrar menu"}
        </button>
      </div>

      <nav
        id="admin-panel-navigation"
        className="admin-menu"
        aria-label="Navegação administrativa"
        style={{ display: menuExpanded ? "flex" : "none" }}
      >
        {MENU_GROUPS.map((group, groupIndex) => (
          <section
            className="admin-menu__group"
            aria-labelledby={`admin-menu-group-${groupIndex}`}
            key={group.title}
          >
            <h3
              className="admin-menu__heading"
              id={`admin-menu-group-${groupIndex}`}
            >
              {group.title}
            </h3>

            <div className="admin-menu__grid">
              {group.items.map((item) => (
                <button
                  key={item.section}
                  type="button"
                  className="admin-menu__card"
                  aria-pressed={activeSection === item.section}
                  onClick={() => setActiveSection(item.section)}
                >
                  <span className="admin-menu__icon">
                    <MenuIcon section={item.section} />
                  </span>

                  <span className="admin-menu__content">
                    <span className="admin-menu__title">{item.title}</span>

                    <span className="admin-menu__description">
                      {item.description}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </nav>

      {activeSection === "evaluations" ? (
        <EvaluationManagement role={role} />
      ) : activeSection === "analysis" ? (
        <EvaluationAnalysis />
      ) : activeSection === "improvement-plans" ? (
        <ImprovementPlans role={role} />
      ) : activeSection === "courses" ? (
        <AcademicCourses role={role} />
      ) : activeSection === "disciplines" ? (
        <AcademicDisciplines role={role} />
      ) : activeSection === "terms" ? (
        <AcademicTerms role={role} />
      ) : activeSection === "classes" ? (
        <AcademicClasses role={role} />
      ) : activeSection === "periods" ? (
        <EvaluationPeriods role={role} />
      ) : activeSection === "eligibilities" ? (
        <EvaluationEligibilities />
      ) : (
        <QuestionnaireManagement />
      )}
    </div>
  );
}
