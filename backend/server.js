const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const http = require("http");
const https = require("https");
const { Server } = require("socket.io");
const { Pool } = require("pg");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || "";
const PUBLIC_URL = process.env.PUBLIC_URL || "";
const NGROK_API_URL = process.env.NGROK_API_URL || "http://127.0.0.1:4040/api/tunnels";
const AUTO_DETECT_NGROK = process.env.AUTO_DETECT_NGROK !== "false";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const allowedOrigins = new Set(["http://localhost:5173", "http://127.0.0.1:5173"]);

FRONTEND_URL.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean)
  .forEach((origin) => allowedOrigins.add(origin));

const ngrokRegex = /^https:\/\/[a-zA-Z0-9-]+\.ngrok(-free)?\.(app|dev)$/;

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  return allowedOrigins.has(origin) || ngrokRegex.test(origin);
};

const getJson = (url) =>
  new Promise((resolve, reject) => {
    const client = url.startsWith("https://") ? https : http;
    const req = client.get(url, (res) => {
      let raw = "";
      res.on("data", (chunk) => {
        raw += chunk;
      });
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }

        try {
          resolve(JSON.parse(raw));
        } catch (error) {
          reject(error);
        }
      });
    });

    req.setTimeout(1500, () => req.destroy(new Error("Timeout")));
    req.on("error", reject);
  });

const detectNgrokPublicUrl = async () => {
  if (!AUTO_DETECT_NGROK) return "";

  try {
    const payload = await getJson(NGROK_API_URL);
    const tunnels = Array.isArray(payload?.tunnels) ? payload.tunnels : [];

    const selectedTunnel =
      tunnels.find(
        (tunnel) =>
          tunnel?.proto === "https" &&
          typeof tunnel?.config?.addr === "string" &&
          tunnel.config.addr.endsWith(`:${PORT}`),
      ) || tunnels.find((tunnel) => tunnel?.proto === "https");

    return typeof selectedTunnel?.public_url === "string" ? selectedTunnel.public_url : "";
  } catch (_error) {
    return "";
  }
};

const corsOptions = {
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error("CORS origin not allowed"));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

const mapMessageRow = (row) => ({
  id: Number(row.id),
  senderId: Number(row.sender_id),
  receiverId: Number(row.receiver_id),
  content: row.content,
  createdAt: row.created_at,
});

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, db: "connected" });
  } catch (_error) {
    res.status(500).json({ ok: false, db: "disconnected" });
  }
});

