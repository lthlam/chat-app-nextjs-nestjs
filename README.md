# 🌌 Chat App

A modern, real-time messaging platform built with **NestJS**, **Next.js**, and **Socket.io**. Designed for speed, scalability, and a premium user experience.

---

## 🛠️ Tech Stack

### Backend (`/be`)
- **Core**: [NestJS v10](https://nestjs.com/) (Node.js Framework)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **ORM**: [TypeORM](https://typeorm.io/)
- **Database**: [PostgreSQL](https://www.postgresql.org/)
- **Real-time**: [Socket.io](https://socket.io/) (WebSockets)
- **Auth**: [JWT](https://jwt.io/) with [Passport.js](https://www.passportjs.org/)
- **Security**: [Helmet](https://helmetjs.github.io/), [Throttler](https://docs.nestjs.com/security/rate-limiting) (Rate Limiting)
- **Media**: [Cloudinary](https://cloudinary.com/) (Cloud Storage)
- **WebRTC**: [Metered.ca](https://www.metered.ca/) (TURN/STUN Servers)
- **Documentation**: [Swagger / OpenAPI](https://swagger.io/)

### Frontend (`/fe`)
- **Framework**: [Next.js 15+](https://nextjs.org/) (App Router)
- **UI Library**: [React 19](https://react.dev/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **State Management**: [Zustand](https://zustand-demo.pmnd.rs/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Real-time**: [Socket.io-client](https://socket.io/)

---

## ✨ Features

- 🔐 **Secure Authentication**: JWT-based login and registration.
- 💬 **Real-time Messaging**: Instant message delivery via WebSockets.
- 📁 **Chat Rooms**: Create, join, and manage group or private conversations.
- 👥 **Friend System**: Search users, send friend requests, and manage social connections.
- 📞 **Audio & Video Calls**: High-quality real-time communication powered by WebRTC.
- 🎞️ **Media Support**: Share images, videos, and voice messages in chats.
- 📱 **Responsive Design**: Optimized for both desktop and mobile devices.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- PostgreSQL
- Docker (optional, for containerized setup)

### 1. Clone the repository
```bash
git clone <repository-url>
cd chat-app-nextjs-nestjs
```

### 2. Environment Setup
Create environment files based on the structure:
- Root: `.env`
- Backend: `be/.env`
- Frontend: `fe/.env.local`

### 3. Installation
Install dependencies in the root (which uses `concurrently`):
```bash
npm install
```
*Note: You may also need to run `npm install` inside `be/` and `fe/` directories.*

### 4. Database Initialization
Before starting the app for the first time, you must install the required PostgreSQL extensions and functions (especially for search functionality):
```bash
cd be
npm run init:db
```

### 5. Running the application
Run both backend and frontend simultaneously:
```bash
npm run dev
```

---

## 🐳 Docker Deployment

Deploy the entire stack (PostgreSQL + NestJS + Next.js) using Docker Compose:

```bash
docker-compose up --build
```

The services will be available at:
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:3001`

---

## 📂 Project Structure

```text
.
├── be/                 # NestJS Backend source code
├── fe/                 # Next.js Frontend source code
├── docs/               # System & API Documentation
├── docker-compose.yml  # Local deployment orchestration
└── package.json        # Root scripts & orchestration
```
