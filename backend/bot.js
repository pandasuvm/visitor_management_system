import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { generateGatepass } from './utils/gatepass.js';

// Baileys imports
import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
  delay,
  makeCacheableSignalKeyStore,
  isJidUser
} from '@whiskeysockets/baileys';
import pino from 'pino';

// ES Module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to visitor data file
const visitorDataPath = path.join(__dirname, '../data/visitorData.json');

// Store pending requests by phone number for easier response handling
// Format: { 'phoneNumber@c.us': { requestId: 'xyz', visitorName: 'John Doe', timestamp: Date } }
export const pendingRequests = new Map();

// Auth session storage path - using Baileys format
const AUTH_FOLDER = path.join(__dirname, '../.baileys_auth_info');

// Ensure auth directory exists
fs.ensureDirSync(AUTH_FOLDER);

// Logger with minimal logging
const logger = pino({ level: 'warn' });

// Global variable to store the WhatsApp client
let waSocket = null;

// Initialize the WhatsApp client with Baileys
async function initWhatsApp() {
  console.log('Setting up WhatsApp client with Baileys...');

  // Use multi-file auth state management
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
  console.log(`Using auth state from: ${AUTH_FOLDER}`);

  // Fetch the latest version of Baileys
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`Using WA v${version.join('.')}, isLatest: ${isLatest}`);

  // Create a new WhatsApp socket connection
  waSocket = makeWASocket({
    version,
    logger,
    printQRInTerminal: true,
    browser: Browsers.macOS('Chrome'),  // Mimicking Chrome on macOS
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    markOnlineOnConnect: true,
    syncFullHistory: false, // Preventing excessive history syncing
    connectTimeoutMs: 60000, // 60 seconds
    defaultQueryTimeoutMs: 30000, // 30 seconds
    emitOwnEvents: true, // Emit events for our own messages
  });

  // Save credentials whenever they are updated
  waSocket.ev.on('creds.update', saveCreds);

  // Handle connection events
  waSocket.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    // Log connection state changes
    if (connection) {
      console.log('Connection status:', connection);
    }

    // If QR code is available, save it to a file for web access
    if (qr) {
      console.log('QR code received. Scan this with your WhatsApp app:');
      try {
        // Ensure the directory exists
        const qrDir = path.join(__dirname, '../public/qr');
        fs.ensureDirSync(qrDir);

        fs.writeFileSync(path.join(qrDir, 'latest-qr.txt'), qr);
        console.log('QR code saved to public/qr/latest-qr.txt');
      } catch (err) {
        console.error('Failed to save QR code to file:', err);
      }
    }

    // When connected successfully, remove the QR code file
    if (connection === 'open') {
      console.log('WhatsApp connection established!');

      // Get connected user info
      const userJid = waSocket.user.id;
      console.log(`Connected as: ${userJid}`);

      // Remove QR code file since we're now authenticated
      try {
        const qrFilePath = path.join(__dirname, '../public/qr/latest-qr.txt');
        if (fs.existsSync(qrFilePath)) {
          fs.unlinkSync(qrFilePath);
          console.log('QR code file removed after successful authentication');
        }
      } catch (err) {
        console.error('Error removing QR code file:', err);
      }

      // Set ready flag on the socket
      waSocket.isReady = true;

      // Notify admin that system is online
      try {
        await waSocket.sendMessage('917781943246@s.whatsapp.net', {
          text: 'Panchsheel Enclave Visitor Management System is now online.'
        });
        console.log('Sent online notification to admin');
      } catch (err) {
        console.error('Failed to send admin notification:', err);
      }
    }

    // If disconnected, try to reconnect based on the reason
    if (connection === 'close') {
      // Set ready flag to false when disconnected
      if (waSocket) waSocket.isReady = false;

      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Connection closed due to:', lastDisconnect?.error, 'Reconnecting:', shouldReconnect);

      if (shouldReconnect) {
        console.log('Attempting to reconnect in 5 seconds...');
        await delay(5000); // Wait 5 seconds before reconnecting
        initWhatsApp(); // Restart the connection
      } else {
        console.log('Not reconnecting as user is logged out. Need to authenticate again.');
        // Clear authentication files for fresh login
        try {
          fs.emptyDirSync(AUTH_FOLDER);
          console.log('Auth folder cleared for fresh login');
        } catch (err) {
          console.error('Failed to clear auth folder:', err);
        }
      }
    }
  });

  // Handle incoming messages
  waSocket.ev.on('messages.upsert', async ({ messages }) => {
    for (const message of messages) {
      if (!message.key.fromMe && message.message) {
        // Process the incoming message
        await handleIncomingMessage(message);
      }
    }
  });

  return waSocket;
}