app.post("/signup", async (req, res) => {
  const { firstName, lastName, email, password } = req.body;

  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ message: "Tous les champs sont requis" });
  }

  try {
    const existingUser = await pool.query("SELECT 1 FROM users WHERE email = $1", [email]);

    if (existingUser.rowCount > 0) {
      return res.status(400).json({ message: "Email deja utilise" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO users (first_name, last_name, email, password_hash)
       VALUES ($1, $2, $3, $4)`,
      [firstName, lastName, email, hashedPassword],
    );

    return res.status(201).json({ message: "Compte cree avec succes" });
  } catch (error) {
    console.error("Signup error:", error);
    return res.status(500).json({ message: "Erreur serveur" });
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Champs manquants" });
  }

  try {
    const result = await pool.query(
      "SELECT id, first_name, email, password_hash FROM users WHERE email = $1",
      [email],
    );

    if (result.rowCount === 0) {
      return res.status(400).json({ message: "Utilisateur introuvable" });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      return res.status(400).json({ message: "Mot de passe incorrect" });
    }

    return res.json({
      message: "Connexion reussie",
      user: {
        id: Number(user.id),
        firstName: user.first_name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Erreur serveur" });
  }
});

app.get("/users", async (req, res) => {
  const excludeUserId = Number(req.query.excludeUserId);

  try {
    const result = Number.isInteger(excludeUserId)
      ? await pool.query(
          `SELECT id, first_name, last_name, email
           FROM users
           WHERE id <> $1
           ORDER BY first_name ASC, last_name ASC`,
          [excludeUserId],
        )
      : await pool.query(
          `SELECT id, first_name, last_name, email
           FROM users
           ORDER BY first_name ASC, last_name ASC`,
        );

    const users = result.rows.map((row) => ({
      id: Number(row.id),
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
    }));

    return res.json({ users });
  } catch (error) {
    console.error("Get users error:", error);
    return res.status(500).json({ message: "Erreur serveur" });
  }
});

app.get("/messages/:otherUserId", async (req, res) => {
  const otherUserId = Number(req.params.otherUserId);
  const currentUserId = Number(req.query.userId);

  if (!Number.isInteger(otherUserId) || !Number.isInteger(currentUserId)) {
    return res.status(400).json({ message: "userId et otherUserId doivent etre numeriques" });
  }

  try {
    const result = await pool.query(
      `SELECT id, sender_id, receiver_id, content, created_at
       FROM messages
       WHERE (sender_id = $1 AND receiver_id = $2)
          OR (sender_id = $2 AND receiver_id = $1)
       ORDER BY created_at ASC`,
      [currentUserId, otherUserId],
    );

    return res.json({ messages: result.rows.map(mapMessageRow) });
  } catch (error) {
    console.error("Get messages error:", error);
    return res.status(500).json({ message: "Erreur serveur" });
  }
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Socket CORS origin not allowed"));
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
});

io.on("connection", (socket) => {
  console.log(`Socket connecte: ${socket.id}`);

  socket.on("join", ({ userId }) => {
    const parsedUserId = Number(userId);

    if (!Number.isInteger(parsedUserId)) {
      socket.emit("socket_error", { message: "userId invalide pour join" });
      return;
    }

    socket.data.userId = parsedUserId;
    socket.join(`user:${parsedUserId}`);
  });

  socket.on("get_messages", async ({ withUserId }) => {
    const currentUserId = socket.data.userId;
    const otherUserId = Number(withUserId);

    if (!Number.isInteger(currentUserId) || !Number.isInteger(otherUserId)) {
      socket.emit("socket_error", { message: "get_messages requiert un userId valide" });
      return;
    }

    try {
      const result = await pool.query(
        `SELECT id, sender_id, receiver_id, content, created_at
         FROM messages
         WHERE (sender_id = $1 AND receiver_id = $2)
            OR (sender_id = $2 AND receiver_id = $1)
         ORDER BY created_at ASC`,
        [currentUserId, otherUserId],
      );

      socket.emit("messages_history", result.rows.map(mapMessageRow));
    } catch (error) {
      console.error("Socket get_messages error:", error);
      socket.emit("socket_error", { message: "Erreur serveur get_messages" });
    }
  });

  socket.on("send_message", async (data) => {
    const senderId = Number(data?.senderId ?? socket.data.userId);
    const receiverId = Number(data?.receiverId);
    const content = typeof data?.content === "string" ? data.content.trim() : "";

    if (!Number.isInteger(senderId) || !Number.isInteger(receiverId) || !content) {
      socket.emit("socket_error", {
        message: "send_message requiert senderId, receiverId et content",
      });
      return;
    }

    try {
      const insertResult = await pool.query(
        `INSERT INTO messages (sender_id, receiver_id, content)
         VALUES ($1, $2, $3)
         RETURNING id, sender_id, receiver_id, content, created_at`,
        [senderId, receiverId, content],
      );

      const savedMessage = mapMessageRow(insertResult.rows[0]);
      io.to(`user:${senderId}`).emit("receive_message", savedMessage);
      io.to(`user:${receiverId}`).emit("receive_message", savedMessage);
    } catch (error) {
      console.error("Socket send_message error:", error);
      socket.emit("socket_error", { message: "Erreur serveur send_message" });
    }
  });

  socket.on("delete_message", async ({ messageId }) => {
    const currentUserId = socket.data.userId;
    const parsedMessageId = Number(messageId);

    if (!Number.isInteger(currentUserId) || !Number.isInteger(parsedMessageId)) {
      socket.emit("socket_error", { message: "delete_message requiert un messageId valide" });
      return;
    }

    try {
      const deleteResult = await pool.query(
        `DELETE FROM messages
         WHERE id = $1 AND sender_id = $2
         RETURNING id, sender_id, receiver_id`,
        [parsedMessageId, currentUserId],
      );

      if (deleteResult.rowCount === 0) {
        socket.emit("socket_error", {
          message: "Message introuvable ou suppression non autorisee",
        });
        return;
      }

      const deleted = deleteResult.rows[0];
      io.to(`user:${Number(deleted.sender_id)}`).emit("message_deleted", {
        messageId: Number(deleted.id),
      });
      io.to(`user:${Number(deleted.receiver_id)}`).emit("message_deleted", {
        messageId: Number(deleted.id),
      });
    } catch (error) {
      console.error("Socket delete_message error:", error);
      socket.emit("socket_error", { message: "Erreur serveur delete_message" });
    }
  });

  socket.on("disconnect", () => {
    console.log(`Socket deconnecte: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`Serveur local: http://localhost:${PORT}`);
  const manualPublicUrl = PUBLIC_URL.trim();
  if (manualPublicUrl) {
    console.log(`Serveur public: ${manualPublicUrl}`);
    return;
  }

  detectNgrokPublicUrl().then((detectedUrl) => {
    if (detectedUrl) {
      console.log(`Serveur public (auto): ${detectedUrl}`);
    }
  });
});
