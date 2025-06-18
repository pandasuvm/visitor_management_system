import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';

const VisitorForm = () => {
  const navigate = useNavigate();
  const [visitorName, setVisitorName] = useState('');
  const [flatNumber, setFlatNumber] = useState('');
  const [purpose, setPurpose] = useState('');
  const [selfieImage, setSelfieImage] = useState(null);
  const [showCamera, setShowCamera] = useState(true); // Camera is shown by default
  const [flats, setFlats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [pollInterval, setPollInterval] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);

  const webcamRef = useRef(null);

  // Fetch available flats on component mount
  useEffect(() => {
    const fetchFlats = async () => {
      try {
        const response = await fetch('/api/flats');
        if (response.ok) {
          const data = await response.json();
          setFlats(data);
        } else {
          // Fallback flats in case API fails
          setFlats(['101', '102', '103', '201', '202', '203', '301', '302', '303']);
        }
      } catch (error) {
        console.error('Error fetching flats:', error);
        // Fallback flats in case of network error
        setFlats(['101', '102', '103', '201', '202', '203', '301', '302', '303']);
      }
    };

    fetchFlats();

    // Auto-focus on name input after short delay
    setTimeout(() => {
      const nameInput = document.getElementById('visitorName');
      if (nameInput) nameInput.focus();
    }, 500);
  }, []);

  // Cleanup polling interval on unmount
  useEffect(() => {
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [pollInterval]);

  const handleCaptureSelfie = () => {
    const imageSrc = webcamRef.current.getScreenshot();
    setSelfieImage(imageSrc);
    setShowCamera(false);
  };

  const handleRetakeSelfie = () => {
    setSelfieImage(null);
    setShowCamera(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selfieImage) {
      setMessage({ text: 'Please take a selfie before submitting', type: 'error' });
      return;
    }

    setLoading(true);
    setMessage({ text: 'Submitting your request...', type: 'info' });

    try {
      // Create form data with visitor information
      const formData = new FormData();
      formData.append('visitorName', visitorName);
      // Default phone number if not provided
      formData.append('visitorPhone', '0000000000');
      formData.append('flatNumber', flatNumber);
      formData.append('purpose', purpose);

      // Convert base64 image to file
      const response = await fetch(selfieImage);
      const blob = await response.blob();
      const file = new File([blob], 'selfie.jpg', { type: 'image/jpeg' });
      formData.append('visitorPhoto', file);

      // Send request to backend
      const submitResponse = await fetch('/api/visitor-request', {
        method: 'POST',
        body: formData,
      });

      const result = await submitResponse.json();

      if (submitResponse.ok) {
        setMessage({ text: 'Request sent! Waiting for resident approval...', type: 'success' });
        // Start polling for request status
        pollForResponse(result.requestId);
      } else {
        setMessage({ text: result.message || 'Error submitting request', type: 'error' });
        setLoading(false);
      }
    } catch (error) {
      console.error('Error:', error);
      setMessage({ text: 'Network error. Please try again.', type: 'error' });
      setLoading(false);
    }
  };

  const pollForResponse = (requestId) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/check-status/${requestId}`);
        const data = await response.json();

        if (response.ok) {
          if (data.status === 'approved') {
            clearInterval(interval);
            setMessage({ text: 'Your visit has been approved! Generating your gatepass...', type: 'success' });

            // Redirect to gatepass page
            setTimeout(() => {
              navigate(`/gatepass/${requestId}`);
            }, 1500);
          } else if (data.status === 'rejected') {
            clearInterval(interval);
            setMessage({ text: 'Sorry, your visit request has been denied.', type: 'error' });
            setLoading(false);
          }
        }
      } catch (error) {
        console.error('Error polling for status:', error);
      }
    }, 3000); // Check every 3 seconds

    setPollInterval(interval);
  };

  const commonPurposes = [
    "Family Visit",
    "Friend Visit",
    "Delivery",
    "Maintenance",
    "Other"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500/80 to-indigo-600/80 flex flex-col items-center justify-center px-4 py-6 sm:py-12">
      <div className="w-full max-w-md bg-white/60 backdrop-blur-lg rounded-2xl shadow-xl overflow-hidden relative">
        {/* Background decorative elements */}
        <div className="absolute top-0 left-0 w-full h-full bg-white/40 backdrop-blur-sm -z-10"></div>
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-purple-400 rounded-full opacity-10"></div>
        <div className="absolute -bottom-16 -left-16 w-40 h-40 bg-indigo-400 rounded-full opacity-10"></div>

        {/* Header section */}
        <div className="bg-white/50 backdrop-blur-md p-4 border-b border-gray-200/50">
          <h1 className="text-2xl font-bold text-gray-800 text-center">Visitor Check-In</h1>
          <p className="text-gray-600 text-sm text-center">Panchsheel Enclave</p>
        </div>

        {/* Main content */}
        <div className="p-4 sm:p-6">
          {/* Centered selfie capture section */}
          <div className="mb-6 flex flex-col items-center">
            {showCamera ? (
              <div className="selfie-container">
                <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-full overflow-hidden border-4 border-white shadow-lg relative mx-auto">
                  <Webcam
                    audio={false}
                    ref={webcamRef}
                    screenshotFormat="image/jpeg"
                    className="absolute top-0 left-0 w-full h-full object-cover"
                    videoConstraints={{
                      facingMode: "user",
                      width: { min: 480 },
                      height: { min: 480 }
                    }}
                    onUserMedia={() => setCameraReady(true)}
                    mirrored={true}
                  />
                  <div
                    className={`absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity duration-300 ${cameraReady ? 'opacity-0' : 'opacity-100'}`}
                  >
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCaptureSelfie}
                  className="mt-3 py-2 px-5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-sm rounded-full shadow-md hover:from-indigo-600 hover:to-purple-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:ring-offset-white/40"
                >
                  <div className="flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                    </svg>
                    Take Photo
                  </div>
                </button>
              </div>
            ) : (
              <div className="selfie-preview text-center">
                <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-full overflow-hidden border-4 border-white shadow-lg mx-auto">
                  <img
                    src={selfieImage}
                    alt="Your selfie"
                    className="w-full h-full object-cover"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleRetakeSelfie}
                  className="mt-3 py-2 px-5 bg-gray-500/30 text-gray-700 text-sm rounded-full hover:bg-gray-500/40 focus:outline-none focus:ring-2 focus:ring-gray-400/50 focus:ring-offset-0"
                >
                  Retake Photo
                </button>
              </div>
            )}
          </div>

          {message.text && (
            <div className={`p-3 mb-4 rounded-lg text-sm text-center ${
              message.type === 'error' ? 'bg-red-500/20 text-red-700' : 
              message.type === 'success' ? 'bg-green-500/20 text-green-700' : 
              'bg-blue-500/20 text-blue-700'}`}>
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-group">
              <label htmlFor="visitorName" className="block text-gray-700 text-sm font-medium mb-1">
                Your Name
              </label>
              <input
                type="text"
                id="visitorName"
                className="w-full px-4 py-2 bg-white/80 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent text-gray-800 placeholder-gray-400"
                placeholder="Enter your name"
                value={visitorName}
                onChange={(e) => setVisitorName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="flatNumber" className="block text-gray-700 text-sm font-medium mb-1">
                Flat to Visit
              </label>
              <select
                id="flatNumber"
                className="w-full px-4 py-2 bg-white/80 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent text-gray-800 appearance-none"
                value={flatNumber}
                onChange={(e) => setFlatNumber(e.target.value)}
                required
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236B7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: `right 0.5rem center`,
                  backgroundRepeat: `no-repeat`,
                  backgroundSize: `1.5em 1.5em`,
                  paddingRight: `2.5rem`
                }}
              >
                <option value="" disabled>Select a flat</option>
                {flats.map((flat) => (
                  <option key={flat} value={flat}>
                    {flat}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="purpose" className="block text-gray-700 text-sm font-medium mb-1">
                Purpose of Visit
              </label>
              <div className="grid grid-cols-3 gap-2 mb-2">
                {commonPurposes.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPurpose(p)}
                    className={`px-2 py-1 text-xs sm:text-sm rounded-full transition-all ${
                      purpose === p 
                        ? 'bg-indigo-500 text-white font-medium shadow-md' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <input
                type="text"
                id="purpose"
                className="w-full px-4 py-2 bg-white/80 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent text-gray-800 placeholder-gray-400"
                placeholder="Why are you visiting?"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                required
              />
            </div>

            <div className="form-group pt-2">
              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium rounded-lg shadow-lg hover:from-indigo-600 hover:to-purple-600 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-400 focus:ring-offset-white/40 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div>
                    Processing...
                  </div>
                ) : (
                  'Submit Request'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 text-xs text-gray-300 text-center">
        Visitor Management System • {new Date().getFullYear()}
      </div>
    </div>
  );
};

export default VisitorForm;
