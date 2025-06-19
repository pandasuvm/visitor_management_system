import qrcode from 'qrcode-terminal';
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, NoAuth, Buttons, List, Poll } = pkg;
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { generateGatepass } from './utils/gatepass.js';

// ES Module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to visitor data file
const visitorDataPath = path.join(__dirname, '../data/visitorData.json');

// Store pending requests by phone number for easier response handling
// Format: { 'phoneNumber@c.us': { requestId: 'xyz', visitorName: 'John Doe', timestamp: Date } }
export const pendingRequests = new Map();

// Initialize the WhatsApp client
async function initWhatsApp() {
  console.log('Setting up WhatsApp client with persistent authentication...');

  // Ensure auth directory exists
  const authDir = path.join(__dirname, '../.wwebjs_auth');
  fs.ensureDirSync(authDir);

  // Ensure proper permissions for auth directory
  try {
    fs.chmodSync(authDir, 0o755);
    console.log(`Set permissions for auth directory: ${authDir}`);
  } catch (error) {
    console.warn(`Could not set permissions for auth directory: ${error.message}`);
  }

  // Create client with persistent authentication
  const client = new Client({
    authStrategy: new LocalAuth({
      dataPath: authDir,
      clientId: 'visitor-management-bot' // Fixed client ID to ensure consistent authentication
    }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
             '--disable-accelerated-2d-canvas', '--no-first-run', '--no-zygote',
             '--disable-gpu',
             '--user-data-dir=' + path.join(authDir, 'puppeteer_data')],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH
    },
    restartOnAuthFail: true,
    takeoverOnConflict: true,
    takeoverTimeoutMs: 60000
  });

  // Generate QR code for login
  client.on('qr', (qr) => {
    console.log('QR RECEIVED. Scan this QR code with your WhatsApp:');
    qrcode.generate(qr, { small: true });

    // Save this QR code to a file for web access
    fs.writeFileSync(path.join(__dirname, '../public/qr/latest-qr.txt'), qr);
    console.log('QR code saved to public/qr/latest-qr.txt');
  });

  // Authentication events
  client.on('authenticated', () => {
    console.log('WhatsApp AUTHENTICATED!');
  });

  client.on('auth_failure', (msg) => {
    console.error('WhatsApp Authentication Failure:', msg);
  });

  // Handle client ready state
  client.on('ready', () => {
    console.log('WhatsApp client is ready!');
    client.isReady = true;

    // Log some information about the connected account
    client.getState().then(state => {
      console.log('WhatsApp connection state:', state);
    });

    // Inform admin account that system is online (optional)
    client.sendMessage('917781943246@c.us', 'Panchsheel Enclave Visitor Management System is now online.')
      .then(() => console.log('Sent online notification to admin'))
      .catch(err => console.error('Failed to send admin notification:', err));
  });

  // Listen for messages to handle resident responses
  client.on('message', async (message) => {
    try {
      // Log all received messages for debugging
      console.log(`Received message: "${message.body}" from ${message.from}`);

      // Check if this is a response to a visitor request
      const messageBody = message.body.trim().toUpperCase();

      // Handle poll responses
      if (message.type === 'poll_vote') {
        console.log('Poll vote received:', message);

        // Check if there's a pending request for this phone number
        if (pendingRequests.has(message.from)) {
          const pendingRequest = pendingRequests.get(message.from);
          const requestId = pendingRequest.requestId;
          const selectedOption = message.selectedOptions[0]; // Get the first selected option

          console.log(`Received poll response from ${message.from} for visitor ${pendingRequest.visitorName}, selected: ${selectedOption}`);

          // Process the response based on the selected option (0 = Yes, 1 = No)
          if (selectedOption === 0) { // First option (Yes/Allow)
            handleVisitorApproval(message, requestId, pendingRequest);
          } else if (selectedOption === 1) { // Second option (No/Deny)
            handleVisitorRejection(message, requestId, pendingRequest);
          }

          // Remove the pending request after processing
          pendingRequests.delete(message.from);
          return;
        }
      }

      // Simple YES/NO response handling (keep for backward compatibility)
      if (messageBody === 'YES' || messageBody === 'NO') {
        // Check if there's a pending request for this phone number
        if (pendingRequests.has(message.from)) {
          const pendingRequest = pendingRequests.get(message.from);
          const requestId = pendingRequest.requestId;

          console.log(`Received ${messageBody} response from ${message.from} for visitor ${pendingRequest.visitorName}`);

          // Check if visitor data file exists
          if (!fs.existsSync(visitorDataPath)) {
            console.error('Visitor data file not found at:', visitorDataPath);
            message.reply('System error: Visitor data file not found.');
            return;
          }

          // Read visitor data
          const visitorData = JSON.parse(fs.readFileSync(visitorDataPath, 'utf8'));

          if (!visitorData[requestId]) {
            console.log(`Request ID ${requestId} not found in visitor data`);
            message.reply('Sorry, this visitor request is no longer valid or has expired.');
            pendingRequests.delete(message.from); // Clean up the pending request
            return;
          }

          // Process the response based on YES/NO
          if (messageBody === 'YES') {
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
            message.reply(`✅ Visitor ${visitorData[requestId].visitorName} has been approved. A gatepass has been generated for security.\n\nGatepass ID: ${gatepass.passId}\nValid until: ${new Date(gatepass.validUntil).toLocaleString()}`)
              .then(() => console.log('Sent approval confirmation with gatepass'))
              .catch(err => console.error('Failed to send approval confirmation with gatepass:', err));
          } else {
            // Handle NO response
            visitorData[requestId].status = 'rejected';
            visitorData[requestId].rejectedAt = new Date().toISOString();

            // Save updated data
            fs.writeFileSync(visitorDataPath, JSON.stringify(visitorData, null, 2));
            console.log(`Updated visitor data for ${requestId} - status: rejected`);

            // Send confirmation to resident
            message.reply(`❌ Visitor ${visitorData[requestId].visitorName} has been denied entry as requested.`)
              .then(() => console.log('Sent rejection confirmation'))
              .catch(err => console.error('Failed to send rejection confirmation:', err));
          }

          // Remove the pending request after processing
          pendingRequests.delete(message.from);
          return;
        } else {
          // No pending request found for this phone number
          message.reply("I don't have any pending visitor requests for your approval at the moment.");
          return;
        }
      }

      // Handle legacy format with request ID (to maintain backward compatibility)
      const parts = messageBody.split(' ');
      if (parts.length >= 2) {
        const action = parts[0];
        const requestId = parts[1];

        if ((action === 'YES' || action === 'NO') && requestId) {
          console.log(`Received ${action} response with ID ${requestId} from ${message.from}`);

          // Process with the explicit request ID
          if (!fs.existsSync(visitorDataPath)) {
            console.error('Visitor data file not found at:', visitorDataPath);
            message.reply('System error: Visitor data file not found.');
            return;
          }

          const visitorData = JSON.parse(fs.readFileSync(visitorDataPath, 'utf8'));

          if (!visitorData[requestId]) {
            // Request ID not found, inform the user
            console.log(`Request ID ${requestId} not found in visitor data`);
            message.reply('Sorry, this visitor request ID is not recognized.');
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
            message.reply(`✅ Visitor ${visitorData[requestId].visitorName} has been approved. A gatepass has been generated for security.\n\nGatepass ID: ${gatepass.passId}\nValid until: ${new Date(gatepass.validUntil).toLocaleString()}`)
              .then(() => console.log('Sent approval confirmation with gatepass'))
              .catch(err => console.error('Failed to send approval confirmation with gatepass:', err));
          } else {
            // Handle NO response
            visitorData[requestId].status = 'rejected';
            visitorData[requestId].rejectedAt = new Date().toISOString();

            // Save updated data
            fs.writeFileSync(visitorDataPath, JSON.stringify(visitorData, null, 2));
            console.log(`Updated visitor data for ${requestId} - status: rejected`);

            // Send confirmation to resident
            message.reply(`❌ Visitor ${visitorData[requestId].visitorName} has been denied entry as requested.`)
              .then(() => console.log('Sent rejection confirmation'))
              .catch(err => console.error('Failed to send rejection confirmation:', err));
          }

          // Also remove any pending requests for this user to avoid confusion
          if (pendingRequests.has(message.from)) {
            pendingRequests.delete(message.from);
          }

          return;
        }
      }

      // If we get here, the message was not recognized as a valid command
      console.log('Message not recognized as a valid visitor approval/rejection command');
    } catch (error) {
      console.error('Error processing WhatsApp message:', error);
      try {
        message.reply('Sorry, there was an error processing your response. Please try again or contact support.');
      } catch (replyError) {
        console.error('Failed to send error message:', replyError);
      }
    }
  });

  // Helper function for visitor approval
  async function handleVisitorApproval(message, requestId, pendingRequest) {
    try {
      console.log(`Processing approval for visitor request ID: ${requestId}`);

      if (!fs.existsSync(visitorDataPath)) {
        console.error('Visitor data file not found at:', visitorDataPath);
        message.reply('System error: Visitor data file not found.');
        return;
      }

      // Read visitor data
      const visitorData = JSON.parse(fs.readFileSync(visitorDataPath, 'utf8'));

      if (!visitorData[requestId]) {
        console.log(`Request ID ${requestId} not found in visitor data`);
        message.reply('Sorry, this visitor request is no longer valid or has expired.');
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
      message.reply(`✅ Visitor ${visitorData[requestId].visitorName} has been approved. A gatepass has been generated for security.\n\nGatepass ID: ${gatepass.passId}\nValid until: ${new Date(gatepass.validUntil).toLocaleString()}`)
        .then(() => console.log('Sent approval confirmation with gatepass'))
        .catch(err => console.error('Failed to send approval confirmation with gatepass:', err));
    } catch (error) {
      console.error('Error handling visitor approval:', error);
      message.reply('Sorry, there was an error processing your approval. Please try again or contact security.');
    }
  }

  // Helper function for visitor rejection
  async function handleVisitorRejection(message, requestId, pendingRequest) {
    try {
      console.log(`Processing rejection for visitor request ID: ${requestId}`);

      if (!fs.existsSync(visitorDataPath)) {
        console.error('Visitor data file not found at:', visitorDataPath);
        message.reply('System error: Visitor data file not found.');
        return;
      }

      // Read visitor data
      const visitorData = JSON.parse(fs.readFileSync(visitorDataPath, 'utf8'));

      if (!visitorData[requestId]) {
        console.log(`Request ID ${requestId} not found in visitor data`);
        message.reply('Sorry, this visitor request is no longer valid or has expired.');
        return;
      }

      visitorData[requestId].status = 'rejected';
      visitorData[requestId].rejectedAt = new Date().toISOString();

      // Save updated data
      fs.writeFileSync(visitorDataPath, JSON.stringify(visitorData, null, 2));
      console.log(`Updated visitor data for ${requestId} - status: rejected`);

      // Send confirmation to resident
      message.reply(`❌ Visitor ${visitorData[requestId].visitorName} has been denied entry as requested.`)
        .then(() => console.log('Sent rejection confirmation'))
        .catch(err => console.error('Failed to send rejection confirmation:', err));
    } catch (error) {
      console.error('Error handling visitor rejection:', error);
      message.reply('Sorry, there was an error processing your rejection. Please try again or contact security.');
    }
  }

  // Handle disconnected state
  client.on('disconnected', (reason) => {
    console.log('WhatsApp client disconnected:', reason);
    client.isReady = false;

    // Attempt to reconnect after a delay
    setTimeout(() => {
      console.log('Attempting to reconnect WhatsApp client...');
      client.initialize();
    }, 10000);
  });

  // Initialize the client
  try {
    console.log('Starting WhatsApp client initialization...');
    await client.initialize();
    console.log('WhatsApp client initialization complete.');
    return client;
  } catch (error) {
    console.error('Failed to initialize WhatsApp client:', error);
    throw error;
  }
}

export default initWhatsApp;
