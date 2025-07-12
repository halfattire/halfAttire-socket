const socketIO = require("socket.io");
const http = require("http");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config({ path: "./.env" });

const app = express();
const server = http.createServer(app);

// ✅ Configure CORS for production frontend
const io = socketIO(server, {
  cors: {
    origin: ["https://www.halfattire.com", "https://halfattire.com"],
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["polling", "websocket"],
  pingTimeout: 60000,
  pingInterval: 25000,
});

// ✅ Middleware
app.use(cors());
app.use(express.json());

// ✅ Health check route
app.get("/", (req, res) => {
  res.send("Hello world from socket server!");
});

// ✅ In-memory users & messages
let users = [];
let messages = {}; // Object to track messages sent to each user

const addUser = (userId, socketId) => {
  if (!users.some((user) => user.userId === userId)) {
    users.push({ userId, socketId });
  }
};

const removeUser = (socketId) => {
  users = users.filter((user) => user.socketId !== socketId);
};

const getUser = (userId) => {
  return users.find((user) => user.userId === userId);
};

const createMessage = ({ senderId, receiverId, text, images }) => ({
  id: Date.now(), // Unique ID
  senderId,
  receiverId,
  text,
  images,
  seen: false,
});

// ✅ Socket.IO Events
io.on("connection", (socket) => {
  console.log("✅ New client connected");

  socket.on("addUser", (userId) => {
    addUser(userId, socket.id);
    io.emit("getUsers", users);
  });

  socket.on("sendMessage", ({ senderId, receiverId, text, images }) => {
    const message = createMessage({ senderId, receiverId, text, images });
    const receiver = getUser(receiverId);

    messages[senderId] = messages[senderId] || [];
    messages[receiverId] = messages[receiverId] || [];

    messages[senderId].push(message);
    messages[receiverId].push(message);

    if (receiver?.socketId) {
      io.to(receiver.socketId).emit("getMessage", message);
    }
  });

  socket.on("messageSeen", ({ senderId, receiverId, messageId }) => {
    const sender = getUser(senderId);

    if (messages[senderId]) {
      const message = messages[senderId].find(
        (msg) => msg.receiverId === receiverId && msg.id === messageId
      );
      if (message) {
        message.seen = true;
        if (sender?.socketId) {
          io.to(sender.socketId).emit("messageSeen", {
            senderId,
            receiverId,
            messageId,
          });
        }
      }
    }
  });

  socket.on("updateLastMessage", ({ lastMessage, lastMessageId }) => {
    io.emit("getLastMessage", {
      lastMessage,
      lastMessageId,
    });
  });

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected");
    removeUser(socket.id);
    io.emit("getUsers", users);
  });

  socket.on("connect_error", (err) => {
    console.error("❌ Socket connection error:", err.message);
  });
});

// ✅ Server listen
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Socket server running on port ${PORT}`);
});
