// Backend base URL — set VITE_API_URL in .env.production for deployment.
// Local development falls back to the Vite dev-server proxy target automatically.
export const BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/+$/, "");

export function getToken() {
  return localStorage.getItem("skillverse_token");
}

const cache = new Map();
const inFlight = new Map();

function isRealtime(path) {
  return path.includes("/unread-count") ||
         path.includes("/notifications") ||
         path.match(/\/requests\/status/) ||
         path.includes("/sessions/upcoming") ||
         path.includes("/chat/inbox") ||
         path.match(/\/chat\/.*\/messages/);
}

function getTTL(path) {
  if (isRealtime(path)) return 0;
  if (path.match(/\/chat\/.*\/file\//)) return 120000; // 2 minutes for signed chat files
  return 30000; // 30 seconds default for GETs (skills, gamification, etc.)
}

export function clearCachePrefix(prefix) {
  for (const key of cache.keys()) {
    if (key.startsWith("GET:" + prefix) || key.includes(prefix)) {
      cache.delete(key);
    }
  }
}

async function request(path, { method = "GET", body, auth = true, bypassCache = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  
  const cacheKey = `GET:${path}`;
  const ttl = getTTL(path);

  if (method === "GET" && !bypassCache && ttl > 0) {
    if (cache.has(cacheKey)) {
      const entry = cache.get(cacheKey);
      if (Date.now() - entry.timestamp < ttl) {
        return entry.data;
      }
      cache.delete(cacheKey);
    }
    
    if (inFlight.has(cacheKey)) {
      return inFlight.get(cacheKey);
    }
  }

  const fetchPromise = (async () => {
    let res;
    try {
      console.log(`[API] Request started: ${method} ${BASE_URL}${path}`);
      res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      console.log(`[API] Request completed: ${method} ${path} - Status: ${res.status}`);
    } catch (error) {
      console.error(`[API] Request failed/aborted: ${method} ${path}`, error.name, error.message);
      if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
        throw new Error("Network connection failed. Please check your internet or try again later.");
      }
      throw error;
    }

    if (!res.ok) {
      let errorMessage = `Request failed (${res.status})`;
      try {
        const errData = await res.json();
        if (res.status === 422 && errData.detail && Array.isArray(errData.detail)) {
          errorMessage = errData.detail.map(e => e.msg).join(", ");
        } else {
          errorMessage = errData.detail || errData.message || res.statusText;
        }
      } catch (parseError) {
        errorMessage = res.statusText || `Server returned ${res.status}`;
      }
      
      if (res.status === 500) {
        throw new Error(`Server error: ${errorMessage}`);
      }
      throw new Error(errorMessage);
    }
    
    const data = res.status === 204 ? null : await res.json();
    
    if (method === "GET" && ttl > 0) {
      cache.set(cacheKey, { data, timestamp: Date.now() });
    }
    
    if (method !== "GET") {
      if (path.startsWith("/users/me")) clearCachePrefix("/users/me");
      if (path.startsWith("/sessions")) clearCachePrefix("/sessions");
      if (path.startsWith("/requests")) clearCachePrefix("/requests");
      if (path.startsWith("/assessments")) clearCachePrefix("/users/me/skills");
    }
    
    return data;
  })();

  if (method === "GET" && ttl > 0) {
    inFlight.set(cacheKey, fetchPromise);
    fetchPromise.finally(() => inFlight.delete(cacheKey));
  }

  return fetchPromise;
}

export const api = {
  signup: (data) => request("/auth/signup", { method: "POST", body: data, auth: false }),
  verifyGoogleSignup: (signup_token, credential) => request("/auth/verify-google-signup", { method: "POST", body: { signup_token, credential }, auth: false }),
  login: (data) => request("/auth/login", { method: "POST", body: data, auth: false }),
  googleAuth: (credential) => request("/auth/google", { method: "POST", body: { credential }, auth: false }),
  completeGoogle: (onboarding_token, details) => request("/auth/complete-google", { method: "POST", body: { onboarding_token, ...details }, auth: false }),
  forgotPassword: (email) => request("/auth/forgot-password", { method: "POST", body: { email }, auth: false }),
  resetPassword: (data) => request("/auth/reset-password", { method: "POST", body: data, auth: false }),
  me: () => request("/users/me"),
  updateMe: (data) => request("/users/me", { method: "PUT", body: data }),
  changePassword: (current_password, new_password) => request("/users/me/password", { method: "PUT", body: { current_password, new_password } }),
  uploadAvatar: async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`${BASE_URL}/users/me/avatar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      });
      if (!res.ok) {
        let errMsg = `Upload failed (${res.status})`;
        try {
          const errData = await res.json();
          errMsg = errData.detail || errData.message || res.statusText;
        } catch (e) {}
        throw new Error(errMsg);
      }
      const u = await res.json();
      localStorage.setItem("skillverse_user", JSON.stringify(u));
      window.dispatchEvent(new Event("skillverse_user_updated"));
      return u;
    } catch (error) {
      if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
        throw new Error("Network connection failed.");
      }
      throw error;
    }
  },
  removeAvatar: async () => {
    try {
      const res = await fetch(`${BASE_URL}/users/me/avatar`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) {
        let errMsg = `Remove failed (${res.status})`;
        try {
          const errData = await res.json();
          errMsg = errData.detail || errData.message || res.statusText;
        } catch (e) {}
        throw new Error(errMsg);
      }
      const u = await res.json();
      localStorage.setItem("skillverse_user", JSON.stringify(u));
      window.dispatchEvent(new Event("skillverse_user_updated"));
      return u;
    } catch (error) {
      if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
        throw new Error("Network connection failed.");
      }
      throw error;
    }
  },

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

  searchTeachers: (skill, role) => {
    let url = `/marketplace/search?`;
    if (skill) url += `q=${encodeURIComponent(skill)}&`;
    if (role) url += `role=${encodeURIComponent(role)}&`;
    return request(url);
  },

  sendRequest: (data) => request("/requests", { method: "POST", body: data }),
  incomingRequests: () => request("/requests/incoming"),
  outgoingRequests: () => request("/requests/outgoing"),
  respondToRequest: (id, accept) => request(`/requests/${id}/respond?accept=${accept}`, { method: "POST" }),
  getConnectionStatus: (toUserId, skillName) =>
    request(`/requests/status?to_user_id=${toUserId}&skill_name=${encodeURIComponent(skillName)}`),
  completeRequest: (id) => request(`/requests/${id}/complete`, { method: "POST" }),

  listMessages: (requestId) => request(`/chat/${requestId}/messages`),
  markMessagesRead: (requestId) => request(`/chat/${requestId}/read`, { method: "POST" }),
  sendMessage: (requestId, content, metadata = {}) => request(`/chat/${requestId}/messages`, { method: "POST", body: { content, metadata } }),
  getChatFileUrl: (requestId, bucket, filename) => request(`/chat/${requestId}/file/${bucket}/${filename}`),
  uploadChatAttachment: (requestId, file, type = "file") => {
    const formData = new FormData();
    formData.append("file", file);
    return fetch(`${BASE_URL}/chat/${requestId}/upload?type=${type}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getToken()}` },
      body: formData,
    }).then(async (res) => {
      if (!res.ok) throw new Error((await res.json()).detail || "Upload failed");
      return res.json();
    });
  },

  submitReview: (requestId, data) => request(`/reviews/${requestId}`, { method: "POST", body: data }),
  getMyReviewForRequest: (requestId) => request(`/reviews/my/${requestId}`),
  getUserReviews: (userId) => request(`/reviews/user/${userId}`, { auth: false }),

  // Sessions
  createSession: (data) => request("/sessions", { method: "POST", body: data }),
  getSession: (id) => request(`/sessions/${id}`),
  upcomingSessions: () => request("/sessions/upcoming"),
  mySessions: () => request("/sessions/my"),
  updateSession: (id, data) => request(`/sessions/${id}`, { method: "PUT", body: data }),
  cancelSession: (id) => request(`/sessions/${id}/cancel`, { method: "POST" }),
  getTurnCredentials: () => request("/sessions/turn-credentials"),


  // Auth Verification
  requestEmailVerification: () => request("/auth/verify-email/request", { method: "POST" }),
  confirmEmailVerification: (otp) => request("/auth/verify-email/confirm", { method: "POST", body: { otp } }),


  // Notifications
  getNotifications: () => request("/notifications"),
  getUnreadNotificationCount: () => request("/notifications/unread-count"),
  markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: "POST" }),
  markAllNotificationsRead: () => request("/notifications/read-all", { method: "POST" }),

  // Certificates
  getMyCertificates: () => request("/certificates/my"),
  generateCertificate: (skillName) => request(`/certificates/generate?skill_name=${encodeURIComponent(skillName)}`, { method: "POST" }),
  verifyCertificate: (certId) => request(`/certificates/verify/${certId}`, { auth: false }),

  // Progress & Notes
  getSessionProgress: (sessionId) => request(`/progress/session/${sessionId}`),
  saveSessionNotes: (sessionId, data) => request(`/progress/session/${sessionId}`, { method: "PUT", body: data }),
  completeSessionProgress: (sessionId) => request(`/progress/session/${sessionId}/complete`, { method: "POST" }),
  getMyProgress: () => request("/progress/my"),
  getProgressHistory: () => request("/progress/history"),

  // Whiteboard
  getWhiteboard: (sessionId) => request(`/sessions/${sessionId}/whiteboard`),
  saveWhiteboard: (sessionId, state) => request(`/sessions/${sessionId}/whiteboard`, { method: "PUT", body: { state } }),

  // Chat inbox (Direct Messages)
  getChatInbox: () => request("/chat/inbox"),
  markChatRead: (requestId) => request(`/chat/${requestId}/read`, { method: "POST" }),
  editMessage: (messageId, content) => request(`/chat/messages/${messageId}`, { method: "PUT", body: { content } }),
  deleteMessageForEveryone: (messageId) => request(`/chat/messages/${messageId}`, { method: "DELETE" }),
  deleteMessageForMe: (messageId) => request(`/chat/messages/${messageId}/hide`, { method: "POST" }),
  toggleReaction: (messageId, emoji) => request(`/chat/messages/${messageId}/react`, { method: "POST", body: { emoji } }),
  forwardMessage: (requestId, content) => request(`/chat/${requestId}/messages`, { method: "POST", body: { content, metadata: { forwarded: true } } }),

  // Materials
  getSessionMaterials: (sessionId) => request(`/materials/session/${sessionId}`),
  uploadMaterial: (sessionId, file) => {
    const formData = new FormData();
    formData.append("file", file);
    return fetch(`${BASE_URL}/materials/${sessionId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getToken()}` },
      body: formData,
    }).then(res => {
      if (!res.ok) throw new Error("Upload failed");
      return res.json();
    });
  },
  deleteMaterial: (id) => request(`/materials/${id}`, { method: "DELETE" }),

  // Gamification
  getLeaderboard: () => request("/gamification/leaderboard"),
  getGamificationSummary: () => request("/gamification/summary"),

  // Compiler (Session Room)
  getCompilerState: (sessionId) => request(`/compiler/${sessionId}/state`),
  runCompiler: (sessionId, code) => request(`/compiler/${sessionId}/run`, { method: "POST", body: { code } }),

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


export const getAvatarUrl = (url) => {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return `${BASE_URL}${url}`;
};
