import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import EvaluationQuestionnaire, {
  type QuestionnaireResponse,
} from "./EvaluationQuestionnaire";

type User = {
  name: string;
  role: string;
};

type StudentEvaluation = {
  id: string;
  completed: boolean;
  evaluation: {
    id: string;
    classGroup: {
      code: string;
      discipline: {
        name: string;
      };
      professor: {
        name: string;
      };
    };
    evaluationPeriod: {
      endDate: string;
    };
  };
};

function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const [loggedInUser, setLoggedInUser] = useState<User | null>(null);
  const [evaluations, setEvaluations] = useState<StudentEvaluation[]>([]);
  const [evaluationsLoading, setEvaluationsLoading] = useState(false);
  const [evaluationsError, setEvaluationsError] = useState("");
  const [loadedAt, setLoadedAt] = useState(0);
  const [questionnaireData, setQuestionnaireData] =
    useState<QuestionnaireResponse | null>(null);

  const [questionnaireLoading, setQuestionnaireLoading] = useState(false);
  const [questionnaireError, setQuestionnaireError] = useState("");
  const [refreshCount, setRefreshCount] = useState(0);

  useEffect(() => {
    if (!loggedInUser || loggedInUser.role !== "STUDENT") {
      return;
    }

    const controller = new AbortController();

    async function loadEvaluations() {
      setEvaluationsLoading(true);
      setEvaluationsError("");

      try {
        const token = sessionStorage.getItem("accessToken");

        const response = await fetch("http://localhost:3000/evaluations/my", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Não foi possível carregar as avaliações.");
        }

        const data: StudentEvaluation[] = await response.json();

        if (!controller.signal.aborted) {
          setEvaluations(data);
          setLoadedAt(Date.now());
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setEvaluationsError(
            error instanceof Error
              ? error.message
              : "Erro ao carregar avaliações.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setEvaluationsLoading(false);
        }
      }
    }

    void loadEvaluations();

    return () => controller.abort();
  }, [loggedInUser, refreshCount]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage("");
    setSuccess(false);
    setLoading(true);

    try {
      const response = await fetch("http://localhost:3000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("E-mail ou senha incorretos.");
        }

        throw new Error(`Erro ao realizar login (${response.status}).`);
      }

      const data = await response.json();

      sessionStorage.setItem("accessToken", data.accessToken);
      sessionStorage.setItem("user", JSON.stringify(data.user));

      setSuccess(true);
      setMessage(`Bem-vindo(a), ${data.user.name}!`);
      setPassword("");
      setLoggedInUser(data.user);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível conectar ao servidor.",
      );
    } finally {
      setLoading(false);
    }
  }
  async function handleOpenQuestionnaire(evaluationId: string) {
    setQuestionnaireLoading(true);
    setQuestionnaireError("");

    try {
      const token = sessionStorage.getItem("accessToken");

      const response = await fetch(
        `http://localhost:3000/evaluations/${evaluationId}/questionnaire`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error("Não foi possível abrir esta avaliação.");
      }

      const data: QuestionnaireResponse = await response.json();

      setQuestionnaireData(data);
    } catch (error) {
      setQuestionnaireError(
        error instanceof Error
          ? error.message
          : "Erro ao carregar questionário.",
      );
    } finally {
      setQuestionnaireLoading(false);
    }
  }

  function handleLogout() {
    sessionStorage.removeItem("accessToken");
    sessionStorage.removeItem("user");

    setLoggedInUser(null);
    setEvaluations([]);
    setEvaluationsError("");
    setEmail("");
    setPassword("");
    setMessage("");
  }
  if (loggedInUser && questionnaireData) {
    return (
      <main className="login-page">
        <section className="login-card" style={{ maxWidth: "760px" }}>
          <EvaluationQuestionnaire
            data={questionnaireData}
            onBack={() => {
              setQuestionnaireData(null);
              setRefreshCount((previous) => previous + 1);
            }}
          />
        </section>
      </main>
    );
  }

  if (loggedInUser) {
    return (
      <main className="login-page">
        <section className="login-card">
          <h1>Olá, {loggedInUser.name}!</h1>

          <p>Bem-vindo(a) à Plataforma de Avaliação de Disciplinas.</p>

          <h2>Minhas avaliações</h2>
          {questionnaireError && (
            <p role="alert" style={{ color: "#dc2626" }}>
              {questionnaireError}
            </p>
          )}

          {loggedInUser.role !== "STUDENT" ? (
            <p>A área deste perfil será desenvolvida posteriormente.</p>
          ) : evaluationsLoading ? (
            <p>Carregando avaliações...</p>
          ) : evaluationsError ? (
            <p style={{ color: "#dc2626" }}>{evaluationsError}</p>
          ) : evaluations.length === 0 ? (
            <p>Nenhuma avaliação encontrada para este estudante.</p>
          ) : (
            <ul style={{ paddingLeft: "20px" }}>
              {evaluations.map((item) => {
                const classGroup = item.evaluation.classGroup;
                const periodEnded =
                  new Date(item.evaluation.evaluationPeriod.endDate).getTime() <
                  loadedAt;

                const status = item.completed
                  ? "Respondida"
                  : periodEnded
                    ? "Período encerrado"
                    : "Ainda não respondida";

                return (
                  <li key={item.id}>
                    <strong>{classGroup.discipline.name}</strong>

                    <p>Turma: {classGroup.code}</p>
                    <p>Professor: {classGroup.professor.name}</p>
                    <p>Situação: {status}</p>
                    {!item.completed && !periodEnded && (
                      <button
                        type="button"
                        disabled={questionnaireLoading}
                        onClick={() =>
                          handleOpenQuestionnaire(item.evaluation.id)
                        }
                      >
                        {questionnaireLoading
                          ? "Abrindo..."
                          : "Responder avaliação"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <button type="button" onClick={handleLogout}>
            Sair
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <h1>Avaliação de Disciplinas</h1>

        <p>Entre com sua conta para acessar a plataforma.</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              placeholder="Digite seu e-mail"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Senha</label>
            <input
              id="password"
              type="password"
              placeholder="Digite sua senha"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          <button type="submit" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        {message && (
          <p role="status" style={{ color: success ? "#15803d" : "#dc2626" }}>
            {message}
          </p>
        )}

        <p className="login-footer">Projeto de estágio — UniXS</p>
      </section>
    </main>
  );
}

export default App;
