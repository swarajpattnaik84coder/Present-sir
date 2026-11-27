import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Loader2, Construction } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Today from './pages/Today.jsx';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0C10] text-white flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-7 h-7 text-[#1E6BFF] animate-spin" />
        <p className="text-xs text-[#9CA3AF]">Verifying session...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function PlaceholderPage({ title, description }) {
  return (
    <div className="bg-[#121418] border border-[#1F242D] rounded-2xl p-10 text-center space-y-3 max-w-xl mx-auto mt-8">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#1E6BFF]/10 border border-[#1E6BFF]/30 text-[#1E6BFF]">
        <Construction className="w-6 h-6" />
      </div>
      <h1 className="text-xl font-bold text-white">{title}</h1>
      <p className="text-sm text-[#9CA3AF]">{description}</p>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="today" element={<Today />} />
            <Route
              path="import"
              element={
                <PlaceholderPage
                  title="Timetable & Holiday Import"
                  description="Multimodal Gemini ingestion UI will be added in the next phase."
                />
              }
            />
            <Route
              path="agents"
              element={
                <PlaceholderPage
                  title="Agentic Co-Pilot"
                  description="Detention Shield, Trip Strategist, Condonation & Batch Consensus UI will be added in the next phase."
                />
              }
            />
            <Route
              path="approvals"
              element={
                <PlaceholderPage
                  title="HITL Pending Approvals"
                  description="Human-in-the-Loop approval queue will be added in the next phase."
                />
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
