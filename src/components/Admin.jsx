import React, { useState, useEffect } from 'react';
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
  }, []);

  // Fetch WhatsApp QR code
  const fetchQrCode = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/whatsapp-qr');
      if (response.ok) {
        const data = await response.json();
        setQrCode(data.qrCode);
      } else {
        console.error('Failed to fetch QR code');
      }
    } catch (error) {
      console.error('Error fetching QR code:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch visitor records
  const fetchVisitorRecords = async () => {
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
  };

  // Fetch flat mappings
  const fetchFlatMappings = async () => {
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
  };

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

  // Format date for display
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
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
          <div className="bg-white shadow rounded-lg p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-800">WhatsApp Bot QR Code</h2>
              <button
                onClick={fetchQrCode}
                className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-md text-sm hover:bg-indigo-200"
              >
                Refresh
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center p-4">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
              </div>
            ) : qrCode ? (
              <div className="flex flex-col items-center">
                <div className="bg-white p-2 rounded-lg border border-gray-200">
                  <QRCode
                    value={qrCode}
                    size={200}
                    level="H"
                    includeMargin={true}
                    renderAs="svg"
                  />
                </div>
                <p className="mt-2 text-gray-600 text-sm text-center">
                  Scan with WhatsApp to authenticate the bot
                </p>
              </div>
            ) : (
              <div className="text-center p-4">
                <p className="text-gray-500 text-sm">No QR code available. The bot may already be authenticated.</p>
                <button
                  onClick={fetchQrCode}
                  className="mt-2 px-4 py-2 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 focus:outline-none text-sm"
                >
                  Check for QR Code
                </button>
              </div>
            )}
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
