import express from "express";
import multer from "multer";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import Groq from "groq-sdk";
import { HfInference } from "@huggingface/inference";
import dotenv from "dotenv";
import cors from "cors";
import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const groq = new Groq({ apiKey: process.env.API_KEY });
const hf = new HfInference(process.env.HF_TOKEN);



const upload = multer({ storage: multer.memoryStorage() });

// ── helpers ──────────────────────────────────────────────

async function extractTextFromPDF(buffer) {
  const data = new Uint8Array(buffer);
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    fullText += content.items.map(item => item.str).join(" ") + "\n";
  }
  return fullText;
}

// Helper to clean HTML and strip out scripts, styles, SVG, comments and HTML tags
function cleanHtml(html) {
  let cleaned = html.replace(/<(script|style|svg)\b[^>]*>([\s\S]*?)<\/\1>/gi, ' ');
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, ' ');
  cleaned = cleaned.replace(/<[^>]+>/g, ' ');
  cleaned = cleaned.replace(/&nbsp;/g, ' ')
                   .replace(/&lt;/g, '<')
                   .replace(/&gt;/g, '>')
                   .replace(/&amp;/g, '&')
                   .replace(/&quot;/g, '"')
                   .replace(/&apos;/g, "'");
  return cleaned.replace(/\s+/g, ' ').trim();
}

// Helper to extract unique internal links belonging to the same host
function extractLinks(html, baseUrl, host) {
  const links = [];
  const hrefRegex = /href="([^"]+)"/g;
  let match;
  while ((match = hrefRegex.exec(html)) !== null) {
    const urlStr = match[1].trim();
    if (urlStr.startsWith('#') || urlStr.startsWith('javascript:')) continue;
    try {
      const resolved = new URL(urlStr, baseUrl).href;
      const parsed = new URL(resolved);
      
      // Check if normalize link hostname matches host (ignores www prefix mismatch)
      const linkNorm = parsed.hostname.replace(/^www\./i, '');
      const hostNorm = host.replace(/^www\./i, '');
      
      if (linkNorm === hostNorm) {
        parsed.hash = '';
        let cleanUrl = parsed.href;
        if (cleanUrl.endsWith('/')) {
          cleanUrl = cleanUrl.slice(0, -1);
        }
        links.push(cleanUrl);
      }
    } catch (e) {
      // Ignore invalid URLs
    }
  }
  return [...new Set(links)];
}

async function embed(text) {
  const result = await hf.featureExtraction({
    model: "sentence-transformers/all-MiniLM-L6-v2",
    inputs: text,
  });
  return Array.from(result);
}

function cosineSimilarity(vecA, vecB) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    magA += vecA[i] * vecA[i];
    magB += vecB[i] * vecB[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const hash = pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return { hash, salt };
}
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);
function passwordMatches(password, user) {
  if (!user || !user.password || !user.hash) {
    return false;
  }
  const { hash } = hashPassword(password, user.hash);
  console.log("User:", user, "Computed Hash:", hash);

  return timingSafeEqual(
    Buffer.from(hash, "hex"),
    Buffer.from(user.password, "hex")
  );
}

app.post("/auth/login", async (req, res) => {
  const { email, password, rememberMe } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      message: "Email and password are required",
    });
  }

  const normalizedEmail = email.toLowerCase().trim();

  if (!/\S+@\S+\.\S+/.test(normalizedEmail)) {
    return res.status(400).json({
      message: "Enter a valid email address",
    });
  }

  try {
    // Find existing user
    const { data: existingUser, error: fetchError } = await supabase
      .from("table1")
      .select("*")
      .eq("name", normalizedEmail)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    // Existing user → Login
    if (existingUser) {
      if (!passwordMatches(password, existingUser)) {
        return res.status(401).json({
          message: "Invalid email or password",
        });
      }

      return res.json({
        success: true,
        user: {
          id: existingUser.id,
          email: existingUser.name,
          rememberMe: Boolean(rememberMe),
        },
      });
    }

    // User doesn't exist → Register
    const { hash, salt } = hashPassword(password);

    const { data: newUser, error: insertError } = await supabase
      .from("table1")
      .insert([
        {
          name: normalizedEmail,
          password: hash,
          hash: salt,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    return res.json({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.name,
      },
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      message: err.message,
    });
  }
});
// ── POST /upload ──────────────────────────────────────────
// Body: multipart/form-data  { userId: string, file: PDF }
// Parses PDF, embeds all chunks, stores in memory under userId

