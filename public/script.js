// Initialize Public Matchmaking Database (Free Tier)
const firebaseConfig = {
    databaseURL: "https://echat-matchmaker-default-rtdb.firebaseio.com/"
};
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

// DOM Elements
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

let peer = null;
let currentCall = null;
let currentConn = null;
let localStream = null;
let myPeerId = null;
let queueRef = null;

// 1. Initialize Camera
async function initMedia() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
    } catch (err) {
        console.error("Camera error:", err);
        addSystemMessage("Camera and Microphone access are required!");
    }
}
initMedia();

// 2. Peer Connection Setup
function initPeer() {
    disconnectStranger();

    peer = new Peer();

    peer.on('open', (id) => {
        myPeerId = id;
        findPartner(id);
    });

    peer.on('call', (call) => {
        currentCall = call;
        call.answer(localStream);
        call.on('stream', (remoteStream) => {
            remoteVideo.srcObject = remoteStream;
            updateStatus('connected', 'Connected to stranger!');
            enableChat(true);
        });
        call.on('close', () => disconnectStranger());
    });

    peer.on('connection', (conn) => {
        currentConn = conn;
        setupDataConnection(conn);
    });

    peer.on('error', (err) => {
        console.error("Peer Error:", err);
        findNext();
    });
}

// 3. Matchmaking Engine
function findPartner(peerId) {
    updateStatus('searching', 'Looking for a stranger...');
    const queue = db.ref('queue');

    queue.once('value', (snapshot) => {
        const users = snapshot.val();
        let matchedPartnerId = null;

        if (users) {
            // Find first available user in queue
            for (let key in users) {
                if (users[key] !== peerId) {
                    matchedPartnerId = users[key];
                    // Remove matched user from queue
                    db.ref('queue/' + key).remove();
                    break;
                }
            }
        }

        if (matchedPartnerId) {
            // Connect to Stranger
            connectToStranger(matchedPartnerId);
        } else {
            // Add self to queue
            queueRef = queue.push(peerId);
            queueRef.onDisconnect().remove();
        }
    });
}

function connectToStranger(partnerId) {
    // Call video/audio
    currentCall = peer.call(partnerId, localStream);
    currentCall.on('stream', (remoteStream) => {
        remoteVideo.srcObject = remoteStream;
        updateStatus('connected', 'Connected to stranger!');
        enableChat(true);
    });

    // Connect text chat
    currentConn = peer.connect(partnerId);
    setupDataConnection(currentConn);
}

function setupDataConnection(conn) {
    conn.on('data', (data) => {
        addMessage(data, 'stranger');
    });

    conn.on('close', () => {
        addSystemMessage("Stranger disconnected.");
        disconnectStranger();
    });
}

// 4. Disconnect & Reset
function disconnectStranger() {
    if (queueRef) {
        queueRef.remove();
        queueRef = null;
    }
    if (currentCall) { currentCall.close(); currentCall = null; }
    if (currentConn) { currentConn.close(); currentConn = null; }
    if (peer) { peer.destroy(); peer = null; }
    
    remoteVideo.srcObject = null;
    enableChat(false);
    updateStatus('', 'Disconnected');
}

function findNext() {
    disconnectStranger();
    initPeer();
}

nextBtn.addEventListener('click', findNext);

// 5. Chat Engine
chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (text && currentConn) {
        currentConn.send(text);
        addMessage(text, 'you');
        chatInput.value = '';
    }
});

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

function updateStatus(stateClass, text) {
    statusDot.className = 'dot ' + stateClass;
    statusText.textContent = text;
}

function enableChat(enable) {
    chatInput.disabled = !enable;
    sendBtn.disabled = !enable;
}

// Media Controls
toggleMicBtn.addEventListener('click', () => {
    if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        audioTrack.enabled = !audioTrack.enabled;
        toggleMicBtn.innerHTML = audioTrack.enabled 
            ? '<i class="fa-solid fa-microphone"></i>' 
            : '<i class="fa-solid fa-microphone-slash"></i>';
    }
});

toggleCamBtn.addEventListener('click', () => {
    if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        videoTrack.enabled = !videoTrack.enabled;
        toggleCamBtn.innerHTML = videoTrack.enabled 
            ? '<i class="fa-solid fa-video"></i>' 
            : '<i class="fa-solid fa-video-slash"></i>';
    }
});