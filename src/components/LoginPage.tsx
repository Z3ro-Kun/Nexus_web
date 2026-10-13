import React, { useState } from 'react';
import { api } from '../api.js';
import { UserRecord } from '../types.js';
import { ShieldCheck, Cpu, Lock, User, KeyRound, Sparkles, AlertCircle, ArrowRight, Eye, EyeOff, CheckCircle2 } from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess: (user: UserRecord) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanUser = username.trim();
    if (!cleanUser) {
      setError('Please enter a username or user ID');
      return;
    }
    if (!password) {
      setError('Please enter a password');
      return;
    }

    if (mode === 'register') {
      if (cleanUser.length < 3) {
        setError('Username must be at least 3 characters long');
        return;
      }
      if (password.length < 4) {
        setError('Password must be at least 4 characters long');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const user = await api.login(cleanUser, password);
        onLoginSuccess(user);
      } else {
        const user = await api.register(cleanUser, password, displayName.trim() || undefined);
        onLoginSuccess(user);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemo = (demoUser: string, demoPass: string) => {
    setMode('login');
    setUsername(demoUser);
    setPassword(demoPass);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-cyan-600/10 via-indigo-600/10 to-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* App Branding Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-900 border border-cyan-500/40 text-cyan-400 shadow-xl shadow-cyan-950/50 mb-2">
            <Cpu className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
            Autonomous Multi-Agent System
          </h1>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            Secure, user-isolated multi-agent platform with dedicated memory, private chat history, and DAG orchestration.
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl backdrop-blur-md p-6 space-y-6">
          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                mode === 'login'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                mode === 'register'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign Up (New User)
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">
                Username or User ID
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={mode === 'login' ? 'e.g. user_1 or user_a' : 'Choose a unique username'}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/80 transition-colors"
                />
              </div>
            </div>

            {mode === 'register' && (
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  Display Name <span className="text-slate-500">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Alex Turing"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/80 transition-colors"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-9 pr-10 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/80 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {mode === 'register' && (
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-300">Confirm Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat your password"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/80 transition-colors"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-semibold text-sm rounded-lg shadow-lg shadow-cyan-950/60 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>{mode === 'login' ? 'Sign In to Workspace' : 'Create Isolated Account'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Accounts Helper */}
          <div className="pt-2 border-t border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="font-semibold uppercase tracking-wider text-slate-500">Quick Test Accounts:</span>
              <span className="text-slate-500">Pass: password123</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleFillDemo('user_1', 'password123')}
                className="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-800/40 text-left transition-colors group cursor-pointer"
              >
                <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center text-[11px] font-bold shrink-0">
                  1
                </div>
                <div className="overflow-hidden">
                  <div className="text-xs font-medium text-slate-200 group-hover:text-cyan-300 truncate">User 1</div>
                  <div className="text-[10px] text-slate-500 font-mono">user_1</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => handleFillDemo('user_2', 'password123')}
                className="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-pink-500/50 hover:bg-slate-800/40 text-left transition-colors group cursor-pointer"
              >
                <div className="w-6 h-6 rounded-full bg-pink-500/20 text-pink-400 border border-pink-500/40 flex items-center justify-center text-[11px] font-bold shrink-0">
                  2
                </div>
                <div className="overflow-hidden">
                  <div className="text-xs font-medium text-slate-200 group-hover:text-pink-300 truncate">User 2</div>
                  <div className="text-[10px] text-slate-500 font-mono">user_2</div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Security & Memory Isolation Trust Badges */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-[11px] text-slate-400 space-y-2">
          <div className="flex items-center gap-2 text-cyan-400 font-medium">
            <Lock className="w-3.5 h-3.5" />
            <span>Strict User Session & Memory Isolation</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-teal-400 shrink-0" />
              <span>Private Chat History</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-teal-400 shrink-0" />
              <span>Token-Scoped Storage</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-teal-400 shrink-0" />
              <span>Isolated Agent Reasoning</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-teal-400 shrink-0" />
              <span>Protected Deliverables</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
