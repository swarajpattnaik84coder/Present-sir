import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { GraduationCap, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    collegeId: 'COL001',
    department: 'Computer Science',
    semester: 5,
    section: 'A',
    targetPercent: 75,
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await register({
        ...form,
        semester: Number(form.semester) || 1,
        targetPercent: Number(form.targetPercent) || 75,
      });
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0C10] text-white flex items-center justify-center p-4 py-10">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#1E6BFF]/15 border border-[#1E6BFF]/30 text-[#1E6BFF] mb-2">
            <GraduationCap className="w-6 h-6" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            Join Present <span className="text-[#1E6BFF]">Sir</span>
          </h1>
          <p className="text-sm text-[#9CA3AF]">
            Create your student profile for cohort &amp; attendance tracking
          </p>
        </div>

        <div className="bg-[#121418] border border-[#1F242D] rounded-2xl p-6 sm:p-8 shadow-2xl space-y-5">
          {error && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-[#9CA3AF] mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Swaraj Demo"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0C10] border border-[#1F242D] text-sm text-white placeholder-[#9CA3AF]/50 focus:outline-none focus:border-[#1E6BFF]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-[#9CA3AF] mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  value={form.email}
                  onChange={handleChange}
                  placeholder="student@college.edu"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0C10] border border-[#1F242D] text-sm text-white placeholder-[#9CA3AF]/50 focus:outline-none focus:border-[#1E6BFF]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-[#9CA3AF] mb-1.5">
                  Password (min 6 characters)
                </label>
                <input
                  type="password"
                  name="password"
                  required
                  minLength={6}
                  value={form.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0C10] border border-[#1F242D] text-sm text-white placeholder-[#9CA3AF]/50 focus:outline-none focus:border-[#1E6BFF]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#9CA3AF] mb-1.5">
                  College ID
                </label>
                <input
                  type="text"
                  name="collegeId"
                  value={form.collegeId}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0C10] border border-[#1F242D] text-sm text-white focus:outline-none focus:border-[#1E6BFF]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#9CA3AF] mb-1.5">
                  Department
                </label>
                <input
                  type="text"
                  name="department"
                  value={form.department}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0C10] border border-[#1F242D] text-sm text-white focus:outline-none focus:border-[#1E6BFF]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#9CA3AF] mb-1.5">
                  Semester
                </label>
                <input
                  type="number"
                  name="semester"
                  min={1}
                  max={12}
                  value={form.semester}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0C10] border border-[#1F242D] text-sm text-white focus:outline-none focus:border-[#1E6BFF]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#9CA3AF] mb-1.5">
                  Section
                </label>
                <input
                  type="text"
                  name="section"
                  value={form.section}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0C10] border border-[#1F242D] text-sm text-white focus:outline-none focus:border-[#1E6BFF]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-[#9CA3AF] mb-1.5">
                  Target Attendance (%)
                </label>
                <input
                  type="number"
                  name="targetPercent"
                  min={1}
                  max={100}
                  value={form.targetPercent}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0C10] border border-[#1F242D] text-sm text-white focus:outline-none focus:border-[#1E6BFF]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 rounded-xl bg-[#1E6BFF] hover:bg-[#1456d6] text-white font-semibold text-sm transition flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <p className="text-center text-xs text-[#9CA3AF] pt-2 border-t border-[#1F242D]">
            Already have an account?{' '}
            <Link to="/login" className="text-[#1E6BFF] hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