app.post("/upload", upload.single("file"), async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Transfer-Encoding", "chunked");

  try {
    const { userId } = req.body;
    if (!userId) {
      res.write(JSON.stringify({ error: "userId is required" }) + "\n");
      return res.end();
    }
    if (!req.file) {
      res.write(JSON.stringify({ error: "No file uploaded" }) + "\n");
      return res.end();
    }

    const ext = req.file.originalname.split(".").pop().toLowerCase();
    if (ext !== "pdf") {
      res.write(JSON.stringify({ error: "Only PDF files are supported" }) + "\n");
      return res.end();
    }

    res.write(JSON.stringify({ status: "processing", progress: 0, message: "Extracting text from PDF..." }) + "\n");

    console.log(`[upload] userId=${userId} file=${req.file.originalname}`);

    const text = await extractTextFromPDF(req.file.buffer);

    const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 300, chunkOverlap: 50 });
    const chunks = await splitter.splitText(text);

    res.write(JSON.stringify({ status: "processing", progress: 5, message: `Parsed into ${chunks.length} chunks. Generating embeddings...` }) + "\n");

    const dbPayload = [];
    for (let i = 0; i < chunks.length; i++) {
      const embedding = await embed(chunks[i]);
      dbPayload.push({
        user_id: userId,
        file_name: req.file.originalname,
        content: chunks[i],
        embedding: embedding,
      });

      const progressPercent = 5 + Math.round((i / chunks.length) * 85);
      res.write(JSON.stringify({
        status: "processing",
        progress: progressPercent,
        message: `Embedding chunks (${i + 1}/${chunks.length})...`
      }) + "\n");

      if (i % 10 === 0) console.log(`  embedded ${i + 1}/${chunks.length}`);
    }

    res.write(JSON.stringify({ status: "processing", progress: 92, message: "Saving embeddings to database..." }) + "\n");

    const { error: insertError } = await supabase
      .from("document_chunks")
      .insert(dbPayload);

    if (insertError) throw insertError;

    res.write(JSON.stringify({ status: "processing", progress: 97, message: "Updating document counts..." }) + "\n");

    // Get total count of chunks for this user
    const { count: totalChunks, error: countError } = await supabase
      .from("document_chunks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    if (countError) throw countError;

    console.log(`[upload] done — total chunks for ${userId}: ${totalChunks}`);

    res.write(JSON.stringify({
      status: "completed",
      success: true,
      fileName: req.file.originalname,
      chunks: chunks.length,
      totalChunks: totalChunks || 0,
    }) + "\n");
    res.end();

  } catch (err) {
    console.error("[upload] error:", err);
    res.write(JSON.stringify({ error: err.message }) + "\n");
    res.end();
  }
});

// ── POST /chat ────────────────────────────────────────────
// Body: { userId: string, question: string }
// Finds top-3 relevant chunks for userId, calls Groq, returns answer

