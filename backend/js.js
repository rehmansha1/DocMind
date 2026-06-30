import express from "express";
import multer from "multer";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import Groq from "groq-sdk";
import { HfInference } from "@huggingface/inference";
import dotenv from "dotenv";
import cors from "cors";
import { pbkdf2Sync, randomBytes, timingSafeEqual, createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "express-rate-limit";
import Razorpay from "razorpay";
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// General rate limiter for auth endpoints
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: { error: "Too many requests from this IP, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limiter for resource-heavy endpoints (PDF uploads & Web Crawling)
const heavyResourceLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 uploads/crawls per hour
  message: { error: "Limit exceeded. You can only perform this action 10 times per hour." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiter for Chat queries to protect your Groq RPM/TPM limits
const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 15, // Limit each IP to 15 chat messages per minute
  message: { error: "You are asking questions too fast. Please wait a moment." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply general rate limit to all authentication endpoints
app.use("/auth", generalLimiter);

const groq = new Groq({ apiKey: process.env.API_KEY, maxRetries: 5 });
const hf = new HfInference(process.env.HF_TOKEN);
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_mockkeyid",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "mockkeysecret"
});



const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

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

async function embedBatch(texts) {
  if (!texts || texts.length === 0) return [];
  const result = await hf.featureExtraction({
    model: "sentence-transformers/all-MiniLM-L6-v2",
    inputs: texts,
  });
  return result.map(item => Array.from(item));
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

// ── GET / ─────────────────────────────────────────────────
app.get("/", (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Redirecting...</title>
      <script>
        window.location.href = "${frontendUrl}/" + window.location.hash;
      </script>
    </head>
    <body>
      <p>Redirecting to application...</p>
    </body>
    </html>
  `);
});

// ── GET /auth/config ──────────────────────────────────────
app.get("/auth/config", (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_KEY,
  });
});

// ── middleware: authenticateUser ──────────────────────────
async function authenticateUser(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Missing token" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: "Unauthorized: Invalid token" });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized: Verification failed" });
  }
}

// ── POST /auth/login ──────────────────────────────────────
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
    // Attempt login with Supabase Auth
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: password,
    });

    if (signInError) {
      return res.status(400).json({ message: signInError.message });
    }

    return res.json({
      success: true,
      session: signInData.session,
      user: {
        id: signInData.user.id,
        email: normalizedEmail,
        rememberMe: Boolean(rememberMe),
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: err.message,
    });
  }
});

// ── POST /auth/signup ─────────────────────────────────────
app.post("/auth/signup", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  const normalizedEmail = email.toLowerCase().trim();

  if (!/\S+@\S+\.\S+/.test(normalizedEmail)) {
    return res.status(400).json({ message: "Enter a valid email address" });
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: password,
      options: {
        emailRedirectTo: `${req.headers.origin || "http://localhost:5173"}/`,
      },
    });

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    const widgetKey = randomBytes(16).toString("hex");
    // Initialize user profile in table1
    const { error: profileError } = await supabase
      .from("table1")
      .insert([
        {
          name: normalizedEmail,
          created_at: new Date().toISOString(),
          widget_key: widgetKey,
        },
      ]);

    if (profileError) {
      console.warn("[signup] Error creating profile row in table1:", profileError.message);
    }

    return res.json({
      success: true,
      message: data.session ? "Registered and logged in" : "Registration successful! Please check your email to confirm.",
      session: data.session,
      user: {
        id: data.user?.id || normalizedEmail,
        email: normalizedEmail,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message });
  }
});

// ── POST /auth/forgot-password ────────────────────────────
app.post("/auth/forgot-password", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${req.headers.origin || "http://localhost:5173"}/?type=recovery`,
    });

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    return res.json({
      success: true,
      message: "Password reset instructions sent to your email.",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message });
  }
});

// ── POST /auth/update-password ────────────────────────────
app.post("/auth/update-password", authenticateUser, async (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ message: "Password is required" });
  }

  try {
    const authHeader = req.headers.authorization;
    const token = authHeader.split(" ")[1];

    const userClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const { error: sessionError } = await userClient.auth.setSession({
      access_token: token,
      refresh_token: "",
    });

    if (sessionError) throw sessionError;

    const { error } = await userClient.auth.updateUser({ password });

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    return res.json({
      success: true,
      message: "Password updated successfully. You can now log in.",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message });
  }
});


