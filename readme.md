# Visitor Management System

A complete solution for managing visitors in residential or office buildings, featuring WhatsApp integration for resident notifications and approvals.

## Features

- 📱 **Modern UI**: Clean, responsive interface for visitor check-ins
- 🤳 **Selfie Capture**: Built-in camera functionality for visitor photos
- 💬 **WhatsApp Integration**: Real-time notifications to residents with visitor photos
- 🎫 **Digital Gatepasses**: Auto-generated passes for approved visitors
- 🔐 **Admin Dashboard**: Monitor visitors and manage WhatsApp bot

## Quick Start

### Prerequisites

- Node.js 14+ and npm installed
- WhatsApp account for the notification bot

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd visitormanagement
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables (copy from example)
```bash
cp .env.example .env
```

4. Start the development server
```bash
npm start
```

5. Visit http://localhost:5173 in your browser

### WhatsApp Bot Setup

1. Log in to the admin panel at http://localhost:3000/admin
   - Username: `panchadmin`
   - Password: `admin@1234`

2. Scan the QR code with your WhatsApp to connect the bot

## Configuration

Edit the `.env` file to customize your installation:

```
# Backend settings
PORT=3000
ADMIN_USERNAME=panchadmin
ADMIN_PASSWORD=admin@1234

# Frontend settings
VITE_API_URL=http://localhost:3000
```

## Deployment

### Free Deployment Options

#### Backend (Render.com)
1. Sign up at [Render](https://render.com)
2. Connect your repository
3. Render will use the provided `render.yaml` configuration

#### Frontend (Netlify/Vercel)
1. Build the frontend: `npm run build`
2. Deploy the `dist` folder to [Netlify](https://netlify.com) or [Vercel](https://vercel.com)

## Directory Structure

```
/
├── backend/           # Backend Node.js code
│   ├── server.js      # Express server
│   └── bot.js         # WhatsApp integration
├── src/               # Frontend React code
│   ├── components/    # React components
│   └── styles/        # CSS styles
├── public/            # Static assets
├── uploads/           # Visitor photos storage
└── data/              # JSON data storage
```

## License

MIT
# visitor_management_system
# visitor_management_system
