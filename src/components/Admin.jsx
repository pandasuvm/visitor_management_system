import React, { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';

// Import QRCode component with the proper named export syntax
import { QRCodeSVG as QRCode } from 'qrcode.react';

const Admin = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [visitorRecords, setVisitorRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState(false);

  // New states for the enhanced QR code system
  const [whatsappStatus, setWhatsappStatus] = useState({
    state: 'unknown',
    lastUpdated: null,
    connectionAttempts: 0,
    qrRefreshCount: 0
  });
  const [whatsappReady, setWhatsappReady] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [qrError, setQrError] = useState('');
  const [qrLastChecked, setQrLastChecked] = useState(null);

  // New states for flat management
  const [flatMappings, setFlatMappings] = useState({});
  const [loadingFlats, setLoadingFlats] = useState(false);
  const [savingFlats, setSavingFlats] = useState(false);
  const [flatManagementMessage, setFlatManagementMessage] = useState({ type: '', text: '' });
  const [editMode, setEditMode] = useState(false);
  const [newFlatNumber, setNewFlatNumber] = useState('');
  const [newPhoneNumber, setNewPhoneNumber] = useState('');

  // New state for tab navigation
  const [activeTab, setActiveTab] = useState('qr');

  // Admin credentials from environment variables with fallbacks
  const ADMIN_USERNAME = import.meta.env.VITE_ADMIN_USERNAME || 'panchadmin';
  const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || 'admin@1234';

  // API base URL from environment variables
  const API_URL = import.meta.env.VITE_API_URL || '';

  // Define all fetch functions before using them in useEffect
  
  // Enhanced Fetch WhatsApp QR code with status information
  const fetchQrCode = useCallback(async () => {
    try {
      setLoading(true);
      setQrError('');
      const response = await fetch('/api/admin/whatsapp-qr');
      const data = await response.json();

      if (response.ok) {
        if (data.qrCode) {
          setQrCode(data.qrCode);
        } else {
          setQrCode('');
        }

        // Update WhatsApp status if available
        if (data.status) {
          setWhatsappStatus(data.status);
          setWhatsappReady(data.isReady || false);
        }

        setQrLastChecked(new Date());
      } else {
        console.error('Failed to fetch QR code:', data.message);
        setQrError(data.message || 'Failed to fetch QR code');
      }
    } catch (error) {
      console.error('Error fetching QR code:', error);
      setQrError('Network error while fetching QR code');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch visitor records
  const fetchVisitorRecords = useCallback(async () => {
    try {
      setLoadingRecords(true);
      const response = await fetch('/api/admin/visitor-records');
      if (response.ok) {
        const data = await response.json();
        setVisitorRecords(data);
      } else {
        console.error('Failed to fetch visitor records');
      }
    } catch (error) {
      console.error('Error fetching visitor records:', error);
    } finally {
      setLoadingRecords(false);
    }
  }, []);

  // Fetch flat mappings
  const fetchFlatMappings = useCallback(async () => {
    try {
      setLoadingFlats(true);
      const response = await fetch('/api/admin/flat-mappings');
      if (response.ok) {
        const data = await response.json();
        setFlatMappings(data); // The data is already in the right format { "101": "91777..." }
      } else {
        console.error('Failed to fetch flat mappings');
        setFlatManagementMessage({ type: 'error', text: 'Failed to fetch flat mappings' });
      }
    } catch (error) {
      console.error('Error fetching flat mappings:', error);
      setFlatManagementMessage({ type: 'error', text: 'Error fetching flat mappings: ' + error.message });
    } finally {
      setLoadingFlats(false);
    }
  }, []);

  // Check if user is already authenticated (from sessionStorage)
  useEffect(() => {
    const auth = sessionStorage.getItem('adminAuthenticated');
    if (auth === 'true') {
      setIsAuthenticated(true);
      // Fetch QR code and visitor records when authenticated
      fetchQrCode();
      fetchVisitorRecords();
      fetchFlatMappings();
    }
  }, [fetchQrCode, fetchVisitorRecords, fetchFlatMappings]);

  // Effect for auto-refreshing QR code
  useEffect(() => {
    let intervalId;

    if (autoRefresh && isAuthenticated) {
      // Auto-refresh every 15 seconds if enabled
      intervalId = setInterval(() => {
        fetchQrCode();
      }, 15000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [autoRefresh, isAuthenticated]);

  // Handle login form submission
  const handleLogin = (e) => {
    e.preventDefault();
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      sessionStorage.setItem('adminAuthenticated', 'true');
      setLoginError('');
      fetchQrCode();
      fetchVisitorRecords();
      fetchFlatMappings();
    } else {
      setLoginError('Invalid username or password');
    }
  };

  // Handle logout
  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('adminAuthenticated');
    setUsername('');
    setPassword('');
  };

  // Handle adding a new flat mapping
  const handleAddNewFlat = () => {
    if (!newFlatNumber || !newPhoneNumber) {
      setFlatManagementMessage({ type: 'error', text: 'Both flat number and phone number are required.' });
      return;
    }

    // Check if the flat already exists
    if (flatMappings[newFlatNumber]) {
      setFlatManagementMessage({ type: 'error', text: 'This flat number already exists.' });
      return;
    }

    // Add the new flat mapping
    setFlatMappings({
      ...flatMappings,
      [newFlatNumber]: newPhoneNumber
    });

    // Clear the input fields
    setNewFlatNumber('');
    setNewPhoneNumber('');
    setFlatManagementMessage({ type: 'success', text: 'New flat added. Remember to save your changes.' });
  };

  // Handle removing a flat mapping
  const handleRemoveFlat = (flatNumber) => {
    const updatedMappings = { ...flatMappings };
    delete updatedMappings[flatNumber];
    setFlatMappings(updatedMappings);
    setFlatManagementMessage({ type: 'success', text: 'Flat removed. Remember to save your changes.' });
  };

  // Handle flat mapping save
  const handleSaveFlats = async () => {
    setSavingFlats(true);
    setFlatManagementMessage({ type: '', text: '' });
    try {
      const response = await fetch('/api/admin/flat-mappings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(flatMappings),
      });
      if (response.ok) {
        setFlatManagementMessage({ type: 'success', text: 'Flat mappings saved successfully.' });
        fetchFlatMappings();
      } else {
        setFlatManagementMessage({ type: 'error', text: 'Failed to save flat mappings.' });
      }
    } catch (error) {
      setFlatManagementMessage({ type: 'error', text: 'Error saving flat mappings: ' + error.message });
    } finally {
      setSavingFlats(false);
    }
  };

  // Handle flat number and phone number change
  const handleFlatChange = (flatNumber, value) => {
    setFlatMappings({ ...flatMappings, [flatNumber]: value });
  };

  // Handle manual QR code refresh
  const handleQrRefresh = () => {
    fetchQrCode();
  };

  // Force WhatsApp reconnection
  const handleReconnectWhatsApp = async () => {
    try {
      setReconnecting(true);
      setQrError('');

      const response = await fetch('/api/admin/whatsapp-reconnect', {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        // Update status from response
        if (data.status) {
          setWhatsappStatus(data.status);
        }

        // Set auto-refresh to catch the QR code when it's ready
        setAutoRefresh(true);

        // Fetch the status immediately to start polling
        setTimeout(fetchQrCode, 2000);
      } else {
        setQrError(data.message || 'Failed to reconnect WhatsApp');
      }
    } catch (error) {
      console.error('Error reconnecting WhatsApp:', error);
      setQrError('Network error while attempting to reconnect');
    } finally {
      setReconnecting(false);
    }
  };

  // Format date for easier reading
  const formatTimeAgo = (dateString) => {
    if (!dateString) return 'N/A';

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.round(diffMs / 1000);
    const diffMin = Math.round(diffSec / 60);
    const diffHr = Math.round(diffMin / 60);

    if (diffSec < 60) return `${diffSec} seconds ago`;
    if (diffMin < 60) return `${diffMin} minutes ago`;
    if (diffHr < 24) return `${diffHr} hours ago`;
    return date.toLocaleString();
  };

  // Get the appropriate status indicator color
  const getStatusColor = () => {
    switch (whatsappStatus.state) {
      case 'authenticated':
        return 'bg-green-500';
      case 'qr-ready':
        return 'bg-blue-500';
      case 'initializing':
        return 'bg-yellow-500';
      case 'disconnected':
      case 'failed':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  // Get status text for display
  const getStatusText = () => {
    switch (whatsappStatus.state) {
      case 'authenticated':
        return 'Connected';
      case 'qr-ready':
        return 'QR Code Ready - Scan Now!';
      case 'initializing':
        return 'Initializing...';
      case 'disconnected':
        return 'Disconnected';
      case 'failed':
        return 'Connection Failed';
      default:
        return 'Unknown Status';
    }
  };

  // If not authenticated, show login form
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-500/80 to-indigo-600/80 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white/60 backdrop-blur-lg rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-white/50 backdrop-blur-md p-4 border-b border-gray-200/50">
            <h1 className="text-2xl font-bold text-gray-800 text-center">Admin Login</h1>
            <p className="text-gray-600 text-sm text-center">Panchsheel Enclave Visitor Management</p>
          </div>

          <div className="p-6">
            {loginError && (
              <div className="mb-4 p-3 bg-red-100 border border-red-200 text-red-700 rounded-lg text-sm">
                {loginError}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-gray-700 text-sm font-medium mb-1">
                  Username
                </label>
                <input
                  type="text"
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-2 bg-white/80 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-gray-700 text-sm font-medium mb-1">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 bg-white/80 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium rounded-lg shadow-md hover:from-indigo-600 hover:to-purple-600 focus:outline-none"
              >
                Login
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin Header - Simplified and sticky */}
      <header className="bg-white shadow fixed top-0 left-0 right-0 z-10">
        <div className="max-w-7xl mx-auto py-3 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900">Visitor Management</h1>
          <button
            onClick={handleLogout}
            className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded-md text-gray-700 text-sm"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Tab Navigation - Sticky, just below header */}
      <div className="bg-white border-b border-gray-200 fixed top-12 left-0 right-0 z-10">
        <div className="max-w-7xl mx-auto px-2">
          <nav className="flex overflow-x-auto py-2 no-scrollbar">
            <button
              onClick={() => setActiveTab('qr')}
              className={`px-3 py-2 text-sm font-medium whitespace-nowrap mr-4 ${
                activeTab === 'qr'
                  ? 'text-indigo-600 border-b-2 border-indigo-500'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              WhatsApp QR
            </button>
            <button
              onClick={() => setActiveTab('visitors')}
              className={`px-3 py-2 text-sm font-medium whitespace-nowrap mr-4 ${
                activeTab === 'visitors'
                  ? 'text-indigo-600 border-b-2 border-indigo-500'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Visitor Records
            </button>
            <button
              onClick={() => setActiveTab('flats')}
              className={`px-3 py-2 text-sm font-medium whitespace-nowrap ${
                activeTab === 'flats'
                  ? 'text-indigo-600 border-b-2 border-indigo-500'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Flat Phone Numbers
            </button>
          </nav>
        </div>
      </div>

      {/* Main content - with padding for fixed header and tabs */}
      <main className="max-w-7xl mx-auto pt-28 pb-6 px-4 sm:px-6 lg:px-8">
        {/* WhatsApp QR Code Tab */}
        {activeTab === 'qr' && (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="border-b border-gray-200">
              <div className="flex justify-between items-center p-4">
                <div className="flex items-center space-x-2">
                  <h2 className="text-lg font-semibold text-gray-800">WhatsApp Bot Connection</h2>
                  <div className={`h-3 w-3 rounded-full ${getStatusColor()}`}></div>
                  <span className="text-sm text-gray-600">{getStatusText()}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="flex items-center">
                    <label className="switch mr-2 inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoRefresh}
                        onChange={() => setAutoRefresh(!autoRefresh)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                      <span className="ml-2 text-sm text-gray-600">Auto-Refresh</span>
                    </label>
                  </div>
                  <button
                    onClick={fetchQrCode}
                    disabled={loading}
                    className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-md text-sm hover:bg-indigo-200 flex items-center"
                  >
                    {loading ? 'Refreshing...' : 'Refresh'}
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4">
              {qrError && (
                <div className="mb-4 p-3 bg-red-100 border border-red-200 text-red-700 rounded-lg text-sm">
                  {qrError}
                </div>
              )}

              <div className="flex flex-col md:flex-row md:space-x-4">
                {/* QR Code Display Panel */}
                <div className="flex-1">
                  <div className="rounded-lg border border-gray-200 p-4">
                    {loading ? (
                      <div className="flex justify-center p-6">
                        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500"></div>
                      </div>
                    ) : whatsappStatus.state === 'authenticated' ? (
                      <div className="flex flex-col items-center justify-center p-6 text-center">
                        <div className="bg-green-100 rounded-full p-3 mb-3">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900">WhatsApp Connected</h3>
                        <p className="text-sm text-gray-600 mt-1">Your WhatsApp bot is authenticated and ready to send notifications</p>
                        <button
                          onClick={handleReconnectWhatsApp}
                          disabled={reconnecting}
                          className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200"
                        >
                          {reconnecting ? 'Reconnecting...' : 'Reconnect WhatsApp'}
                        </button>
                      </div>
                    ) : qrCode ? (
                      <div className="flex flex-col items-center p-6 text-center">
                        <div className="bg-white p-2 rounded-lg border-2 border-indigo-300 shadow-lg mb-3">
                          <QRCode
                            value={qrCode}
                            size={260}
                            level="H"
                            includeMargin={true}
                            renderAs="svg"
                            bgColor="#FFFFFF"
                            fgColor="#000000"
                          />
                        </div>
                        <h3 className="text-md font-medium text-gray-900">Scan with WhatsApp</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          Open WhatsApp on your phone, tap Menu or Settings and select WhatsApp Web
                        </p>
                        {autoRefresh && (
                          <p className="text-xs text-indigo-600 mt-3">
                            QR code will refresh automatically
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center p-6 text-center">
                        <div className="bg-yellow-100 rounded-full p-3 mb-3">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900">No QR Code Available</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          WhatsApp may already be authenticated or is initializing
                        </p>
                        <div className="flex space-x-3 mt-4">
                          <button
                            onClick={fetchQrCode}
                            disabled={loading}
                            className="px-4 py-2 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 text-sm"
                          >
                            Check for QR Code
                          </button>
                          <button
                            onClick={handleReconnectWhatsApp}
                            disabled={reconnecting}
                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200"
                          >
                            {reconnecting ? 'Reconnecting...' : 'Force Reconnection'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Connection Status Panel */}
                <div className="flex-1 mt-4 md:mt-0">
                  <div className="rounded-lg border border-gray-200 p-4 h-full">
                    <h3 className="font-medium text-gray-800 mb-3">Connection Status</h3>
                    <div className="space-y-3">
                      <div>
                        <div className="text-sm font-medium text-gray-500">Status</div>
                        <div className="flex items-center mt-1">
                          <div className={`h-3 w-3 rounded-full ${getStatusColor()} mr-2`}></div>
                          <div className="font-medium">{getStatusText()}</div>
                        </div>
                      </div>

                      <div>
                        <div className="text-sm font-medium text-gray-500">Last Update</div>
                        <div className="mt-1">
                          {whatsappStatus.lastUpdated ? formatTimeAgo(whatsappStatus.lastUpdated) : 'N/A'}
                        </div>
                      </div>

                      <div>
                        <div className="text-sm font-medium text-gray-500">Connection Attempts</div>
                        <div className="mt-1">{whatsappStatus.connectionAttempts || 0}</div>
                      </div>

                      <div>
                        <div className="text-sm font-medium text-gray-500">QR Code Refreshes</div>
                        <div className="mt-1">{whatsappStatus.qrRefreshCount || 0}</div>
                      </div>

                      <div>
                        <div className="text-sm font-medium text-gray-500">Last Checked</div>
                        <div className="mt-1">
                          {qrLastChecked ? formatTimeAgo(qrLastChecked) : 'Not yet checked'}
                        </div>
                      </div>

                      {whatsappStatus.error && (
                        <div>
                          <div className="text-sm font-medium text-red-500">Error</div>
                          <div className="mt-1 text-sm text-red-600">{whatsappStatus.error}</div>
                        </div>
                      )}
                    </div>

                    <div className="mt-5">
                      <h4 className="font-medium text-gray-800 mb-2">Troubleshooting</h4>
                      <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
                        <li>Make sure you have a stable internet connection</li>
                        <li>Ensure your phone has an active WhatsApp account</li>
                        <li>Scan the QR code quickly before it expires</li>
                        <li>If issues persist, try the "Force Reconnection" button</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Manual control for QR code refresh */}
              <div className="mt-4">
                <button
                  onClick={handleQrRefresh}
                  className="px-3 py-1 bg-indigo-500 text-white rounded-md text-sm hover:bg-indigo-600 focus:outline-none"
                >
                  Refresh QR Code
                </button>
              </div>

              {/* Auto-refresh toggle */}
              <div className="mt-4 flex items-center">
                <input
                  type="checkbox"
                  id="autoRefresh"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <label htmlFor="autoRefresh" className="ml-2 block text-sm text-gray-700">
                  Auto-refresh QR code
                </label>
              </div>

              {/* Reconnecting status */}
              {reconnecting && (
                <div className="mt-4 p-2 bg-yellow-100 text-yellow-800 rounded-md text-sm">
                  Reconnecting to WhatsApp... Please wait.
                </div>
              )}

              {/* QR code error message */}
              {qrError && (
                <div className="mt-4 p-2 bg-red-100 text-red-800 rounded-md text-sm">
                  Error: {qrError}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Visitor Records Tab */}
        {activeTab === 'visitors' && (
          <div className="bg-white shadow rounded-lg p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Visitor Records</h2>
              <button
                onClick={fetchVisitorRecords}
                className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-md text-sm hover:bg-indigo-200"
              >
                Refresh
              </button>
            </div>

            {loadingRecords ? (
              <div className="flex justify-center p-4">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
              </div>
            ) : visitorRecords.length > 0 ? (
              <div className="overflow-x-hidden">
                {/* Mobile-friendly visitor cards instead of table */}
                <div className="space-y-3">
                  {visitorRecords.map((record) => (
                    <div key={record.id} className="bg-gray-50 rounded-lg p-3 shadow-sm">
                      <div className="flex items-center">
                        <div className="h-12 w-12 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                          <img
                            src={record.photoUrl}
                            alt={record.visitorName}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = "https://via.placeholder.com/40?text=?";
                            }}
                          />
                        </div>
                        <div className="ml-3 flex-1 min-w-0">
                          <div className="flex justify-between items-center">
                            <p className="text-sm font-medium text-gray-900 truncate">{record.visitorName}</p>
                            <span className={`px-2 py-1 inline-flex text-xs leading-4 font-medium rounded-full 
                              ${record.status === 'approved' ? 'bg-green-100 text-green-800' : 
                               record.status === 'rejected' ? 'bg-red-100 text-red-800' : 
                               'bg-yellow-100 text-yellow-800'}`}>
                              {record.status}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <p className="text-xs text-gray-500">Flat: {record.flatNumber}</p>
                            <p className="text-xs text-gray-500">{new Date(record.timestamp).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}</p>
                          </div>
                          <p className="text-xs text-gray-500 truncate mt-1">{record.purpose}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center p-4">
                <p className="text-gray-500 text-sm">No visitor records found.</p>
              </div>
            )}
          </div>
        )}

        {/* Flat Phone Management Tab */}
        {activeTab === 'flats' && (
          <div className="bg-white shadow rounded-lg p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Flat Phone Numbers</h2>
              <button
                onClick={handleSaveFlats}
                className="px-3 py-1 bg-green-500 text-white rounded-md text-sm hover:bg-green-600"
                disabled={savingFlats}
              >
                {savingFlats ? 'Saving...' : 'Save'}
              </button>
            </div>

            {loadingFlats ? (
              <div className="flex justify-center p-4">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
              </div>
            ) : (
              <div>
                {flatManagementMessage.text && (
                  <div className={`mb-3 p-2 rounded-lg text-sm ${
                    flatManagementMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {flatManagementMessage.text}
                  </div>
                )}

                {/* Simplified flat listing for mobile */}
                <div className="space-y-2 mb-4 max-h-[45vh] overflow-y-auto">
                  {Object.entries(flatMappings).map(([flatNumber, phoneNumber]) => (
                    <div key={flatNumber} className="flex items-center bg-gray-50 p-2 rounded-lg">
                      <div className="font-medium text-gray-900 w-14">
                        {flatNumber}
                      </div>
                      <div className="flex-1 mx-2">
                        <input
                          type="text"
                          value={phoneNumber}
                          onChange={(e) => handleFlatChange(flatNumber, e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-400"
                          placeholder="Phone number"
                        />
                      </div>
                      <button
                        onClick={() => handleRemoveFlat(flatNumber)}
                        className="ml-1 p-1 text-red-500 rounded-full hover:bg-red-100"
                        aria-label="Remove flat"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add new flat form - more compact */}
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs font-medium text-gray-500 mb-1">Add New Flat</p>
                  <div className="flex items-end">
                    <div className="w-1/3 mr-2">
                      <input
                        type="text"
                        value={newFlatNumber}
                        onChange={(e) => setNewFlatNumber(e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        placeholder="Flat No."
                      />
                    </div>
                    <div className="flex-1 mr-2">
                      <input
                        type="text"
                        value={newPhoneNumber}
                        onChange={(e) => setNewPhoneNumber(e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        placeholder="Phone number"
                      />
                    </div>
                    <button
                      onClick={handleAddNewFlat}
                      className="px-3 py-1 bg-indigo-500 text-white text-sm rounded-md hover:bg-indigo-600 focus:outline-none"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Admin;
