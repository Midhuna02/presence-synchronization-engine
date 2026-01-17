const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const users = {};
const GROUP_ROOM = "GLOBAL_GROUP";

function broadcastUsers(){
  const list = {};
  for(const u in users){
    list[u] = users[u].status;
  }
  io.emit("user-list", list);
}

io.on("connection", socket => {

  socket.on("join", userId => {
    socket.userId = userId;
    if(!users[userId]){
      users[userId] = { sockets:new Set(), status:"online" };
    }
    users[userId].sockets.add(socket.id);
    users[userId].status="online";
    socket.join(GROUP_ROOM);
    broadcastUsers();
  });

  socket.on("group-message", msg=>{
    socket.to(GROUP_ROOM).emit("group-message", msg);
  });

  socket.on("group-typing", ()=>{
    socket.to(GROUP_ROOM).emit("group-typing", socket.userId);
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
      io.to(id).emit("private-typing", socket.userId);
    });
  });

  socket.on("seen", ({to,msgId})=>{
    if(!users[to]) return;
    users[to].sockets.forEach(id=>{
      io.to(id).emit("seen", msgId);
    });
  });

  socket.on("disconnect", ()=>{
    const u = socket.userId;
    if(!u || !users[u]) return;
    users[u].sockets.delete(socket.id);
    if(users[u].sockets.size===0){
      users[u].status="offline";
      broadcastUsers();
    }
  });

});

server.listen(3000, ()=>console.log("Server running on 3000"));
