import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, getCurrentUser } from './firebase';
import { set, get } from 'idb-keyval';

export interface ReadingProgress {
  bookId: string;
  currentPage: number;
  totalPages: number;
  percentage: number;
  lastReadAt: string;
}

const LOCAL_STORAGE_KEY_PREFIX = 'reading_progress_';

export function getLocalBookProgress(bookId: string): ReadingProgress | null {
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${bookId}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to read progress from localStorage', e);
  }
  return null;
}

export function setLocalBookProgress(progress: ReadingProgress): void {
  try {
    localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${progress.bookId}`, JSON.stringify(progress));
  } catch (e) {
    console.error('Failed to save progress to localStorage', e);
  }
}

export function getAllLocalProgress(): Record<string, ReadingProgress> {
  const result: Record<string, ReadingProgress> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(LOCAL_STORAGE_KEY_PREFIX)) {
        const bookId = key.replace(LOCAL_STORAGE_KEY_PREFIX, '');
        const val = localStorage.getItem(key);
        if (val) {
          result[bookId] = JSON.parse(val);
        }
      }
    }
  } catch (e) {
    console.error('Failed to get all progress', e);
  }
  return result;
}

export async function saveReadingProgress(
  bookId: string,
  currentPage: number,
  totalPages: number = 50,
  customPercentage?: number
): Promise<ReadingProgress> {
  const safePage = Math.max(1, currentPage);
  const safeTotal = Math.max(1, totalPages);
  const calculatedPercentage = customPercentage !== undefined
    ? Math.min(100, Math.max(0, Math.round(customPercentage)))
    : Math.min(100, Math.max(0, Math.round((safePage / safeTotal) * 100)));

  const progress: ReadingProgress = {
    bookId,
    currentPage: safePage,
    totalPages: safeTotal,
    percentage: calculatedPercentage,
    lastReadAt: new Date().toISOString()
  };

  // 1. Save synchronously to localStorage
  setLocalBookProgress(progress);

  // 2. Save to IndexedDB
  try {
    await set(`progress_${bookId}`, progress);
    
    // Also update downloaded book object in IndexedDB if exists
    const localBook = await get(`book_${bookId}`);
    if (localBook) {
      await set(`book_${bookId}`, {
        ...localBook,
        lastPage: safePage,
        totalPages: safeTotal,
        percentage: calculatedPercentage
      });
    }
  } catch (e) {
    console.error('Error writing progress to IDB:', e);
  }

  // 3. Sync to Firestore if user logged in
  const currentUser = getCurrentUser();
  if (currentUser && navigator.onLine) {
    try {
      const progressRef = doc(db, 'users', currentUser.uid, 'readingProgress', bookId);
      await setDoc(progressRef, {
        bookId,
        currentPage: safePage,
        totalPages: safeTotal,
        percentage: calculatedPercentage,
        updatedAt: progress.lastReadAt
      }, { merge: true });
    } catch (err) {
      console.warn('Firestore progress sync failed, saved locally:', err);
    }
  }

  return progress;
}

export async function fetchReadingProgress(bookId: string): Promise<ReadingProgress | null> {
  // Check localStorage first for instant response
  let progress = getLocalBookProgress(bookId);

  // Check IDB if not in localStorage
  if (!progress) {
    try {
      const idbProgress = await get(`progress_${bookId}`);
      if (idbProgress) {
        progress = idbProgress as ReadingProgress;
        setLocalBookProgress(progress);
      }
    } catch (e) {
      console.error('Failed to read IDB progress', e);
    }
  }

  // Check Firestore if user logged in
  const currentUser = getCurrentUser();
  if (currentUser && navigator.onLine) {
    try {
      const progressRef = doc(db, 'users', currentUser.uid, 'readingProgress', bookId);
      const snap = await getDoc(progressRef);
      if (snap.exists()) {
        const data = snap.data();
        const firestoreProgress: ReadingProgress = {
          bookId,
          currentPage: data.currentPage || 1,
          totalPages: data.totalPages || 50,
          percentage: data.percentage || Math.round(((data.currentPage || 1) / (data.totalPages || 50)) * 100),
          lastReadAt: data.updatedAt || new Date().toISOString()
        };
        // Update local if newer or not present
        if (!progress || new Date(firestoreProgress.lastReadAt) > new Date(progress.lastReadAt)) {
          progress = firestoreProgress;
          setLocalBookProgress(progress);
          await set(`progress_${bookId}`, progress);
        }
      }
    } catch (err) {
      console.warn('Could not fetch Firestore progress:', err);
    }
  }

  return progress;
}
