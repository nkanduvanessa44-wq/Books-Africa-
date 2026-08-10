import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { UserPlus, Chrome, KeyRound, ExternalLink, ShieldAlert, CheckCircle2 } from 'lucide-react';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'customer' | 'writer'>('customer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isAuthDisabled, setIsAuthDisabled] = useState(false);
  const navigate = useNavigate();

  const saveUserToFirestore = async (user: any, userName: string, userEmail: string, userRole: string) => {
    const path = `users/${user.uid}`;
    try {
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        name: userName || user.displayName || 'Anonymous',
        email: userEmail || user.email || '',
        role: userRole,
        createdAt: new Date().toISOString()
      });
    } catch (fErr) {
      handleFirestoreError(fErr, OperationType.WRITE, path);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setIsAuthDisabled(false);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await saveUserToFirestore(userCredential.user, name, email, role);
      navigate('/');
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed') {
        setIsAuthDisabled(true);
        setError('Email/Password registration is disabled in Firebase. Use Google Login or enable it in Firebase Console.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    setLoading(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // Check if user already exists in Firestore to avoid overwriting their role
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        await saveUserToFirestore(user, user.displayName || '', user.email || '', role);
      }
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-amber-500/10 via-emerald-900/10 to-teal-900/20 backdrop-blur-3xl">
      <div className="w-full max-w-md bg-white/75 backdrop-blur-2xl rounded-[40px] shadow-2xl p-8 md:p-10 border border-white/60 relative overflow-hidden">
        {/* Subtle decorative glass glow accents */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col items-center mb-8 relative z-10">
          <div className="w-20 h-20 bg-gradient-to-br from-primary/20 to-emerald-600/20 text-primary rounded-[28px] flex items-center justify-center mb-4 border border-white/80 shadow-lg shadow-primary/10">
            <UserPlus className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-serif font-black italic text-primary">Books Africa</h2>
          <p className="text-accent text-xs font-black uppercase tracking-widest mt-1">Register Account Access</p>
        </div>

        {error && (
          <div className="bg-red-500/10 backdrop-blur-md text-red-700 p-4 rounded-2xl text-xs font-medium mb-6 border border-red-500/20 flex flex-col gap-1.5">
            <span className="font-bold flex items-center gap-1.5 text-red-800">
              <ShieldAlert className="w-4 h-4 text-red-600" /> Security Notice
            </span>
            <p>{error}</p>
          </div>
        )}

        {isAuthDisabled && (
          <div className="mb-6 p-5 bg-white/80 backdrop-blur-md border border-primary/20 rounded-[28px] text-xs text-natural-text space-y-3.5 shadow-sm">
            <div className="flex items-center gap-2 text-primary">
              <KeyRound className="w-4 h-4 text-primary animate-pulse" />
              <span className="font-black uppercase tracking-wider text-[10px]">How to Enable Email/Password Sign-In</span>
            </div>
            
            <p className="text-accent leading-relaxed font-serif">
              Firebase projects require Email/Password login to be explicitly toggled on in the console dashboard. If you have admin access, you can enable it in seconds:
            </p>

            <ol className="list-decimal list-inside space-y-2 text-accent/90 font-sans">
              <li>Open the <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-primary hover:underline font-bold inline-flex items-center gap-0.5">Firebase Console <ExternalLink className="w-3 h-3" /></a></li>
              <li>Under the <strong>Build</strong> menu on the left sidebar, click <strong>Authentication</strong></li>
              <li>Navigate to the <strong>Sign-in method</strong> tab at the top</li>
              <li>Click <strong>Add new provider</strong> and choose <strong>Email/Password</strong></li>
              <li>Toggle <strong>Enable</strong> and click <strong>Save</strong>!</li>
            </ol>

            <div className="pt-2 border-t border-primary/10">
              <p className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-primary" /> Alternate Option:
              </p>
              <p className="mt-1 text-accent/80 font-sans">
                You can register and sign in instantly using the <strong>Google Login</strong> option below without any project configuration.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4 relative z-10">
          <div>
            <label className="block text-[10px] uppercase font-black tracking-widest text-accent mb-2">Full Name</label>
            <input
              type="text"
              required
              className="w-full px-5 py-3.5 bg-white/60 border border-white/80 rounded-2xl text-sm font-bold text-natural-text placeholder-accent/40 focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white outline-none transition backdrop-blur-md shadow-inner"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase font-black tracking-widest text-accent mb-2">Email</label>
            <input
              type="email"
              required
              className="w-full px-5 py-3.5 bg-white/60 border border-white/80 rounded-2xl text-sm font-bold text-natural-text placeholder-accent/40 focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white outline-none transition backdrop-blur-md shadow-inner"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase font-black tracking-widest text-accent mb-2">Password</label>
            <input
              type="password"
              required
              className="w-full px-5 py-3.5 bg-white/60 border border-white/80 rounded-2xl text-sm font-bold text-natural-text placeholder-accent/40 focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white outline-none transition backdrop-blur-md shadow-inner"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          
          <div>
            <label className="block text-[10px] uppercase font-black tracking-widest text-accent mb-3">Choose Account Type:</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setRole('customer')}
                className={`flex-1 p-4 rounded-2xl border transition text-left backdrop-blur-md ${
                  role === 'customer' ? 'border-primary bg-primary/10 text-primary shadow-md' : 'border-white/80 text-accent/70 bg-white/40 hover:bg-white/60'
                }`}
              >
                <p className="font-black text-xs uppercase tracking-wider">Reader</p>
                <p className="text-[10px] opacity-80 mt-1 leading-snug">Read & download books</p>
              </button>
              <button
                type="button"
                onClick={() => setRole('writer')}
                className={`flex-1 p-4 rounded-2xl border transition text-left backdrop-blur-md ${
                  role === 'writer' ? 'border-primary bg-primary/10 text-primary shadow-md' : 'border-white/80 text-accent/70 bg-white/40 hover:bg-white/60'
                }`}
              >
                <p className="font-black text-xs uppercase tracking-wider">Writer</p>
                <p className="text-[10px] opacity-80 mt-1 leading-snug">Publish works & manuscripts</p>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary-dark text-white font-black text-xs uppercase tracking-[0.2em] py-4.5 rounded-2xl transition transform active:scale-95 disabled:opacity-50 shadow-xl shadow-primary/20 mt-6"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-primary/10"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-black tracking-widest">
              <span className="px-4 bg-white/80 backdrop-blur-md text-accent/60 rounded-full border border-white">Or Connect Google</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleRegister}
            disabled={loading}
            className="w-full bg-white/90 border border-white/80 hover:border-primary/40 text-natural-text font-black text-xs uppercase tracking-widest py-4 rounded-2xl transition flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 shadow-md backdrop-blur-md"
          >
            <Chrome className="w-5 h-5 text-red-500" />
            Connect via Google
          </button>
        </form>

        <p className="mt-8 text-center text-accent text-sm font-medium relative z-10">
          Already have an account?{' '}
          <Link to="/login" className="text-primary font-black hover:underline underline-offset-4">
            Login here
          </Link>
        </p>
      </div>
    </div>
  );
}
