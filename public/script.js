const socket = io();

// UI Elements
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const nextBtn = document.getElementById('next-btn');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const messagesContainer = document.getElementById('messages');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const toggleMicBtn = document.getElementById('toggle-mic');
const toggleCamBtn = document.getElementById('toggle-cam');

let localStream;
let peerConnection;
let isAudioMuted = false;
let isVideoMuted = false;

// WebRTC STUN Servers for Peer-to-Peer connection
const rtcConfig = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19020' }]
};

// Initialize Media (Camera & Mic)
async function initMedia() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
    } catch (err) {
        console.error("Error accessing camera/mic:", err);
        addSystemMessage("Error accessing video camera/microphone.");
    }
}

initMedia();

// Socket Events
nextBtn.addEventListener('click', () => {
    resetConnection();
    socket.emit('find-partner');
    updateStatus('searching', 'Searching for stranger...');
});

socket.on('waiting', () => {
    updateStatus('searching', 'Waiting for someone to join...');
});

socket.on('paired', async ({ initiate }) => {
    updateStatus('connected', 'Connected to stranger!');
    enableChat(true);

    peerConnection = new RTCPeerConnection(rtcConfig);

    // Add local tracks to WebRTC connection
    if (localStream) {
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
    }

    // Handle remote tracks
    peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
    };

    // Handle ICE Candidates
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('signal', { candidate: event.candidate });
        }
    };

    if (initiate) {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('signal', { offer });
    }
});

socket.on('signal', async (data) => {
    if (!peerConnection) return;

    if (data.offer) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('signal', { answer });
    } else if (data.answer) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    } else if (data.candidate) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
});

socket.on('partner-disconnected', () => {
    addSystemMessage("Stranger disconnected.");
    resetConnection();
    updateStatus('', 'Disconnected');
});

// Chat Functionality
chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (text) {
        socket.emit('send-message', text);
        addMessage(text, 'you');
        chatInput.value = '';
    }
});

socket.on('receive-message', (text) => {
    addMessage(text, 'stranger');
});

// Helper Functions
function addMessage(text, sender) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('msg', sender);
    msgDiv.textContent = text;
    messagesContainer.appendChild(msgDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function addSystemMessage(text) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('system-msg');
    msgDiv.textContent = text;
    messagesContainer.appendChild(msgDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function resetConnection() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    remoteVideo.srcObject = null;
    enableChat(false);
}

function enableChat(enable) {
    chatInput.disabled = !enable;
    sendBtn.disabled = !enable;
}

function updateStatus(stateClass, text) {
    statusDot.className = 'dot ' + stateClass;
    statusText.textContent = text;
}

// Media Controls
toggleMicBtn.addEventListener('click', () => {
    if (localStream) {
        isAudioMuted = !isAudioMuted;
        localStream.getAudioTracks()[0].enabled = !isAudioMuted;
        toggleMicBtn.innerHTML = isAudioMuted 
            ? '<i class="fa-solid fa-microphone-slash"></i>' 
            : '<i class="fa-solid fa-microphone"></i>';
    }
});

toggleCamBtn.addEventListener('click', () => {
    if (localStream) {
        isVideoMuted = !isVideoMuted;
        localStream.getVideoTracks()[0].enabled = !isVideoMuted;
        toggleCamBtn.innerHTML = isVideoMuted 
            ? '<i class="fa-solid fa-video-slash"></i>' 
            : '<i class="fa-solid fa-video"></i>';
    }
});