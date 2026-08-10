import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, updateDoc, increment, collection, query, orderBy, onSnapshot, addDoc, deleteDoc } from 'firebase/firestore';
import { ArrowLeft, ShoppingCart, Download, ShieldCheck, CheckCircle2, Star, FileText, X, ChevronLeft, ChevronRight, Sun, Moon, Eye, Settings2, MessageSquare, Send, Trash2, PenTool, Bookmark, Clock, BookOpen, Check, Percent } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth, getCurrentUser } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { set, get } from 'idb-keyval';
import { encryptBlob, decryptToBlob } from '../lib/encryption';
import { saveReadingProgress as persistProgress, fetchReadingProgress, ReadingProgress } from '../lib/progress';
import { toast } from 'sonner';

function base64ToBlob(base64Data: string, contentType: string = 'application/pdf') {
  const parts = base64Data.split(';base64,');
  const pureBase64 = parts[1] || parts[0];
  const sliceSize = 512;
  const byteCharacters = atob(pureBase64);
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
    const slice = byteCharacters.slice(offset, offset + sliceSize);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }

  return new Blob(byteArrays, { type: contentType });
}

interface Book {
  id: string;
  title: string;
  author: string;
  price: string;
  description: string;
  coverUrl: string;
  pdfUrl: string;
  ratingAverage?: number;
  ratingCount?: number;
  downloadCount?: number;
  lastPage?: number;
  ageRating?: string;
  writerId?: string;
}

interface Comment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
}

