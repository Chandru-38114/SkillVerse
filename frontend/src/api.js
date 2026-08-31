// Backend base URL — set VITE_API_URL in .env.production for deployment.
// Local development falls back to the Vite dev-server proxy target automatically.
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

function getToken() {
  return localStorage.getItem("skillverse_token");
}

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  signup: (data) => request("/auth/signup", { method: "POST", body: data, auth: false }),
  login: (data) => request("/auth/login", { method: "POST", body: data, auth: false }),
  me: () => request("/users/me"),
  refreshMe: async () => {
    const user = await request("/users/me");
    localStorage.setItem("skillverse_user", JSON.stringify(user));
    // Notify any component listening (e.g. Navbar) that the user object changed.
    window.dispatchEvent(new Event("skillverse_user_updated"));
    return user;
  },
  mySkills: () => request("/users/me/skills"),

  assessmentQuestions: (skill) => request(`/assessments/questions/${encodeURIComponent(skill)}`),
  submitAssessment: (data) => request("/assessments/submit", { method: "POST", body: data }),

  searchTeachers: (skill) => request(`/marketplace/search${skill ? `?skill=${encodeURIComponent(skill)}` : ""}`),

  sendRequest: (data) => request("/requests", { method: "POST", body: data }),
  incomingRequests: () => request("/requests/incoming"),
  outgoingRequests: () => request("/requests/outgoing"),
  respondToRequest: (id, accept) => request(`/requests/${id}/respond?accept=${accept}`, { method: "POST" }),
  getConnectionStatus: (toUserId, skillName) =>
    request(`/requests/status?to_user_id=${toUserId}&skill_name=${encodeURIComponent(skillName)}`),
  completeRequest: (id) => request(`/requests/${id}/complete`, { method: "POST" }),

  listMessages: (requestId) => request(`/chat/${requestId}/messages`),
  sendMessage: (requestId, content) => request(`/chat/${requestId}/messages`, { method: "POST", body: { content } }),

  submitReview: (requestId, data) => request(`/reviews/${requestId}`, { method: "POST", body: data }),
  getMyReviewForRequest: (requestId) => request(`/reviews/my/${requestId}`),
  getUserReviews: (userId) => request(`/reviews/user/${userId}`, { auth: false }),
};

export function saveSession(token, user) {
  localStorage.setItem("skillverse_token", token);
  localStorage.setItem("skillverse_user", JSON.stringify(user));
}

export function getSessionUser() {
  const raw = localStorage.getItem("skillverse_user");
  return raw ? JSON.parse(raw) : null;
}

export function clearSession() {
  localStorage.removeItem("skillverse_token");
  localStorage.removeItem("skillverse_user");
}


// Phase 2: real-time chat over WebSockets.
// Browsers can't set an Authorization header on a WebSocket handshake, so
// the JWT is passed as a query param instead — the backend decodes it the
// same way as any REST request (see chat.py's _authenticate_ws).
export function chatSocketUrl(requestId) {
  const token = getToken();
  const wsBase = BASE_URL.replace(/^http/, "ws");
  return `${wsBase}/chat/ws/${requestId}?token=${encodeURIComponent(token || "")}`;
}