const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.static("public"));

/*
  users = {
    username: {
      sockets: Set(socketId),
      status: "online" | "offline"
    }
  }
*/
const users = {};
const GROUP = "GLOBAL_GROUP";

/* BROADCAST USER LIST */
function broadcastUsers() {
  const list = {};
  for (const u in users) {
    list[u] = users[u].status;
  }
  io.emit("user-list", list);
}

io.on("connection", (socket) => {

  /* JOIN / REJOIN */
  socket.on("join", (username) => {
    socket.username = username;

    // create user if first time
    if (!users[username]) {
      users[username] = {
        sockets: new Set(),
        status: "offline"
      };
    }

    // add socket
    users[username].sockets.add(socket.id);

    // ALWAYS mark online on join
    users[username].status = "online";

    socket.join(GROUP);

    broadcastUsers();
  });

  /* GROUP MESSAGE */
  socket.on("group-message", (msg) => {
    socket.to(GROUP).emit("group-message", msg);
  });

  /* GROUP TYPING */
  socket.on("group-typing", () => {
    if (!socket.username) return;
    socket.to(GROUP).emit("group-typing", socket.username);
  });

  /* PRIVATE MESSAGE */
  socket.on("private-message", ({ to, message }) => {
    if (!users[to]) return;

    users[to].sockets.forEach((sid) => {
      io.to(sid).emit("private-message", message);
    });
  });

  /* PRIVATE TYPING */
  socket.on("private-typing", ({ to }) => {
    if (!users[to] || !socket.username) return;

    users[to].sockets.forEach((sid) => {
      io.to(sid).emit("private-typing", socket.username);
    });
  });

  /* SEEN */
  socket.on("seen", ({ to, msgId }) => {
    if (!users[to]) return;

    users[to].sockets.forEach((sid) => {
      io.to(sid).emit("seen", msgId);
    });
  });

  /* DISCONNECT */
  socket.on("disconnect", () => {
    const username = socket.username;
    if (!username || !users[username]) return;

    // remove socket
    users[username].sockets.delete(socket.id);

    // ONLY mark offline if NO sockets remain
    if (users[username].sockets.size === 0) {
      users[username].status = "offline";
      broadcastUsers();
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
