#!/bin/bash

# Create necessary directories
mkdir -p data uploads .wwebjs_auth public/qr

# Set permissions
chmod -R 777 data uploads .wwebjs_auth public/qr

# Exit with success
exit 0
