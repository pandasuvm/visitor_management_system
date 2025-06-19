import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs-extra';
import cors from 'cors';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import initWhatsApp, { pendingRequests } from './bot.js';
import { generateGatepass } from './utils/gatepass.js';
import pkg from 'whatsapp-web.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const { MessageMedia } = pkg;

// ES Module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set up file storage for visitor photos
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const uploadDir = join(__dirname, '../uploads');
    fs.ensureDirSync(uploadDir); // Create directory if it doesn't exist
    cb(null, uploadDir);
  },
  filename: function(req, file, cb) {
    const uniqueFilename = `${Date.now()}-${uuidv4()}.jpg`;
    cb(null, uniqueFilename);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max file size
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Initialize data storage files if they don't exist
const dataDir = join(__dirname, '../data');
fs.ensureDirSync(dataDir);

const flatMappingPath = join(dataDir, 'flatMapping.json');
const visitorDataPath = join(dataDir, 'visitorData.json');

// Copy our default mapping from backend to data directory if it doesn't exist
if (!fs.existsSync(flatMappingPath)) {
  try {
    // Try to use the existing file in backend directory
    const backendFlatMapping = join(__dirname, 'flatMapping.json');
    if (fs.existsSync(backendFlatMapping)) {
      fs.copyFileSync(backendFlatMapping, flatMappingPath);
      console.log('Copied flat mapping from backend directory');
    } else {
      // Create a minimal default mapping if backend file doesn't exist
      const defaultMapping = {
        "101": "917781943246",
        "102": "919812345678",
        "201": "918888888888"
      };
      fs.writeFileSync(flatMappingPath, JSON.stringify(defaultMapping, null, 2));
      console.log('Created default flat mapping');
    }
  } catch (error) {
    console.error('Error setting up flat mapping:', error);
  }
}

// Create visitor data file if it doesn't exist
if (!fs.existsSync(visitorDataPath)) {
  fs.writeFileSync(visitorDataPath, JSON.stringify({}, null, 2));
}

// Initialize WhatsApp client
let whatsappClient;
let whatsappInitialized = false;
(async () => {
  try {
    console.log('Initializing WhatsApp client with persistent auth...');
    whatsappClient = await initWhatsApp();
    whatsappInitialized = true;
    console.log('WhatsApp client initialized successfully');
  } catch (error) {
    console.error('Failed to initialize WhatsApp client:', error);
  }
})();

// Function to format phone number for WhatsApp Web.js
const formatPhoneForWhatsApp = (phoneNumber) => {
  // Remove any non-digit characters
  const digitsOnly = phoneNumber.replace(/\D/g, '');

  // WhatsApp Web.js requires format: countrycode + phone number without + sign
  return digitsOnly;
};

// API Routes

// Get list of flats
app.get('/api/flats', (req, res) => {
  try {
    const flatMapping = JSON.parse(fs.readFileSync(flatMappingPath, 'utf8'));
    res.json(Object.keys(flatMapping));
  } catch (error) {
    console.error('Error reading flat mapping:', error);
    res.status(500).json({ message: 'Error retrieving flat list' });
  }
});

// Submit visitor request
app.post('/api/visitor-request', upload.single('visitorPhoto'), async (req, res) => {
  try {
    const { visitorName, visitorPhone, flatNumber, purpose } = req.body;

    if (!visitorName || !visitorPhone || !flatNumber || !purpose) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Check if we have a photo
    if (!req.file) {
      return res.status(400).json({ message: 'Visitor photo is required' });
    }

    // Get resident phone number from flat mapping
    const flatMapping = JSON.parse(fs.readFileSync(flatMappingPath, 'utf8'));
    let residentPhone = flatMapping[flatNumber];

    if (!residentPhone) {
      return res.status(404).json({ message: 'Flat number not found in the system' });
    }

    // Format the phone number for WhatsApp
    residentPhone = formatPhoneForWhatsApp(residentPhone);

    // Generate a unique request ID
    const requestId = uuidv4();

    // Save visitor data
    const visitorData = JSON.parse(fs.readFileSync(visitorDataPath, 'utf8'));
    visitorData[requestId] = {
      id: requestId,
      visitorName,
      visitorPhone,
      flatNumber,
      purpose,
      photoPath: req.file.path,
      photoUrl: `/uploads/${req.file.filename}`,
      timestamp: new Date().toISOString(),
      status: 'pending'
    };
    fs.writeFileSync(visitorDataPath, JSON.stringify(visitorData, null, 2));

    // Send WhatsApp message if client is ready
    if (whatsappInitialized && whatsappClient && whatsappClient.isReady) {
      try {
        // Format message to make it more user-friendly
        const message = `🏢 *Visitor Request Received* \n\n` +
                       `👤 *Name:* ${visitorName}\n` +
                       `🏠 *Flat:* ${flatNumber}\n` +
                       `📝 *Purpose:* ${purpose}`;

        // Format phone number with @ for WhatsApp syntax
        const formattedPhone = `${residentPhone}@c.us`;
        console.log(`Sending WhatsApp message to: ${formattedPhone}`);

        // Store this in the pending requests map so we can look it up when user replies
        pendingRequests.set(formattedPhone, {
          requestId: requestId,
          visitorName: visitorName,
          timestamp: new Date()
        });

        console.log(`Added pending request for ${formattedPhone}: ${requestId} - ${visitorName}`);

        // First send the text message
        await whatsappClient.sendMessage(formattedPhone, message);

        // Add a small delay to ensure file is properly saved
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Then send the visitor's photo
        const photoPath = req.file.path;
        if (fs.existsSync(photoPath)) {
          console.log(`Sending visitor selfie from: ${photoPath}`);
          const captionText = `📸 Photo of visitor: ${visitorName}`;

          const mediaFile = MessageMedia.fromFilePath(photoPath);
          await whatsappClient.sendMessage(formattedPhone, mediaFile, { caption: captionText });
          console.log('Visitor selfie sent successfully');

          // Now send a poll for easier response
          try {
            const poll = {
              title: 'Do you approve this visitor?',
              options: ['✅ Yes, Allow Entry', '❌ No, Deny Entry'],
              // Set Allow Entry as the first option (index 0)
              multipleAnswers: false
            };

            await whatsappClient.sendMessage(formattedPhone, new Poll(poll.title, poll.options, { allowMultipleAnswers: poll.multipleAnswers }));
            console.log('Visitor approval poll sent successfully');
          } catch (pollError) {
            console.error('Failed to send poll, sending text-only instructions instead:', pollError);
            // Send text-only instructions when poll fails
            await whatsappClient.sendMessage(formattedPhone, 'Please reply with *YES* to approve or *NO* to deny this visitor request.');
          }
        } else {
          console.log(`Photo file not found at path: ${photoPath}`);

          // Try with an alternate path construction
          const altPath = join(__dirname, '../uploads', path.basename(req.file.path));
          console.log(`Trying alternate path: ${altPath}`);

          if (fs.existsSync(altPath)) {
            console.log(`Found photo at alternate path: ${altPath}`);
            const captionText = `📸 Photo of visitor: ${visitorName}`;

            const mediaFile = MessageMedia.fromFilePath(altPath);
            await whatsappClient.sendMessage(formattedPhone, mediaFile, { caption: captionText });
            console.log('Visitor selfie sent successfully using alternate path');

            // Send poll after photo is sent
            try {
              const poll = {
                title: 'Do you approve this visitor?',
                options: ['✅ Yes, Allow Entry', '❌ No, Deny Entry'],
                multipleAnswers: false
              };

              await whatsappClient.sendMessage(formattedPhone, new Poll(poll.title, poll.options, { allowMultipleAnswers: poll.multipleAnswers }));
              console.log('Visitor approval poll sent successfully');
            } catch (pollError) {
              console.error('Failed to send poll, sending text-only instructions instead:', pollError);
              // Send text-only instructions when poll fails
              await whatsappClient.sendMessage(formattedPhone, 'Please reply with *YES* to approve or *NO* to deny this visitor request.');
            }
          } else {
            console.log(`Photo not found at alternate path either`);
            // Send poll even without photo
            try {
              const poll = {
                title: 'Do you approve this visitor?',
                options: ['✅ Yes, Allow Entry', '❌ No, Deny Entry'],
                multipleAnswers: false
              };

              await whatsappClient.sendMessage(formattedPhone, new Poll(poll.title, poll.options, { allowMultipleAnswers: poll.multipleAnswers }));
              console.log('Visitor approval poll sent successfully');
            } catch (pollError) {
              console.error('Failed to send poll, sending text-only instructions instead:', pollError);
              // Send text-only instructions when poll fails
              await whatsappClient.sendMessage(formattedPhone, 'Please reply with *YES* to approve or *NO* to deny this visitor request.');
            }
          }
        }

        return res.status(201).json({
          message: 'Request submitted and notification sent to resident',
          requestId
        });
      } catch (whatsappError) {
        console.error('WhatsApp error:', whatsappError);
        return res.status(202).json({
          message: 'Request submitted, but failed to notify resident. Security will contact them directly.',
          requestId
        });
      }
    } else {
      return res.status(202).json({
        message: 'Request submitted, but WhatsApp service is not available. Security will contact the resident directly.',
        requestId
      });
    }
  } catch (error) {
    console.error('Error processing visitor request:', error);
    res.status(500).json({ message: 'Server error processing request' });
  }
});

// Check request status
app.get('/api/check-status/:requestId', (req, res) => {
  try {
    const { requestId } = req.params;
    const visitorData = JSON.parse(fs.readFileSync(visitorDataPath, 'utf8'));

    if (!visitorData[requestId]) {
      return res.status(404).json({ message: 'Request not found' });
    }

    res.json({ status: visitorData[requestId].status });
  } catch (error) {
    console.error('Error checking request status:', error);
    res.status(500).json({ message: 'Server error checking status' });
  }
});

// Get gatepass data
app.get('/api/gatepass/:requestId', (req, res) => {
  try {
    const { requestId } = req.params;
    const visitorData = JSON.parse(fs.readFileSync(visitorDataPath, 'utf8'));

    if (!visitorData[requestId]) {
      return res.status(404).json({ message: 'Gatepass not found' });
    }

    const visitorRequest = visitorData[requestId];

    if (visitorRequest.status !== 'approved') {
      return res.status(403).json({ message: 'Visit request has not been approved' });
    }

    // Generate the gatepass data
    const gatepass = generateGatepass(visitorRequest);

    res.json(gatepass);
  } catch (error) {
    console.error('Error generating gatepass:', error);
    res.status(500).json({ message: 'Server error generating gatepass' });
  }
});

// Admin API Routes

// Get WhatsApp QR code
app.get('/api/admin/whatsapp-qr', async (req, res) => {
  try {
    // Check if QR code exists
    const qrFilePath = join(__dirname, '../public/qr/latest-qr.txt');
    if (fs.existsSync(qrFilePath)) {
      const qrCode = fs.readFileSync(qrFilePath, 'utf8');
      res.json({ qrCode });
    } else {
      res.status(404).json({ message: 'QR code not available. The bot may already be authenticated.' });
    }
  } catch (error) {
    console.error('Error getting WhatsApp QR code:', error);
    res.status(500).json({ message: 'Error getting WhatsApp QR code' });
  }
});

// Get visitor records
app.get('/api/admin/visitor-records', (req, res) => {
  try {
    if (!fs.existsSync(visitorDataPath)) {
      return res.status(404).json({ message: 'Visitor data file not found' });
    }

    const visitorData = JSON.parse(fs.readFileSync(visitorDataPath, 'utf8'));

    // Convert object to array and sort by timestamp (newest first)
    const records = Object.values(visitorData).sort((a, b) => {
      return new Date(b.timestamp) - new Date(a.timestamp);
    });

    res.json(records);
  } catch (error) {
    console.error('Error getting visitor records:', error);
    res.status(500).json({ message: 'Error fetching visitor records' });
  }
});

// Get flat mappings
app.get('/api/admin/flat-mappings', (req, res) => {
  try {
    const flatMappingPath = join(__dirname, '../data/flatMapping.json');
    if (!fs.existsSync(flatMappingPath)) {
      return res.status(404).json({ message: 'Flat mapping file not found' });
    }

    const flatMappings = JSON.parse(fs.readFileSync(flatMappingPath, 'utf8'));
    res.json(flatMappings);
  } catch (error) {
    console.error('Error getting flat mappings:', error);
    res.status(500).json({ message: 'Error fetching flat mappings' });
  }
});

// Update flat mappings
app.post('/api/admin/flat-mappings', express.json(), (req, res) => {
  try {
    const flatMappingPath = join(__dirname, '../data/flatMapping.json');
    const updatedMappings = req.body;

    // Validate the input
    if (!updatedMappings || typeof updatedMappings !== 'object') {
      return res.status(400).json({ message: 'Invalid flat mapping data' });
    }

    // Save the updated mappings
    fs.writeFileSync(flatMappingPath, JSON.stringify(updatedMappings, null, 2));

    // Also update the backend copy for the bot
    const backendFlatMappingPath = join(__dirname, './flatMapping.json');
    fs.writeFileSync(backendFlatMappingPath, JSON.stringify(updatedMappings, null, 2));

    res.json({ message: 'Flat mappings updated successfully' });
  } catch (error) {
    console.error('Error updating flat mappings:', error);
    res.status(500).json({ message: 'Error updating flat mappings' });
  }
});

// Serve static files from the React app in production
if (process.env.NODE_ENV === 'production') {
  const buildPath = join(__dirname, '../dist');
  app.use(express.static(buildPath));

  app.get('*', (req, res) => {
    res.sendFile(join(buildPath, 'index.html'));
  });
}

// Serve uploads directory
app.use('/uploads', express.static(join(__dirname, '../uploads')));

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
