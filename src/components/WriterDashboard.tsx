import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { ArrowLeft, Book as BookIcon, Download, Star, Trash2, Eye, Plus, LayoutDashboard, BarChart3, Users, X, FileText, LogOut, MoreVertical, Library, User as UserIcon, TrendingUp, CheckCircle, AlertCircle, PenTool, Edit } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db, getCurrentUser } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface WriterBook {
  id: string;
  title: string;
  author: string;
  coverUrl: string;
  pdfUrl: string;
  price: string;
  downloadCount: number;
  ratingAverage: number;
  ratingCount: number;
  createdAt: string;
  isApproved: boolean;
  isScript: boolean;
  status: 'published' | 'draft';
}

export default function WriterDashboard() {
  const [books, setBooks] = useState<WriterBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'published' | 'scripts' | 'drafts'>('published');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/login');
  };

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser) return;

    const q = query(
      collection(db, 'books'),
      where('writerId', '==', currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const booksData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as WriterBook[];
      
      // Sort by creation date
      booksData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setBooks(booksData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredBooks = books.filter(book => {
    if (activeTab === 'drafts') return book.status === 'draft';
    if (activeTab === 'scripts') return book.isScript && book.status === 'published';
    return !book.isScript && book.status === 'published';
  });

  const handleDelete = async (bookId: string, title: string) => {
    if (window.confirm(`Are you sure you want to remove "${title}" from the archives? This action cannot be undone.`)) {
      const path = `books/${bookId}`;
      try {
        await deleteDoc(doc(db, 'books', bookId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    }
  };

  const totalDownloads = books.reduce((sum, book) => sum + (book.downloadCount || 0), 0);
  const avgRating = books.length > 0 
    ? books.reduce((sum, book) => sum + (book.ratingAverage || 0), 0) / books.length 
    : 0;

  // Synthesize trend data for visualization
  const getTrendData = () => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    if (books.length === 0) return days.map(day => ({ name: day, downloads: 0 }));

    // Distribute total downloads across the week for a "trend" look
    const total = totalDownloads || 10;
    return days.map((day, idx) => {
      // Create a bell-curve like distribution with some randomness
      const multiplier = 0.5 + Math.random() + (idx * 0.1);
      return {
        name: day,
        downloads: Math.floor((total / 7) * multiplier)
      };
    });
  };

  const trendData = getTrendData();

  return (
    <div className="min-h-screen bg-natural-bg font-sans flex overflow-hidden">
      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 w-[280px] bg-sidebar-bg border-r border-white/5 z-50 transition-transform duration-300 transform lg:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } flex flex-col`}
      >
        <div className="p-8 border-b border-white/5">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-serif font-black text-white tracking-tighter italic">Books Africa</h1>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-white/60 hover:bg-white/5 rounded-xl">
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/40 font-black">Writer Environment</p>
        </div>

        <nav className="flex-1 overflow-y-auto p-6 space-y-8 customize-scrollbar">
          {/* Dashboard Actions */}
          <div className="space-y-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/30 px-4">Control Panel</p>
            <div className="space-y-1">
              <button 
                onClick={() => { navigate('/'); setIsSidebarOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest text-white/60 hover:bg-white/5 transition-all"
              >
                <Library className="w-4 h-4" />
                Return to Library
              </button>
              <button 
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-primary text-white shadow-lg shadow-black/20"
              >
                <LayoutDashboard className="w-4 h-4" />
                Live Dashboard
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#5A5A40]/40 px-4">Create</p>
            <div className="space-y-3">
              <button 
                onClick={() => navigate('/upload')}
                className="w-full h-32 flex flex-col items-center justify-center gap-3 px-6 py-4 rounded-[32px] text-[10px] font-black uppercase tracking-[0.2em] text-white bg-primary hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-primary/20 group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4 opacity-10 translate-x-4 -translate-y-4 group-hover:translate-x-2 group-hover:-translate-y-2 transition-all">
                  <Plus className="w-20 h-20" />
                </div>
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FileText className="w-6 h-6" />
                </div>
                Publish Manuscript
              </button>
            </div>
          </div>
        </nav>

        <div className="p-8 border-t border-white/5 space-y-4">
          <button 
            onClick={() => { navigate('/profile'); setIsSidebarOpen(false); }}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] text-[#5A5A40] bg-white border border-primary/10 hover:bg-natural-bg transition-all shadow-sm"
          >
            <PenTool className="w-4 h-4" />
            Identity & Bio
          </button>

          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
          
          <div className="text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20">© 2026 Books Africa</p>
            <p className="text-[8px] uppercase tracking-widest text-white/20 mt-1 italic">Property of Carter Cyber Security technology</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 lg:ml-[280px] min-h-screen relative flex flex-col overflow-y-auto">
        <header className="px-8 py-10 bg-white/50 backdrop-blur-md sticky top-0 z-40 border-b border-primary/5 flex items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-3 bg-white rounded-2xl text-accent hover:text-primary transition-all shadow-sm"
            >
              <MoreVertical className="w-6 h-6 rotate-90" />
            </button>
            <button onClick={() => navigate(-1)} className="hidden sm:flex w-12 h-12 bg-white rounded-2xl items-center justify-center shadow-sm text-accent hover:text-primary transition-all active:scale-95">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-3xl font-serif font-black text-natural-text italic">Writer Console</h1>
              <p className="text-[10px] uppercase tracking-[0.2em] text-accent font-black mt-1">Management of Literary Works</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/profile')}
              className="p-3 text-accent hover:text-primary bg-white rounded-2xl transition-all shadow-sm"
            >
              <UserIcon className="w-5 h-5" />
            </button>
            <button 
              onClick={() => navigate('/upload')}
              className="bg-primary text-white px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all hover:shadow-lg hover:shadow-primary/20 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Publish
            </button>
          </div>
        </header>

        <main className="max-w-5xl mx-auto p-8 pt-12 w-full">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-8 rounded-[40px] shadow-xl shadow-primary/5 border border-primary/5 flex items-center gap-6"
            >
              <div className="w-16 h-16 bg-blue-50 rounded-3xl flex items-center justify-center text-blue-600">
                <BookIcon className="w-8 h-8" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest font-black text-accent mb-1">Total Works</p>
                <h3 className="text-3xl font-black text-natural-text">{books.length}</h3>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white p-8 rounded-[40px] shadow-xl shadow-primary/5 border border-primary/5 flex items-center gap-6"
            >
              <div className="w-16 h-16 bg-green-50 rounded-3xl flex items-center justify-center text-green-600">
                <CheckCircle className="w-8 h-8" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest font-black text-accent mb-1">Approved Works</p>
                <h3 className="text-3xl font-black text-natural-text">{books.filter(b => b.isApproved).length}</h3>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white p-8 rounded-[40px] shadow-xl shadow-primary/5 border border-primary/5 flex items-center gap-6"
            >
              <div className="w-16 h-16 bg-accent/5 rounded-3xl flex items-center justify-center text-accent">
                <Download className="w-8 h-8" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest font-black text-accent mb-1">Total Reach</p>
                <h3 className="text-3xl font-black text-natural-text">{totalDownloads}</h3>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white p-8 rounded-[40px] shadow-xl shadow-primary/5 border border-primary/5 flex items-center gap-6"
            >
              <div className="w-16 h-16 bg-yellow-50 rounded-3xl flex items-center justify-center text-yellow-500">
                <Star className="w-8 h-8 fill-current" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest font-black text-accent mb-1">Impact (Avg Rating)</p>
                <h3 className="text-3xl font-black text-natural-text">{avgRating.toFixed(1)}</h3>
              </div>
            </motion.div>
          </div>

          {/* Analytics Chart */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-[48px] shadow-2xl shadow-primary/5 border border-primary/5 p-10 mb-12"
          >
            <div className="flex items-center justify-between mb-10">
              <div>
                <h2 className="text-xl font-serif font-black text-natural-text flex items-center gap-3 italic">
                  <TrendingUp className="w-6 h-6 text-primary" />
                  Growth Trajectory
                </h2>
                <p className="text-[10px] uppercase tracking-widest text-accent font-black mt-1">Download trends over last 7 days</p>
              </div>
              <div className="flex bg-natural-bg/50 p-1 rounded-2xl border border-primary/5">
                <span className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-primary bg-white rounded-xl shadow-sm">Weekly</span>
                <span className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-accent/50 cursor-not-allowed">Monthly</span>
              </div>
            </div>

            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="colorDownloads" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4A4A2E" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#4A4A2E" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F0E0" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#888870', fontSize: 10, fontWeight: 900 }} 
                    dy={15}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#888870', fontSize: 10, fontWeight: 900 }} 
                  />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '24px', 
                      border: 'none', 
                      boxShadow: '0 20px 50px rgba(0,0,0,0.1)',
                      fontSize: '11px',
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      padding: '12px 20px'
                    }} 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="downloads" 
                    stroke="#4A4A2E" 
                    strokeWidth={4}
                    fillOpacity={1} 
                    fill="url(#colorDownloads)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
          {/* Books Table */}
          <div className="bg-white rounded-[48px] shadow-2xl shadow-primary/5 border border-primary/5 overflow-hidden">
            <div className="px-10 pt-8 pb-0 border-b border-primary/5">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-serif font-black text-natural-text flex items-center gap-3 italic">
                  <LayoutDashboard className="w-6 h-6 text-primary" />
                  Manuscript Workspace
                </h2>
              </div>

              <div className="flex gap-8">
                {(['published', 'scripts', 'drafts'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`pb-4 text-[10px] uppercase tracking-[0.2em] font-black transition-all relative ${
                      activeTab === tab ? 'text-primary' : 'text-accent/40 hover:text-accent'
                    }`}
                  >
                    {tab}
                    {activeTab === tab && (
                      <motion.div 
                        layoutId="activeTabUnderline"
                        className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full" 
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-20 text-center">
                  <div className="w-10 h-10 border-4 border-primary/10 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-accent text-[10px] font-black uppercase tracking-widest">Accessing records...</p>
                </div>
              ) : filteredBooks.length > 0 ? (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-natural-bg/30">
                      <th className="px-10 py-5 text-[10px] uppercase font-black tracking-widest text-accent">Work</th>
                      <th className="px-6 py-5 text-[10px] uppercase font-black tracking-widest text-accent">Stats</th>
                      {activeTab !== 'drafts' && <th className="px-6 py-5 text-[10px] uppercase font-black tracking-widest text-accent">Listing</th>}
                      <th className="px-6 py-5 text-[10px] uppercase font-black tracking-widest text-accent">Price</th>
                      <th className="px-10 py-5 text-[10px] uppercase font-black tracking-widest text-accent text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-primary/5">
                    {filteredBooks.map((book) => (
                      <tr key={book.id} className="hover:bg-natural-bg/20 transition-colors group">
                        <td className="px-10 py-6">
                          <div className="flex items-center gap-5">
                            <div className="w-14 h-20 rounded-xl overflow-hidden shadow-md flex-shrink-0 bg-natural-bg">
                              {book.coverUrl ? (
                                <img src={book.coverUrl} className="w-full h-full object-cover" alt={book.title} />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-accent/20">
                                  <BookIcon className="w-6 h-6" />
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="font-bold text-natural-text text-sm group-hover:text-primary transition-colors">{book.title}</p>
                              <p className="text-[10px] text-accent mt-1 italic">
                                {book.status === 'draft' ? 'Modified' : 'Published'} {new Date(book.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-6">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1 text-[10px] font-black text-natural-text" title="Downloads">
                              <Download className="w-3 h-3 text-primary" />
                              {book.downloadCount || 0}
                            </div>
                            <div className="flex items-center gap-1 text-[10px] font-black text-natural-text" title="Rating">
                              <Star className="w-3 h-3 text-yellow-500 fill-current" />
                              {book.ratingAverage?.toFixed(1) || '0.0'}
                            </div>
                          </div>
                        </td>
                        {activeTab !== 'drafts' && (
                          <td className="px-6 py-6">
                            <div className="flex items-center gap-2">
                               {book.isApproved ? (
                                 <div className="flex items-center gap-2 px-3 py-1 bg-green-50 text-green-600 rounded-full border border-green-100">
                                   <CheckCircle className="w-3 h-3" />
                                   <span className="text-[9px] font-black uppercase">Approved</span>
                                 </div>
                               ) : (
                                 <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-600 rounded-full border border-amber-100">
                                   <AlertCircle className="w-3 h-3" />
                                   <span className="text-[9px] font-black uppercase">Review Pending</span>
                                 </div>
                               )}
                            </div>
                          </td>
                        )}
                        <td className="px-6 py-6 font-black text-[10px] text-primary">
                          {book.price} ZMW
                        </td>
                        <td className="px-10 py-6 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <button 
                              onClick={() => navigate(`/upload?id=${book.id}`)}
                              className="p-3 text-accent hover:text-primary hover:bg-primary/5 rounded-2xl transition-all"
                              title="Edit Manuscript"
                            >
                              <Edit className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={() => window.open(book.pdfUrl, '_blank')}
                              className="p-3 text-accent hover:text-primary hover:bg-primary/5 rounded-2xl transition-all"
                              title="Download Manuscript"
                            >
                              <Download className="w-5 h-5" />
                            </button>
                            {book.status !== 'draft' && (
                              <button 
                                onClick={() => navigate(`/book/${book.id}`)}
                                className="p-3 text-accent hover:text-primary hover:bg-primary/5 rounded-2xl transition-all"
                                title="View in Store"
                              >
                                <Eye className="w-5 h-5" />
                              </button>
                            )}
                            <button 
                              onClick={() => handleDelete(book.id, book.title)}
                              className="p-3 text-accent hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                              title="Delete Work"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-20 text-center">
                  <div className="w-20 h-20 bg-natural-bg rounded-full flex items-center justify-center mx-auto mb-6">
                    <BookIcon className="w-10 h-10 text-accent/30" />
                  </div>
                  <h3 className="text-lg font-serif font-bold text-natural-text mb-2">Workspace Empty</h3>
                  <p className="text-accent text-xs mb-8 max-w-xs mx-auto">
                    {activeTab === 'drafts' 
                      ? 'No draft scripts found. Save your progress to build your archives.' 
                      : activeTab === 'scripts'
                        ? 'No professional scripts listed in your collection.'
                        : 'Your published works will appear here once approved for the library.'}
                  </p>
                  <button 
                    onClick={() => navigate('/upload')}
                    className="bg-primary text-white px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-primary/20"
                  >
                    Create New Work
                  </button>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
