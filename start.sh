#!/bin/bash

# Panchsheel Enclave Visitor Management System Launcher
# This script starts both frontend and backend services

# Set text colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to display usage information
show_help() {
  echo -e "${YELLOW}Usage:${NC}"
  echo -e "  ./start.sh         - Start the application"
  echo -e "  ./start.sh kill    - Kill running services only"
  echo -e "  ./start.sh help    - Show this help message"
}

# Function to kill processes on specific ports
kill_ports() {
  echo -e "${YELLOW}Killing any processes running on ports 3000 (backend) and 5173 (frontend)...${NC}"
  lsof -ti:3000 | xargs kill -9 2>/dev/null || echo -e "${NC}No process running on port 3000"
  lsof -ti:5173 | xargs kill -9 2>/dev/null || echo -e "${NC}No process running on port 5173"
  echo -e "${GREEN}Ports cleared.${NC}"
}

# Check command arguments
if [ "$1" = "kill" ]; then
  kill_ports
  exit 0
elif [ "$1" = "help" ] || [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
  show_help
  exit 0
fi

echo -e "${GREEN}Starting Panchsheel Enclave Visitor Management System...${NC}"

# Kill existing processes on ports first
kill_ports

# Check if .env file exists, if not copy from example
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    echo -e "${YELLOW}No .env file found. Creating from .env.example...${NC}"
    cp .env.example .env
    echo -e "${GREEN}Created .env file. You may want to edit it with your own settings.${NC}"
  else
    echo -e "${RED}No .env or .env.example file found. This may cause issues.${NC}"
  fi
fi

# Check if required directories exist, create if not
echo -e "${YELLOW}Ensuring required directories are in place...${NC}"
mkdir -p data uploads .wwebjs_auth public/qr
touch data/.gitkeep uploads/.gitkeep

# Check if npm is installed
if ! command -v npm &> /dev/null; then
  echo -e "${RED}Error: npm is not installed or not in your PATH.${NC}"
  echo -e "${YELLOW}Please install Node.js and npm before continuing.${NC}"
  exit 1
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}Installing dependencies...${NC}"
  npm install
fi

# Start backend server
echo -e "${GREEN}Starting backend server...${NC}"
npm run server &
BACKEND_PID=$!

# Wait briefly for backend to initialize
echo -e "${YELLOW}Waiting for backend to initialize...${NC}"
sleep 5

# Check if backend started correctly
if ! ps -p $BACKEND_PID > /dev/null; then
  echo -e "${RED}Error: Backend failed to start. Check logs for details.${NC}"
  exit 1
fi

# Start frontend dev server
echo -e "${GREEN}Starting frontend development server...${NC}"
npm run dev &
FRONTEND_PID=$!

# Print access instructions
echo ""
echo -e "${GREEN}===================================================================${NC}"
echo -e "${GREEN}  PANCHSHEEL ENCLAVE VISITOR MANAGEMENT SYSTEM IS NOW RUNNING${NC}"
echo -e "${GREEN}===================================================================${NC}"
echo ""
echo -e "${YELLOW}  ✅ Access the visitor check-in form at:${NC} http://localhost:5173"
echo -e "${YELLOW}  ✅ Administrative access at:${NC} http://localhost:5173/admin"
echo -e "${YELLOW}     Username: panchadmin${NC}"
echo -e "${YELLOW}     Password: admin@1234${NC}"
echo ""
echo -e "${YELLOW}  WhatsApp bot is initializing. Log in to admin panel to scan the QR code.${NC}"
echo ""
echo -e "${RED}  Press Ctrl+C to stop all services.${NC}"
echo -e "${GREEN}===================================================================${NC}"

# Function to handle exit
function cleanup {
  echo -e "${YELLOW}Stopping services...${NC}"
  kill $FRONTEND_PID 2>/dev/null
  kill $BACKEND_PID 2>/dev/null
  echo -e "${GREEN}System shutdown complete.${NC}"
  exit 0
}

# Set up trap to catch Ctrl+C
trap cleanup INT

# Wait for user to press Ctrl+C
wait
