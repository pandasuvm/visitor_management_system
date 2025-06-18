import React from 'react';
import { Routes, Route } from 'react-router-dom';
import VisitorForm from './components/VisitorForm';
import Gatepass from './components/Gatepass';
import NotFound from './components/NotFound';
import Admin from './components/Admin';

function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<VisitorForm />} />
        <Route path="/gatepass/:requestId" element={<Gatepass />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}

export default App;
