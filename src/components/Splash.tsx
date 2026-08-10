import React, { useEffect } from 'react';
import { motion } from 'motion/react';

export default function Splash() {
  return (
    <div className="fixed inset-0 bg-primary flex flex-col items-center justify-center text-white z-50">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <h1 className="text-5xl font-black italic tracking-tighter mb-2">Books Africa</h1>
        <p className="text-blue-100 italic">African Stories & Masterpieces</p>
      </motion.div>
      <div className="absolute bottom-12">
        <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
      </div>
    </div>
  );
}
