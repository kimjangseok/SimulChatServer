// Setup basic express server
const express = require('express');
const config = require('config');
const app = express();
const path = require('path');
const server = require('http').createServer(app);
const redisAdapter = require('socket.io-redis');
const io = require('socket.io')(server, {
    cors: {
        origin: ["https://simul.gg", "http://127.0.0.1:3000", "http://localhost:3000", "http://192.168.219.160:3000"],
        methods: ["GET", "POST"],
        allowedHeaders: ["simulgg"],
        credentials: true
    }
});
const port = config.get("port");
const redisHost = config.get("redis").host;
const redisPort = config.get("redis").port;
console.log(redisHost, ":", redisPort);
// 클러스터는 차후 개발
io.adapter(redisAdapter({ host: redisHost, port: redisPort }));

server.listen(port, () => {
    console.log('Server listening at port %d', port);
});

// Chatroom

let numUsers = 0;

io.on('connection', (socket) => {
    console.log("connection");
    let addedUser = false;
    console.log('ip:', socket.conn.remoteAddress.split(":")[3]);

    // when the client emits 'new message', this listens and executes
    socket.on('new message', (data) => {
        try {
            console.log('new message ip:', socket.conn.remoteAddress.split(":")[3], data);
            // socket.conn.remoteAddress.split(":")[3]
            // we tell the client to execute 'new message'
            let ipArr = socket.conn.remoteAddress.split(":")[3].split(".");
            socket.broadcast.to(socket.roomNo).emit('new message', {
                username: socket.username,
                message: data,
                date: Date.now(),
                ip: ipArr[2] + "." + ipArr[3]
            });
        } catch (e) {

        }

    });

    // when the client emits 'add user', this listens and executes
    socket.on('add user', (data) => {
        let username = data.username;
        let roomNo = data.roomNo;

        // 채팅방 참여
        socket.join(roomNo);
        console.log('add user', username, roomNo);
        if (addedUser) return;

        // we store the username in the socket session for this client
        socket.username = username;
        socket.roomNo = roomNo;
        addedUser = true;
        // echo globally (all clients) that a person has connected
        // socket.broadcast.to(roomNo).emit('user joined', {
        //     username: socket.username,
        //     numUsers: numUsers
        // });
    });

    socket.on('leave user', (data) => {
        let username = data.username;
        let roomNo = data.roomNo;
        socket.leave(roomNo);
        console.log('leave user', username, roomNo);
        addedUser = false;
        socket.username = username;
        socket.roomNo = roomNo;
    });

    // when the client emits 'typing', we broadcast it to others
    socket.on('typing', () => {
        socket.broadcast.to(socket.roomNo).emit('typing', {
            username: socket.username
        });
    });

    // when the client emits 'stop typing', we broadcast it to others
    socket.on('stop typing', () => {
        socket.broadcast.to(socket.roomNo).emit('stop typing', {
            username: socket.username
        });
    });

    // when the user disconnects.. perform this
    socket.on('disconnect', () => {
        if (addedUser) {
            console.log('user left', socket.username, socket.roomNo)
            --numUsers;
            // echo globally that this client has left
            socket.broadcast.to(socket.roomNo).emit('user left', {
                username: socket.username,
                numUsers: numUsers
            });
        }
    });
});
