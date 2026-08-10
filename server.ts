import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // API Route for Gemini Analyze
  app.post("/api/gemini/analyze", async (req, res) => {
    try {
      const { text, type } = req.body;
      if (!text) {
        return res.status(400).json({ error: "No text content provided for analysis." });
      }

      let systemPrompt = "";
      if (type === "synopsis") {
        systemPrompt = "You are an expert literary editor. Analyze the provided book description or draft content and write an engaging, high-quality, and captivating synopsis (max 3-4 sentences) optimized for a book marketplace like Books Africa. Focus on highlighting cultural elements, narrative hooks, and emotional resonance.";
      } else if (type === "metadata") {
        systemPrompt = "You are a database classification system. Analyze the provided book description and return a JSON object with: 1) recommendedCategory (choose from: Fiction, Non-Fiction, Poetry, Academic, History, Education, Traditional, Contemporary, Drama, Biography), 2) ageRating (choose from: Kids, All Ages, PG-13, 18+), and 3) keywords (list of 4-5 tags). Output ONLY valid JSON.";
      } else {
        systemPrompt = "You are a creative writing mentor. Analyze the provided book description or synopsis and suggest 3 key improvements to make it more appealing to readers. Format the output with clear bullet points.";
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: text,
        config: {
          systemInstruction: systemPrompt,
          ...(type === "metadata" ? { responseMimeType: "application/json" } : {})
        }
      });

      res.json({ result: response.text });
    } catch (err: any) {
      console.error("Gemini server error:", err);
      res.status(500).json({ error: err.message || "An error occurred with Gemini analysis." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
