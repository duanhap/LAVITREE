import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { DiagnosePage } from './pages/DiagnosePage';
import { HandbookPage } from './pages/HandbookPage';
import { AdminDashboard } from './pages/AdminDashboard';
import { KnowledgeCollectorPage } from './pages/KnowledgeCollectorPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Navbar />
        <main style={{ flex: 1 }}>
          <Routes>
            <Route path="/" element={<DiagnosePage />} />
            <Route path="/handbook" element={<HandbookPage />} />
            <Route path="/knowledge" element={<KnowledgeCollectorPage />} />
            <Route path="/admin/knowledge" element={<KnowledgeCollectorPage />} />
            <Route path="/admin" element={<AdminDashboard />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
};

export default App;
