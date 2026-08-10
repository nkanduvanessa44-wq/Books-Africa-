import { collection, addDoc } from 'firebase/firestore';
import { db } from './firebase';

export const REAL_LIFE_BOOKS = [
  {
    title: "The Great Gatsby",
    author: "F. Scott Fitzgerald",
    price: "K150.00",
    description: "A story of ambition, love, and the American Dream in the Roaring Twenties.",
    category: "Classic Literature",
    coverUrl: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=400",
    pdfUrl: "#",
    downloadCount: 1240,
    ratingAverage: 4.8,
    ratingCount: 85
  },
  {
    title: "1984",
    author: "George Orwell",
    price: "K120.00",
    description: "A dystopian masterpiece about surveillance, truth, and rebellion.",
    category: "Sci-Fi / Dystopian",
    coverUrl: "https://images.unsplash.com/photo-1541963463532-d68292c34b19?auto=format&fit=crop&q=80&w=400",
    pdfUrl: "#",
    downloadCount: 3100,
    ratingAverage: 4.9,
    ratingCount: 150
  },
  {
    title: "Atomic Habits",
    author: "James Clear",
    price: "K200.00",
    description: "An easy and proven way to build good habits and break bad ones.",
    category: "Self-Help",
    coverUrl: "https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&q=80&w=400",
    pdfUrl: "#",
    downloadCount: 5200,
    ratingAverage: 4.9,
    ratingCount: 420
  },
  {
    title: "The Hobbit",
    author: "J.R.R. Tolkien",
    price: "K180.00",
    description: "The classic fantasy adventure of Bilbo Baggins and his quest for treasure.",
    category: "Fantasy",
    coverUrl: "https://images.unsplash.com/photo-1621351183012-e2f9972dd9bf?auto=format&fit=crop&q=80&w=400",
    pdfUrl: "#",
    downloadCount: 890,
    ratingAverage: 4.7,
    ratingCount: 64
  },
  {
    title: "Thinking, Fast and Slow",
    author: "Daniel Kahneman",
    price: "K250.00",
    description: "A deep dive into the two systems that drive the way we think.",
    category: "Psychology",
    coverUrl: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=400",
    pdfUrl: "#",
    downloadCount: 150,
    ratingAverage: 4.5,
    ratingCount: 32
  }
];

export async function seedBooks(userId: string) {
  const booksCol = collection(db, 'books');
  const promises = REAL_LIFE_BOOKS.map(book => 
    addDoc(booksCol, {
      ...book,
      writerId: userId,
      createdAt: new Date().toISOString()
    })
  );
  await Promise.all(promises);
}
