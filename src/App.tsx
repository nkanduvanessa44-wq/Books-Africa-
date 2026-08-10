import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { onSnapshot, doc } from 'firebase/firestore';
import { auth, db } from './lib/firebase';

import MobileAppShell from './components/MobileAppShell';
import Splash from './components/Splash';
import Login from './components/Login';
import Register from './components/Register';
import Home from './components/Home';
import Upload from './components/Upload';
import BookDetails from './components/BookDetails';
import Profile from './components/Profile';
import WriterDashboard from './components/WriterDashboard';
import AdminDashboard from './components/AdminDashboard';
import { Toaster } from 'sonner';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = null;
      }

      if (currentUser) {
        unsubscribeDoc = onSnapshot(doc(db, 'users', currentUser.uid), (snapshot) => {
          if (snapshot.exists()) {
            setUserRole(snapshot.data().role || 'customer');
          } else {
            setUserRole('customer');
          }
          setLoading(false);
        }, (error) => {
          console.error("User document listen error:", error);
          setUserRole('customer');
          setLoading(false);
        });
      } else {
        setUserRole(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, []);

  if (loading) return <Splash />;

  return (
    <Router>
      <MobileAppShell user={user} role={userRole}>
        <Routes>
          <Route path="/" element={user ? <Home user={user} role={userRole} /> : <Navigate to="/login" />} />
          <Route path="/profile" element={user ? <Profile user={user} role={userRole} /> : <Navigate to="/login" />} />
          <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
          <Route path="/register" element={!user ? <Register /> : <Navigate to="/" />} />
          <Route path="/upload" element={user && userRole === 'writer' ? <Upload /> : <Navigate to="/" />} />
          <Route path="/dashboard" element={user && userRole === 'writer' ? <WriterDashboard /> : <Navigate to="/" />} />
          <Route path="/admin" element={user && userRole === 'admin' ? <AdminDashboard /> : <Navigate to="/" />} />
          <Route path="/book/:id" element={<BookDetails />} />
        </Routes>
      </MobileAppShell>
      <Toaster position="top-center" richColors />
    </Router>
  );
}
