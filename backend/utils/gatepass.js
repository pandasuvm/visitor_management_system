import { v4 as uuidv4 } from 'uuid';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ES Module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Generates a gatepass object for an approved visitor
 * @param {Object} visitorData - The visitor request data
 * @returns {Object} - The gatepass object
 */
export function generateGatepass(visitorData) {
  // Generate a unique pass ID
  const passId = `PE-${Math.floor(1000 + Math.random() * 9000)}-${new Date().toISOString().slice(0, 10)}`;

  // In a production environment, we would generate an actual QR code here
  // For now we'll just assume we have a URL to a QR code
  const qrCodeUrl = '/qr/sample-qr.png';

  return {
    passId,
    visitorName: visitorData.visitorName,
    visitorPhone: visitorData.visitorPhone,
    flatNumber: visitorData.flatNumber,
    purpose: visitorData.purpose,
    photoUrl: visitorData.photoUrl,
    approvedAt: visitorData.approvedAt,
    validUntil: visitorData.validUntil,
    qrCode: qrCodeUrl,
    generatedAt: new Date().toISOString()
  };
}

/**
 * Creates a sample QR code file if it doesn't exist
 * In production, this would generate a real QR for each visitor
 */
export function ensureSampleQrExists() {
  const qrDir = path.join(__dirname, '../../public/qr');
  fs.ensureDirSync(qrDir);

  // Check if sample QR already exists
  const sampleQrPath = path.join(qrDir, 'sample-qr.png');
  if (!fs.existsSync(sampleQrPath)) {
    // In a real application, we would generate a real QR code here
    // For now, let's create a placeholder file
    try {
      // Copy a sample image or create an empty file
      const placeholderContent = 'This is a placeholder for a QR code image';
      fs.writeFileSync(sampleQrPath, placeholderContent);
      console.log('Created placeholder QR code file');
    } catch (error) {
      console.error('Error creating sample QR code:', error);
    }
  }
}

// Ensure the sample QR exists when this module is imported
ensureSampleQrExists();
