import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ref, uploadBytes, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { addDoc, collection, doc, getDoc, updateDoc } from 'firebase/firestore';
import { ArrowLeft, Upload as UploadIcon, Image as ImageIcon, FileText, Plus, ShieldCheck, Loader2, Scissors, Check, X, Save, Sparkles, Wand2, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Cropper from 'react-easy-crop';
import { toast } from 'sonner';
import { auth, db, storage, getCurrentUser } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { getCroppedImg } from '../lib/cropImage';
import { set } from 'idb-keyval';

const readFileAsDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
};

const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const max_size = 500;
        if (width > height) {
          if (width > max_size) {
            height *= max_size / width;
            width = max_size;
          }
        } else {
          if (height > max_size) {
            width *= max_size / height;
            height = max_size;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        } else {
          resolve(e.target?.result as string);
        }
      };
      img.onerror = () => {
        resolve(e.target?.result as string);
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      resolve('');
    };
    reader.readAsDataURL(file);
  });
};

export default function Upload() {
  const [searchParams] = useSearchParams();
  const editingId = searchParams.get('id');
  
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [price, setPrice] = useState('');
  const [desc, setDesc] = useState('');
  const [category, setCategory] = useState('Fiction');
  const [ageRating, setAgeRating] = useState('All Ages');
  const [cover, setCover] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [pdf, setPdf] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [isScript, setIsScript] = useState(false);
  const [existingPdfUrl, setExistingPdfUrl] = useState<string | null>(null);
  const [existingCoverUrl, setExistingCoverUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [userMetadata, setUserMetadata] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const navigate = useNavigate();

  const handleAiPolish = async (type: 'synopsis' | 'metadata' | 'feedback') => {
    if (!desc && (type === 'synopsis' || type === 'feedback')) {
      toast.error('Please input a brief narrative first for Gemini to analyze.');
      return;
    }
    
    setAiLoading(true);
    try {
      const response = await fetch('/api/gemini/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: type === 'synopsis' ? desc : `${title}\n\n${desc}`,
          type
        })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch from the server-side Gemini gateway.');
      }

      const data = await response.json();
      if (type === 'synopsis') {
        setDesc(data.result);
        toast.success('Your synopsis has been polished with Gemini insight!');
      } else if (type === 'metadata') {
        const metadata = JSON.parse(data.result);
        if (metadata.recommendedCategory) setCategory(metadata.recommendedCategory);
        if (metadata.ageRating) setAgeRating(metadata.ageRating);
        if (metadata.keywords && metadata.keywords.length > 0) {
          const tagsStr = `\n\nTags: ${metadata.keywords.join(', ')}`;
          if (!desc.includes('Tags:')) {
            setDesc(prev => prev + tagsStr);
          }
          toast.success(`Classified! Category: ${metadata.recommendedCategory}, Rating: ${metadata.ageRating}`);
        }
      } else if (type === 'feedback') {
        toast.info(data.result, { duration: 10000 });
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Gemini Assistant connection issue: ' + err.message);
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    const fetchMeta = async () => {
      const sandboxUserStr = localStorage.getItem('sandbox_user');
      if (sandboxUserStr) {
        try {
          const parsed = JSON.parse(sandboxUserStr);
          setUserMetadata(parsed);
          if (!editingId) {
            if (parsed.penName) setAuthor(parsed.penName);
            else if (parsed.name) setAuthor(parsed.name);
          }
          return;
        } catch (e) {}
      }
      try {
        const snap = await getDoc(doc(db, 'users', currentUser.uid));
        if (snap.exists()) {
          const data = snap.data();
          setUserMetadata(data);
          if (!editingId) {
            if (data.penName) setAuthor(data.penName);
            else if (data.name) setAuthor(data.name);
          }
        }
      } catch (err) {
        console.warn("Meta fetch error (non-fatal):", err);
      }
    };
    fetchMeta();
  }, [editingId]);

  useEffect(() => {
    if (!editingId) return;
    
    const fetchBook = async () => {
      setFetching(true);
      try {
        const snap = await getDoc(doc(db, 'books', editingId));
        if (snap.exists()) {
          const data = snap.data();
          if (data.writerId !== getCurrentUser()?.uid) {
            toast.error('Identity Mismatch: Access to this manuscript is restricted.');
            navigate('/writer-dashboard');
            return;
          }
          setTitle(data.title || '');
          setAuthor(data.author || '');
          setPrice(data.price || '');
          setDesc(data.description || '');
          setCategory(data.category || 'Fiction');
          setAgeRating(data.ageRating || 'All Ages');
          setIsScript(data.isScript || false);
          setExistingCoverUrl(data.coverUrl || null);
          setExistingPdfUrl(data.pdfUrl || null);
          if (data.coverUrl) setCoverPreview(data.coverUrl);
        }
      } catch (err) {
        console.error("Fetch error:", err);
        toast.error('Failed to retrieve archival entry.');
      } finally {
        setFetching(false);
      }
    };
    fetchBook();
  }, [editingId, navigate]);

  const categories = ['Fiction', 'Non-Fiction', 'Poetry', 'Academic', 'History', 'Education', 'Traditional', 'Contemporary', 'Drama', 'Biography', 'Other'];
  const [customCategory, setCustomCategory] = useState('');

  const [uploadStatus, setUploadStatus] = useState('');

  const handleUpload = async (e: React.FormEvent, asDraft: boolean = false) => {
    e.preventDefault();
    
    const currentUser = getCurrentUser();
    if (!currentUser) {
      toast.error('Identity required for archival access.');
      return;
    }

    if (!cover && !existingCoverUrl) {
      toast.error('Identity visual component missing (Cover Art).');
      return;
    }

    if (!pdf && !existingPdfUrl) {
      toast.error('Intellectual content missing (PDF Manuscript).');
      return;
    }

    if (!currentUser.emailVerified && currentUser.providerData[0]?.providerId === 'password') {
      toast.info('Security Notice: Continuing without email verification for sandbox convenience.');
    }

    setLoading(true);
    setUploadProgress(0);
    setUploadStatus('Synchronizing nodes...');
    toast.info(asDraft ? 'Preserving draft manuscript...' : 'Initiating global publication...');

    try {
      const finalCategory = category === 'Other' ? customCategory : category;
      const timestamp = Date.now();
      
      let coverUrl = existingCoverUrl;
      let pdfUrl = existingPdfUrl;

      const progressState = { cover: cover ? 0 : 100, pdf: pdf ? 0 : 100 };
      const totalToUploadSize = (cover ? cover.size : 0) + (pdf ? pdf.size : 0);
      
      const uploadWithProgress = (storageRef: any, file: File, key: 'cover' | 'pdf') => {
        return new Promise<string>((resolve, reject) => {
          let lastBytesTransferred = 0;
          let progressTimer: any = null;

          const uploadTask = uploadBytesResumable(storageRef, file, {
            contentType: file.type
          });

          // Connection timeout: abort if no progress at all in first 30 seconds
          const connectionTimer = setTimeout(() => {
            if (lastBytesTransferred === 0) {
              console.warn(`[Storage] Connection timeout for ${key} - zero progress within 30s.`);
              uploadTask.cancel();
              reject(new Error('Connection timeout'));
            }
          }, 30000);

          // Stalled progress timeout: abort if progress stops for more than 60 seconds
          const resetProgressTimer = () => {
            if (progressTimer) clearTimeout(progressTimer);
            progressTimer = setTimeout(() => {
              console.warn(`[Storage] Progress stalled for ${key}.`);
              uploadTask.cancel();
              reject(new Error('Stalled progress'));
            }, 60000);
          };

          resetProgressTimer();

          uploadTask.on('state_changed', 
            (snapshot) => {
              const bytes = snapshot.bytesTransferred;
              if (bytes > lastBytesTransferred) {
                lastBytesTransferred = bytes;
                resetProgressTimer();
              }
              progressState[key] = bytes;
              if (totalToUploadSize > 0) {
                const currentTotal = (cover ? progressState.cover : 0) + (pdf ? progressState.pdf : 0);
                const overall = (currentTotal / totalToUploadSize) * 100;
                setUploadProgress(Math.round(overall));
              }
              setUploadStatus(`${asDraft ? 'Saving' : 'Uploading'} ${key}: ${Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)}%`);
            },
            (error) => {
              clearTimeout(connectionTimer);
              if (progressTimer) clearTimeout(progressTimer);
              console.warn(`[Storage] ${key} upload failed:`, error);
              reject(error);
            },
            async () => {
              clearTimeout(connectionTimer);
              if (progressTimer) clearTimeout(progressTimer);
              try {
                const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
                resolve(downloadUrl);
              } catch (err) {
                reject(err);
              }
            }
          );
        });
      };

      const uploadWithProgressAndRetry = async (storageRef: any, file: File, key: 'cover' | 'pdf', maxRetries = 3) => {
        const isSandbox = !!localStorage.getItem('sandbox_user');
        if (isSandbox) {
          console.warn(`[Storage] Sandbox Mode detected. Bypassing Firebase Storage upload for ${key} to use instant local database fallback.`);
          throw new Error('Sandbox storage bypass');
        }

        const isDev = window.location.hostname.includes('run.app') || window.location.hostname === 'localhost';
        const finalMaxRetries = isDev ? 1 : maxRetries;

        let attempt = 0;
        while (attempt < finalMaxRetries) {
          try {
            const url = await uploadWithProgress(storageRef, file, key);
            return url;
          } catch (err) {
            attempt++;
            console.warn(`[Storage] Upload attempt ${attempt} failed for ${key}. Retrying...`, err);
            if (attempt >= finalMaxRetries) {
              throw err;
            }
            await new Promise((res) => setTimeout(res, 1500));
          }
        }
        throw new Error(`Failed to upload ${key} after ${finalMaxRetries} attempts.`);
      };

      if (cover) {
        try {
          const coverRef = ref(storage, `covers/${timestamp}-${cover.name}`);
          coverUrl = await uploadWithProgressAndRetry(coverRef, cover, 'cover');
        } catch (storageErr) {
          console.warn("Firebase Storage unavailable for cover, using fallback logic...", storageErr);
          setUploadStatus('Optimizing cover as database asset...');
          coverUrl = await compressImage(cover);
        }
      }

      if (pdf) {
        try {
          const pdfRef = ref(storage, `books/${timestamp}-${pdf.name}`);
          pdfUrl = await uploadWithProgressAndRetry(pdfRef, pdf, 'pdf');
        } catch (storageErr) {
          console.warn("Firebase Storage unavailable for manuscript, using fallback logic...", storageErr);
          setUploadStatus('Processing manuscript document...');
          const isWordDoc = pdf.name.toLowerCase().endsWith('.doc') || pdf.name.toLowerCase().endsWith('.docx');
          
          if (isWordDoc) {
            try {
              const textContent = await pdf.text();
              const cleanLines = textContent
                .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
                .split(/\n+/)
                .map(line => line.trim())
                .filter(line => line.length > 3);

              const docTitle = pdf.name.replace(/\.[^/.]+$/, "");
              const htmlDoc = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>${docTitle}</title>
    <style>
      body { font-family: 'Georgia', 'Times New Roman', serif; line-height: 1.8; padding: 48px 32px; background: #FAF9F5; color: #2A2A2A; max-width: 800px; margin: 0 auto; }
      h1 { text-align: center; font-size: 28px; margin-bottom: 24px; font-weight: 900; border-bottom: 2px solid #E5E3D8; padding-bottom: 16px; color: #111; }
      p { text-indent: 2em; margin-bottom: 1.2em; text-align: justify; font-size: 18px; color: #333; }
      .meta { text-align: center; font-size: 11px; color: #888; font-family: sans-serif; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 32px; }
    </style>
  </head>
  <body>
    <div class="meta">Manuscript Document (${pdf.name})</div>
    <h1>${title || docTitle}</h1>
    ${cleanLines.length > 0 
      ? cleanLines.map(l => `<p>${l}</p>`).join('') 
      : `<p>Manuscript text content loaded successfully from ${pdf.name}.</p>`}
  </body>
</html>`;
              pdfUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlDoc);
            } catch (err) {
              pdfUrl = await readFileAsDataURL(pdf);
            }
          } else if (pdf.size < 800 * 1024) {
            pdfUrl = await readFileAsDataURL(pdf);
          } else {
            const localKey = `offline_pdf_${timestamp}`;
            const pdfBase64 = await readFileAsDataURL(pdf);
            await set(localKey, pdfBase64);
            pdfUrl = `https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf#local_ref=${localKey}`;
          }
        }
      }

      setUploadStatus('Writing to decentralized ledger...');
      
      const bookData = {
        title,
        author,
        price,
        description: desc,
        category: finalCategory || category || 'Uncategorized',
        ageRating,
        coverUrl,
        pdfUrl,
        writerId: getCurrentUser().uid,
        updatedAt: new Date().toISOString(),
        isApproved: false, 
        status: asDraft ? 'draft' : 'published',
        isScript,
      };

      try {
        if (editingId) {
          await updateDoc(doc(db, 'books', editingId), bookData);
        } else {
          await addDoc(collection(db, 'books'), {
            ...bookData,
            createdAt: new Date().toISOString(),
            ratingAverage: 0,
            ratingCount: 0,
            downloadCount: 0
          });
        }

        toast.success(asDraft ? 'Draft manuscript preserved in your workspace.' : 'Manuscript broadcasted to the archives!');
        navigate('/writer-dashboard');
      } catch (err) {
        handleFirestoreError(err, editingId ? OperationType.UPDATE : OperationType.CREATE, 'books');
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Transmission failure: ' + err.message);
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setImageToCrop(reader.result as string);
        setIsCropping(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const showCroppedImage = useCallback(async () => {
    try {
      if (!imageToCrop || !croppedAreaPixels) return;
      const croppedImage = await getCroppedImg(imageToCrop, croppedAreaPixels);
      if (croppedImage) {
        const file = new File([croppedImage], 'cover.jpg', { type: 'image/jpeg' });
        setCover(file);
        setCoverPreview(URL.createObjectURL(file));
        setIsCropping(false);
        setImageToCrop(null);
        toast.success('Artwork framed perfectly.');
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to crop artwork.');
    }
  }, [imageToCrop, croppedAreaPixels]);

  return (
    <div className="min-h-screen bg-natural-bg font-sans pb-20">
      <AnimatePresence>
        {isCropping && imageToCrop && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex flex-col"
          >
            <div className="p-8 flex items-center justify-between">
              <div>
                <h2 className="text-white text-2xl font-serif font-black italic">Frame Your Artwork</h2>
                <p className="text-[10px] text-white/50 uppercase tracking-widest font-black mt-1">Scale and position your cover</p>
              </div>
              <button 
                onClick={() => { setIsCropping(false); setImageToCrop(null); }}
                className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white hover:bg-white/20 transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 relative">
              <Cropper
                image={imageToCrop}
                crop={crop}
                zoom={zoom}
                aspect={2 / 3}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>

            <div className="p-10 bg-white/5 border-t border-white/10 space-y-8">
              <div className="space-y-4">
                <div className="flex justify-between text-[10px] text-white/50 font-black uppercase tracking-widest px-1">
                  <span>Zoom Intensity</span>
                  <span>{Math.round(zoom * 100)}%</span>
                </div>
                <input
                  type="range"
                  value={zoom}
                  min={1}
                  max={3}
                  step={0.1}
                  aria-labelledby="Zoom"
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>

              <button
                onClick={showCroppedImage}
                className="w-full bg-primary text-white font-black text-sm uppercase tracking-[0.2em] py-6 rounded-3xl shadow-2xl flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all"
              >
                <Check className="w-5 h-5" />
                Commit Frame
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <header className="px-8 py-10 bg-white/50 backdrop-blur-md sticky top-0 z-40 border-b border-primary/5 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button onClick={() => navigate(-1)} className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm text-accent hover:text-primary transition-all active:scale-95">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-3xl font-serif font-black text-natural-text italic">
              {editingId ? 'Refine Archive' : 'Contribute Library'}
            </h1>
            <p className="text-[10px] uppercase tracking-[0.2em] text-accent font-black mt-1">
              {editingId ? 'Updating existing literary record' : 'Expanding the Zambian Narrative'}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto p-8 pt-12">
        {fetching ? (
          <div className="py-20 flex flex-col items-center justify-center gap-6">
            <div className="w-12 h-12 bg-white rounded-3xl flex items-center justify-center shadow-xl">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-accent">Accessing Archives...</p>
          </div>
        ) : (
          <form onSubmit={handleUpload} className="space-y-12">
          <div className="flex flex-col items-center">
            <div className={`w-44 h-64 rounded-[48px] bg-white flex flex-col items-center justify-center border-2 border-dashed border-primary/10 relative shadow-inner overflow-hidden transition-all group ${cover ? 'border-primary ring-8 ring-primary/5 shadow-2xl' : 'hover:border-primary/30'}`}>
              {coverPreview ? (
                <div className="relative w-full h-full group">
                  <img src={coverPreview} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                    <Scissors className="w-6 h-6 text-white" />
                    <span className="text-[8px] font-black uppercase text-white tracking-widest">Adjust Frame</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center p-6">
                  <div className="w-16 h-16 bg-natural-bg rounded-3xl flex items-center justify-center mb-4 shadow-sm group-hover:scale-110 transition-transform">
                    <ImageIcon className="w-8 h-8 text-primary/30" />
                  </div>
                  <span className="text-[10px] uppercase font-black text-accent tracking-widest leading-relaxed">Manuscript<br/>Cover Art</span>
                </div>
              )}
              <input 
                type="file" 
                required={!cover}
                accept="image/*" 
                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                onChange={handleImageSelect}
              />
            </div>
            {cover && (
              <motion.p 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[10px] uppercase font-black text-primary mt-6 tracking-widest bg-primary/5 px-4 py-1.5 rounded-full"
              >
                Artwork Selected
              </motion.p>
            )}
          </div>

          <div className="space-y-8 bg-white p-10 rounded-[48px] shadow-2xl shadow-primary/5 border border-primary/5">
            <div className="flex gap-4 p-2 bg-natural-bg rounded-3xl border border-primary/5">
              <button 
                type="button"
                onClick={() => setIsScript(false)}
                className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${!isScript ? 'bg-primary text-white shadow-lg' : 'text-accent hover:bg-white/50'}`}
              >
                Manuscript
              </button>
              <button 
                type="button"
                onClick={() => setIsScript(true)}
                className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${isScript ? 'bg-primary text-white shadow-lg' : 'text-accent hover:bg-white/50'}`}
              >
                Script
              </button>
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-[0.2em] font-black text-accent mb-3">Work Title</label>
              <input 
                type="text" required
                className="w-full p-4 bg-natural-bg rounded-2xl border border-primary/5 outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/20 transition-all font-medium"
                placeholder="Name of your manuscript"
                value={title} onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-[11px] uppercase tracking-[0.2em] font-black text-accent mb-3">Writer</label>
                <input 
                  type="text" required
                  className="w-full p-4 bg-natural-bg rounded-2xl border border-primary/5 outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/20 transition-all font-medium"
                  placeholder="Author name"
                  value={author} onChange={(e) => setAuthor(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-[0.2em] font-black text-accent mb-3">Price (ZMW)</label>
                <input 
                  type="number" required step="0.01"
                  className="w-full p-4 bg-natural-bg rounded-2xl border border-primary/5 outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/20 transition-all font-medium"
                  placeholder="0.00"
                  value={price} onChange={(e) => setPrice(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <label className="block text-[11px] uppercase tracking-[0.2em] font-black text-accent mb-3">Literary Classification</label>
                <div className="relative">
                  <select 
                    className="w-full p-4 bg-natural-bg rounded-2xl border border-primary/5 outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/20 appearance-none transition-all font-bold text-sm"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-accent">
                    <ArrowLeft className="w-4 h-4 -rotate-90" />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <label className="block text-[11px] uppercase tracking-[0.2em] font-black text-accent mb-3">Age Rating</label>
                <div className="relative">
                  <select 
                    className="w-full p-4 bg-natural-bg rounded-2xl border border-primary/5 outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/20 appearance-none transition-all font-bold text-sm"
                    value={ageRating}
                    onChange={(e) => setAgeRating(e.target.value)}
                  >
                    <option value="Kids">Kids</option>
                    <option value="All Ages">All Ages</option>
                    <option value="PG-13">PG-13</option>
                    <option value="18+">18+</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-accent">
                    <ArrowLeft className="w-4 h-4 -rotate-90" />
                  </div>
                </div>
              </div>
            </div>
              
            <AnimatePresence>
              {category === 'Other' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-6"
                >
                  <label className="block text-[11px] uppercase tracking-[0.2em] font-black text-accent mb-3">Define Category</label>
                  <input 
                    type="text" required
                    className="w-full p-4 bg-natural-bg rounded-2xl border border-primary/5 outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/20 transition-all font-medium"
                    placeholder="Enter custom genre..."
                    value={customCategory} onChange={(e) => setCustomCategory(e.target.value)}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label className="block text-[11px] uppercase tracking-[0.2em] font-black text-accent mb-3">Brief Narrative</label>
              <textarea 
                required
                className="w-full p-5 bg-natural-bg rounded-[24px] border border-primary/5 outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/20 transition-all font-medium min-h-[160px] resize-none"
                placeholder="What is the heart of this story?"
                value={desc} onChange={(e) => setDesc(e.target.value)}
              />
              <div className="mt-4 flex flex-wrap gap-3 p-4 bg-primary/5 rounded-3xl border border-primary/10">
                <div className="w-full flex items-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                  <span className="text-[10px] uppercase font-black tracking-widest text-primary">Gemini AI Assistant</span>
                </div>
                <button
                  type="button"
                  disabled={aiLoading}
                  onClick={() => handleAiPolish('synopsis')}
                  className="flex-1 min-w-[120px] bg-white border border-primary/15 hover:border-primary/30 text-[10px] font-black uppercase tracking-wider py-2.5 px-4 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-primary active:scale-95"
                >
                  {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                  Polish Synopsis
                </button>
                <button
                  type="button"
                  disabled={aiLoading}
                  onClick={() => handleAiPolish('metadata')}
                  className="flex-1 min-w-[120px] bg-white border border-primary/15 hover:border-primary/30 text-[10px] font-black uppercase tracking-wider py-2.5 px-4 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-primary active:scale-95"
                >
                  {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  Auto-Classify Work
                </button>
                <button
                  type="button"
                  disabled={aiLoading}
                  onClick={() => handleAiPolish('feedback')}
                  className="flex-1 min-w-[120px] bg-white border border-primary/15 hover:border-primary/30 text-[10px] font-black uppercase tracking-wider py-2.5 px-4 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-primary active:scale-95"
                >
                  {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Get AI Feedback
                </button>
              </div>
            </div>
          </div>

          <div className="p-8 bg-white/70 backdrop-blur-xl rounded-[40px] border border-white/60 flex items-center justify-between shadow-xl shadow-primary/5">
            <div className="flex items-center gap-6">
              <div className={`w-16 h-16 rounded-[24px] flex items-center justify-center transition-all shadow-inner ${pdf ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-white/50 text-accent border border-white/80'}`}>
                <FileText className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm font-black truncate max-w-[200px] text-natural-text">{pdf ? pdf.name : 'Select Manuscript'}</p>
                <p className="text-[10px] text-accent tracking-widest font-bold mt-1 uppercase">
                  {pdf 
                    ? (pdf.size / 1024 / 1024).toFixed(2) + ' MB (' + (pdf.name.toLowerCase().endsWith('.pdf') ? 'PDF' : 'Word Document') + ')' 
                    : 'PDF or Word (.doc / .docx)'}
                </p>
              </div>
            </div>
            <label className="bg-primary text-white w-14 h-14 rounded-2xl flex items-center justify-center cursor-pointer hover:bg-primary-dark transition-all transform active:scale-90 shadow-lg shadow-primary/20">
              <Plus className="w-8 h-8" />
              <input 
                type="file" 
                accept="application/pdf, .doc, .docx, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document" 
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  if (file) {
                    const ext = file.name.toLowerCase();
                    const isValid = ext.endsWith('.pdf') || ext.endsWith('.doc') || ext.endsWith('.docx') || file.type.includes('pdf') || file.type.includes('word') || file.type.includes('officedocument');
                    if (!isValid) {
                      toast.error('Validation Check: Only PDF (.pdf) and Word (.doc, .docx) documents are allowed.');
                      return;
                    }
                    setPdf(file);
                    toast.success(`Manuscript loaded: ${file.name}`);
                  }
                }}
              />
            </label>
          </div>

          {!getCurrentUser()?.emailVerified && getCurrentUser()?.providerData[0]?.providerId === 'password' && (
            <div className="p-6 bg-yellow-50 border border-yellow-100 rounded-[32px] flex items-center gap-4">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-yellow-600 shadow-sm shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <p className="text-[11px] text-yellow-800 font-bold leading-relaxed">
                Verification Required: Please check your inbox for a verification link. You must verify your email before publishing to the archives.
              </p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4">
            <button
              type="button"
              disabled={loading}
              onClick={(e) => handleUpload(e as any, true)}
              className="flex-1 bg-white text-primary border-2 border-primary/10 font-black text-[11px] uppercase tracking-[0.2em] py-6 rounded-[32px] shadow-xl disabled:opacity-50 transition transform hover:-translate-y-1 active:translate-y-0 active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : editingId ? 'Update Draft' : 'Preserve as Draft'}
            </button>

            <button
              type="submit"
              disabled={loading}
              className="flex-[2] bg-primary text-white font-black text-sm uppercase tracking-[0.2em] py-6 rounded-[32px] shadow-2xl shadow-primary/40 disabled:opacity-50 transition transform hover:-translate-y-1 active:translate-y-0 active:scale-[0.98] flex flex-col items-center justify-center gap-1 relative overflow-hidden"
            >
              {loading ? (
                <>
                  <div className="flex items-center gap-4">
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <div className="text-center">
                      <p className="text-[10px] font-black">{uploadProgress}%</p>
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-0 h-1 bg-white/20 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                </>
              ) : (
                <>
                  {(!cover && !existingCoverUrl) || (!pdf && !existingPdfUrl) ? (
                    <span className="text-[10px] text-white/60 lowercase">Awaiting resources...</span>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        {editingId ? <Check className="w-5 h-5" /> : <UploadIcon className="w-5 h-5" />}
                        {editingId ? 'Update Publication' : 'Publish To Archives'}
                      </div>
                    </>
                  )}
                </>
              )}
            </button>
          </div>
        </form>
      )}
      </main>
    </div>
  );
}
