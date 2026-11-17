export const apiPath = "/improvement-plans";

export async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const token = sessionStorage.getItem("accessToken");
  if (!token) {
    throw new Error("Faça login novamente para continuar.");
  }
  const response = await fetch(`http://localhost:3000${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    const data: { message?: string | string[] } = await response
      .json()
      .catch(() => ({}));
    const message = Array.isArray(data.message)
      ? data.message.join(" ")
      : data.message;
    throw new Error(
      message || "Não foi possível acessar os planos de melhoria.",
    );
  }
  return response.json();
}

export function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Ocorreu um erro ao acessar os planos.";
}
