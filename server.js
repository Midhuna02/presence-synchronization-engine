const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET","POST"] }
});

app.use(express.static("public"));

const users = {}; // username -> { sockets:Set, status }
const GROUP = "GLOBAL";

function broadcastUsers(){
  const list = {};
  for(const u in users){
    list[u] = users[u].status;
  }
  io.emit("user-list", list);
}

io.on("connection", socket => {

  socket.on("join", username => {
    socket.username = username;

    if(!users[username]){
      users[username] = { sockets:new Set(), status:"online" };
    }

    users[username].sockets.add(socket.id);
    users[username].status = "online";

    socket.join(GROUP);
    broadcastUsers();
  });

  socket.on("group-message", msg=>{
    socket.to(GROUP).emit("group-message", msg);
  });

  socket.on("group-typing", ()=>{
    socket.to(GROUP).emit("group-typing", socket.username);
  });

  socket.on("private-message", ({to,message})=>{
    if(!users[to]) return;
    users[to].sockets.forEach(id=>{
      io.to(id).emit("private-message", message);
    });
  });

  socket.on("private-typing", ({to})=>{
    if(!users[to]) return;
    users[to].sockets.forEach(id=>{
      io.to(id).emit("private-typing", socket.username);
    });
  });

  socket.on("seen", ({to,msgId})=>{
    if(!users[to]) return;
    users[to].sockets.forEach(id=>{
      io.to(id).emit("seen", msgId);
    });
  });

  socket.on("disconnect", ()=>{
    const u = socket.username;
    if(!u || !users[u]) return;

    users[u].sockets.delete(socket.id);
    if(users[u].sockets.size === 0){
      users[u].status = "offline";
      broadcastUsers();
    }
  });
});

server.listen(process.env.PORT || 3000, () =>
  console.log("Server running")
);
