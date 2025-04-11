import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
// Theme Provider
import AppThemeProvider from './theme/AppThemeProvider';
// Layout component
import Layout from './components/layout/Layout';
// Pages
import HomePage from './pages/HomePage';
import UploadPage from './pages/UploadPage';
import './App.css';

function App () {
  return (
    <AppThemeProvider>
      <Router>
        <Layout>
          <Routes>
            {/* Home Page */}
            <Route path="/" element={<HomePage />} />
            
            {/* Document Management */}
            <Route path="/upload" element={<UploadPage />} />
            {/* <Route path="/documents" element={<ViewDocumentsPage />} /> */}
            
            {/* Data Analysis */}
            {/* <Route path="/visualizations" element={<VisualizationsPage />} />
            <Route path="/query-tool" element={<QueryToolPage />} /> */}
            
            {/* Error Handling */}
            {/* <Route path="/404" element={<NotFoundPage />} />
            <Route path="*" element={<Navigate to="/404" replace />} /> */}
          </Routes>
        </Layout>
      </Router>
    </AppThemeProvider>
  );
};

export default App;