// Process incoming messages
async function handleIncomingMessage(message) {
  try {
    // Extract the sender ID and message content
    const senderId = message.key.remoteJid;
    // Extract the actual text content depending on message type
    const messageContent = message.message.conversation ||
                          (message.message.extendedTextMessage?.text) ||
                          '';

    console.log(`Received message: "${messageContent}" from ${senderId}`);

    // Convert to uppercase for easier comparison
    const messageBody = messageContent.trim().toUpperCase();

    // Normalize the phone number to check both @c.us and @s.whatsapp.net formats
    const normalizedSenderId = senderId.replace('@s.whatsapp.net', '@c.us');
    const alternativeSenderId = senderId.replace('@c.us', '@s.whatsapp.net');

    // Check if either format exists in the pending requests map
    const hasPendingRequest = pendingRequests.has(senderId) ||
                             pendingRequests.has(normalizedSenderId) ||
                             pendingRequests.has(alternativeSenderId);

    // Get the actual key that exists in the map
    const actualSenderId = pendingRequests.has(senderId) ? senderId :
                         pendingRequests.has(normalizedSenderId) ? normalizedSenderId :
                         pendingRequests.has(alternativeSenderId) ? alternativeSenderId : null;

    // Handle poll votes (buttons in Baileys)
    // Note: Baileys handles buttons differently, this is a simplified approach
    if (message.message.buttonsResponseMessage) {
      const buttonId = message.message.buttonsResponseMessage.selectedButtonId;
      console.log(`Button response received: ${buttonId}`);

      if (hasPendingRequest && actualSenderId) {
        const pendingRequest = pendingRequests.get(actualSenderId);
        const requestId = pendingRequest.requestId;

        if (buttonId === 'approve') {
          await handleVisitorApproval(senderId, requestId, pendingRequest);
        } else if (buttonId === 'reject') {
          await handleVisitorRejection(senderId, requestId, pendingRequest);
        }

        // Remove the pending request after processing
        pendingRequests.delete(actualSenderId);
        return;
      }
    }

    // Simple YES/NO response handling
    if (messageBody === 'YES' || messageBody === 'NO') {
      // Check if there's a pending request for this phone number
      if (hasPendingRequest && actualSenderId) {
        const pendingRequest = pendingRequests.get(actualSenderId);
        const requestId = pendingRequest.requestId;

        console.log(`Received ${messageBody} response from ${senderId} for visitor ${pendingRequest.visitorName}`);

        // Check if visitor data file exists
        if (!fs.existsSync(visitorDataPath)) {
          console.error('Visitor data file not found at:', visitorDataPath);
          await sendMessage(senderId, 'System error: Visitor data file not found.');
          return;
        }

        // Read visitor data
        const visitorData = JSON.parse(fs.readFileSync(visitorDataPath, 'utf8'));

        if (!visitorData[requestId]) {
          console.log(`Request ID ${requestId} not found in visitor data`);
          await sendMessage(senderId, 'Sorry, this visitor request is no longer valid or has expired.');
          pendingRequests.delete(actualSenderId); // Clean up the pending request
          return;
        }

        // Process the response based on YES/NO
        if (messageBody === 'YES') {
          await handleVisitorApproval(senderId, requestId, pendingRequest);
        } else {
          await handleVisitorRejection(senderId, requestId, pendingRequest);
        }

        // Remove the pending request after processing
        pendingRequests.delete(actualSenderId);
        return;
      } else {
        // No pending request found for this phone number
        await sendMessage(senderId, "I don't have any pending visitor requests for your approval at the moment.");
        return;
      }
    }

    // Handle legacy format with request ID (to maintain backward compatibility)
    const parts = messageBody.split(' ');
    if (parts.length >= 2) {
      const action = parts[0];
      const requestId = parts[1];

      if ((action === 'YES' || action === 'NO') && requestId) {
        console.log(`Received ${action} response with ID ${requestId} from ${senderId}`);

        // Process with the explicit request ID
        if (!fs.existsSync(visitorDataPath)) {
          console.error('Visitor data file not found at:', visitorDataPath);
          await sendMessage(senderId, 'System error: Visitor data file not found.');
          return;
        }

        const visitorData = JSON.parse(fs.readFileSync(visitorDataPath, 'utf8'));

        if (!visitorData[requestId]) {
          // Request ID not found, inform the user
          console.log(`Request ID ${requestId} not found in visitor data`);
          await sendMessage(senderId, 'Sorry, this visitor request ID is not recognized.');
          return;
        }

        // Process the response based on YES/NO (same logic as above)
        if (action === 'YES') {
          visitorData[requestId].status = 'approved';
          visitorData[requestId].approvedAt = new Date().toISOString();

          // Set validity period (default: 6 hours from approval)
          const validUntil = new Date();
          validUntil.setHours(validUntil.getHours() + 6);
          visitorData[requestId].validUntil = validUntil.toISOString();

          // Save updated data
          fs.writeFileSync(visitorDataPath, JSON.stringify(visitorData, null, 2));
          console.log(`Updated visitor data for ${requestId} - status: approved`);

          // Generate gatepass
          const gatepass = generateGatepass(visitorData[requestId]);
          console.log('Generated gatepass for visitor');

          // Store gatepass information in visitor data
          visitorData[requestId].gatepass = gatepass;
          fs.writeFileSync(visitorDataPath, JSON.stringify(visitorData, null, 2));

          // Send confirmation to resident with gatepass info
          await sendMessage(
            senderId,
            `✅ Visitor ${visitorData[requestId].visitorName} has been approved. A gatepass has been generated for security.\n\nGatepass ID: ${gatepass.passId}\nValid until: ${new Date(gatepass.validUntil).toLocaleString()}`
          );
          console.log('Sent approval confirmation with gatepass');
        } else {
          // Handle NO response
          visitorData[requestId].status = 'rejected';
          visitorData[requestId].rejectedAt = new Date().toISOString();

          // Save updated data
          fs.writeFileSync(visitorDataPath, JSON.stringify(visitorData, null, 2));
          console.log(`Updated visitor data for ${requestId} - status: rejected`);

          // Send confirmation to resident
          await sendMessage(
            senderId,
            `❌ Visitor ${visitorData[requestId].visitorName} has been denied entry as requested.`
          );
          console.log('Sent rejection confirmation');
        }

        // Also remove any pending requests for this user to avoid confusion
        if (pendingRequests.has(senderId)) {
          pendingRequests.delete(senderId);
        }

        return;
      }
    }

    // If we get here, the message was not recognized as a valid command
    console.log('Message not recognized as a valid visitor approval/rejection command');
  } catch (error) {
    console.error('Error processing WhatsApp message:', error);
    try {
      await sendMessage(message.key.remoteJid, 'Sorry, there was an error processing your response. Please try again or contact support.');
    } catch (replyError) {
      console.error('Failed to send error message:', replyError);
    }
  }
}

