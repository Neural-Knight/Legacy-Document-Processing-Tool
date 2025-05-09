import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
// Theme Provider
import AppThemeProvider from './theme/AppThemeProvider';
// Auth Provider
import AuthProvider from './context/AuthContext';
// Protected Route component
import ProtectedRoute from './components/auth/ProtectedRoute';
// Layout component
import Layout from './components/layout/Layout';
// Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import HomePage from './pages/HomePage';
import UploadPage from './pages/UploadPage';
import MyDocumentsPage from './pages/MyDocumentsPage';
import VisualizationsPage from './pages/VisualizationsPage';
import QueryAgentPage from './pages/QueryAgentPage';
import NotFoundPage from './pages/NotFoundPage';
import DocumentViewerPage from './pages/DocumentViewerPage';
import './App.css';
import { UploadProvider } from './contexts/UploadContext';
import { DragDropProvider } from './contexts/DragDropContext';
import UploadDialog from './components/Upload/UploadDialog';
import { useUpload } from './contexts/UploadContext';

// Create a component to include the UploadDialog
const UploadDialogContainer = () => {
  const { 
    uploadDialogOpen, 
    closeUploadDialog, 
    setRecentlyUploadedDocuments,
    initialFiles
  } = useUpload();

  const handleUploadComplete = (documentIds: string[]) => {
    // Store the uploaded document IDs for reference
    setRecentlyUploadedDocuments(documentIds);
  };

  return (
    <UploadDialog
      open={uploadDialogOpen}
      onClose={closeUploadDialog}
      initialFiles={initialFiles}
      onUploadComplete={handleUploadComplete}
    />
  );
};

function App() {
  return (
    <AppThemeProvider>
      <AuthProvider>
        <UploadProvider>
          <DragDropProvider>
            <Router>
              <Routes>
                {/* Public Routes */}
                <Route path="/landing" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                
                {/* Protected Routes */}
                <Route 
                  path="/" 
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <HomePage />
                      </Layout>
                    </ProtectedRoute>
                  } 
                />
                
                <Route 
                  path="/upload" 
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <UploadPage />
                      </Layout>
                    </ProtectedRoute>
                  } 
                />
                
                <Route 
                  path="/documents" 
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <MyDocumentsPage />
                      </Layout>
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/visualizations" 
                  element={
                    <ProtectedRoute>
                      <Layout>
                      <VisualizationsPage />
                      </Layout>
                    </ProtectedRoute>
                  } 
                />
                
                <Route 
                  path="/query-agent" 
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <QueryAgentPage />
                      </Layout>
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/documents/:documentId" 
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <DocumentViewerPage />
                      </Layout>
                    </ProtectedRoute>
                  } 
                />
                
                {/* Default root route - redirects to landing if not authenticated */}
                <Route 
                  path="/" 
                  element={<Navigate to="/landing" replace />} 
                />
                
                {/* Error Handling */}
                <Route path="/404" element={<NotFoundPage />} />
                <Route path="*" element={<Navigate to="/404" replace />} />
              </Routes>
            </Router>
            <UploadDialogContainer />
          </DragDropProvider>
        </UploadProvider>
      </AuthProvider>
    </AppThemeProvider>
  );
}

export default App;