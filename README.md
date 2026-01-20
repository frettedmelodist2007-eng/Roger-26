# Network Walkie-Talkie Android App

A real-time **network-based walkie-talkie (Push-to-Talk)** Android application that allows users to communicate using a **5-digit room code** over the internet.
The app does **not** rely on Bluetooth or Wi-Fi Direct and works globally using mobile data or Wi-Fi.

---
Android apk
https://github.com/frettedmelodist2007-eng/Roger-26/releases/download/app/app-debug.apk

Webapp link:
https://roger-26.onrender.com/

##  Features

*  **5-Digit Room Code System**

  * One user creates a room and gets a unique code
  * Other users join by entering the same code

*  **Push-to-Talk Voice Communication**

  * Real-time audio streaming
  * Low-latency voice transmission

*  **Admin Controls**

  * Set maximum user limit per room
  * Manage participants

* **Internet-Based Communication**

  * Works anywhere using network connection
  * No proximity or hardware limitations

---

##  Tech Stack

###  Android App

* **Language:** Kotlin
* **IDE:** Android Studio
* **Audio:** WebRTC
* **Networking:** Socket.IO

### Backend Server

* **Runtime:** Node.js
* **Framework:** Express.js
* **Real-Time Signaling:** Socket.IO
* **Room Management:** In-memory / Database (Firebase / MongoDB – optional)

---

##  Architecture Overview

```
Android Client (Admin)
        │
        │  Create Room (5-digit code)
        ▼
  Signaling Server (Node.js + Socket.IO)
        ▲
        │  Join Room
        │
Android Client (Users)
```

Audio streams are exchanged using **WebRTC**, while room creation and signaling are handled by the backend server.

---

##  Project Structure

```
walkie-talkie-app/
│
├── android-app/
│   ├── app/
│   ├── manifests/
│   └── kotlin/
│
├── server/
│   ├── server.js
│   ├── package.json
│   └── node_modules/
│
└── README.md
```

---

##  Permissions Used

```xml
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.RECORD_AUDIO"/>
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
```

---

## Setup Instructions

### Backend Server Setup

```bash
cd server
npm install
node server.js
```

Server will run on:

```
http://localhost:3000
```

---

###  Android App Setup

1. Open **Android Studio**
2. Import the `android-app` folder
3. Sync Gradle
4. Run on physical device (recommended for mic testing)

---

## How It Works

1. Admin creates a room → receives a **5-digit code**
2. Users enter the code to join
3. Press and hold **Push-to-Talk** button to speak
4. Release button to stop transmitting
5. Admin controls room capacity

---

##  Use Cases

* Team communication
* Event coordination
* Campus or college projects
* Emergency or field communication
* Learning WebRTC & real-time systems

---

##  Limitations (Current)

* No encryption (to be added)
* No voice recording storage
* Basic UI (focus on functionality)

---

##  Future Enhancements

*  End-to-end encryption
*  Modern UI with Jetpack Compose
*  Firebase-based room persistence
*  Network quality handling
*  User roles & moderation

---

##  Learning Outcomes

* Android audio handling
* WebRTC integration
* Real-time communication
* Client–server architecture
* Scalable room-based systems

---

##  Author

**Ayush**
B.Tech Student | Android Developer | Tech Enthusiast

 Instagram: [@fretted_melodist](https://instagram.com/fretted_melodist)



> *This project is built for educational and learning purposes.*
