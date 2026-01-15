import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import SoundManager from './SoundManager';
import './index.css';

const SERVER_URL = 'http://localhost:3001';

function App() {
  const [socket, setSocket] = useState(null);

  // UI State
  const [view, setView] = useState('LANDING'); // LANDING, LOBBY
  const [roomCode, setRoomCode] = useState('');
  const [limit, setLimit] = useState(2);
  const [status, setStatus] = useState('READY');
  const [isTx, setIsTx] = useState(false); // Transmitting?
  const [isRx, setIsRx] = useState(false); // Receiving?

  // WebRTC Refs
  const localStream = useRef(null);
  const peers = useRef({}); // { [id]: RTCPeerConnection }

  const handleClose = () => {
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      ipcRenderer.send('app-close');
    }
  };

  // 1. Initialize Socket
  useEffect(() => {
    const s = io(SERVER_URL);
    setSocket(s);

    s.on('connect', () => {
      console.log('Connected to server');
    });

    s.on('room_created', ({ roomCode }) => {
      setRoomCode(roomCode);
      setView('LOBBY');
      setStatus('CHANNEL OPEN');
      initAudio();
    });

    s.on('room_joined', ({ roomCode }) => {
      setRoomCode(roomCode);
      setView('LOBBY');
      setStatus('CHANNEL OPEN');
      initAudio();
    });

    s.on('error', (msg) => {
      alert(msg);
      setStatus('ERROR');
    });

    s.on('user_connected', ({ userId }) => {
      console.log('User joined:', userId);
      setStatus('USER JOINED');
      // Initiator (existing user) calls the new user
      createPeer(userId, s, true);
    });

    s.on('user_disconnected', ({ userId }) => {
      console.log('User left:', userId);
      if (peers.current[userId]) {
        peers.current[userId].close();
        delete peers.current[userId];
      }
    });

    // WebRTC Signals
    s.on('offer', handleOffer);
    s.on('answer', handleAnswer);
    s.on('ice-candidate', handleCandidate);

    return () => s.disconnect();
  }, []);

  // 2. Audio Setup
  const initAudio = async () => {
    try {
      // 1. Clean up potential old streams first
      if (localStream.current) {
        localStream.current.getTracks().forEach(track => track.stop());
        localStream.current = null;
      }

      // 2. Request new stream
      console.log("Requesting mic access...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStream.current = stream;
      setStatus("READY"); // Clear previous error

      // Mute initially (PTT logic)
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

  // 3. Peer Connection Logic
  const createPeer = (targetId, socketInstance, isInitiator) => {
    const peer = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    // Add local tracks
    if (localStream.current) {
      localStream.current.getTracks().forEach(track => {
        peer.addTrack(track, localStream.current);
      });
    }

    // Handle ICE
    peer.onicecandidate = (e) => {
      if (e.candidate) {
        socketInstance.emit('ice-candidate', {
          target: targetId,
          candidate: e.candidate,
          caller: socketInstance.id
        });
      }
    };

    // Handle Remote Stream (Play Audio)
    peer.ontrack = (e) => {
      audio.srcObject = e.streams[0];
      audio.autoplay = true;

      // Detect audio activity roughly (or just trust the stream existence for RX light)
      setIsRx(true);
      SoundManager.playStatic(0.1); // Initial squelch open

      // Simple activity monitor (optional, for now just toggle RX on track)
      // For true voice activity detection (VAD), we'd need AudioContext analysis.
      // Here we simulate "RX ON" while track is active.

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

  // 4. PTT Handlers
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

  // 5. Actions
  const handleCreate = () => socket.emit('create_room', { limit });
  const handleJoin = () => socket.emit('join_room', { roomCode });

  return (
    <div className="walkie-talkie">
      <div className="drag-region"></div>
      <div className="antenna"></div>
      <div className="grip left"></div>
      <div className="grip right"></div>

      <div className="speaker"></div>



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
              disabled={status === 'MIC DENIED' || status === 'MIC ERROR' || status === 'NO MIC FOUND'}
            >
              {isTx ? 'TALK' : 'PUSH'}
            </button>

            {(status === 'MIC DENIED' || status === 'MIC ERROR') && (
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
