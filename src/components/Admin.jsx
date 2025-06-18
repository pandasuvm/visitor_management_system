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

  // Handle login form submission
  const handleLogin = (e) => {
    e.preventDefault();
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      sessionStorage.setItem('adminAuthenticated', 'true');
      setLoginError('');
      fetchQrCode();
      fetchVisitorRecords();
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
    <div className="min-h-screen bg-gray-100">
      {/* Admin Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md text-gray-700"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* WhatsApp QR Code Section */}
          <div className="bg-white shadow rounded-lg mb-6 p-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">WhatsApp Bot QR Code</h2>
            {loading ? (
              <div className="flex justify-center p-8">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
              </div>
            ) : qrCode ? (
              <div className="flex flex-col items-center space-y-4">
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <QRCode
                    value={qrCode}
                    size={256}
                    level="H"
                    includeMargin={true}
                    renderAs="svg"
                  />
                </div>
                <p className="text-gray-600 text-sm text-center max-w-md">
                  Scan this QR code with WhatsApp to authenticate the visitor management bot.
                </p>
                <button
                  onClick={fetchQrCode}
                  className="px-4 py-2 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 focus:outline-none"
                >
                  Refresh QR Code
                </button>
              </div>
            ) : (
              <div className="text-center p-8">
                <p className="text-gray-500">No QR code available. The bot may already be authenticated.</p>
                <button
                  onClick={fetchQrCode}
                  className="mt-4 px-4 py-2 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 focus:outline-none"
                >
                  Check for QR Code
                </button>
              </div>
            )}
          </div>

          {/* Visitor Records Section */}
          <div className="bg-white shadow rounded-lg p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Visitor Records</h2>
              <button
                onClick={fetchVisitorRecords}
                className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded-md text-gray-700 text-sm"
              >
                Refresh
              </button>
            </div>

            {loadingRecords ? (
              <div className="flex justify-center p-8">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
              </div>
            ) : visitorRecords.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Visitor
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Flat
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Purpose
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Time
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {visitorRecords.map((record) => (
                      <tr key={record.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-10 w-10 rounded-full overflow-hidden bg-gray-200">
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
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{record.visitorName}</div>
                              <div className="text-xs text-gray-500">{record.visitorPhone}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {record.flatNumber}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {record.purpose}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                            ${record.status === 'approved' ? 'bg-green-100 text-green-800' : 
                             record.status === 'rejected' ? 'bg-red-100 text-red-800' : 
                             'bg-yellow-100 text-yellow-800'}`}>
                            {record.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(record.timestamp)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center p-8">
                <p className="text-gray-500">No visitor records found.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Admin;
