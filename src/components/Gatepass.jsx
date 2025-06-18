import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

const Gatepass = () => {
  const { requestId } = useParams();
  const [gatepass, setGatepass] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const fetchGatepass = async () => {
      try {
        const response = await fetch(`/api/gatepass/${requestId}`);
        if (response.ok) {
          const data = await response.json();
          setGatepass(data);
        } else {
          const errorData = await response.json();
          setError(errorData.message || 'Failed to fetch gatepass');
        }
      } catch (err) {
        setError('Network error. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchGatepass();

    // Update current time every minute
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, [requestId]);

  // Format date to display in a friendly way
  const formatDate = (dateString) => {
    const options = {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    };
    return new Date(dateString).toLocaleString('en-US', options);
  };

  // Calculate if pass is valid
  const isPassValid = gatepass && new Date(gatepass.validUntil) > currentTime;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-500/80 to-indigo-600/80">
        <div className="text-center bg-white/60 backdrop-blur-lg p-8 rounded-2xl border border-white/30 shadow-xl">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-700 font-medium">Loading your gatepass...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-500/80 to-indigo-600/80 p-4">
        <div className="bg-white/60 backdrop-blur-lg rounded-2xl p-6 max-w-md w-full border border-white/30 shadow-lg">
          <div className="text-center text-gray-800 mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-2">Gatepass Error</h2>
            <p className="text-gray-600">{error}</p>
          </div>
          <Link to="/" className="block w-full py-3 px-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium rounded-lg shadow-md text-center hover:from-indigo-600 hover:to-purple-600 focus:outline-none">
            Return to Check-In
          </Link>
        </div>
      </div>
    );
  }

  if (!gatepass) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-500/80 to-indigo-600/80 p-4">
        <div className="bg-white/60 backdrop-blur-lg rounded-2xl p-6 max-w-md w-full border border-white/30 shadow-lg">
          <div className="text-center text-gray-800 mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-2">No Gatepass Found</h2>
            <p className="text-gray-600">This visit may not have been approved.</p>
          </div>
          <Link to="/" className="block w-full py-3 px-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium rounded-lg shadow-md text-center hover:from-indigo-600 hover:to-purple-600 focus:outline-none">
            Return to Check-In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500/80 to-indigo-600/80 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white/60 backdrop-blur-lg rounded-2xl shadow-xl overflow-hidden relative">
        {/* Background decorative elements */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-purple-400 rounded-full opacity-10"></div>
        <div className="absolute -bottom-16 -left-16 w-40 h-40 bg-indigo-400 rounded-full opacity-10"></div>

        {/* Header section */}
        <div className="bg-white/50 backdrop-blur-md p-4 border-b border-gray-200/50">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-800">Visitor Gatepass</h1>
            <p className="text-gray-600 text-sm">Panchsheel Enclave</p>
          </div>
        </div>

        {/* Status indicator */}
        <div className={`mx-4 mt-4 rounded-xl py-2 px-4 text-center ${isPassValid ? 'bg-green-100 border border-green-200' : 'bg-red-100 border border-red-200'}`}>
          <span className={`text-lg font-medium ${isPassValid ? 'text-green-700' : 'text-red-700'}`}>
            {isPassValid ? 'VALID PASS' : 'EXPIRED PASS'}
          </span>
        </div>

        {/* Main content */}
        <div className="p-4 flex flex-col items-center">
          {/* Prominent timestamp - large and centered */}
          <div className="my-6 w-full rounded-xl bg-gradient-to-r from-indigo-500/50 to-purple-500/50 p-5 text-center border border-white/60 shadow-lg">
            <div className="mb-1">
              <p className="text-white/90 text-xs uppercase tracking-wider">Pass Generated</p>
              <p className="text-white text-4xl font-bold tracking-tight">
                {formatDate(gatepass.generatedAt)}
              </p>
            </div>
          </div>

          {/* Visitor details in card */}
          <div className="w-full my-2 rounded-xl bg-white/80 p-4 border border-gray-200/60 shadow-sm">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-gray-500 text-xs">Visitor</p>
                <p className="text-gray-800 text-lg font-medium">{gatepass.visitorName}</p>
              </div>
              <div className="text-right">
                <p className="text-gray-500 text-xs">Flat</p>
                <p className="text-gray-800 text-lg font-medium">{gatepass.flatNumber}</p>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-gray-500 text-xs">Purpose</p>
              <p className="text-gray-800">{gatepass.purpose}</p>
            </div>
          </div>

          {/* Pass ID in smaller font */}
          <div className="w-full mt-2 rounded-lg bg-gray-100/80 py-2 px-4 text-center border border-gray-200/60">
            <p className="text-gray-500 text-xs">Pass ID</p>
            <p className="text-gray-700 text-sm font-mono tracking-wide">{gatepass.passId}</p>
          </div>
        </div>

        {/* Bottom action button */}
        <div className="bg-gray-100/50 px-4 py-5 border-t border-gray-200/50">
          <Link to="/" className="block w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium rounded-lg shadow-md text-center hover:from-indigo-600 hover:to-purple-600 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1 focus:ring-offset-white/40">
            Return to Check-In
          </Link>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 text-xs text-gray-300 text-center">
        Visitor Management System • {new Date().getFullYear()}
      </div>
    </div>
  );
};

export default Gatepass;