app.post("/chat", async (req, res) => {
  try {
    const { userId, question, history = [] } = req.body;
    if (!userId) return res.status(400).json({ error: "userId is required" });
    if (!question) return res.status(400).json({ error: "question is required" });

    console.log(`[chat] userId=${userId} question="${question}" historyLength=${history.length}`);

    // 1. Rewrite query if history exists to resolve conversational references (e.g. "if i didnt?")
    let searchQuery = question;
    if (history && history.length > 0) {
      try {
        const rewriteCompletion = await groq.chat.completions.create({
          model: "llama-3.1-8b-instant",
          messages: [
            {
              role: "system",
              content: "You are a helper that rewrites conversational questions into standalone search queries. Given a conversation history and a final question, write a single standalone query that captures the user's intent to search in a company policy document. Answer with ONLY the standalone query. Do not add any conversational text.",
            },
            ...history.slice(-4), // Use last 4 messages for context
            { role: "user", content: question }
          ],
        });
        const rewritten = rewriteCompletion.choices[0].message.content.trim().replace(/^"|"$/g, "");
        if (rewritten) {
          searchQuery = rewritten;
          console.log(`  [rewrite] "${question}" -> "${searchQuery}"`);
        }
      } catch (rewriteErr) {
        console.error("Failed to rewrite query:", rewriteErr);
      }
    }

    const questionEmbedding = await embed(searchQuery);

    const { data: matchedChunks, error: matchError } = await supabase.rpc(
      "match_document_chunks",
      {
        query_embedding: questionEmbedding,
        match_threshold: -1.0,
        match_count: 3,
        filter_user_id: userId,
      }
    );
    console.log(userId);
    if (matchError) throw matchError;

    if (!matchedChunks || matchedChunks.length === 0) {
      return res.status(404).json({ error: "No documents found for this user. Upload a PDF first." });
    }

    const context = matchedChunks.map(c => c.content).join("\n\n");

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a warm, friendly, and professional customer service assistant. 
Use the provided context to answer the user's questions in a polite and helpful manner.

Guidelines:
1. Maintain an empathetic, conversational, and professional tone.
2. If the user's question cannot be answered using the provided context, do not say "I don't know" or mention "the context/document". Instead, politely explain that you don't have that specific detail available, and ask how else you can assist them.
3. If they express intent (like wanting to buy products), guide them politely based on any available payment/pricing info or state how they can proceed.

You MUST respond in JSON format with the following keys:
{
  "answer": "Your friendly, detailed customer service answer here...",
  "suggestions": [
    "Short suggested follow-up question 1",
    "Short suggested follow-up question 2",
    "Short suggested follow-up question 3"
  ]
}
Generate exactly 3 relevant, highly specific follow-up suggestions based on the context and answer to help the user continue the conversation.`,
        },
        ...history.slice(-6), // Include recent conversation history for context
        {
          role: "user",
          content: `Context:\n${context}\n\nQuestion:\n${question}`,
        },
      ],
    });

    let answer = "";
    let suggestions = [];
    try {
      const parsed = JSON.parse(completion.choices[0].message.content);
      answer = parsed.answer || "";
      suggestions = parsed.suggestions || [];
    } catch (parseErr) {
      console.warn("Failed to parse JSON response from Groq:", parseErr);
      answer = completion.choices[0].message.content;
      suggestions = [];
    }

    console.log(`[chat] answered for ${userId}`);
    res.json({
      answer,
      suggestions,
      sources: matchedChunks.map(c => ({ text: c.content.slice(0, 120) + "...", score: c.similarity.toFixed(3) })),
    });

  } catch (err) {
    console.error("[chat] error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /documents ─────────────────────────────────────
// Body: { userId: string }
// Clears all stored vectors for a user

app.delete("/documents", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "userId is required" });

    const { error: deleteError } = await supabase
      .from("document_chunks")
      .delete()
      .eq("user_id", userId);

    if (deleteError) throw deleteError;

    res.json({ success: true, message: `Documents cleared for ${userId}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /status/:userId ───────────────────────────────────
// Check how many chunks are stored for a use 

app.get("/status/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { count, error } = await supabase
      .from("document_chunks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    if (error) throw error;

    const chunks = count || 0;
    res.json({ userId, chunks, hasDocuments: chunks > 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /documents/:userId ──────────────────────────────
// List unique documents and their chunk counts for a user
app.get("/documents/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { data, error } = await supabase
      .from("document_chunks")
      .select("file_name")
      .eq("user_id", userId);

    if (error) throw error;

    const fileMap = {};
    (data || []).forEach(row => {
      const name = row.file_name;
      if (!fileMap[name]) {
        fileMap[name] = { name, chunks: 0 };
      }
      fileMap[name].chunks++;
    });

    res.json({ success: true, documents: Object.values(fileMap) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /documents/:userId/:fileName ──────────────────
// Delete chunks of a specific document for a user
app.delete("/documents/:userId/:fileName", async (req, res) => {
  try {
    const { userId, fileName } = req.params;
    const { error } = await supabase
      .from("document_chunks")
      .delete()
      .eq("user_id", userId)
      .eq("file_name", fileName);

    if (error) throw error;
    res.json({ success: true, message: `Document "${fileName}" cleared for ${userId}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /crawl ───────────────────────────────────────────
// Body: { userId: string, url: string }
// Scrapes domain pages recursively, chunks them, generates embeddings, stores in supabase
app.post("/crawl", async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Transfer-Encoding", "chunked");

  try {
    const { userId, url } = req.body;
    if (!userId) {
      res.write(JSON.stringify({ error: "userId is required" }) + "\n");
      return res.end();
    }
    if (!url) {
      res.write(JSON.stringify({ error: "url is required" }) + "\n");
      return res.end();
    }

    let startUrl;
    try {
      startUrl = new URL(url).href;
    } catch (err) {
      res.write(JSON.stringify({ error: "Invalid URL format" }) + "\n");
      return res.end();
    }

    const parsedStart = new URL(startUrl);
    const host = parsedStart.hostname;
    const baseDomain = host.replace(/^www\./i, '');

    res.write(JSON.stringify({ status: "processing", progress: 2, message: `Starting crawler for ${baseDomain}...` }) + "\n");

    const queue = [startUrl];
    const visited = new Set();
    const maxPages = 15;
    const crawledData = [];

    while (queue.length > 0 && visited.size < maxPages) {
      const currentUrl = queue.shift();
      let normUrl = currentUrl;
      if (normUrl.endsWith('/')) normUrl = normUrl.slice(0, -1);

      if (visited.has(normUrl)) continue;
      visited.add(normUrl);

      const count = visited.size;
      res.write(JSON.stringify({ 
        status: "processing", 
        progress: 2 + Math.round((count / maxPages) * 33), 
        message: `Crawling page ${count}/${maxPages}: ${normUrl}...` 
      }) + "\n");

      try {
        const response = await fetch(currentUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          },
          signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) {
          console.warn(`[crawl] Failed to fetch ${currentUrl}: ${response.status}`);
          continue;
        }

        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("text/html")) {
          console.warn(`[crawl] Skipping non-HTML page ${currentUrl}: ${contentType}`);
          continue;
        }

        const html = await response.text();
        const cleanText = cleanHtml(html);
        
        if (cleanText.length > 50) {
          crawledData.push({ url: currentUrl, text: cleanText });
        }

        const links = extractLinks(html, currentUrl, host);
        for (const link of links) {
          let normLink = link;
          if (normLink.endsWith('/')) normLink = normLink.slice(0, -1);
          if (!visited.has(normLink) && !queue.includes(link)) {
            queue.push(link);
          }
        }
      } catch (err) {
        console.error(`[crawl] Error crawling ${currentUrl}:`, err.message);
      }
    }

    if (crawledData.length === 0) {
      res.write(JSON.stringify({ error: "Could not extract any content from the website." }) + "\n");
      return res.end();
    }

    res.write(JSON.stringify({ 
      status: "processing", 
      progress: 40, 
      message: `Crawl complete. Scraped ${crawledData.length} pages. Generating embeddings...` 
    }) + "\n");

    const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 300, chunkOverlap: 50 });
    const dbPayload = [];

    for (let p = 0; p < crawledData.length; p++) {
      const page = crawledData[p];
      const chunks = await splitter.splitText(page.text);
      
      res.write(JSON.stringify({ 
        status: "processing", 
        progress: 40 + Math.round((p / crawledData.length) * 45), 
        message: `Vectorizing page (${p + 1}/${crawledData.length}): ${page.url} (${chunks.length} chunks)...` 
      }) + "\n");

      for (let i = 0; i < chunks.length; i++) {
        const embedding = await embed(chunks[i]);
        dbPayload.push({
          user_id: userId,
          file_name: page.url,
          content: chunks[i],
          embedding: embedding,
        });
      }
    }

    res.write(JSON.stringify({ 
      status: "processing", 
      progress: 90, 
      message: `Saving ${dbPayload.length} chunks to database...` 
    }) + "\n");

    // Remove existing chunks for the same page URLs to prevent duplicates
    const crawledUrls = crawledData.map(p => p.url);
    const { error: deleteError } = await supabase
      .from("document_chunks")
      .delete()
      .eq("user_id", userId)
      .in("file_name", crawledUrls);

    if (deleteError) {
      console.warn("[crawl] Error clearing old page chunks:", deleteError.message);
    }

    const { error: insertError } = await supabase
      .from("document_chunks")
      .insert(dbPayload);

    if (insertError) throw insertError;

    res.write(JSON.stringify({ status: "processing", progress: 97, message: "Updating document counts..." }) + "\n");

    const { count: totalChunks, error: countError } = await supabase
      .from("document_chunks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    if (countError) throw countError;

    res.write(JSON.stringify({
      status: "completed",
      success: true,
      url: startUrl,
      pages: crawledData.length,
      chunks: dbPayload.length,
      totalChunks: totalChunks || 0,
    }) + "\n");
    res.end();

  } catch (err) {
    console.error("[crawl] error:", err);
    res.write(JSON.stringify({ error: err.message }) + "\n");
    res.end();
  }
});

app.listen(3001, () => console.log("Server running on http://localhost:3001"));
