const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const users = {};
const GROUP_ROOM = "GLOBAL_GROUP";

function broadcastUserList() {
  const list = {};
  for (const u in users) {
    list[u] = users[u].status;
  }
  io.emit("user-list", list);
}

io.on("connection", (socket) => {
  socket.on("join", (userId) => {
    socket.userId = userId;

    if (!users[userId]) {
      users[userId] = { sockets: new Set(), status: "online" };
    }

    users[userId].sockets.add(socket.id);
    users[userId].status = "online";

    socket.join(GROUP_ROOM);
    broadcastUserList();
  });

  // GROUP MESSAGE
  socket.on("group-message", (message) => {
    socket.to(GROUP_ROOM).emit("group-message", message);
  });

  // GROUP TYPING
  socket.on("group-typing", () => {
    socket.to(GROUP_ROOM).emit("group-typing", socket.userId);
  });

  // PRIVATE MESSAGE
  socket.on("private-message", ({ to, message }) => {
    if (!users[to]) return;

    users[to].sockets.forEach((sid) => {
      io.to(sid).emit("private-message", message);
    });

    socket.emit("delivered", message.msgId);
  });

  // PRIVATE TYPING
  socket.on("private-typing", ({ to }) => {
    if (!users[to]) return;

    users[to].sockets.forEach((sid) => {
      io.to(sid).emit("private-typing", socket.userId);
    });
  });

  // SEEN
  socket.on("seen", ({ to, msgId }) => {
    if (!users[to]) return;

    users[to].sockets.forEach((sid) => {
      io.to(sid).emit("seen", msgId);
    });
  });

  socket.on("disconnect", () => {
    const userId = socket.userId;
    if (!userId || !users[userId]) return;

    users[userId].sockets.delete(socket.id);

    if (users[userId].sockets.size === 0) {
      users[userId].status = "offline";
      broadcastUserList();
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
