import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, updateProfile, verifyBeforeUpdateEmail, sendEmailVerification } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { ArrowLeft, User as UserIcon, Mail, Shield, CheckCircle2, AlertCircle, LayoutDashboard, PenTool, Camera, Loader2, AtSign } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { auth, db, storage } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

export default function Profile({ user, role }: { user: User; role: string | null }) {
  const [name, setName] = useState(user.displayName || '');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState(user.email || '');
  const [penName, setPenName] = useState('');
  const [bio, setBio] = useState('');
  const [photoUrl, setPhotoUrl] = useState(user.photoURL || '');
  const [newPhoto, setNewPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(user.photoURL || null);
  const [isApplying, setIsApplying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [userMetadata, setUserMetadata] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserData = async () => {
      const sandboxUserStr = localStorage.getItem('sandbox_user');
      if (sandboxUserStr) {
        try {
          const parsed = JSON.parse(sandboxUserStr);
          setUserMetadata(parsed);
          setName(parsed.name || '');
          setUsername(parsed.username || '');
          setPenName(parsed.penName || '');
          setBio(parsed.bio || '');
          if (parsed.photoUrl) {
            setPhotoUrl(parsed.photoUrl);
            setPhotoPreview(parsed.photoUrl);
          }
          return;
        } catch (e) {}
      }
      const path = `users/${user.uid}`;
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserMetadata(data);
          setName(data.name || '');
          setUsername(data.username || '');
          setPenName(data.penName || '');
          setBio(data.bio || '');
          if (data.photoUrl) {
            setPhotoUrl(data.photoUrl);
            setPhotoPreview(data.photoUrl);
          }
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, path);
      }
    };
    fetchUserData();
  }, [user.uid]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be less than 5MB');
        return;
      }
      setNewPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const path = `users/${user.uid}`;
    try {
      const sandboxUserStr = localStorage.getItem('sandbox_user');
      if (sandboxUserStr) {
        const parsed = JSON.parse(sandboxUserStr);
        const updatedSandboxUser = {
          ...parsed,
          name,
          username,
          penName: penName || '',
          bio,
          photoUrl: photoPreview || photoUrl
        };
        localStorage.setItem('sandbox_user', JSON.stringify(updatedSandboxUser));
        setUserMetadata(updatedSandboxUser);
        toast.success('Profile credentials synchronized successfully! (Sandbox Mode)');
        setLoading(false);
        return;
      }

      let finalPhotoUrl = photoUrl;

      if (newPhoto) {
        setPhotoLoading(true);
        toast.info('Uploading profile identity...');
        const photoRef = ref(storage, `avatars/${user.uid}-${Date.now()}`);
        
        // Use resumable with timeout
        const uploadTask = uploadBytesResumable(photoRef, newPhoto);
        
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            uploadTask.cancel();
            reject(new Error('Profile photo upload timed out. Please try a smaller image.'));
          }, 60000); // 60s for a profile photo is plenty

          uploadTask.on('state_changed', 
            null,
            (err) => {
              clearTimeout(timeout);
              reject(err);
            },
            () => {
              clearTimeout(timeout);
              resolve();
            }
          );
        });

        finalPhotoUrl = await getDownloadURL(photoRef);
        setPhotoUrl(finalPhotoUrl);
        setPhotoLoading(false);
      }

      await updateProfile(user, { 
        displayName: name,
        photoURL: finalPhotoUrl
      });
      
      await updateDoc(doc(db, 'users', user.uid), {
        name,
        username,
        penName: penName || '',
        bio,
        photoUrl: finalPhotoUrl,
        updatedAt: new Date().toISOString()
      });

      if (email !== user.email) {
        try {
          await verifyBeforeUpdateEmail(user, email);
          toast.success('Identity updated. Verification link sent to new email.');
        } catch (emailErr: any) {
          if (emailErr.code === 'auth/requires-recent-login') {
            toast.error('Please re-authenticate to change sensitive email data.');
            setLoading(false);
            return;
          }
          throw emailErr;
        }
      } else {
        toast.success('Profile credentials synchronized successfully!');
      }
    } catch (error: any) {
      toast.error('Failed to commit changes: ' + error.message);
      handleFirestoreError(error, OperationType.UPDATE, path);
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setLoading(true);
    try {
      await sendEmailVerification(user);
      toast.success('New verification beacon transmitted.');
    } catch (error: any) {
      if (error.code === 'auth/too-many-requests') {
        toast.error('Cooldown active. Try again later.');
      } else {
        toast.error('Signal failure. Resend failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBecomeWriter = async () => {
    setIsApplying(true);
    const sandboxUserStr = localStorage.getItem('sandbox_user');
    if (sandboxUserStr) {
      try {
        const parsed = JSON.parse(sandboxUserStr);
        const updatedSandboxUser = {
          ...parsed,
          role: 'writer',
          hasAppliedAsWriter: true
        };
        localStorage.setItem('sandbox_user', JSON.stringify(updatedSandboxUser));
        toast.success('Welcome to the Author Guild! Your account is now a Writer account. (Sandbox Mode)');
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } catch (e) {}
      setIsApplying(false);
      return;
    }

    const path = `users/${user.uid}`;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        role: 'writer',
        hasAppliedAsWriter: true,
        updatedAt: new Date().toISOString()
      });
      toast.success('Welcome to the Author Guild! Your account is now a Writer account.');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      toast.error('Failed to elevate account: ' + err.message);
      handleFirestoreError(err, OperationType.UPDATE, path);
    } finally {
      setIsApplying(false);
    }
  };

  const handleBecomeReader = async () => {
    setIsApplying(true);
    const sandboxUserStr = localStorage.getItem('sandbox_user');
    if (sandboxUserStr) {
      try {
        const parsed = JSON.parse(sandboxUserStr);
        const updatedSandboxUser = {
          ...parsed,
          role: 'customer'
        };
        localStorage.setItem('sandbox_user', JSON.stringify(updatedSandboxUser));
        toast.success('Account switched back to Reader mode. (Sandbox Mode)');
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } catch (e) {}
      setIsApplying(false);
      return;
    }

    const path = `users/${user.uid}`;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        role: 'customer',
        updatedAt: new Date().toISOString()
      });
      toast.success('Account switched back to Reader mode.');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      toast.error('Failed to switch account: ' + err.message);
      handleFirestoreError(err, OperationType.UPDATE, path);
    } finally {
      setIsApplying(false);
    }
  };

  const container = {
    hidden: { opacity: 1 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-screen bg-natural-bg font-sans pb-20">
      <header className="sticky top-0 z-30 px-6 py-6 bg-white/80 backdrop-blur-xl border-b border-primary/5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)} 
            className="w-10 h-10 flex items-center justify-center rounded-2xl bg-primary/5 text-primary hover:bg-primary hover:text-white transition-all shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-serif font-black text-primary">Identity</h1>
            <p className="text-[9px] uppercase tracking-[0.2em] text-accent font-black">Authorized Personnel Only</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        <motion.div 
          variants={container}
          initial="hidden"
          animate="show"
          className="space-y-8"
        >
          {/* Hero Section */}
          <motion.div variants={item} className="bg-white rounded-[40px] p-8 shadow-2xl shadow-primary/5 border border-primary/5 flex flex-col items-center text-center">
            <div className="relative mb-6 group p-1 bg-white rounded-[36px] shadow-xl">
              <div className="w-24 h-24 bg-primary/10 rounded-[32px] overflow-hidden flex items-center justify-center text-primary shadow-inner border border-primary/5">
                {photoPreview ? (
                  <img src={photoPreview} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  role === 'writer' ? <PenTool className="w-10 h-10" /> : <UserIcon className="w-10 h-10" />
                )}
                {photoLoading && (
                  <div className="absolute inset-0 bg-primary/40 backdrop-blur-sm flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-white animate-spin" />
                  </div>
                )}
              </div>
              <label 
                htmlFor="avatar-upload"
                className="absolute -bottom-2 -right-2 w-10 h-10 bg-primary text-white rounded-2xl flex items-center justify-center shadow-xl cursor-pointer hover:scale-110 transition-all border-4 border-white"
              >
                <Camera className="w-5 h-5" />
                <input 
                  id="avatar-upload"
                  type="file" 
                  className="hidden" 
                  accept="image/*"
                  onChange={handlePhotoChange}
                />
              </label>
              {user.emailVerified && (
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 text-white rounded-lg flex items-center justify-center shadow-lg border-2 border-white">
                  <CheckCircle2 className="w-3 h-3" />
                </div>
              )}
            </div>
            <h2 className="text-2xl font-serif font-black text-primary">
              {penName && role === 'writer' ? penName : (name || 'Nameless Reader')}
            </h2>
            {penName && role === 'writer' && name && (
              <p className="text-[10px] font-bold text-accent mt-1 uppercase tracking-widest">aka {name}</p>
            )}
            <div className="mt-3 flex items-center gap-2 px-4 py-1.5 bg-primary/5 text-primary rounded-full border border-primary/10">
              <Shield className="w-3.5 h-3.5" />
              <span className="text-[10px] font-black uppercase tracking-[0.1em]">
                {role === 'writer' ? 'Authorized Author' : 'Registered Reader'}
              </span>
            </div>
          </motion.div>

          {/* Account Role Management Panel */}
          <motion.div variants={item} className="bg-white rounded-[32px] p-6 shadow-xl border border-primary/5 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/5 text-primary rounded-2xl flex items-center justify-center">
                {role === 'writer' ? <PenTool className="w-6 h-6" /> : <UserIcon className="w-6 h-6" />}
              </div>
              <div className="text-left">
                <p className="text-[10px] font-black uppercase tracking-widest text-accent">Account Level</p>
                <p className="text-sm font-black text-primary font-serif">
                  {role === 'writer' ? 'Authorized Writer Mode' : 'Standard Reader Mode'}
                </p>
                <p className="text-[10px] text-gray-500 mt-1 max-w-xs leading-relaxed">
                  {role === 'writer' 
                    ? 'Publish your manuscripts, design custom covers, and access writer analytics.' 
                    : 'Unlock full publisher features by converting your profile to an Author account.'}
                </p>
              </div>
            </div>
            
            {role === 'writer' ? (
              <button
                type="button"
                onClick={handleBecomeReader}
                disabled={isApplying}
                className="w-full md:w-auto px-6 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition flex items-center justify-center gap-2"
              >
                {isApplying ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UserIcon className="w-4 h-4" />
                )}
                Switch to Reader
              </button>
            ) : (
              <button
                type="button"
                onClick={handleBecomeWriter}
                disabled={isApplying}
                className="w-full md:w-auto px-6 py-3.5 bg-primary hover:bg-primary-dark text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 hover:scale-105"
              >
                {isApplying ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <PenTool className="w-4 h-4" />
                )}
                Become a Writer
              </button>
            )}
          </motion.div>

          {/* Verification Card */}
          {!user.emailVerified && (
            <motion.div variants={item} className="bg-amber-50 border border-amber-100 rounded-[32px] p-6 flex flex-col md:flex-row items-center gap-6">
              <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <p className="text-xs font-black text-amber-900 uppercase tracking-wider">Unverified Email</p>
                <p className="text-[10px] text-amber-700 font-bold mt-1 leading-relaxed">
                  Your account is currently limited. Please verify your email to unlock global publication and secure transactions.
                </p>
              </div>
              <button 
                onClick={handleResendVerification}
                disabled={loading}
                className="w-full md:w-auto mt-2 md:mt-0 px-6 py-3 bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-700 transition-all disabled:opacity-50 shadow-lg shadow-amber-600/10"
              >
                {loading ? 'Sending...' : 'Resend Link'}
              </button>
            </motion.div>
          )}

          <form onSubmit={handleUpdate} className="space-y-8 pb-20">
            {/* Core Info */}
            <motion.div variants={item} className="bg-white rounded-[40px] p-8 shadow-2xl shadow-primary/5 border border-primary/5">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-8 ml-1 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary" />
                Core Credentials
              </h3>
              
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-accent/60 ml-1">Legal Name</label>
                    <div className="relative group">
                      <UserIcon className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-accent transition-colors group-focus-within:text-primary" />
                      <input 
                        type="text"
                        placeholder="Your full name"
                        className="w-full bg-natural-bg border border-primary/5 rounded-[20px] pl-14 pr-6 py-4 text-sm font-bold text-primary focus:outline-none focus:border-primary/20 focus:bg-white transition-all shadow-inner"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-accent/60 ml-1">Username</label>
                    <div className="relative group">
                      <AtSign className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-accent transition-colors group-focus-within:text-primary" />
                      <input 
                        type="text"
                        placeholder="Unique handle"
                        className="w-full bg-natural-bg border border-primary/5 rounded-[20px] pl-14 pr-6 py-4 text-sm font-bold text-primary focus:outline-none focus:border-primary/20 focus:bg-white transition-all shadow-inner"
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[9px] font-black uppercase tracking-[0.2em] text-accent/60 ml-1">Secure Email</label>
                  <div className="relative group">
                    <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-accent transition-colors group-focus-within:text-primary" />
                    <input 
                      type="email"
                      className="w-full bg-natural-bg border border-primary/5 rounded-[20px] pl-14 pr-6 py-4 text-sm font-bold text-primary focus:outline-none focus:border-primary/20 focus:bg-white transition-all shadow-inner"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[9px] font-black uppercase tracking-[0.2em] text-accent/60 ml-1">Short Biography</label>
                  <textarea 
                    className="w-full bg-natural-bg border border-primary/5 rounded-[24px] px-6 py-5 text-sm font-bold text-primary min-h-[140px] focus:outline-none focus:border-primary/20 focus:bg-white transition-all shadow-inner resize-none"
                    placeholder="Tell your readers your story..."
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                  />
                </div>
              </div>
            </motion.div>

            {/* Author Extras */}
            {(role === 'writer' || userMetadata?.role === 'writer') && (
              <motion.div variants={item} className="bg-white rounded-[40px] p-8 shadow-2xl shadow-primary/5 border border-primary/5">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-8 ml-1 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  Author Identity
                </h3>

                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-accent/60 ml-1">Author Pen Name</label>
                    <div className="relative group">
                      <PenTool className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-accent transition-colors group-focus-within:text-primary" />
                      <input 
                        type="text"
                        placeholder="e.g. Victor Kanyama"
                        className="w-full bg-natural-bg border border-primary/5 rounded-[20px] pl-14 pr-6 py-4 text-sm font-bold text-primary focus:outline-none focus:border-primary/20 focus:bg-white transition-all shadow-inner"
                        value={penName}
                        onChange={(e) => setPenName(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Save Button */}
            <div className="pt-4 flex justify-center">
              <button
                type="submit"
                disabled={loading}
                className="px-12 py-5 bg-primary text-white font-black uppercase tracking-[0.3em] text-[10px] rounded-[24px] shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-95 disabled:opacity-50 transition-all flex items-center gap-4"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Commit Changes
              </button>
            </div>
          </form>
        </motion.div>
      </main>
    </div>
  );
}
