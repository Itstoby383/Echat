const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let waitingUser = null;
const activePairs = new Map(); // socket.id -> partner.id

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Pair user logic
    socket.on('find-partner', () => {
        // Disconnect from existing partner if any
        leaveCurrentPartner(socket);

        if (waitingUser && waitingUser.id !== socket.id) {
            // Pair found!
            const partner = waitingUser;
            waitingUser = null;

            activePairs.set(socket.id, partner.id);
            activePairs.set(partner.id, socket.id);

            // Notify both users
            socket.emit('paired', { partnerId: partner.id, initiate: true });
            partner.emit('paired', { partnerId: socket.id, initiate: false });
        } else {
            // Put in waiting queue
            waitingUser = socket;
            socket.emit('waiting');
        }
    });

    // WebRTC Signaling
    socket.on('signal', (data) => {
        const partnerId = activePairs.get(socket.id);
        if (partnerId) {
            io.to(partnerId).emit('signal', data);
        }
    });

    // Text Chat
    socket.on('send-message', (text) => {
        const partnerId = activePairs.get(socket.id);
        if (partnerId) {
            io.to(partnerId).emit('receive-message', text);
        }
    });

    // Skip / Next button
    socket.on('leave', () => {
        leaveCurrentPartner(socket);
    });

    // Disconnect
    socket.on('disconnect', () => {
        leaveCurrentPartner(socket);
        if (waitingUser && waitingUser.id === socket.id) {
            waitingUser = null;
        }
        console.log(`User disconnected: ${socket.id}`);
    });
});

function leaveCurrentPartner(socket) {
    const partnerId = activePairs.get(socket.id);
    if (partnerId) {
        activePairs.delete(socket.id);
        activePairs.delete(partnerId);
        io.to(partnerId).emit('partner-disconnected');
    }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`\n🔥 eChat server running at http://localhost:${PORT}\n`);
});