export default function BookDetails() {
  const { id } = useParams();
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [showPdfViewer, setShowPdfViewer] = useState(false);
  const [viewPdfUrl, setViewPdfUrl] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(50);
  const [progressPercentage, setProgressPercentage] = useState<number>(0);
  const [readingProgress, setReadingProgress] = useState<ReadingProgress | null>(null);
  const [showResumeToast, setShowResumeToast] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [readingMode, setReadingMode] = useState<'bright' | 'dark' | 'eyecare'>('bright');
  const [brightness, setBrightness] = useState<number>(100);
  const [contrast, setContrast] = useState<number>(100);
  const [zoom, setZoom] = useState<number>(100);
  const [showReaderSettings, setShowReaderSettings] = useState(false);
  const [showReaderComments, setShowReaderComments] = useState(false);
  const [writerMetadata, setWriterMetadata] = useState<any>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const saved = localStorage.getItem('reader_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.mode) setReadingMode(parsed.mode);
        if (parsed.brightness !== undefined) setBrightness(parsed.brightness);
        if (parsed.contrast !== undefined) setContrast(parsed.contrast);
        if (parsed.zoom !== undefined) setZoom(parsed.zoom);
      } catch (e) {
        console.error("Failed to load reader settings", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('reader_settings', JSON.stringify({
      mode: readingMode,
      brightness,
      contrast,
      zoom
    }));
  }, [readingMode, brightness, contrast, zoom]);

  useEffect(() => {
    const fetchBookAndRating = async () => {
      if (!id) return;
      
      let bookData: Book | null = null;

      try {
        const snap = await getDoc(doc(db, 'books', id));
        if (snap.exists()) {
          bookData = { id: snap.id, ...snap.data() } as Book;
        }
      } catch (err) {
        console.error('Firestore fetch failed, checking local storage:', err);
      }

      // Fetch saved reading progress across localStorage, IDB, and Firestore
      const prog = await fetchReadingProgress(id);
      if (prog) {
        setReadingProgress(prog);
        setCurrentPage(prog.currentPage);
        if (prog.totalPages) setTotalPages(prog.totalPages);
        if (prog.percentage !== undefined) setProgressPercentage(prog.percentage);
      }

      // Check if book is already downloaded
      const downloaded = await get(`book_${id}`);
      if (downloaded) {
        setIsDownloaded(true);
        // If firestore failed or data is missing, we use local data
        if (!bookData) {
          bookData = { ...downloaded } as Book;
        } else {
          // Merge local flags like lastPage
          bookData.lastPage = downloaded.lastPage;
        }
        if (downloaded.lastPage && !prog) {
          setCurrentPage(downloaded.lastPage);
        }
      }

      if (bookData) {
        setBook(bookData);

        // Fetch Writer Metadata
        if (bookData.writerId) {
          try {
            const writerSnap = await getDoc(doc(db, 'users', bookData.writerId));
            if (writerSnap.exists()) {
              setWriterMetadata(writerSnap.data());
            }
          } catch (wErr) {
            console.error('Could not fetch writer metadata:', wErr);
          }
        }

        // Fetch user's rating if logged in and online
        const currentUser = getCurrentUser();
        if (currentUser) {
          const ratingPath = `books/${id}/ratings/${currentUser.uid}`;
          try {
            const ratingSnap = await getDoc(doc(db, 'books', id, 'ratings', currentUser.uid));
            if (ratingSnap.exists()) {
              setUserRating(ratingSnap.data().rating);
            }
          } catch (rErr) {
            console.error('Could not fetch rating (might be offline):', rErr);
            handleFirestoreError(rErr, OperationType.GET, ratingPath);
          }
        }

        // Auto-resume if URL requested ?resume=true
        const params = new URLSearchParams(window.location.search);
        if (params.get('resume') === 'true') {
          const startP = prog?.currentPage || bookData.lastPage || 1;
          setTimeout(() => {
            handleRead(startP);
          }, 300);
        }
      }
      setLoading(false);
    };
    fetchBookAndRating();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const commentsRef = collection(db, 'books', id, 'comments');
    const q = query(commentsRef, orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment));
      setComments(docs);
    }, (error) => {
      console.error("Comments error:", error);
      handleFirestoreError(error, OperationType.GET, `books/${id}/comments`);
    });

    return () => unsubscribe();
  }, [id]);

  const handleRate = async (rating: number) => {
    const currentUser = getCurrentUser();
    if (!id || !currentUser || ratingLoading) return;
    
    setRatingLoading(true);
    const bookPath = `books/${id}`;
    const ratingPath = `books/${id}/ratings/${currentUser.uid}`;

    const enqueueRate = async (data: any) => {
      const queue = await get('sync_queue') || [];
      queue.push({ type: 'rate', bookId: id, data, timestamp: new Date().toISOString() });
      await set('sync_queue', queue);
    };

    const ratingData = {
      userId: currentUser.uid,
      rating,
      oldRating: userRating
    };

    if (!navigator.onLine) {
      await enqueueRate(ratingData);
      setUserRating(rating);
      // Update local state and IDB
      if (isDownloaded) {
        const localBook = await get(`book_${id}`);
        if (localBook) {
          const currentAvg = localBook.ratingAverage || 0;
          const currentCount = localBook.ratingCount || 0;
          let newAvg, newCount;
          if (userRating === null) {
            newCount = currentCount + 1;
            newAvg = ((currentAvg * currentCount) + rating) / newCount;
          } else {
            newCount = currentCount;
            newAvg = ((currentAvg * currentCount) - userRating + rating) / newCount;
          }
          await set(`book_${id}`, { ...localBook, ratingAverage: newAvg, ratingCount: newCount });
          setBook(prev => prev ? { ...prev, ratingAverage: newAvg, ratingCount: newCount } : null);
        }
      }
      setRatingLoading(false);
      return;
    }

    try {
      const bookRef = doc(db, 'books', id);
      const ratingRef = doc(db, 'books', id, 'ratings', currentUser.uid);
      
      const oldRating = userRating;
      
      // Update rating document
      try {
        await setDoc(ratingRef, {
          userId: currentUser.uid,
          rating,
          createdAt: new Date().toISOString()
        });
      } catch (rateErr) {
        await enqueueRate(ratingData);
        handleFirestoreError(rateErr, OperationType.WRITE, ratingPath);
      }

      // Update book aggregation
      try {
        const bookSnap = await getDoc(bookRef);
        const bookData = bookSnap.data();
        const currentAvg = bookData?.ratingAverage || 0;
        const currentCount = bookData?.ratingCount || 0;

        let newAvg, newCount;
        if (oldRating === null) {
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
        
        setUserRating(rating);
        setBook(prev => prev ? { ...prev, ratingAverage: newAvg, ratingCount: newCount } : null);

        // Sync with IndexedDB if downloaded
        if (isDownloaded) {
          const localBook = await get(`book_${id}`);
          if (localBook) {
            await set(`book_${id}`, { ...localBook, ratingAverage: newAvg, ratingCount: newCount });
          }
        }
      } catch (aggErr) {
        // Already enqueued rate above if rate document failed, 
        // but here we should maybe enqueue the aggregation update specifically?
        // For simplicity, we'll just let the background sync handle it next time.
        handleFirestoreError(aggErr, OperationType.UPDATE, bookPath);
      }
    } catch (error) {
      console.error('Error rating:', error);
    } finally {
      setRatingLoading(false);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentUser = getCurrentUser();
    if (!id || !newComment.trim() || !currentUser || commentLoading) return;

    setCommentLoading(true);
    const commentPath = `books/${id}/comments`;
    try {
      await addDoc(collection(db, 'books', id, 'comments'), {
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Zambia Voice Author',
        text: newComment.trim(),
        createdAt: new Date().toISOString()
      });
      setNewComment('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, commentPath);
    } finally {
      setCommentLoading(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!id || !confirm('Delete your comment?')) return;
    const commentPath = `books/${id}/comments/${commentId}`;
    try {
      await deleteDoc(doc(db, 'books', id, 'comments', commentId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, commentPath);
    }
  };

  const saveReadingProgress = async (page: number, customTotal?: number, customPercent?: number) => {
    if (!id || page < 1) return;
    const newPage = Math.max(1, page);
    const newTotal = customTotal !== undefined ? Math.max(1, customTotal) : totalPages;
    const newPercent = customPercent !== undefined
      ? Math.min(100, Math.max(0, Math.round(customPercent)))
      : Math.min(100, Math.max(0, Math.round((newPage / newTotal) * 100)));

    setCurrentPage(newPage);
    setTotalPages(newTotal);
    setProgressPercentage(newPercent);

    const updated = await persistProgress(id, newPage, newTotal, newPercent);
    setReadingProgress(updated);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);

    const localBook = await get(`book_${id}`);
    if (localBook) {
      setBook(prev => prev ? { ...prev, lastPage: newPage } : null);
    }
  };

  const getReaderFilter = () => {
    let base = '';
    switch (readingMode) {
      case 'dark': 
        base = 'invert(0.9) hue-rotate(180deg) '; 
        break;
      case 'eyecare': 
        base = 'sepia(0.6) '; 
        break;
      default: 
        base = '';
    }
    return `${base} brightness(${brightness}%) contrast(${contrast}%)`;
  };

  const handleRead = async (pageNum?: number, zoomLevel?: number) => {
    const targetPage = pageNum || currentPage;
    const targetZoom = zoomLevel || zoom;
    saveReadingProgress(targetPage);

    if (targetPage > 1 || (readingProgress && readingProgress.currentPage > 1)) {
      setShowResumeToast(true);
      setTimeout(() => setShowResumeToast(false), 4000);
    }

    // Security flags: hide toolbar, zoom and starting page
    const securityFlags = `#toolbar=0&navpanes=0&scrollbar=0&zoom=${targetZoom}&page=${targetPage}`;
    
    // Increment download count (popularity metric) when reading starts
    if (id) {
       const enqueueDownload = async () => {
        const queue = await get('sync_queue') || [];
        queue.push({ type: 'download', bookId: id, timestamp: new Date().toISOString() });
        await set('sync_queue', queue);
      };

      if (!navigator.onLine) {
        enqueueDownload();
      } else {
        const bookRef = doc(db, 'books', id);
        try {
          updateDoc(bookRef, {
            downloadCount: increment(1),
            updatedAt: new Date().toISOString()
          });
          setBook(prev => prev ? { ...prev, downloadCount: (prev.downloadCount || 0) + 1 } : null);
        } catch (upErr) {
          enqueueDownload();
        }
      }
    }

    if (isDownloaded) {
      try {
        const localData = await get(`book_${id}`);
        if (localData && localData.encryptedPdf) {
          const decryptedBlob = await decryptToBlob(localData.encryptedPdf);
          const url = URL.createObjectURL(decryptedBlob);
          setViewPdfUrl(`${url}${securityFlags}`);
          setShowPdfViewer(true);
          return;
        }
      } catch (err) {
        console.error('Secure Reader Error:', err);
      }
    }
    if (book?.pdfUrl) {
      let targetUrl = book.pdfUrl;
      const localRefIndex = targetUrl.indexOf('#local_ref=');
      if (localRefIndex !== -1) {
        const localKey = targetUrl.substring(localRefIndex + 11);
        try {
          const base64Data = await get(localKey);
          if (base64Data) {
            const blob = base64ToBlob(base64Data);
            targetUrl = URL.createObjectURL(blob);
          }
        } catch (localReadErr) {
          console.error("Failed to load PDF from local IndexedDB reference:", localReadErr);
        }
      } else if (targetUrl.startsWith('data:')) {
        try {
          const blob = base64ToBlob(targetUrl);
          targetUrl = URL.createObjectURL(blob);
        } catch (base64Err) {
          console.error("Failed to parse data URL to blob:", base64Err);
        }
      }
      setViewPdfUrl(`${targetUrl}${securityFlags}`);
      setShowPdfViewer(true);
    }
  };

  // Global Keyboard & Clipboard Protection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showPdfViewer) return;
      
      // Block common data exfiltration/modification shortcuts
      // Ctrl+C, Ctrl+V, Ctrl+P (Print), Ctrl+U (Source), Ctrl+S (Save), Ctrl+A (Select All)
      if (e.ctrlKey && (['c', 'v', 'p', 'u', 's', 'a', 'x'].includes(e.key.toLowerCase()))) {
        e.preventDefault();
        return false;
      }
      
      // Block F12 (DevTools)
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'C' || e.key === 'J'))) {
        e.preventDefault();
        return false;
      }
    };

    const blockEvent = (e: Event) => {
      if (showPdfViewer) {
        e.preventDefault();
        return false;
      }
    };

    if (showPdfViewer) {
      window.addEventListener('keydown', handleKeyDown, true);
      window.addEventListener('copy', blockEvent, true);
      window.addEventListener('cut', blockEvent, true);
      window.addEventListener('contextmenu', blockEvent, true);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('copy', blockEvent, true);
      window.removeEventListener('cut', blockEvent, true);
      window.removeEventListener('contextmenu', blockEvent, true);
    };
  }, [showPdfViewer]);

  const navigatePage = (direction: 'prev' | 'next') => {
    const newPage = direction === 'prev' ? Math.max(1, currentPage - 1) : currentPage + 1;
    saveReadingProgress(newPage);
    handleRead(newPage);
  };

  const handleBuy = () => {
    setBuying(true);
    setTimeout(() => {
      setBuying(false);
      handleRead();
    }, 1500);
  };

  const handleRemoveOffline = async () => {
    if (!id) return;
    if (confirm('Remove this book from offline storage?')) {
      await set(`book_${id}`, undefined);
      setIsDownloaded(false);
    }
  };

  const handleDownloadOffline = async () => {
    if (!book || downloading || isDownloaded) return;
    
    setDownloading(true);
    setDownloadProgress(0);
    try {
      let targetPdfUrl = book.pdfUrl;
      if (!targetPdfUrl) {
        throw new Error('No manuscript document URL available for this book.');
      }

      const localRefIndex = targetPdfUrl.indexOf('#local_ref=');
      let pdfBlob: Blob;
      
      if (localRefIndex !== -1) {
        const localKey = targetPdfUrl.substring(localRefIndex + 11);
        const base64Data = await get(localKey);
        if (!base64Data) throw new Error('Local reference data empty');
        pdfBlob = base64ToBlob(base64Data);
        setDownloadProgress(50);
      } else if (targetPdfUrl.startsWith('data:')) {
        pdfBlob = base64ToBlob(targetPdfUrl);
        setDownloadProgress(50);
      } else {
        const response = await fetch(targetPdfUrl);
        if (!response.ok) {
          throw new Error(`Network error (${response.status}): Failed to retrieve document.`);
        }
        if (!response.body) throw new Error('No response body returned from document server.');
        
        const contentLength = response.headers.get('Content-Length');
        const total = contentLength ? parseInt(contentLength, 10) : 0;
        
        const reader = response.body.getReader();
        let loaded = 0;
        const chunks: Uint8Array[] = [];
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          chunks.push(value);
          loaded += value.length;
          
          if (total > 0) {
            setDownloadProgress(Math.round((loaded / total) * 100));
          } else {
            setDownloadProgress(prev => (prev + 5) % 100);
          }
        }
        pdfBlob = new Blob(chunks, { type: 'application/pdf' });
      }

      if (pdfBlob.size === 0) {
        throw new Error('Downloaded document content is empty.');
      }
      
      const encryptedData = await encryptBlob(pdfBlob);

      await set(`book_${book.id}`, {
        ...book,
        ratingAverage: book.ratingAverage || 0,
        ratingCount: book.ratingCount || 0,
        encryptedPdf: encryptedData,
        downloadedAt: new Date().toISOString()
      });

      setIsDownloaded(true);
      setDownloadProgress(100);
      toast.success('Manuscript stored securely for offline reading.');

      // Enqueue download interaction for sync
      const enqueueDownload = async () => {
        const queue = await get('sync_queue') || [];
        queue.push({ type: 'download', bookId: book.id, timestamp: new Date().toISOString() });
        await set('sync_queue', queue);
      };

      if (!navigator.onLine) {
        await enqueueDownload();
        return;
      }

      // Increment download count in Firestore
      const bookRef = doc(db, 'books', book.id);
      const bookPath = `books/${book.id}`;
      try {
        await updateDoc(bookRef, {
          downloadCount: increment(1),
          updatedAt: new Date().toISOString()
        });
      } catch (upErr) {
        await enqueueDownload();
        handleFirestoreError(upErr, OperationType.UPDATE, bookPath);
      }
      
      setBook(prev => prev ? { ...prev, downloadCount: (prev.downloadCount || 0) + 1 } : null);
    } catch (error: any) {
      console.error('Offline download failed:', error);
      toast.error('Offline storage failed: ' + (error.message || 'Network error'));
    } finally {
      setDownloading(false);
    }
  };

  const handleDirectDownload = async () => {
    if (!book) return;
    try {
      setDownloading(true);
      let targetPdfUrl = book.pdfUrl;
      if (!targetPdfUrl) {
        toast.error('Document URL missing for this book.');
        return;
      }

      const localRefIndex = targetPdfUrl.indexOf('#local_ref=');
      let blob: Blob;

      if (localRefIndex !== -1) {
        const localKey = targetPdfUrl.substring(localRefIndex + 11);
        const base64Data = await get(localKey);
        if (!base64Data) throw new Error('Local reference data empty');
        blob = base64ToBlob(base64Data);
      } else if (targetPdfUrl.startsWith('data:')) {
        blob = base64ToBlob(targetPdfUrl);
      } else {
        try {
          const response = await fetch(targetPdfUrl);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          blob = await response.blob();
          if (blob.size === 0) {
            throw new Error('Retrieved PDF file was empty.');
          }
        } catch (fetchError: any) {
          console.warn("Direct fetch failed, attempting browser download link:", fetchError);
          const safeTitle = (book.title || 'manuscript').replace(/[^a-zA-Z0-9_-]/g, '_');
          const a = document.createElement('a');
          a.href = targetPdfUrl;
          a.target = '_blank';
          a.download = `${safeTitle}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setDownloading(false);
          return;
        }
      }

      const safeTitle = (book.title || 'manuscript').replace(/[^a-zA-Z0-9_-]/g, '_');
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeTitle}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Manuscript PDF download started.');
      
      const enqueueDownload = async () => {
        const queue = await get('sync_queue') || [];
        queue.push({ type: 'download', bookId: book.id, timestamp: new Date().toISOString() });
        await set('sync_queue', queue);
      };

      if (!navigator.onLine) {
        await enqueueDownload();
        return;
      }

      // Also increment count if they download directly
      const bookRef = doc(db, 'books', book.id);
      const bookPath = `books/${book.id}`;
      try {
        await updateDoc(bookRef, {
          downloadCount: increment(1),
          updatedAt: new Date().toISOString()
        });
      } catch (upErr) {
        await enqueueDownload();
        handleFirestoreError(upErr, OperationType.UPDATE, bookPath);
      }
      setBook(prev => prev ? { ...prev, downloadCount: (prev.downloadCount || 0) + 1 } : null);
    } catch (error: any) {
      console.error('Download error:', error);
      toast.error('Download failed: ' + (error.message || 'Check network connection'));
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading details...</div>;
  if (!book) return <div className="p-8 text-center text-red-500">Book not found.</div>;

  return (
    <div className="min-h-screen bg-natural-bg pb-32 font-sans">
      <div className="relative h-[450px] bg-white group overflow-hidden border-b border-primary/10">
        <img 
          src={book.coverUrl} 
          className="w-full h-full object-cover blur-3xl opacity-30 absolute inset-0 scale-110" 
          alt=""
        />
        <div className="max-w-6xl mx-auto h-full relative z-10 flex flex-col md:flex-row items-center justify-center md:justify-start p-8 gap-12">
          <motion.div 
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="h-[320px] md:h-[400px] aspect-[1/1.5] natural-card overflow-hidden shadow-2xl relative"
          >
            <img 
              src={book.coverUrl} 
              className="w-full h-full object-cover" 
              onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/600x900?text=Untitled'; }}
            />
          </motion.div>
          
          <motion.div 
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="hidden md:flex flex-col gap-4 max-w-xl"
          >
            <div className="flex flex-wrap gap-2">
              <span className="px-4 py-1.5 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-full w-fit">
                {book.category || 'Featured Literature'}
              </span>
              {book.ageRating && (
                <span className="px-4 py-1.5 bg-white/20 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-widest rounded-full border border-white/20">
                  Rating: {book.ageRating}
                </span>
              )}
            </div>
            <h1 className="text-5xl font-serif font-black text-natural-text leading-[1.1]">{book.title}</h1>
            <p className="text-2xl text-accent border-l-4 border-primary/20 pl-6 italic">by {book.author}</p>
          </motion.div>
        </div>
        <button 
          onClick={() => navigate(-1)} 
          className="absolute top-6 left-6 w-12 h-12 bg-white/80 text-primary rounded-2xl flex items-center justify-center z-20 backdrop-blur-md shadow-sm border border-primary/10 hover:bg-white transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
      </div>

      <div className="max-w-4xl mx-auto p-8 -mt-16 relative z-20">
        <div className="bg-white rounded-[48px] p-8 md:p-12 shadow-2xl shadow-primary/10 border border-primary/5">
          <div className="md:hidden mb-12">
            <div className="flex flex-wrap justify-center gap-2 mb-4">
              <span className="px-4 py-1.5 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-full w-fit">
                {book.category || 'Featured Literature'}
              </span>
              {book.ageRating && (
                <span className="px-4 py-1.5 bg-natural-bg text-accent text-[10px] font-black uppercase tracking-widest rounded-full border border-primary/10">
                  Rating: {book.ageRating}
                </span>
              )}
            </div>
            <h1 className="text-4xl font-serif font-bold text-natural-text text-center leading-tight mb-2">{book.title}</h1>
            <p className="text-xl text-accent italic text-center">by {book.author}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-12">
              <div className="flex flex-col md:flex-row items-center justify-between p-8 bg-natural-bg rounded-[32px] border border-primary/5 gap-6">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-inner">
                    <Star className="w-8 h-8 text-yellow-500 fill-current" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-natural-text uppercase tracking-widest">Global Rating</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-2xl font-black">{(book.ratingAverage || 0).toFixed(1)}</span>
                      <span className="text-xs text-accent font-bold">/ 5.0</span>
                      <span className="text-xs text-accent ml-2">({book.ratingCount || 0} reviews)</span>
                    </div>
                  </div>
                </div>

                <div className="h-px w-full md:w-px md:h-12 bg-primary/10" />

                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-inner">
                    <Download className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-natural-text uppercase tracking-widest">Library Reach</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-2xl font-black">{book.downloadCount || 0}</span>
                      <span className="text-[10px] text-accent font-bold uppercase tracking-tighter">Downloads</span>
                    </div>
                  </div>
                </div>

                <div className="h-px w-full md:w-px md:h-12 bg-primary/10" />

                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-inner">
                    <ShieldCheck className="w-8 h-8 text-green-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-natural-text uppercase tracking-widest">Asset Status</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-lg font-black text-green-600">Digital Verified</span>
                    </div>
                  </div>
                </div>

                <div className="h-px w-full md:w-px md:h-12 bg-primary/10" />

                <div className="text-center md:text-right">
                  <p className="text-[10px] font-black uppercase tracking-widest text-accent mb-1">Pricing</p>
                  <p className="text-3xl font-black text-primary">{book.price} ZMW</p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-12 space-y-12">
              {/* Reading Progress & Resume Reading CTA */}
              <div className="p-6 md:p-8 rounded-[32px] bg-gradient-to-br from-emerald-900/10 via-primary/5 to-emerald-900/10 border border-emerald-500/20 shadow-xl space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 text-emerald-700 font-black text-xs uppercase tracking-widest">
                    <Bookmark className="w-4 h-4 fill-emerald-600 text-emerald-600" />
                    <span>{readingProgress ? 'Reading Progress Recorded' : 'Manuscript Reader'}</span>
                  </div>
                  {readingProgress?.lastReadAt && (
                    <span className="text-[10px] text-accent flex items-center gap-1 font-mono">
                      <Clock className="w-3.5 h-3.5 text-emerald-600" />
                      Updated {new Date(readingProgress.lastReadAt).toLocaleDateString()}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between font-black text-base text-natural-text">
                  <span>Page {currentPage} of {totalPages}</span>
                  <span className="text-emerald-600 font-mono text-lg">{progressPercentage}% Complete</span>
                </div>

                <div className="w-full bg-primary/10 h-3 rounded-full overflow-hidden p-0.5 border border-primary/10">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercentage}%` }}
                    transition={{ duration: 0.8 }}
                    className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full shadow-sm"
                  />
                </div>

                <div className="pt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    onClick={() => handleRead(currentPage)}
                    className="py-4 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-3"
                  >
                    <BookOpen className="w-5 h-5" />
                    {currentPage > 1 ? `Resume at Page ${currentPage} (${progressPercentage}%)` : 'Start Reading Reader'}
                  </button>

                  <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-primary/10 shadow-sm">
                    <label className="text-[10px] font-black uppercase text-accent whitespace-nowrap">Jump %:</label>
                    <input 
                      type="range"
                      min="0"
                      max="100"
                      value={progressPercentage}
                      onChange={(e) => {
                        const pct = parseInt(e.target.value) || 0;
                        const targetP = Math.max(1, Math.round((pct / 100) * totalPages));
                        saveReadingProgress(targetP, totalPages, pct);
                      }}
                      className="w-full accent-emerald-600 h-1.5 bg-primary/10 rounded-full appearance-none cursor-pointer"
                    />
                    <span className="text-xs font-mono font-bold text-emerald-700 w-10 text-right">{progressPercentage}%</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={handleDownloadOffline}
                    disabled={downloading || isDownloaded}
                    className={`flex items-center justify-center gap-3 px-8 py-5 rounded-[24px] text-sm font-black uppercase tracking-widest transition-all shadow-lg ${
                      isDownloaded 
                        ? 'bg-green-50 text-green-600 border border-green-200' 
                        : 'bg-primary/5 text-primary border border-primary/10 hover:bg-primary/10'
                    }`}
                  >
                    {downloading ? (
                      <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    ) : isDownloaded ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <Download className="w-5 h-5" />
                    )}
                    {isDownloaded ? 'Locally Available' : downloading ? 'Syncing...' : 'Add to Archive'}
                  </button>

                  <button
                    onClick={handleDirectDownload}
                    disabled={downloading}
                    className="flex items-center justify-center gap-3 px-8 py-5 rounded-[24px] text-sm font-black uppercase tracking-widest transition-all bg-white text-accent border border-primary/10 hover:bg-natural-bg shadow-md"
                  >
                    <FileText className="w-5 h-5" />
                    Download PDF
                  </button>
                </div>

                <div className="flex flex-col gap-3">
                  {isDownloaded && (
                    <button
                      onClick={handleRemoveOffline}
                      className="text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-red-600 transition-colors mt-2 text-center w-full"
                    >
                      Remove from Offline
                    </button>
                  )}

                  {downloading && (
                    <div className="w-full bg-primary/5 rounded-full h-3 overflow-hidden border border-primary/5 mt-2">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${downloadProgress}%` }}
                        className="h-full bg-primary"
                      />
                      <p className="text-[10px] uppercase tracking-[0.2em] font-black text-primary mt-3 text-center">
                        Syncing: {downloadProgress}%
                      </p>
                    </div>
                  )}
                </div>

                <div className="bg-white p-8 rounded-[40px] border-2 border-dashed border-primary/10">
                  <p className="text-[11px] uppercase font-black tracking-[0.2em] text-accent mb-6 text-center">Contribute Your Rating</p>
                  <div className="flex items-center justify-center gap-4">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => handleRate(star)}
                        disabled={ratingLoading}
                        className="transition-all hover:scale-110 active:scale-95 disabled:opacity-50"
                      >
                        <Star 
                          className={`w-12 h-12 transition-colors ${
                            userRating !== null && star <= userRating 
                              ? 'text-yellow-500 fill-current' 
                              : 'text-gray-200 hover:text-yellow-300'
                          }`} 
                        />
                      </button>
                    ))}
                  </div>
                  {userRating && (
                    <p className="text-xs text-green-600 font-bold mt-6 text-center flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Feedback recorded successfully
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-8">
                <div className="flex items-center gap-4">
                  <div className="h-1 w-12 bg-primary rounded-full" />
                  <h2 className="text-2xl font-serif font-black text-natural-text italic">The Narrative</h2>
                </div>
                <div className="bg-natural-bg/40 p-8 md:p-10 rounded-[40px] border border-primary/5">
                  <p className="text-accent leading-relaxed text-lg font-medium whitespace-pre-wrap">
                    {book.description}
                  </p>
                </div>
              </div>

              {/* Author Showcase Section */}
              {writerMetadata && (
                <div className="space-y-10">
                  <div className="flex items-center gap-4">
                    <div className="h-1 w-12 bg-primary rounded-full" />
                    <h2 className="text-2xl font-serif font-black text-natural-text italic">Meet the Author</h2>
                  </div>

                  <div className="bg-white p-8 md:p-12 rounded-[48px] border border-primary/5 shadow-2xl shadow-primary/5 flex flex-col md:flex-row items-center md:items-start gap-10">
                    <div className="relative shrink-0">
                      <div className="w-40 h-40 bg-natural-bg rounded-[48px] overflow-hidden shadow-inner border-2 border-white">
                        {writerMetadata.photoUrl ? (
                          <img src={writerMetadata.photoUrl} alt="Author" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-primary/20">
                            <PenTool className="w-16 h-16" />
                          </div>
                        )}
                      </div>
                      <div className="absolute -bottom-4 -right-4 w-12 h-12 bg-primary text-white rounded-2xl flex items-center justify-center shadow-xl border-4 border-white">
                        <PenTool className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="flex-1 text-center md:text-left">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        <div>
                          <h3 className="text-3xl font-serif font-black text-primary">{writerMetadata.penName || writerMetadata.name}</h3>
                          <p className="text-[10px] font-black uppercase tracking-widest text-[#5A5A40]/40 mt-1">Authorized Archive Author</p>
                        </div>
                        {writerMetadata.categories && writerMetadata.categories.length > 0 && (
                          <div className="flex flex-wrap justify-center md:justify-start gap-2">
                            {writerMetadata.categories.slice(0, 3).map((cat: string) => (
                              <span key={cat} className="px-3 py-1 bg-primary/5 text-primary text-[8px] font-black uppercase tracking-widest rounded-full border border-primary/10">
                                {cat}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <p className="text-base text-accent leading-relaxed italic font-medium">
                        {writerMetadata.bio || "This author prefer to let their literary works speak for themselves. A teller of stories from across the Zambian horizon."}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Comment Section */}
              <div className="space-y-10">
                <div className="flex items-center gap-4">
                  <div className="h-1 w-12 bg-primary rounded-full" />
                  <h2 className="text-2xl font-serif font-black text-natural-text italic">Literary Discourse</h2>
                </div>

                <div className="bg-white p-8 rounded-[40px] border border-primary/5 shadow-xl shadow-primary/5 space-y-8">
                  {getCurrentUser() ? (
                    <form onSubmit={handlePostComment} className="flex flex-col gap-4">
                      <textarea 
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Share your review or start a dialogue..."
                        className="w-full p-6 bg-natural-bg rounded-3xl border border-primary/5 outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/20 transition-all font-medium text-sm min-h-[120px] resize-none"
                      />
                      <div className="flex justify-end">
                        <button 
                          type="submit"
                          disabled={commentLoading || !newComment.trim()}
                          className="flex items-center gap-3 px-8 py-4 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                        >
                          {commentLoading ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                          Post Commentary
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="p-8 bg-natural-bg/50 rounded-3xl border border-dashed border-primary/20 text-center">
                      <p className="text-accent text-xs font-bold">Join the community to participate in the discourse</p>
                    </div>
                  )}

                  <div className="space-y-6">
                    {comments.length === 0 ? (
                      <div className="text-center py-12">
                        <MessageSquare className="w-12 h-12 text-primary/10 mx-auto mb-4" />
                        <p className="text-accent/40 text-[10px] font-black uppercase tracking-widest">No discourse recorded yet</p>
                      </div>
                    ) : (
                      comments.map((comment) => (
                        <motion.div 
                          key={comment.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-6 bg-natural-bg/30 rounded-3xl border border-primary/5 group"
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div>
                                <h4 className="text-sm font-black text-primary mb-0.5">{comment.userName}</h4>
                                <p className="text-[9px] font-black uppercase tracking-widest text-[#5A5A40]/40">
                                  {new Date(comment.createdAt).toLocaleDateString()}
                                </p>
                            </div>
                            {getCurrentUser()?.uid === comment.userId && (
                              <button 
                                onClick={() => handleDeleteComment(comment.id)}
                                className="p-2 text-red-400 opacity-0 group-hover:opacity-100 transition-all hover:text-red-600"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          <p className="text-sm text-natural-text leading-relaxed font-medium italic">
                            "{comment.text}"
                          </p>
                        </motion.div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 w-full max-w-xl px-8 z-50">
        <button
          onClick={handleBuy}
          disabled={buying}
          className="w-full bg-primary text-white font-black text-sm uppercase tracking-[0.2em] py-7 rounded-[32px] shadow-2xl shadow-primary/40 flex items-center justify-center gap-4 transition-all transform hover:-translate-y-1 active:translate-y-0 active:scale-[0.98] disabled:opacity-50"
        >
          {buying ? (
            <div className="w-7 h-7 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : (
            <>
              <ShoppingCart className="w-7 h-7" />
              Own Digital Copy Now
            </>
          )}
        </button>
      </div>

      {/* Secure PDF Viewer */}
      <AnimatePresence>
        {showPdfViewer && viewPdfUrl && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex flex-col pt-24"
            onContextMenu={(e) => e.preventDefault()}
          >
            {/* Top Reading Progress Bar Line */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-white/10 z-[110]">
              <motion.div 
                className="h-full bg-emerald-400 shadow-sm shadow-emerald-400/50"
                style={{ width: `${progressPercentage}%` }}
                animate={{ width: `${progressPercentage}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>

            {/* Resume Toast Banner */}
            <AnimatePresence>
              {showResumeToast && (
                <motion.div 
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="absolute top-28 left-1/2 -translate-x-1/2 z-[120] bg-emerald-500 text-slate-950 font-black px-6 py-2.5 rounded-full text-xs shadow-2xl flex items-center gap-2.5 border border-emerald-300"
                >
                  <Bookmark className="w-4 h-4 fill-slate-950" />
                  <span>Resumed at Page {currentPage} of {totalPages} ({progressPercentage}%)</span>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="absolute top-0 left-0 right-0 h-24 bg-white/5 border-b border-white/10 flex items-center justify-between px-6 md:px-8 backdrop-blur-xl z-[105]">
              <div className="flex items-center gap-4 md:gap-6 overflow-x-auto no-scrollbar py-2">
                <button 
                  onClick={() => {
                    if (viewPdfUrl.startsWith('blob:')) {
                      const base = viewPdfUrl.split('#')[0];
                      URL.revokeObjectURL(base);
                    }
                    setShowPdfViewer(false);
                  }}
                  className="group flex items-center gap-3 px-5 py-3 bg-white/10 hover:bg-white text-white hover:text-primary rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex-shrink-0"
                >
                  <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                  Exit Reader
                </button>

                <div className="h-8 w-px bg-white/10 hidden md:block flex-shrink-0" />

                <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-2xl border border-white/10 flex-shrink-0">
                  <button 
                    onClick={() => setReadingMode('bright')}
                    className={`p-2 rounded-xl transition-all ${readingMode === 'bright' ? 'bg-white text-primary shadow-lg shadow-white/10' : 'text-white/40 hover:bg-white/5'}`}
                    title="Bright Mode"
                  >
                    <Sun className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setReadingMode('dark')}
                    className={`p-2 rounded-xl transition-all ${readingMode === 'dark' ? 'bg-primary text-white shadow-lg shadow-black/10' : 'text-white/40 hover:bg-white/5'}`}
                    title="Dark Mode"
                  >
                    <Moon className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setReadingMode('eyecare')}
                    className={`p-2 rounded-xl transition-all ${readingMode === 'eyecare' ? 'bg-amber-100 text-amber-900 shadow-lg shadow-amber-500/10' : 'text-white/40 hover:bg-white/5'}`}
                    title="Eye Care Mode"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  
                  <div className="h-4 w-px bg-white/10 mx-1" />
                  
                  <button 
                    onClick={() => setShowReaderComments(!showReaderComments)}
                    className={`p-2 rounded-xl transition-all ${showReaderComments ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-white/40 hover:bg-white/5'}`}
                    title="Reader Discourse"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>
                  
                  <button 
                    onClick={() => setShowReaderSettings(!showReaderSettings)}
                    className={`p-2 rounded-xl transition-all ${showReaderSettings ? 'bg-white/20 text-white' : 'text-white/40 hover:bg-white/5'}`}
                    title="Reader Settings"
                  >
                    <Settings2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Page Navigation & Input */}
                <div className="flex items-center gap-2 bg-white/5 p-1 rounded-2xl border border-white/10 flex-shrink-0">
                  <button 
                    onClick={() => navigatePage('prev')}
                    disabled={currentPage <= 1}
                    className="p-2 rounded-xl text-white/60 hover:bg-white/10 disabled:opacity-20 transition-all"
                    title="Previous Page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="px-2 flex items-center gap-1.5 text-xs text-white/80 font-mono">
                    <span className="text-[10px] text-white/40 font-black uppercase">Pg</span>
                    <input 
                      type="number"
                      min="1"
                      className="w-12 bg-white/10 rounded-lg px-1.5 py-1 text-white text-xs font-black text-center focus:outline-none focus:ring-1 focus:ring-emerald-400 transition-all"
                      value={currentPage}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 1;
                        saveReadingProgress(val);
                        handleRead(val);
                      }}
                    />
                    <span className="text-white/40">/</span>
                    <input 
                      type="number"
                      min="1"
                      className="w-12 bg-white/5 rounded-lg px-1.5 py-1 text-white/70 text-xs font-bold text-center focus:outline-none focus:ring-1 focus:ring-white/30 transition-all"
                      value={totalPages}
                      title="Set Total Book Pages"
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 1;
                        saveReadingProgress(currentPage, val);
                      }}
                    />
                  </div>
                  <button 
                    onClick={() => navigatePage('next')}
                    className="p-2 rounded-xl text-white/60 hover:bg-white/10 transition-all"
                    title="Next Page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Percentage Slider */}
                <div className="hidden sm:flex items-center gap-2 bg-white/5 px-3 py-2 rounded-2xl border border-white/10 flex-shrink-0">
                  <Percent className="w-3.5 h-3.5 text-emerald-400" />
                  <input 
                    type="range"
                    min="0"
                    max="100"
                    value={progressPercentage}
                    onChange={(e) => {
                      const pct = parseInt(e.target.value) || 0;
                      const targetP = Math.max(1, Math.round((pct / 100) * totalPages));
                      saveReadingProgress(targetP, totalPages, pct);
                      handleRead(targetP);
                    }}
                    className="w-20 md:w-28 accent-emerald-400 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer"
                  />
                  <span className="text-xs font-mono font-bold text-emerald-400 w-10 text-right">{progressPercentage}%</span>
                </div>

                {/* Saved Notice */}
                {savedNotice && (
                  <div className="flex items-center gap-1 text-[10px] font-black uppercase text-emerald-400 bg-emerald-500/10 px-2.5 py-1.5 rounded-xl border border-emerald-500/20 flex-shrink-0 animate-in fade-in">
                    <Check className="w-3 h-3" />
                    <span>Saved</span>
                  </div>
                )}
              </div>

              <div className="hidden xl:flex flex-col items-center">
                <h3 className="text-white text-sm font-serif font-black italic tracking-tight">{book.title}</h3>
                <p className="text-white/40 text-[9px] font-black uppercase tracking-[0.3em] mt-1">
                  Page {currentPage} of {totalPages} ({progressPercentage}%)
                </p>
              </div>

              <div className="flex items-center gap-4 flex-shrink-0">
                <div className="flex items-center gap-2 px-4 py-3 bg-white/5 border border-white/10 rounded-2xl">
                  <ShieldCheck className="w-4 h-4 text-green-400" />
                  <span className="text-[10px] font-black text-white/80 uppercase tracking-widest">DRM Secure</span>
                </div>
              </div>
            </div>

            <div className="flex-1 w-full max-w-6xl mx-auto px-4 pb-12 relative flex gap-6 select-none" style={{ WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none', userSelect: 'none' }}>
              <div className="flex-1 relative">
                <AnimatePresence>
                  {showReaderSettings && (
                  <motion.div
                    initial={{ opacity: 0, y: -20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.95 }}
                    className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-neutral-900/90 backdrop-blur-xl border border-white/10 p-6 rounded-[24px] shadow-2xl w-64 space-y-6"
                  >
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black uppercase tracking-widest text-white/60">Zoom</label>
                        <span className="text-[10px] font-mono text-white/40">{zoom}%</span>
                      </div>
                      <input 
                        type="range" min="50" max="250" step="10"
                        value={zoom}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setZoom(val);
                          handleRead(currentPage, val);
                        }}
                        className="w-full accent-primary h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer"
                      />
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black uppercase tracking-widest text-white/60">Brightness</label>
                        <span className="text-[10px] font-mono text-white/40">{brightness}%</span>
                      </div>
                      <input 
                        type="range" min="50" max="150" step="1"
                        value={brightness}
                        onChange={(e) => setBrightness(parseInt(e.target.value))}
                        className="w-full accent-primary h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer"
                      />
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black uppercase tracking-widest text-white/60">Contrast</label>
                        <span className="text-[10px] font-mono text-white/40">{contrast}%</span>
                      </div>
                      <input 
                        type="range" min="50" max="150" step="1"
                        value={contrast}
                        onChange={(e) => setContrast(parseInt(e.target.value))}
                        className="w-full accent-primary h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer"
                      />
                    </div>
                    <button 
                      onClick={() => {
                        setBrightness(100);
                        setContrast(100);
                        setZoom(100);
                        handleRead(currentPage, 100);
                      }}
                      className="w-full py-2 bg-white/5 hover:bg-white/10 text-white/60 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all"
                    >
                      Reset to Default
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="absolute inset-x-0 -top-8 flex justify-center">
                <div className="bg-yellow-400 text-primary px-6 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg shadow-yellow-400/20">
                  {readingMode === 'dark' ? 'Dark Mode' : readingMode === 'eyecare' ? 'Eye Care Protocol' : 'Standard Clarity'} Active
                </div>
              </div>
              
              <div className="relative w-full h-full group">
                <iframe 
                  src={`${viewPdfUrl}`}
                  className="w-full h-full rounded-2xl border border-white/10 shadow-[0_0_100px_rgba(253,224,71,0.05)] pointer-events-auto bg-neutral-900 transition-all duration-500"
                  style={{ 
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    filter: getReaderFilter(),
                  }}
                  title="Secure Manuscript Viewer"
                  onLoad={(e) => {
                    // Attempting to block interaction once loaded (may be restricted by CORS if url is external)
                    try {
                      const frame = e.currentTarget;
                      if (frame.contentWindow) {
                        frame.contentWindow.addEventListener('contextmenu', (ev) => ev.preventDefault());
                      }
                    } catch (err) {
                      // Silently skip if CORS blocks access
                    }
                  }}
                />
                
                {/* Security layers */}
                <div className="absolute inset-0 pointer-events-none border-[30px] border-transparent" />
                <div 
                  className="absolute inset-0 pointer-events-none opacity-[0.03]" 
                  style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}
                />
              </div>
            </div>

            {/* Reader Discourse Sidebar */}
            <AnimatePresence>
              {showReaderComments && (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="w-80 bg-neutral-900/80 backdrop-blur-xl border border-white/10 rounded-[32px] overflow-hidden flex flex-col shadow-2xl pointer-events-auto"
                >
                  <div className="p-6 border-b border-white/5 flex justify-between items-center">
                    <div>
                      <h4 className="text-white text-xs font-serif font-black italic">Reader Discourse</h4>
                      <p className="text-[8px] font-black uppercase tracking-widest text-white/30">{comments.length} Observations</p>
                    </div>
                    <button 
                      onClick={() => setShowReaderComments(false)}
                      className="p-2 text-white/40 hover:text-white transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
                    {comments.map((comment) => (
                      <div key={`reader-sidebar-${comment.id}`} className="bg-white/5 p-4 rounded-2xl border border-white/5">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[9px] font-black text-primary uppercase tracking-wider">{comment.userName}</span>
                          <span className="text-[7px] font-bold text-white/20">{new Date(comment.createdAt).toLocaleDateString()}</span>
                        </div>
                        <p className="text-[11px] text-white/80 leading-relaxed italic">"{comment.text}"</p>
                      </div>
                    ))}
                    {comments.length === 0 && (
                      <div className="text-center py-12 opacity-20">
                        <MessageSquare className="w-8 h-8 mx-auto mb-2 text-white" />
                        <p className="text-[8px] font-black uppercase tracking-widest text-white">Quiet Reflection</p>
                      </div>
                    )}
                  </div>

                  <div className="p-6 border-t border-white/5">
                    <form onSubmit={handlePostComment} className="relative">
                      <input 
                        type="text"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Add to discourse..."
                        className="w-full pl-4 pr-10 py-3 bg-white/5 rounded-xl border border-white/10 text-[11px] text-white outline-none focus:ring-1 focus:ring-primary/30 transition-all font-medium"
                      />
                      <button 
                        type="submit"
                        disabled={!newComment.trim() || commentLoading}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-primary hover:scale-110 disabled:opacity-30 transition-all"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
    </div>
  );
}