// Helper function to send messages
async function sendMessage(recipient, textContent) {
  if (!waSocket) {
    console.error('Cannot send message: WhatsApp client not initialized');
    return;
  }

  try {
    await waSocket.sendMessage(recipient, { text: textContent });
    return true;
  } catch (error) {
    console.error('Failed to send message:', error);
    return false;
  }
}

// Helper function to send approval request to resident
export async function sendApprovalRequest(recipientNumber, messageContent, requestId, visitorName) {
  if (!waSocket) {
    console.error('Cannot send approval request: WhatsApp client not initialized');
    return false;
  }

  // Format phone number for WhatsApp
  const recipient = formatPhoneNumber(recipientNumber);

  try {
    // Store the pending request
    pendingRequests.set(recipient, {
      requestId: requestId,
      visitorName: visitorName,
      timestamp: new Date()
    });

    // Send the approval request message
    const buttons = [
      {buttonId: 'approve', buttonText: {displayText: 'Approve'}, type: 1},
      {buttonId: 'reject', buttonText: {displayText: 'Reject'}, type: 1}
    ];

    const buttonMessage = {
      text: messageContent,
      footer: 'Reply YES to approve or NO to reject',
      buttons: buttons,
      headerType: 1
    };

    await waSocket.sendMessage(recipient, buttonMessage);
    console.log(`Sent approval request to ${recipient} for visitor ${visitorName}`);
    return true;
  } catch (error) {
    console.error(`Failed to send approval request to ${recipient}:`, error);
    return false;
  }
}

