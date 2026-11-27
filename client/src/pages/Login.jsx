import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { GraduationCap, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  const fillDemoCredentials = () => {
    setEmail('demo@presentsir.app');
    setPassword('Password123!');
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to sign in. Please check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0C10] text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#1E6BFF]/15 border border-[#1E6BFF]/30 text-[#1E6BFF] mb-2">
            <GraduationCap className="w-6 h-6" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            Present <span className="text-[#1E6BFF]">Sir</span>
          </h1>
          <p className="text-sm text-[#9CA3AF]">
            Sign in to your deterministic attendance co-pilot
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-[#121418] border border-[#1F242D] rounded-2xl p-6 sm:p-8 shadow-2xl space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Welcome back</h2>
            <button
              type="button"
              onClick={fillDemoCredentials}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-[#1E6BFF]/10 hover:bg-[#1E6BFF]/20 text-[#1E6BFF] border border-[#1E6BFF]/30 transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Fill Demo Credentials
            </button>
          </div>

          {error && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#9CA3AF] mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="demo@presentsir.app"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0C10] border border-[#1F242D] text-sm text-white placeholder-[#9CA3AF]/50 focus:outline-none focus:border-[#1E6BFF] transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#9CA3AF] mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0C10] border border-[#1F242D] text-sm text-white placeholder-[#9CA3AF]/50 focus:outline-none focus:border-[#1E6BFF] transition"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 rounded-xl bg-[#1E6BFF] hover:bg-[#1456d6] text-white font-semibold text-sm transition flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <p className="text-center text-xs text-[#9CA3AF] pt-2 border-t border-[#1F242D]">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="text-[#1E6BFF] hover:underline font-medium">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
