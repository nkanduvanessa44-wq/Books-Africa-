import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, onSnapshot, updateDoc, deleteDoc, doc, addDoc, serverTimestamp } from 'firebase/firestore';
import { 
  ArrowLeft, CheckCircle, XCircle, Trash2, Plus, 
  Settings, ShoppingBag, BookOpen, AlertCircle,
  Search, Filter, MoreVertical, Loader2, Package,
  TrendingUp, Users, ShieldCheck, Mail,
  ChevronLeft, ChevronRight, Eye, X, Star
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

interface Book {
  id: string;
  title: string;
  author: string;
  writerId: string;
  price: string;
  category: string;
  coverUrl: string;
  pdfUrl: string;
  isApproved?: boolean;
  status?: string;
  isScript?: boolean;
  createdAt: string;
}



const AdminDashboard: React.FC = () => {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingPage, setPendingPage] = useState(1);
  const [approvedPage, setApprovedPage] = useState(1);
  const ITEMS_PER_PAGE_PENDING = 4;
  const ITEMS_PER_PAGE_APPROVED = 10;

  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  
  const navigate = useNavigate();

  useEffect(() => {
    const unsubBooks = onSnapshot(collection(db, 'books'), (snapshot) => {
      const bookData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Book));
      setBooks(bookData);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'books'));

    return () => {
      unsubBooks();
    };
  }, []);

  const handleApprove = async (id: string) => {
    try {
      await updateDoc(doc(db, 'books', id), { isApproved: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `books/${id}`);
    }
  };

  const handleReject = async (id: string) => {
    if (window.confirm('Are you sure you want to reject and delete this book?')) {
      try {
        await deleteDoc(doc(db, 'books', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `books/${id}`);
      }
    }
  };



  const pendingBooks = books.filter(b => !b.isApproved && b.status === 'published');
  const approvedBooks = books.filter(b => b.isApproved && b.status === 'published');

  const paginatedPending = pendingBooks.slice(
    (pendingPage - 1) * ITEMS_PER_PAGE_PENDING,
    pendingPage * ITEMS_PER_PAGE_PENDING
  );

  const paginatedApproved = approvedBooks.slice(
    (approvedPage - 1) * ITEMS_PER_PAGE_APPROVED,
    approvedPage * ITEMS_PER_PAGE_APPROVED
  );

  const totalPendingPages = Math.ceil(pendingBooks.length / ITEMS_PER_PAGE_PENDING);
  const totalApprovedPages = Math.ceil(approvedBooks.length / ITEMS_PER_PAGE_APPROVED);

  if (loading) {
    return (
      <div className="min-h-screen bg-natural-bg flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-natural-bg font-sans flex overflow-hidden">
      {/* Sidebar */}
      <aside className="w-80 bg-sidebar-bg border-r border-white/5 flex flex-col p-8 hidden lg:flex">
        <div className="flex items-center gap-4 mb-12">
          <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-black/20 rotate-3">
             <ShieldCheck className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-serif font-black text-white">Admin Panel</h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/40 leading-none mt-1">Management Hub</p>
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          <div className="w-full flex items-center gap-4 px-6 py-4 rounded-[24px] bg-primary text-white shadow-xl shadow-black/20">
            <CheckCircle className="w-5 h-5 text-white" />
            <span className="text-[11px] font-black uppercase tracking-widest leading-none">Book Approvals</span>
            {pendingBooks.length > 0 && (
              <span className="ml-auto w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black bg-white text-primary">
                {pendingBooks.length}
              </span>
            )}
          </div>
        </nav>

        <div className="pt-8 border-t border-white/5">
          <button 
            onClick={() => navigate('/')}
            className="w-full flex items-center gap-4 px-6 py-4 rounded-[24px] text-white/60 hover:bg-white/5 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-[11px] font-black uppercase tracking-widest leading-none">Back to Library</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8 lg:p-16">
        <header className="flex justify-between items-end mb-16">
          <div>
            <div className="flex items-center gap-3 text-accent mb-2">
              <Settings className="w-4 h-4" />
              <p className="text-[10px] font-black uppercase tracking-widest">System Overview</p>
            </div>
            <h2 className="text-5xl font-serif font-black text-natural-text italic">
              Content Queue
            </h2>
          </div>
        </header>

        <div className="space-y-12">
            {/* Pending Section */}
            <section>
              <div className="flex items-center gap-4 mb-8">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-xl font-serif font-bold text-natural-text">Pending Approval</h3>
                  <p className="text-[10px] uppercase font-black tracking-widest text-accent/50 mt-1">Review submissions from writers</p>
                </div>
              </div>

              {pendingBooks.length === 0 ? (
                <div className="bg-white rounded-[40px] p-16 text-center border border-dashed border-primary/20">
                  <BookOpen className="w-12 h-12 text-primary/20 mx-auto mb-4" />
                  <p className="text-sm font-bold text-accent">Queue is empty. No books awaiting review.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {paginatedPending.map(book => (
                      <motion.div 
                        key={book.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white p-8 rounded-[40px] shadow-xl shadow-primary/5 border border-primary/5 flex gap-8"
                      >
                        <div className="w-24 h-32 rounded-2xl overflow-hidden bg-natural-bg shrink-0 shadow-lg">
                          <img src={book.coverUrl} className="w-full h-full object-cover" alt={book.title} />
                        </div>
                        <div className="flex-1 flex flex-col justify-between">
                          <div>
                            <h4 className="text-lg font-serif font-bold text-natural-text leading-tight">{book.title}</h4>
                            <p className="text-[10px] font-black uppercase text-accent mt-1">by {book.author}</p>
                            <div className="mt-3 flex gap-2">
                              <div className="px-3 py-1 bg-natural-bg rounded-lg text-[9px] font-black text-primary uppercase">{book.category}</div>
                              {book.isScript && (
                                <div className="px-3 py-1 bg-blue-50 rounded-lg text-[9px] font-black text-blue-600 uppercase">Script</div>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-3">
                            <button 
                              onClick={() => setPreviewPdfUrl(book.pdfUrl)}
                              className="px-4 py-3 bg-white border border-primary/10 rounded-2xl text-accent hover:text-primary hover:border-primary/30 transition-all flex items-center justify-center"
                              title="View Manuscript"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleApprove(book.id)}
                              className="flex-1 bg-primary text-white py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-primary-hover transition-colors flex items-center justify-center gap-2"
                            >
                              <CheckCircle className="w-3.5 h-3.5" /> Approve
                            </button>
                            <button 
                              onClick={() => handleReject(book.id)}
                              className="px-4 py-3 bg-red-50 text-red-600 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-red-100 transition-colors"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {totalPendingPages > 1 && (
                    <div className="mt-10 flex items-center justify-center gap-4">
                      <button 
                        disabled={pendingPage === 1}
                        onClick={() => setPendingPage(p => Math.max(1, p - 1))}
                        className="p-3 bg-white border border-primary/5 rounded-2xl text-primary disabled:opacity-20 hover:bg-primary/5 transition-all"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <span className="text-[10px] font-black uppercase tracking-widest text-accent/60">
                        Page {pendingPage} of {totalPendingPages}
                      </span>
                      <button 
                        disabled={pendingPage === totalPendingPages}
                        onClick={() => setPendingPage(p => Math.min(totalPendingPages, p + 1))}
                        className="p-3 bg-white border border-primary/5 rounded-2xl text-primary disabled:opacity-20 hover:bg-primary/5 transition-all"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>

            {/* Approved List */}
            <section className="pt-12 border-t border-primary/5">
              <h3 className="text-xl font-serif font-bold text-natural-text mb-8">Recently Approved</h3>
              <div className="bg-white rounded-[40px] shadow-xl shadow-primary/5 border border-primary/5 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-natural-bg/50 border-b border-primary/5">
                      <th className="px-10 py-6 text-left text-[10px] font-black uppercase tracking-widest text-accent">Book Details</th>
                      <th className="px-10 py-6 text-left text-[10px] font-black uppercase tracking-widest text-accent">Writer ID</th>
                      <th className="px-10 py-6 text-left text-[10px] font-black uppercase tracking-widest text-accent">Status</th>
                      <th className="px-10 py-6 text-left text-[10px] font-black uppercase tracking-widest text-accent">Price</th>
                      <th className="px-10 py-6 text-right text-[10px] font-black uppercase tracking-widest text-accent">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-primary/5">
                    {paginatedApproved.map(book => (
                      <tr key={book.id}>
                        <td className="px-10 py-6">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-natural-bg">
                              <img src={book.coverUrl} className="w-full h-full object-cover" alt="" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-natural-text">{book.title}</p>
                              <p className="text-[10px] font-medium text-accent">
                                {book.isScript ? 'Script' : 'Book'} Archive
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-10 py-6 text-[10px] font-black text-accent uppercase tracking-wider font-mono">{book.writerId.slice(0, 8)}...</td>
                        <td className="px-10 py-6">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                            book.isApproved ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {book.isApproved ? (
                              <><CheckCircle className="w-3 h-3" /> Approved</>
                            ) : (
                              <><AlertCircle className="w-3 h-3" /> Pending</>
                            )}
                          </span>
                        </td>
                        <td className="px-10 py-6 text-xs font-black text-primary">{book.price}</td>
                        <td className="px-10 py-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => setPreviewPdfUrl(book.pdfUrl)}
                              className="p-2 text-accent hover:text-primary transition-colors"
                              title="View Document"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleReject(book.id)}
                              className="text-red-400 hover:text-red-700 transition-colors p-2"
                              title="Delete Archive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {totalApprovedPages > 1 && (
                  <div className="p-8 bg-natural-bg/30 border-t border-primary/5 flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-widest text-accent/60 italic">
                      Found {approvedBooks.length} Approved Manuscripts
                    </p>
                    <div className="flex items-center gap-4">
                      <button 
                        disabled={approvedPage === 1}
                        onClick={() => setApprovedPage(p => Math.max(1, p - 1))}
                        className="p-3 bg-white border border-primary/5 rounded-2xl text-primary disabled:opacity-20 hover:bg-primary/5 transition-all"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <span className="text-[10px] font-black uppercase tracking-widest text-accent/60">
                        {approvedPage} / {totalApprovedPages}
                      </span>
                      <button 
                        disabled={approvedPage === totalApprovedPages}
                        onClick={() => setApprovedPage(p => Math.min(totalApprovedPages, p + 1))}
                        className="p-3 bg-white border border-primary/5 rounded-2xl text-primary disabled:opacity-20 hover:bg-primary/5 transition-all"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
      </main>

      {/* PDF Preview Modal */}
      <AnimatePresence>
        {previewPdfUrl && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPreviewPdfUrl(null)}
              className="absolute inset-0 bg-natural-text/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-5xl h-[85vh] bg-white rounded-[40px] shadow-3xl overflow-hidden flex flex-col"
            >
              <header className="p-6 border-b border-primary/5 flex justify-between items-center bg-white/80 backdrop-blur-md sticky top-0 z-10">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                    <BookOpen className="text-primary w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-serif font-black text-natural-text">Manuscript Preview</h3>
                    <p className="text-[9px] font-black uppercase tracking-widest text-accent/50">Confidential Admin Review</p>
                  </div>
                </div>
                <button 
                  onClick={() => setPreviewPdfUrl(null)}
                  className="p-3 bg-natural-bg rounded-2xl text-accent hover:text-primary transition-all active:scale-95"
                >
                  <X className="w-5 h-5" />
                </button>
              </header>
              <div className="flex-1 bg-natural-bg/50 p-4">
                <iframe 
                  src={`${previewPdfUrl}#toolbar=0`}
                  className="w-full h-full rounded-2xl border border-primary/5 shadow-inner"
                  title="PDF Preview"
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminDashboard;