// Helper function to format phone number for WhatsApp
function formatPhoneNumber(phone) {
  // Remove any non-digit characters
  const cleanNumber = phone.replace(/\D/g, '');

  // Add the WhatsApp suffix
  return `${cleanNumber}@s.whatsapp.net`;
}

// Helper function for visitor approval
async function handleVisitorApproval(senderId, requestId, pendingRequest) {
  try {
    console.log(`Processing approval for visitor request ID: ${requestId}`);

    if (!fs.existsSync(visitorDataPath)) {
      console.error('Visitor data file not found at:', visitorDataPath);
      await sendMessage(senderId, 'System error: Visitor data file not found.');
      return;
    }

    // Read visitor data
    const visitorData = JSON.parse(fs.readFileSync(visitorDataPath, 'utf8'));

    if (!visitorData[requestId]) {
      console.log(`Request ID ${requestId} not found in visitor data`);
      await sendMessage(senderId, 'Sorry, this visitor request is no longer valid or has expired.');
      return;
    }

    visitorData[requestId].status = 'approved';
    visitorData[requestId].approvedAt = new Date().toISOString();

    // Set validity period (default: 6 hours from approval)
    const validUntil = new Date();
    validUntil.setHours(validUntil.getHours() + 6);
    visitorData[requestId].validUntil = validUntil.toISOString();

    // Save updated data
    fs.writeFileSync(visitorDataPath, JSON.stringify(visitorData, null, 2));
    console.log(`Updated visitor data for ${requestId} - status: approved`);

    // Generate gatepass
    const gatepass = generateGatepass(visitorData[requestId]);
    console.log('Generated gatepass for visitor');

    // Store gatepass information in visitor data
    visitorData[requestId].gatepass = gatepass;
    fs.writeFileSync(visitorDataPath, JSON.stringify(visitorData, null, 2));

    // Send confirmation to resident with gatepass info
    await sendMessage(
      senderId,
      `✅ Visitor ${visitorData[requestId].visitorName} has been approved. A gatepass has been generated for security.\n\nGatepass ID: ${gatepass.passId}\nValid until: ${new Date(gatepass.validUntil).toLocaleString()}`
    );
    console.log('Sent approval confirmation with gatepass');
  } catch (error) {
    console.error('Error handling visitor approval:', error);
    await sendMessage(senderId, 'Sorry, there was an error processing your approval. Please try again or contact security.');
  }
}

// Helper function for visitor rejection
async function handleVisitorRejection(senderId, requestId, pendingRequest) {
  try {
    console.log(`Processing rejection for visitor request ID: ${requestId}`);

    if (!fs.existsSync(visitorDataPath)) {
      console.error('Visitor data file not found at:', visitorDataPath);
      await sendMessage(senderId, 'System error: Visitor data file not found.');
      return;
    }

    // Read visitor data
    const visitorData = JSON.parse(fs.readFileSync(visitorDataPath, 'utf8'));

    if (!visitorData[requestId]) {
      console.log(`Request ID ${requestId} not found in visitor data`);
      await sendMessage(senderId, 'Sorry, this visitor request is no longer valid or has expired.');
      return;
    }

    visitorData[requestId].status = 'rejected';
    visitorData[requestId].rejectedAt = new Date().toISOString();

    // Save updated data
    fs.writeFileSync(visitorDataPath, JSON.stringify(visitorData, null, 2));
    console.log(`Updated visitor data for ${requestId} - status: rejected`);

    // Send confirmation to resident
    await sendMessage(
      senderId,
      `❌ Visitor ${visitorData[requestId].visitorName} has been denied entry as requested.`
    );
    console.log('Sent rejection confirmation');
  } catch (error) {
    console.error('Error handling visitor rejection:', error);
    await sendMessage(senderId, 'Sorry, there was an error processing your rejection. Please try again or contact security.');
  }
}

export default initWhatsApp;
