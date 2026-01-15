import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import SoundManager from './SoundManager';
import './index.css';

// 1. GLOBAL CONNECTION (Connects once to your live server)
const SOCKET_URL = "https://roger-26.onrender.com";
const socket = io(SOCKET_URL);

function App() {
  // UI State
  const [view, setView] = useState('LANDING'); // LANDING, LOBBY
  const [roomCode, setRoomCode] = useState('');
  const [limit, setLimit] = useState(2);
  const [status, setStatus] = useState('CONNECTING...');
  const [isTx, setIsTx] = useState(false); // Transmitting?
  const [isRx, setIsRx] = useState(false); // Receiving?

  // WebRTC Refs
  const localStream = useRef(null);
  const peers = useRef({}); // { [id]: RTCPeerConnection }
  const remoteAudioRef = useRef(null); // Reference to the hidden audio tag

  const handleClose = () => {
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      ipcRenderer.send('app-close');
    }
  };

  // 2. Initialize Socket Listeners
  useEffect(() => {
    // Connection Status
    socket.on('connect', () => {
      console.log('Connected to server:', socket.id);
      setStatus('READY');
    });

    socket.on('disconnect', () => {
      console.log('Disconnected');
      setStatus('OFFLINE');
    });

    socket.on('error', (msg) => {
      alert(msg);
      setStatus('ERROR');
    });

    // Room Logic
    socket.on('room_created', ({ roomCode }) => {
      setRoomCode(roomCode);
      setView('LOBBY');
      setStatus('CHANNEL OPEN');
      initAudio();
    });

    socket.on('room_joined', ({ roomCode }) => {
      setRoomCode(roomCode);
      setView('LOBBY');
      setStatus('CHANNEL OPEN');
      initAudio();
    });

    // WebRTC Signaling
    socket.on('user_connected', ({ userId }) => {
      console.log('User joined:', userId);
      setStatus('USER JOINED');
      // Initiator (existing user) calls the new user
      createPeer(userId, socket, true);
    });

    socket.on('user_disconnected', ({ userId }) => {
      console.log('User left:', userId);
      if (peers.current[userId]) {
        peers.current[userId].close();
        delete peers.current[userId];
      }
    });

    socket.on('offer', handleOffer);
    socket.on('answer', handleAnswer);
    socket.on('ice-candidate', handleCandidate);

    // Cleanup on unmount
    return () => {
      socket.off('connect');
      socket.off('room_created');
      socket.off('room_joined');
      socket.off('user_connected');
      socket.off('offer');
      socket.off('answer');
      socket.off('ice-candidate');
    };
  }, []);

  // 3. Audio Setup
  const initAudio = async () => {
    try {
      // Clean up old streams
      if (localStream.current) {
        localStream.current.getTracks().forEach(track => track.stop());
        localStream.current = null;
      }

      // Request new stream
      console.log("Requesting mic access...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStream.current = stream;
      setStatus("READY");

      // Mute mic initially (PTT logic - only unmute when button pressed)
      stream.getAudioTracks().forEach(track => track.enabled = false);

    } catch (e) {
      console.error("Mic Error Details:", e);
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        setStatus("MIC DENIED");
        alert("Microphone permission denied! Please reset permissions in your browser address bar.");
      } else if (e.name === 'NotFoundError') {
        setStatus("NO MIC FOUND");
        alert("No microphone device found.");
      } else {
        setStatus("MIC ERROR");
        alert(`Microphone error: ${e.message}`);
      }
    }
  };

  // 4. Peer Connection Logic
  const createPeer = (targetId, socketInstance, isInitiator) => {
    const peer = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    // Add local tracks to the connection
    if (localStream.current) {
      localStream.current.getTracks().forEach(track => {
        peer.addTrack(track, localStream.current);
      });
    }

    // Handle ICE Candidates
    peer.onicecandidate = (e) => {
      if (e.candidate) {
        socketInstance.emit('ice-candidate', {
          target: targetId,
          candidate: e.candidate,
          caller: socketInstance.id
        });
      }
    };

    // Handle Incoming Audio Stream
    peer.ontrack = (e) => {
      console.log("Receiving remote audio track");

      // Play the audio through the hidden <audio> tag
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = e.streams[0];
        remoteAudioRef.current.play().catch(e => console.error("Auto-play blocked:", e));
      }

      setIsRx(true);
      SoundManager.playStatic(0.1);

      e.track.onended = () => {
        setIsRx(false);
        SoundManager.playRoger();
      };
    };

    peers.current[targetId] = peer;

    if (isInitiator) {
      peer.createOffer().then(offer => {
        peer.setLocalDescription(offer);
        socketInstance.emit('offer', {
          target: targetId,
          sdp: offer,
          caller: socketInstance.id
        });
      });
    }

    return peer;
  };

  const handleOffer = async ({ caller, sdp }) => {
    // Receiver creates peer (not initiator)
    const peer = createPeer(caller, socket, false);

    await peer.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);

    socket.emit('answer', {
      target: caller,
      sdp: answer,
      caller: socket.id
    });
  };

  const handleAnswer = async ({ caller, sdp }) => {
    const peer = peers.current[caller];
    if (peer) {
      await peer.setRemoteDescription(new RTCSessionDescription(sdp));
    }
  };

  const handleCandidate = async ({ caller, candidate }) => {
    const peer = peers.current[caller];
    if (peer) {
      await peer.addIceCandidate(new RTCIceCandidate(candidate));
    }
  };

  // 5. PTT Handlers
  const startTx = () => {
    if (localStream.current) {
      localStream.current.getAudioTracks().forEach(t => t.enabled = true);
      setIsTx(true);
      setStatus('TRANSMITTING...');
      SoundManager.playClick();
    }
  };

  const stopTx = () => {
    if (localStream.current) {
      localStream.current.getAudioTracks().forEach(t => t.enabled = false);
      setIsTx(false);
      setStatus('RECEIVING...');
      SoundManager.playRoger();
    }
  };

  // 6. Actions
  const handleCreate = () => socket.emit('create_room', { limit });
  const handleJoin = () => socket.emit('join_room', { roomCode });

  return (
    <div className="walkie-talkie">
      <div className="drag-region"></div>
      <div className="antenna"></div>
      <div className="grip left"></div>
      <div className="grip right"></div>
      <div className="speaker"></div>

      {/* Hidden Audio Element for Incoming Sound */}
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />

      <div className={`led-indicator ${isTx ? 'tx' : isRx ? 'rx' : ''}`}></div>

      <div className="screen">
        <div className="lcd-text">
          {view === 'LANDING' ? 'READY' : `CH: ${roomCode}`}
        </div>
        <div className="status-bar">
          <span>{status}</span>
          <span>BAT 100%</span>
        </div>
      </div>

      <div className="controls">
        {view === 'LANDING' ? (
          <>
            <input
              placeholder="ENTER CODE"
              value={roomCode}
              onChange={e => setRoomCode(e.target.value)}
              maxLength={5}
            />
            <button className="btn" onClick={handleJoin}>TUNE IN</button>

            <div style={{ height: 20 }}></div>

            <label style={{ color: '#F4D03F', fontSize: '0.8rem' }}>MAX USERS</label>
            <input
              type="number"
              value={limit}
              onChange={e => setLimit(e.target.value)}
              style={{ width: '60px' }}
            />
            <button className="btn" onClick={handleCreate}>CREATE NEW</button>
          </>
        ) : (
          <>
            <button
              className={`ptt-btn ${isTx ? 'active' : ''}`}
              onMouseDown={startTx}
              onMouseUp={stopTx}
              onTouchStart={startTx}
              onTouchEnd={stopTx}
              disabled={status.includes('DENIED') || status.includes('ERROR') || status.includes('NO MIC')}
            >
              {isTx ? 'TALK' : 'PUSH'}
            </button>

            {(status.includes('DENIED') || status.includes('ERROR')) && (
              <button className="btn"
                style={{ marginTop: 10, fontSize: '0.7rem', background: '#C0392B' }}
                onClick={initAudio}>
                RETRY MIC
              </button>
            )}

            <button className="btn"
              onClick={handleClose}
              style={{ marginTop: 50, background: '#333' }}
            >
              OFF
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default App;