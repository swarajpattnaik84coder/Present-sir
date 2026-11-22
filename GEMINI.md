# Present Sir — Workspace Rules

## Tech Stack
- **Frontend (`client/`):** React (Vite), JavaScript, Tailwind CSS.
- **Backend (`server/`):** Node.js, Express.js, MongoDB + Mongoose.
- **AI:** Google Gemini API (`@google/genai` SDK) — server-side only.
- **Auth:** JWT + bcrypt.

## Strict Architectural Guardrails
1. **Deterministic Math Only:** Never let Gemini calculate attendance percentages, bunk limits, recovery classes, or projections. All math must live as pure functions in `server/services/attendanceMath.js` with unit tests.
2. **Human-in-the-Loop (HITL) Writes:** Agents may read database state via tool calls, but any mutation (timetable extraction, class cancellation, schedule swap, condonation) must return a staged `PENDING_APPROVAL` payload for user confirmation before writing to MongoDB.
3. **Security:** Never expose `GEMINI_API_KEY`, `MONGO_URI`, or `JWT_SECRET` in `client/`. Load all secrets via `server/.env`.
4. **Build Order:** Always build and verify backend models, services, and Express routes before building the corresponding React UI.
5. **UI Theme:** Dark-mode keynote aesthetic — background `#0B0C10` / `#121418`, primary text `#FFFFFF`, electric blue accent `#1E6BFF`, amber alert accent `#EAB308`, muted text `#9CA3AF`.