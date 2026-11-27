import { useEffect, useState, useCallback } from 'react';
import {
  Pencil,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  BookOpen,
  Target,
  X,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import api from '../api/axios.js';

const statusConfig = {
  SAFE: {
    label: 'SAFE',
    badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    bar: 'bg-emerald-500',
    text: 'text-emerald-400',
  },
  ON_TARGET: {
    label: 'ON_TARGET',
    badge: 'bg-[#EAB308]/15 text-[#EAB308] border-[#EAB308]/30',
    bar: 'bg-[#EAB308]',
    text: 'text-[#EAB308]',
  },
  DANGER: {
    label: 'DANGER',
    badge: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    bar: 'bg-rose-500',
    text: 'text-rose-400',
  },
  NO_CLASSES: {
    label: 'NO_CLASSES',
    badge: 'bg-white/5 text-[#9CA3AF] border-[#1F242D]',
    bar: 'bg-[#9CA3AF]',
    text: 'text-[#9CA3AF]',
  },
};

export default function Dashboard() {
  const [targetPercent, setTargetPercent] = useState(75);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Edit Baseline modal state
  const [editingSubject, setEditingSubject] = useState(null);
  const [baselineForm, setBaselineForm] = useState({ initialAttended: 0, initialConducted: 0 });
  const [savingBaseline, setSavingBaseline] = useState(false);
  const [baselineError, setBaselineError] = useState('');

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/attendance/dashboard');
      setTargetPercent(res.data.targetPercent || 75);
      setSubjects(res.data.subjects || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const totalAttended = subjects.reduce((sum, s) => sum + (s.attended || 0), 0);
  const totalConducted = subjects.reduce((sum, s) => sum + (s.conducted || 0), 0);
  const overallPercent =
    totalConducted > 0 ? Math.round((totalAttended / totalConducted) * 10000) / 100 : 0;
  const dangerCount = subjects.filter((s) => s.status === 'DANGER').length;

  const openEditBaseline = (subject) => {
    setEditingSubject(subject);
    setBaselineForm({
      initialAttended: subject.initialAttended ?? 0,
      initialConducted: subject.initialConducted ?? 0,
    });
    setBaselineError('');
  };

  const handleSaveBaseline = async (e) => {
    e.preventDefault();
    if (!editingSubject) return;

    const attended = Number(baselineForm.initialAttended);
    const conducted = Number(baselineForm.initialConducted);

    if (attended < 0 || conducted < 0 || attended > conducted) {
      setBaselineError('Initial attended must be between 0 and initial conducted.');
      return;
    }

    setSavingBaseline(true);
    setBaselineError('');
    try {
      const res = await api.put(`/attendance/baseline/${editingSubject._id}`, {
        initialAttended: attended,
        initialConducted: conducted,
      });
      const updated = res.data.subject;
      setSubjects((prev) =>
        prev.map((s) => (s._id === updated._id ? { ...s, ...updated } : s))
      );
      setEditingSubject(null);
    } catch (err) {
      setBaselineError(err.response?.data?.error || 'Failed to update baseline.');
    } finally {
      setSavingBaseline(false);
    }
  };

  const getMathCallout = (sub) => {
    if (sub.status === 'NO_CLASSES') {
      return 'No classes conducted yet';
    }
    if (sub.status === 'SAFE') {
      if (sub.maxSafeSkips > 0) {
        return `Can safely skip ${sub.maxSafeSkips} class${sub.maxSafeSkips === 1 ? '' : 'es'}`;
      }
      return 'On the edge — attend next class to keep buffer';
    }
    if (sub.status === 'ON_TARGET') {
      return `Right at ${targetPercent}% — do not miss the next class`;
    }
    if (sub.classesRequired === null) {
      return `Target ${targetPercent}% is mathematically unreachable`;
    }
    return `Attend next ${sub.classesRequired} class${sub.classesRequired === 1 ? '' : 'es'} to reach ${targetPercent}%`;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Attendance Dashboard
          </h1>
          <p className="text-sm text-[#9CA3AF] mt-1">
            Deterministic projections across your enrolled subjects
          </p>
        </div>
        <button
          onClick={fetchDashboard}
          disabled={loading}
          className="inline-flex items-center gap-2 self-start sm:self-auto px-3.5 py-2 rounded-xl bg-[#121418] hover:bg-white/5 border border-[#1F242D] text-xs font-medium text-[#9CA3AF] hover:text-white transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Top Summary Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#121418] border border-[#1F242D] rounded-2xl p-5">
          <div className="flex items-center justify-between text-[#9CA3AF] text-xs font-medium mb-2">
            <span>Overall Attendance</span>
            <CheckCircle2 className="w-4 h-4 text-[#1E6BFF]" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white">{overallPercent}%</p>
          <p className="text-xs text-[#9CA3AF] mt-1">
            {totalAttended} / {totalConducted} total classes
          </p>
        </div>

        <div className="bg-[#121418] border border-[#1F242D] rounded-2xl p-5">
          <div className="flex items-center justify-between text-[#9CA3AF] text-xs font-medium mb-2">
            <span>Target Threshold</span>
            <Target className="w-4 h-4 text-[#1E6BFF]" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white">{targetPercent}%</p>
          <p className="text-xs text-[#9CA3AF] mt-1">Minimum required</p>
        </div>

        <div className="bg-[#121418] border border-[#1F242D] rounded-2xl p-5">
          <div className="flex items-center justify-between text-[#9CA3AF] text-xs font-medium mb-2">
            <span>Total Subjects</span>
            <BookOpen className="w-4 h-4 text-[#9CA3AF]" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white">{subjects.length}</p>
          <p className="text-xs text-[#9CA3AF] mt-1">Active this semester</p>
        </div>

        <div className="bg-[#121418] border border-[#1F242D] rounded-2xl p-5">
          <div className="flex items-center justify-between text-[#9CA3AF] text-xs font-medium mb-2">
            <span>Subjects in Danger</span>
            <ShieldAlert
              className={`w-4 h-4 ${dangerCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}
            />
          </div>
          <p
            className={`text-2xl sm:text-3xl font-bold ${
              dangerCount > 0 ? 'text-rose-400' : 'text-emerald-400'
            }`}
          >
            {dangerCount}
          </p>
          <p className="text-xs text-[#9CA3AF] mt-1">
            {dangerCount > 0 ? 'Below target threshold' : 'All subjects above target'}
          </p>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading State */}
      {loading && subjects.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="h-52 rounded-2xl bg-[#121418] border border-[#1F242D] animate-pulse"
            />
          ))}
        </div>
      ) : subjects.length === 0 ? (
        <div className="bg-[#121418] border border-[#1F242D] rounded-2xl p-10 text-center space-y-2">
          <BookOpen className="w-8 h-8 text-[#9CA3AF] mx-auto" />
          <p className="text-white font-medium">No subjects found</p>
          <p className="text-xs text-[#9CA3AF]">
            Use the Import tab (coming soon) or seed demo data to populate your subjects.
          </p>
        </div>
      ) : (
        /* Subject Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {subjects.map((sub) => {
            const cfg = statusConfig[sub.status] || statusConfig.NO_CLASSES;
            const progressWidth = Math.min(100, Math.max(0, sub.percentage || 0));

            return (
              <div
                key={sub._id}
                className="bg-[#121418] border border-[#1F242D] rounded-2xl p-6 flex flex-col justify-between space-y-5 hover:border-[#1E6BFF]/40 transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {sub.code && (
                        <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-[#0B0C10] border border-[#1F242D] text-[#9CA3AF]">
                          {sub.code}
                        </span>
                      )}
                      <span
                        className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${cfg.badge}`}
                      >
                        {cfg.label}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-white mt-2 truncate">
                      {sub.name}
                    </h3>
                    {sub.faculty && (
                      <p className="text-xs text-[#9CA3AF] mt-0.5 truncate">{sub.faculty}</p>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <span className={`text-3xl font-bold tracking-tight ${cfg.text}`}>
                      {sub.percentage}%
                    </span>
                    <p className="text-xs text-[#9CA3AF] mt-0.5">
                      {sub.attended} / {sub.conducted}
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="relative h-2.5 w-full rounded-full bg-[#0B0C10] border border-[#1F242D] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${cfg.bar}`}
                      style={{ width: `${progressWidth}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <p
                      className={`text-xs font-medium ${
                        sub.status === 'DANGER'
                          ? 'text-rose-400'
                          : sub.status === 'ON_TARGET'
                          ? 'text-[#EAB308]'
                          : 'text-[#9CA3AF]'
                      }`}
                    >
                      {getMathCallout(sub)}
                    </p>

                    <button
                      onClick={() => openEditBaseline(sub)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-[#9CA3AF] hover:text-white px-2.5 py-1 rounded-lg bg-[#0B0C10] hover:bg-white/5 border border-[#1F242D] transition shrink-0"
                    >
                      <Pencil className="w-3 h-3" />
                      Edit Baseline
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Baseline Modal */}
      {editingSubject && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#121418] border border-[#1F242D] rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Edit Mid-Semester Baseline</h2>
                <p className="text-xs text-[#9CA3AF] mt-1">
                  {editingSubject.name} ({editingSubject.code})
                </p>
              </div>
              <button
                onClick={() => setEditingSubject(null)}
                className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-white hover:bg-white/5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {baselineError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                {baselineError}
              </div>
            )}

            <form onSubmit={handleSaveBaseline} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#9CA3AF] mb-1.5">
                    Initial Attended
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={baselineForm.initialAttended}
                    onChange={(e) =>
                      setBaselineForm((prev) => ({ ...prev, initialAttended: e.target.value }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0C10] border border-[#1F242D] text-sm text-white focus:outline-none focus:border-[#1E6BFF]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#9CA3AF] mb-1.5">
                    Initial Conducted
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={baselineForm.initialConducted}
                    onChange={(e) =>
                      setBaselineForm((prev) => ({ ...prev, initialConducted: e.target.value }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0C10] border border-[#1F242D] text-sm text-white focus:outline-none focus:border-[#1E6BFF]"
                  />
                </div>
              </div>

              <p className="text-xs text-[#9CA3AF]">
                Tracked sessions ({editingSubject.trackedAttended || 0}/
                {editingSubject.trackedConducted || 0}) are automatically combined with this baseline.
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingSubject(null)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-[#9CA3AF] hover:text-white bg-[#0B0C10] border border-[#1F242D]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingBaseline}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#1E6BFF] hover:bg-[#1456d6] flex items-center gap-2 disabled:opacity-60"
                >
                  {savingBaseline && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Baseline
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
