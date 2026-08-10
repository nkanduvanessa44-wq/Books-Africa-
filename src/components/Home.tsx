import React, { useEffect, useState } from 'react';
import { User, signOut } from 'firebase/auth';
import { updateDoc, doc, collection, onSnapshot, query, where, getDoc, setDoc, increment } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import { auth, db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { Plus, LogOut, Book as BookIcon, DownloadCloud, Library, Search, User as UserIcon, ArrowUpDown, Star, FolderPlus, Tag, MoreVertical, X, LayoutDashboard, BookOpen, PenTool, Database, Loader2, ShieldCheck, ShoppingBag, TrendingUp, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { keys, get, set } from 'idb-keyval';
import { decryptToBlob } from '../lib/encryption';
import { seedBooks } from '../lib/seed';
import { getAllLocalProgress, ReadingProgress } from '../lib/progress';

interface Book {
  id: string;
  title: string;
  author: string;
  price: string;
  coverUrl: string;
  description?: string;
  isOffline?: boolean;
  ratingAverage?: number;
  ratingCount?: number;
  category?: string;
  ageRating?: string;
  downloadCount?: number;
}



export default function Home({ user, role }: { user: User; role: string | null }) {
  const [books, setBooks] = useState<Book[]>([]);
  const [offlineBooks, setOfflineBooks] = useState<Book[]>([]);
  const [offlineCategories, setOfflineCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [view, setView] = useState<'all' | 'offline'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'none' | 'price-asc' | 'price-desc'>('none');
  const [assigningCategoryId, setAssigningCategoryId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCategoriesExpanded, setIsCategoriesExpanded] = useState(true);
  const [userMetadata, setUserMetadata] = useState<any>(null);
  const [progressMap, setProgressMap] = useState<Record<string, ReadingProgress>>({});
  const navigate = useNavigate();

  const storeCategories = ['Fiction', 'Non-Fiction', 'Poetry', 'Academic', 'History', 'Education', 'Traditional', 'Contemporary', 'Drama', 'Biography', 'Other'];

  const processSyncQueue = async () => {
    if (!navigator.onLine) return;
    const queue = await get('sync_queue') || [];
    if (queue.length === 0) return;

    console.log(`Processing ${queue.length} sync operations...`);
    const remaining = [];
    
    for (const op of queue) {
      try {
        if (op.type === 'rate') {
          const { bookId, data } = op;
          const { userId, rating, oldRating } = data;
          
          const bookRef = doc(db, 'books', bookId);
          const ratingRef = doc(db, 'books', bookId, 'ratings', userId);
          
          await setDoc(ratingRef, {
            userId,
            rating,
            createdAt: new Date().toISOString()
          });

          const bookSnap = await getDoc(bookRef);
          if (bookSnap.exists()) {
            const bData = bookSnap.data();
            const currentAvg = bData.ratingAverage || 0;
            const currentCount = bData.ratingCount || 0;

            let newAvg, newCount;
            if (oldRating === null || oldRating === undefined) {
              newCount = currentCount + 1;
              newAvg = ((currentAvg * currentCount) + rating) / newCount;
            } else {
              newCount = currentCount;
              newAvg = ((currentAvg * currentCount) - oldRating + rating) / newCount;
            }

            await updateDoc(bookRef, {
              ratingAverage: newAvg,
              ratingCount: newCount,
              updatedAt: new Date().toISOString()
            });
          }
        } else if (op.type === 'download') {
          await updateDoc(doc(db, 'books', op.bookId), {
            downloadCount: increment(1),
            updatedAt: new Date().toISOString()
          });
        }
      } catch (err) {
        console.error('Failed to sync operation:', op, err);
        remaining.push(op);
      }
    }
    
    await set('sync_queue', remaining);
    if (remaining.length === 0) {
      console.log('Sync completed successfully.');
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      processSyncQueue();
    };

    window.addEventListener('online', handleOnline);
    processSyncQueue(); // Run once on mount if online

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  const loadOfflineData = async () => {
    // Fetch categories
    const categories = await get('offline_categories') || [];
    setOfflineCategories(categories);

    // Refresh all reading progress
    setProgressMap(getAllLocalProgress());

    // Fetch from IndexedDB
    const allKeys = await keys();
    const bookKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith('book_'));
    const downloadedBooks = await Promise.all(
      bookKeys.map(async k => {
        const data = await get(k);
        return { ...data, isOffline: true } as Book;
      })
    );
    setOfflineBooks(downloadedBooks);
  };

  useEffect(() => {
    const sandboxUserStr = localStorage.getItem('sandbox_user');
    let unsubscribeUser = () => {};
    if (sandboxUserStr) {
      try {
        const parsed = JSON.parse(sandboxUserStr);
        setUserMetadata(parsed);
      } catch (e) {}
    } else {
      const userRef = doc(db, 'users', user.uid);
      unsubscribeUser = onSnapshot(userRef, (snapshot) => {
        if (snapshot.exists()) {
          setUserMetadata(snapshot.data());
        }
      }, (error) => {
        console.warn("User document listen error (non-fatal):", error);
      });
    }

    const path = 'books';
    const q = query(collection(db, 'books'));

    const unsubscribeBooks = onSnapshot(q, (snapshot) => {
      const booksData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];
      const filtered = booksData.filter((b: any) => {
        const isOwner = b.writerId === user.uid;
        const isAdmin = role === 'admin';
        const isPublished = b.status === 'published' || !b.status; // Support legacy books without status
        const isApproved = b.isApproved === true;

        // Admins and owners can see drafts/pending, but users only see approved published works
        if (isAdmin || isOwner) return true;
        return isPublished && isApproved;
      });
      setBooks(filtered);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
      setLoading(false);
    });

    loadOfflineData();

    return () => {
      unsubscribeBooks();
      unsubscribeUser();
    };
  }, [user, role]);

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    const updated = [...offlineCategories, newCategoryName.trim()];
    await set('offline_categories', updated);
    setOfflineCategories(updated);
    setNewCategoryName('');
    setShowNewCategoryInput(false);
  };

  const setBookCategory = async (bookId: string, category: string) => {
    const key = `book_${bookId}`;
    const bookData = await get(key);
    if (bookData) {
      const updatedBook = { ...bookData, category };
      await set(key, updatedBook);
      await loadOfflineData();
      setAssigningCategoryId(null);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const handleSeed = async () => {
    if (!user || role !== 'writer') return;
    setSeeding(true);
    try {
      await seedBooks(user.uid);
      alert('The Archives have been enriched with classical literature!');
    } catch (error) {
      console.error('Seeding failed:', error);
      alert('Failed to enrich the archives.');
    } finally {
      setSeeding(false);
    }
  };

  const baseBooks = view === 'all' ? books : offlineBooks;
  
  const filteredByCategory = selectedCategory === 'All'
    ? baseBooks
    : baseBooks.filter(b => b.category === selectedCategory);

  const displayedBooks = filteredByCategory
    .filter(book => 
      book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (book.description?.toLowerCase().includes(searchQuery.toLowerCase()) || false)
    )
    .sort((a, b) => {
      if (sortBy === 'price-asc') return parseFloat(a.price) - parseFloat(b.price);
      if (sortBy === 'price-desc') return parseFloat(b.price) - parseFloat(a.price);
      return 0;
    });

  const offlineBookIds = new Set(offlineBooks.map(b => b.id));

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
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/40 font-black">African Literature Portal</p>
        </div>

        <nav className="flex-1 overflow-y-auto p-6 space-y-8 customize-scrollbar">
          {/* Account Type Display */}
          <div className="space-y-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/30 px-4">System Identity</p>
            <div className="flex bg-white/5 p-3 rounded-[20px] border border-white/10 items-center gap-3 mx-4">
              <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-white/80 shrink-0">
                {role === 'writer' ? <PenTool className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
              </div>
              <div className="text-left">
                <p className="text-[8px] font-black uppercase tracking-widest text-white/40 leading-none">Account Type</p>
                <p className="text-[11px] font-black uppercase tracking-wide text-white mt-1">
                  {role === 'writer' ? 'Writer Profile' : role === 'admin' ? 'Admin Profile' : 'Reader Profile'}
                </p>
              </div>
            </div>
          </div>

          {/* Admin Panel Link - MOVED TO TOP */}
          {role === 'admin' && (
            <div className="space-y-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/30 px-4">Administration</p>
              <button
                onClick={() => navigate('/admin')}
                className="w-full flex items-center gap-4 px-4 py-4 rounded-[24px] text-white/80 hover:bg-white/5 transition-all border border-transparent hover:border-white/10 group"
              >
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center transition-all group-hover:bg-white group-hover:text-primary shadow-sm">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className="text-[10px] font-black uppercase tracking-widest leading-none text-white">Admin Control</p>
                  <p className="text-[9px] text-white/40 font-bold mt-1">Manage system</p>
                </div>
              </button>
            </div>
          )}

          {/* Navigation Views */}
          <div className="space-y-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/30 px-4">Archives</p>
            <div className="space-y-1">
              <button 
                onClick={() => { setView('all'); setSelectedCategory('All'); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${
                  view === 'all' ? 'bg-primary text-white shadow-lg shadow-black/20' : 'text-white/60 hover:bg-white/5'
                }`}
              >
                <Library className="w-4 h-4" />
                Library
              </button>
              <button 
                onClick={() => { setView('offline'); setSelectedCategory('All'); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${
                  view === 'offline' ? 'bg-primary text-white shadow-lg shadow-black/20' : 'text-white/60 hover:bg-white/5'
                }`}
              >
                <div className="relative">
                  <DownloadCloud className="w-4 h-4" />
                  {offlineBooks.length > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-red-500 border border-sidebar-bg rounded-full"></span>
                  )}
                </div>
                My Library
              </button>
            </div>
          </div>

          {/* Categories */}
          <div className="space-y-2">
            <button 
              onClick={() => setIsCategoriesExpanded(!isCategoriesExpanded)}
              className="w-full flex items-center justify-between px-4 group"
            >
              <p className="text-[10px] font-black uppercase tracking-widest text-white/30 group-hover:text-white/50 transition-colors">Categories</p>
              <motion.div
                animate={{ rotate: isCategoriesExpanded ? 0 : -90 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="w-3.5 h-3.5 text-white/20 group-hover:text-white/40" />
              </motion.div>
            </button>
            
            <motion.div 
              initial={false}
              animate={{ 
                height: isCategoriesExpanded ? 'auto' : 0,
                opacity: isCategoriesExpanded ? 1 : 0
              }}
              className="overflow-hidden"
            >
              <div className="space-y-1 pt-2">
                <button
                  onClick={() => { setSelectedCategory('All'); setIsSidebarOpen(false); }}
                  className={`w-full text-left px-4 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${
                    selectedCategory === 'All' 
                      ? 'bg-white/10 text-white' 
                      : 'text-white/60 hover:bg-white/5'
                  }`}
                >
                  All Collections
                </button>
                
                {(view === 'all' ? storeCategories : offlineCategories).map(cat => (
                  <button
                    key={cat}
                    onClick={() => { setSelectedCategory(cat); setIsSidebarOpen(false); }}
                    className={`w-full text-left px-4 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${
                      selectedCategory === cat 
                        ? 'bg-white/10 text-white font-bold' 
                        : 'text-white/60 hover:bg-white/5'
                    }`}
                  >
                    {cat}
                  </button>
                ))}

                {view === 'offline' && (
                  <div className="pt-2 px-2">
                    {!showNewCategoryInput ? (
                      <button
                        onClick={() => setShowNewCategoryInput(true)}
                        className="w-full flex items-center gap-2 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white bg-white/5 border border-white/10 hover:bg-white/20 transition-all"
                      >
                        <FolderPlus className="w-4 h-4" />
                        Create Folder
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 bg-white/10 rounded-2xl border border-white/20 p-1.5 shadow-sm">
                        <input
                          autoFocus
                          type="text"
                          placeholder="Name..."
                          className="pl-3 py-1.5 bg-transparent border-none outline-none text-[10px] uppercase font-bold w-full text-white placeholder:text-white/30"
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                        />
                        <button onClick={handleAddCategory} className="p-2 text-green-400 hover:bg-white/5 rounded-full transition-colors">
                          <Plus className="w-4 h-4" />
                        </button>
                        <button onClick={() => setShowNewCategoryInput(false)} className="p-2 text-white/40 hover:bg-red-500/10 rounded-full transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          {/* Seeding Action for Writers */}
          {role === 'writer' && (
            <div className="pt-4">
              <button
                onClick={handleSeed}
                disabled={seeding}
                className="w-full flex items-center gap-4 px-4 py-4 rounded-[24px] text-white/60 hover:bg-white/5 transition-all border border-transparent hover:border-white/10 group disabled:opacity-50"
              >
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${seeding ? 'bg-primary text-white animate-spin' : 'bg-white/10 group-hover:bg-primary group-hover:text-white shadow-sm'}`}>
                  {seeding ? <Loader2 className="w-5 h-5" /> : <Database className="w-5 h-5" />}
                </div>
                <div className="text-left">
                  <p className="text-[10px] font-black uppercase tracking-widest leading-none text-white">Seed Real Books</p>
                  <p className="text-[9px] text-white/40 font-bold mt-1">Enrich the archives</p>
                </div>
              </button>
            </div>
          )}
        </nav>

        <div className="p-8 border-t border-white/5 space-y-4">
          <button 
            onClick={() => { navigate('/profile'); setIsSidebarOpen(false); }}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] text-white hover:bg-white/10 transition-all border border-white/5 shadow-sm"
          >
            <UserIcon className="w-4 h-4" />
            My Identity
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

      {/* Main Content Area */}
      <div className="flex-1 lg:ml-[280px] min-h-screen relative flex flex-col overflow-y-auto">
        <header className="bg-white/80 backdrop-blur-md px-6 py-6 sticky top-0 z-40 flex justify-between items-end border-b border-primary/10">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-3 bg-white rounded-2xl text-primary hover:bg-primary hover:text-white transition-all shadow-sm border border-primary/5"
            >
              <MoreVertical className="w-6 h-6 rotate-90" />
            </button>
            <div className="hidden sm:block">
              <h2 className="text-2xl font-serif font-black text-primary tracking-tighter italic">Books Africa</h2>
            </div>
            <div className="sm:hidden">
               <h2 className="text-xl font-serif font-black text-primary tracking-tighter italic">Library</h2>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {role === 'writer' && (
              <button 
                onClick={() => navigate('/dashboard')}
                className="p-3 text-accent hover:text-primary bg-white rounded-2xl transition-all shadow-sm border border-primary/5"
                title="Writer Dashboard"
              >
                <LayoutDashboard className="w-5 h-5" />
              </button>
            )}
            <button 
              onClick={() => navigate('/profile')}
              className="p-3 text-accent hover:text-primary bg-white rounded-2xl transition-all shadow-sm border border-primary/5"
              title="Profile"
            >
              <UserIcon className="w-5 h-5" />
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-10 pb-32">
          <div className="mb-10 max-w-5xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
              <div>
                <h2 className="text-5xl lg:text-6xl font-serif font-black text-natural-text italic tracking-tighter">
                  {view === 'all' ? 'The Library' : 'Saved Works'}
                </h2>
                <p className="text-accent text-sm mt-3 flex items-center gap-3">
                  <span className="w-12 h-px bg-primary/20"></span>
                  {view === 'all' ? 'Discover curated voices of Africa' : 'Your personal curated archive'}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-8">
              <div className="relative group">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-accent group-focus-within:text-primary transition-colors" />
                <input 
                  type="text"
                  placeholder="Search archives by title, author, or themes..."
                  className="w-full pl-16 pr-8 py-6 bg-white rounded-[32px] border border-primary/10 shadow-sm outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/20 transition-all font-medium text-lg text-natural-text placeholder:text-accent/50"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Horizontal Category Selector */}
              <div className="flex overflow-x-auto gap-3 pb-4 no-scrollbar -mx-2 px-2">
                <button
                  onClick={() => setSelectedCategory('All')}
                  className={`flex-shrink-0 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    selectedCategory === 'All'
                      ? 'bg-primary text-white shadow-lg shadow-primary/20'
                      : 'bg-white text-accent hover:bg-primary/5 border border-primary/5'
                  }`}
                >
                  All Collections
                </button>
                {(view === 'all' ? storeCategories : view === 'offline' ? offlineCategories : storeCategories).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`flex-shrink-0 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      selectedCategory === cat
                        ? 'bg-primary text-white shadow-lg shadow-primary/20'
                        : 'bg-white text-accent hover:bg-primary/5 border border-primary/5'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              
              <div className="flex items-center justify-between gap-4">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-accent">
                  Refined Search Results
                </p>

                <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-primary/5 shadow-sm">
                  <button 
                    onClick={() => setSortBy(sortBy === 'price-asc' ? 'none' : 'price-asc')}
                    className={`p-3 rounded-xl transition-all ${
                      sortBy === 'price-asc' ? 'bg-primary/10 text-primary' : 'text-accent hover:bg-natural-bg'
                    }`}
                    title="Price: Low to High"
                  >
                    <ArrowUpDown className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setSortBy(sortBy === 'price-desc' ? 'none' : 'price-desc')}
                    className={`p-3 rounded-xl transition-all ${
                      sortBy === 'price-desc' ? 'bg-primary/10 text-primary' : 'text-accent hover:bg-natural-bg'
                    }`}
                    title="Price: High to Low"
                  >
                    <ArrowUpDown className="w-4 h-4 rotate-180" />
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          {/* Best Sellers Section */}
          {view === 'all' && !searchQuery && selectedCategory === 'All' && (
            <div className="mb-16">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="h-1 w-12 bg-primary rounded-full" />
                  <h2 className="text-2xl font-serif font-black text-natural-text italic">The Vanguard (Best Sellers)</h2>
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-accent/60">Most Circulated Works</p>
              </div>
              
              <div className="flex overflow-x-auto gap-8 pb-8 no-scrollbar -mx-4 px-4">
                {books
                  .filter(b => b.isApproved !== false) // Only approved for best sellers
                  .sort((a, b) => (b.downloadCount || 0) - (a.downloadCount || 0))
                  .slice(0, 6)
                  .map((book) => (
                    <motion.div
                      key={`best-${book.id}`}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      whileHover={{ y: -12 }}
                      onClick={() => navigate(`/book/${book.id}`)}
                      className="flex-shrink-0 w-[240px] group relative cursor-pointer"
                    >
                      <div className="aspect-[1/1.5] relative overflow-hidden bg-white rounded-[32px] mb-6 shadow-[0_20px_50px_rgba(0,0,0,0.05)] group-hover:shadow-[0_40px_80px_rgba(0,0,0,0.1)] transition-all duration-500">
                         <img 
                          src={book.coverUrl} 
                          className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                          alt={book.title} 
                        />
                        <div className="absolute top-4 left-4 flex flex-col gap-2">
                           <div className="bg-primary text-white px-3 py-1.5 rounded-full shadow-xl flex items-center gap-2 border border-white/20">
                              <TrendingUp className="w-3 h-3" />
                              <span className="text-[7px] font-black uppercase tracking-widest">Trending Now</span>
                           </div>
                           {offlineBookIds.has(book.id) && (
                             <div className="bg-green-500 text-white px-3 py-1.5 rounded-full shadow-xl flex items-center gap-2 border border-white/20 animate-in fade-in zoom-in duration-300">
                               <DownloadCloud className="w-3 h-3" />
                               <span className="text-[7px] font-black uppercase tracking-widest">Saved Offline</span>
                             </div>
                           )}
                        </div>
                        
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-end p-4">
                          <div className="w-full bg-white/95 backdrop-blur-md py-2 rounded-xl text-[8px] font-black uppercase tracking-widest text-primary text-center shadow-2xl transform translate-y-2 group-hover:translate-y-0 transition-transform duration-500">
                             {progressMap[book.id]?.currentPage ? `Resume Pg ${progressMap[book.id].currentPage} (${progressMap[book.id].percentage}%)` : 'Examine Work'}
                          </div>
                        </div>

                        {progressMap[book.id] && (progressMap[book.id].currentPage > 1 || progressMap[book.id].percentage > 0) ? (
                          <div className="absolute bottom-0 left-0 right-0 p-2.5 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
                            <div className="flex items-center justify-between text-[7px] font-black uppercase text-emerald-300 mb-1">
                              <span>Pg {progressMap[book.id].currentPage}</span>
                              <span>{progressMap[book.id].percentage}%</span>
                            </div>
                            <div className="w-full bg-white/20 h-1 rounded-full overflow-hidden">
                              <div className="bg-emerald-400 h-full rounded-full" style={{ width: `${progressMap[book.id].percentage}%` }} />
                            </div>
                          </div>
                        ) : (
                          <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-md px-3 py-1 rounded-full border border-primary/10 shadow-sm">
                             <p className="text-[9px] font-black text-primary italic">#{book.downloadCount || 0} Readers</p>
                          </div>
                        )}
                      </div>
                      
                      <div className="px-2 space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[8px] font-black uppercase tracking-[0.2em] text-primary/40">{book.category || 'Vanguard'}</span>
                          <span className="h-0.5 w-0.5 bg-primary/20 rounded-full" />
                          <div className="flex items-center gap-1">
                            <Star className="w-2.5 h-2.5 text-yellow-500 fill-current" />
                            <span className="text-[8px] font-black text-primary">{(book.ratingAverage || 0).toFixed(1)}</span>
                          </div>
                        </div>
                        
                        <h4 className="font-serif font-black text-natural-text line-clamp-1 italic text-lg leading-tight group-hover:text-primary transition-colors">{book.title}</h4>
                        <p className="text-[10px] text-accent italic font-medium">by {book.author}</p>
                        
                        <div className="pt-1 flex items-center justify-between">
                           <span className="text-base font-black text-primary">
                             {book.price === 'Free' ? 'GRATIS' : `${book.price} ZMW`}
                           </span>
                           <div className="p-1.5 rounded-lg bg-primary/5 text-primary border border-primary/5">
                             <Plus className="w-3 h-3" />
                           </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
              </div>
            </div>
          )}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} className="bg-white rounded-[40px] aspect-[1/1.5] animate-pulse border border-primary/5"></div>
            ))}
          </div>
        ) : displayedBooks.length > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-16">
            {displayedBooks.map((book) => (
              <motion.div
                key={book.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -12 }}
                className="group relative cursor-pointer"
                onClick={() => navigate(`/book/${book.id}`)}
              >
                <div className="aspect-[1/1.5] relative overflow-hidden bg-white rounded-[32px] mb-6 shadow-[0_20px_50px_rgba(0,0,0,0.05)] group-hover:shadow-[0_40px_80px_rgba(0,0,0,0.1)] transition-all duration-500">
                  <img 
                    src={book.coverUrl} 
                    alt={book.title} 
                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://placehold.co/400x600?text=Untitled+Work';
                    }}
                  />
                  
                  {(book.isOffline || offlineBookIds.has(book.id)) && (
                    <div className="absolute top-4 left-4">
                      <div className="bg-green-500 text-white p-2 rounded-xl shadow-xl backdrop-blur-sm bg-green-500/90 border border-white/20 flex items-center gap-2 animate-in fade-in zoom-in duration-300">
                        <DownloadCloud className="w-3.5 h-3.5" />
                        {view === 'all' && (
                          <span className="text-[8px] font-black uppercase tracking-widest pr-1">Offline</span>
                        )}
                      </div>
                    </div>
                  )}

                  {progressMap[book.id] && (progressMap[book.id].currentPage > 1 || progressMap[book.id].percentage > 0) && (
                    <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
                      <div className="flex items-center justify-between text-[8px] font-black uppercase text-emerald-300 mb-1">
                        <span>Pg {progressMap[book.id].currentPage}</span>
                        <span>{progressMap[book.id].percentage}%</span>
                      </div>
                      <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-emerald-400 h-full rounded-full" style={{ width: `${progressMap[book.id].percentage}%` }} />
                      </div>
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-end p-6">
                    <div className="w-full bg-white/95 backdrop-blur-md py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-primary text-center shadow-2xl transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                      {progressMap[book.id]?.currentPage ? `Resume Pg ${progressMap[book.id].currentPage} (${progressMap[book.id].percentage}%)` : 'Explore Archives'}
                    </div>
                  </div>
                </div>
                
                <div className="px-2 space-y-2 relative">
                  {book.isOffline && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setAssigningCategoryId(assigningCategoryId === book.id ? null : book.id);
                      }}
                      className="absolute top-0 right-0 p-2 rounded-xl hover:bg-primary/5 text-accent transition-colors z-10"
                    >
                      <Tag className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-primary/40">{book.category || 'Literary Archive'}</span>
                    <span className="h-0.5 w-0.5 bg-primary/20 rounded-full" />
                    <div className="flex items-center gap-1">
                      <Star className="w-2.5 h-2.5 text-yellow-500 fill-current" />
                      <span className="text-[9px] font-black text-primary">{(book.ratingAverage || 0).toFixed(1)}</span>
                    </div>
                  </div>
                  
                  <h3 className="text-xl font-serif font-black text-natural-text leading-tight line-clamp-2 group-hover:text-primary transition-colors italic">
                    {book.title}
                  </h3>
                  
                  <p className="text-[11px] text-accent font-medium italic">by {book.author}</p>
                  
                  <div className="pt-2 flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[8px] font-black uppercase tracking-widest text-[#5A5A40]/30 -mb-0.5">Investment</span>
                      <span className="text-lg font-black text-primary uppercase">
                        {book.price === 'Free' ? 'Gratis' : `${book.price} ZMW`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                       {book.ageRating && (
                        <div className="px-2 py-1 bg-primary/5 text-primary text-[8px] font-black rounded-lg border border-primary/10">
                          {book.ageRating}
                        </div>
                      )}
                    </div>
                  </div>

                  <AnimatePresence>
                    {assigningCategoryId === book.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 10 }}
                        className="absolute inset-x-0 bottom-full mb-4 z-30 bg-white shadow-2xl rounded-[28px] border border-primary/10 p-5 backdrop-blur-xl"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-between mb-4 px-1">
                          <p className="text-[10px] font-black uppercase tracking-widest text-primary">Organize Archives</p>
                          <X className="w-3.5 h-3.5 text-accent cursor-pointer hover:text-red-500 transition-colors" onClick={() => setAssigningCategoryId(null)} />
                        </div>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 customize-scrollbar">
                          <button
                            onClick={() => setBookCategory(book.id, '')}
                            className={`w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                              !book.category ? 'bg-primary/5 text-primary border border-primary/10' : 'hover:bg-primary/5 text-accent'
                            }`}
                          >
                            Generic Collection
                          </button>
                          {offlineCategories.map(cat => (
                            <button
                              key={cat}
                              onClick={() => setBookCategory(book.id, cat)}
                              className={`w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                                book.category === cat ? 'bg-primary text-white shadow-lg' : 'hover:bg-primary/5 text-accent'
                              }`}
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-32 flex flex-col items-center">
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-sm border border-primary/5">
              {view === 'all' ? (
                <BookIcon className="w-10 h-10 text-primary/20" />
              ) : (
                <DownloadCloud className="w-10 h-10 text-primary/20" />
              )}
            </div>
            <p className="text-accent font-serif italic">
              {searchQuery 
                ? `No results found for "${searchQuery}"`
                : view === 'all' 
                  ? 'The library is currently being stocked...' 
                  : 'No books saved for offline yet.'}
            </p>
          </div>
        )}
      </main>

        {role === 'writer' && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="fixed bottom-8 right-8 z-50 lg:right-12 lg:bottom-12"
          >
            <Link 
              to="/upload"
              className="w-16 h-16 bg-primary text-white rounded-2xl flex items-center justify-center shadow-2xl shadow-primary/40 hover:bg-primary-dark transition-all transform active:scale-90"
            >
              <Plus className="w-8 h-8" />
            </Link>
          </motion.div>
        )}
      </div>
    </div>
  );
}
