import { useEffect, useState } from 'react';

function App() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const checkHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/health');
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data = await res.json();
      setHealth(data);
    } catch (err) {
      setError(err.message || 'Failed to connect to backend');
      setHealth(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div className="min-h-screen bg-[#0B0C10] text-white flex flex-col items-center justify-center p-6 select-none">
      {/* Background glow effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-[#1E6BFF]/10 blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 w-full max-w-xl flex flex-col items-center text-center space-y-8">
        {/* Brand Header */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-[#121418] text-xs font-medium text-[#9CA3AF] tracking-wide uppercase">
            <span className="w-2 h-2 rounded-full bg-[#1E6BFF] animate-pulse" />
            AI Attendance Co-Pilot
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white">
            Present <span className="text-[#1E6BFF]">Sir</span>
          </h1>
          <p className="text-sm sm:text-base text-[#9CA3AF] max-w-md mx-auto">
            Deterministic attendance intelligence, real-time timetable tracking, and strategic bunk optimization.
          </p>
        </div>

        {/* Backend Health Status Card */}
        <div className="w-full bg-[#121418] border border-white/10 rounded-2xl p-6 shadow-2xl backdrop-blur-sm text-left">
          <div className="flex items-center justify-between pb-4 border-b border-white/5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold tracking-wider text-[#9CA3AF] uppercase">
                System Diagnostics
              </span>
            </div>
            <button
              onClick={checkHealth}
              disabled={loading}
              className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white transition disabled:opacity-50"
            >
              {loading ? 'Checking...' : 'Refresh'}
            </button>
          </div>

          <div className="mt-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#9CA3AF]">Backend API (`/api/health`)</span>
              {loading ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-[#9CA3AF]">
                  <span className="w-2 h-2 rounded-full bg-[#9CA3AF] animate-ping" />
                  Connecting...
                </span>
              ) : error ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#EAB308]">
                  <span className="w-2 h-2 rounded-full bg-[#EAB308]" />
                  Offline
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1E6BFF]">
                  <span className="w-2 h-2 rounded-full bg-[#1E6BFF]" />
                  Connected ({health?.status})
                </span>
              )}
            </div>

            {health && (
              <div className="rounded-xl bg-[#0B0C10] p-4 border border-white/5 font-mono text-xs text-[#9CA3AF] space-y-1">
                <div className="flex justify-between">
                  <span className="text-white/60">Status:</span>
                  <span className="text-[#1E6BFF] font-semibold">{health.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Server Time:</span>
                  <span className="text-white">{health.timestamp}</span>
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-xl bg-[#EAB308]/10 border border-[#EAB308]/20 p-4 text-xs text-[#EAB308]">
                <p className="font-semibold mb-1">Connection Alert</p>
                <p className="text-[#EAB308]/80">{error}</p>
                <p className="mt-2 text-[11px] text-[#9CA3AF]">
                  Make sure the server is running on port 5000 (`npm run dev` in `server/`).
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer info */}
        <p className="text-xs text-[#9CA3AF]/60">
          Present Sir &bull; Dark-Mode Keynote Aesthetic &bull; Client &amp; Server Scaffolded
        </p>
      </div>
    </div>
  );
}

export default App;
