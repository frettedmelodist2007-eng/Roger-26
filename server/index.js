const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, '../client/dist')));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*', // Allow all origins for local testing
        methods: ['GET', 'POST']
    }
});

// State
// rooms[code] = { users: Set<socketId>, limit: number }
const rooms = {};

const generateCode = () => {
    let code;
    do {
        code = Math.floor(10000 + Math.random() * 90000).toString();
    } while (rooms[code]);
    return code;
};

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('create_room', ({ limit }) => {
        // 1. Generate unique code
        const roomCode = generateCode();

        // 2. Create room state
        // Ensure limit is a valid number, default to 2
        const maxUsers = parseInt(limit) > 0 ? parseInt(limit) : 2;

        rooms[roomCode] = {
            users: new Set([socket.id]),
            limit: maxUsers
        };

        // 3. Join socket room
        socket.join(roomCode);

        // 4. Notify client
        socket.emit('room_created', { roomCode });
        console.log(`Room ${roomCode} created by ${socket.id} with limit ${maxUsers}`);
    });

    socket.on('join_room', ({ roomCode }) => {
        const room = rooms[roomCode];

        // Validation
        if (!room) {
            socket.emit('error', 'Channel does not exist.');
            return;
        }
        if (room.users.size >= room.limit) {
            socket.emit('error', 'Channel is full.');
            return;
        }
        if (room.users.has(socket.id)) {
            // User already in room? Just ignore or re-ack
            return;
        }

        // Join logic
        room.users.add(socket.id);
        socket.join(roomCode);

        // Notify user
        socket.emit('room_joined', { roomCode });

        // Notify others (Trigger WebRTC offer from existing users)
        socket.to(roomCode).emit('user_connected', { userId: socket.id });

        console.log(`User ${socket.id} joined room ${roomCode}`);
    });

    // --- WebRTC Signaling ---
    socket.on('offer', (payload) => {
        io.to(payload.target).emit('offer', payload);
    });

    socket.on('answer', (payload) => {
        io.to(payload.target).emit('answer', payload);
    });

    socket.on('ice-candidate', (payload) => {
        io.to(payload.target).emit('ice-candidate', payload);
    });

    // --- Disconnect ---
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);

        // Scan all rooms to remove user
        for (const [code, room] of Object.entries(rooms)) {
            if (room.users.has(socket.id)) {
                room.users.delete(socket.id);
                socket.to(code).emit('user_disconnected', { userId: socket.id });

                // Cleanup empty room
                if (room.users.size === 0) {
                    delete rooms[code];
                    console.log(`Room ${code} closed (empty).`);
                }
            }
        }
    });
});

// All other GET requests not handled before will return our React app
app.get(/(.*)/, (req, res) => {
    res.sendFile(path.resolve(__dirname, '../client/dist', 'index.html'));
});

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`SERVER RUNNING ON PORT ${PORT}`);
});
