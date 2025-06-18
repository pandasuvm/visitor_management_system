#!/bin/bash

# Simple Free Deployment Script for Visitor Management System

echo "==== Starting Simple Deployment Process ===="

# 1. Install dependencies
echo "Installing dependencies..."
npm install

# 2. Create necessary directories if they don't exist
echo "Setting up directories..."
mkdir -p data uploads .wwebjs_auth public/qr

# 3. Start the application
echo "Starting the application..."
node backend/server.js