// ── GET /auth/domains ─────────────────────────────────────
app.get("/auth/domains", authenticateUser, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("table1")
      .select("allowed_domains, widget_key")
      .eq("name", req.user.email.toLowerCase().trim())
      .maybeSingle();

    if (error) throw error;

    let allowedDomains = data?.allowed_domains || "";
    let widgetKey = data?.widget_key;

    if (!widgetKey && data) {
      widgetKey = randomBytes(16).toString("hex");
      const { error: updateError } = await supabase
        .from("table1")
        .update({ widget_key: widgetKey })
        .eq("name", req.user.email.toLowerCase().trim());
      if (updateError) {
        console.warn("Failed to generate widget_key for user:", updateError.message);
      }
    }

    res.json({ success: true, allowed_domains: allowedDomains, widget_key: widgetKey || "" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /auth/domains ────────────────────────────────────
app.post("/auth/domains", authenticateUser, async (req, res) => {
  const { allowed_domains } = req.body;

  try {
    const { data, error } = await supabase
      .from("table1")
      .update({ allowed_domains })
      .eq("name", req.user.email.toLowerCase().trim())
      .select();

    if (error) throw error;

    res.json({ success: true, allowed_domains });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});
// ── POST /upload ──────────────────────────────────────────
// Body: multipart/form-data  { userId: string, file: PDF }
// Parses PDF, embeds all chunks, stores in memory under userId

app.post("/upload", heavyResourceLimiter, upload.single("file"), authenticateUser, async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Transfer-Encoding", "chunked");

  try {
    const userId = req.user.email;
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
    const batchSize = 16;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const embeddings = await embedBatch(batch);

      for (let j = 0; j < batch.length; j++) {
        dbPayload.push({
          user_id: userId,
          file_name: req.file.originalname,
          content: batch[j],
          embedding: embeddings[j],
        });
      }

      const progressPercent = 5 + Math.round((Math.min(i + batchSize, chunks.length) / chunks.length) * 85);
      res.write(JSON.stringify({
        status: "processing",
        progress: progressPercent,
        message: `Embedding chunks (${Math.min(i + batchSize, chunks.length)}/${chunks.length})...`
      }) + "\n");

      console.log(`  embedded ${Math.min(i + batchSize, chunks.length)}/${chunks.length}`);
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

app.post("/chat", chatLimiter, async (req, res) => {
  try {
    const { userId, question, history = [], widgetKey } = req.body;
    if (!question) return res.status(400).json({ error: "question is required" });

    let targetUserId = null;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      // Authenticated Dashboard User
      const token = authHeader.split(" ")[1];
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) {
        return res.status(401).json({ error: "Unauthorized token" });
      }
      const callerEmail = user.email;

      if (!userId) return res.status(400).json({ error: "userId is required for dashboard queries" });
      // Ensure user only queries their own account data
      if (callerEmail.toLowerCase() !== userId.toLowerCase()) {
        return res.status(403).json({ error: "Forbidden: Cannot query another user's documents" });
      }
      targetUserId = userId;
    } else {
      // Widget Mode - authenticated via widgetKey
      if (!widgetKey) {
        return res.status(401).json({ error: "Unauthorized: Missing widget key or token" });
      }

      const { data: profile, error: profileError } = await supabase
        .from("table1")
        .select("name, allowed_domains")
        .eq("widget_key", widgetKey)
        .maybeSingle();

      if (profileError) {
        console.error("Widget key check profile error:", profileError);
        return res.status(500).json({ error: "Internal verification error" });
      }

      if (!profile) {
        return res.status(401).json({ error: "Unauthorized: Invalid widget key" });
      }

      targetUserId = profile.name;

      // CORS Origin check
      const origin = req.headers.origin || req.headers.referer || "";
      if (profile.allowed_domains) {
        const allowed = profile.allowed_domains
          .split(",")
          .map(d => d.trim().toLowerCase())
          .filter(Boolean);

        if (allowed.length > 0) {
          let isAllowed = false;
          try {
            const originUrl = new URL(origin.startsWith("http") ? origin : "http://" + origin);
            const hostname = originUrl.hostname.toLowerCase();
            isAllowed = allowed.some(domain => hostname === domain || hostname.endsWith("." + domain));
          } catch (urlErr) {
            // invalid URL format
          }

          if (!isAllowed) {
            console.warn(`[CORS blocked] Request from Origin "${origin}" is not allowed for widget key "${widgetKey}"`);
            return res.status(403).json({ error: "Forbidden: Origin not allowed" });
          }
        }
      }
    }

    console.log(`[chat] userId=${targetUserId} question="${question}" historyLength=${history.length}`);

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
        filter_user_id: targetUserId,
      }
    );
    console.log(targetUserId);
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
app.delete("/documents", authenticateUser, async (req, res) => {
  try {
    const userId = req.user.email;
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
// Check how many chunks are stored for a user
app.get("/status/:userId", authenticateUser, async (req, res) => {
  try {
    const { userId } = req.params;
    if (req.user.email.toLowerCase() !== userId.toLowerCase()) {
      return res.status(403).json({ error: "Forbidden" });
    }

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
app.get("/documents/:userId", authenticateUser, async (req, res) => {
  try {
    const { userId } = req.params;
    if (req.user.email.toLowerCase() !== userId.toLowerCase()) {
      return res.status(403).json({ error: "Forbidden" });
    }

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
app.delete("/documents/:userId/:fileName", authenticateUser, async (req, res) => {
  try {
    const { userId, fileName } = req.params;
    if (req.user.email.toLowerCase() !== userId.toLowerCase()) {
      return res.status(403).json({ error: "Forbidden" });
    }

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
app.post("/crawl", heavyResourceLimiter, authenticateUser, async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Transfer-Encoding", "chunked");

  try {
    const userId = req.user.email;
    const { url } = req.body;
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

      const batchSize = 16;
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const embeddings = await embedBatch(batch);
        for (let j = 0; j < batch.length; j++) {
          dbPayload.push({
            user_id: userId,
            file_name: page.url,
            content: batch[j],
            embedding: embeddings[j],
          });
        }
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

// ── POST /api/create-order ─────────────────────────────
app.post("/api/create-order", authenticateUser, async (req, res) => {
  const { amount, currency = "INR", receipt } = req.body;

  if (!amount) {
    return res.status(400).json({ error: "amount is required in paise" });
  }

  const amountVal = Number(amount);
  if (isNaN(amountVal) || amountVal < 100) {
    return res.status(400).json({ error: "Amount must be at least 100 paise (1 INR)." });
  }

  try {
    const order = await razorpay.orders.create({
      amount: amountVal,
      currency: currency,
      receipt: receipt || `receipt_${Date.now()}`
    });

    res.json({
      success: true,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency
    });
  } catch (err) {
    console.error("Razorpay order creation failed:", err);
    res.status(500).json({ error: err.message || "Failed to create Razorpay order." });
  }
});

// ── POST /api/verify-payment ─────────────────────────────
app.post("/api/verify-payment", authenticateUser, async (req, res) => {
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

  if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
    return res.status(400).json({ error: "Missing required Razorpay payment response parameters." });
  }

  try {
    const secret = process.env.RAZORPAY_KEY_SECRET || "";
    const generated_signature = createHmac("sha256", secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generated_signature !== razorpay_signature) {
      return res.status(400).json({ error: "Payment verification failed: Invalid signature." });
    }

    const userEmail = req.user.email.toLowerCase().trim();
    const { error: dbError } = await supabase
      .from("table1")
      .update({
        tier: "pro",
        razorpay_subscription_id: razorpay_order_id
      })
      .eq("name", userEmail);

    if (dbError) throw dbError;

    res.json({
      success: true,
      message: "Payment verified and account upgraded to Pro successfully!"
    });
  } catch (err) {
    console.error("Payment verification failed:", err);
    res.status(500).json({ error: err.message || "Database update failed during verification." });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
