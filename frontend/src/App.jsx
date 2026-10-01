import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ChatProvider } from './context/ChatContext';
import Login from './pages/Login';
import ChatLayout from './pages/ChatLayout';

// WhatsApp-style loading spinner
const LoadingScreen = () => (
  <div className="h-screen w-screen bg-[#f0f2f5] flex flex-col items-center justify-center select-none">
    <div className="w-14 h-14 rounded-full bg-[#00a884] flex items-center justify-center mb-5 shadow-lg">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm.029 18.88a9.947 9.947 0 01-4.766-1.215L3 19l1.395-4.091A9.954 9.954 0 012.07 9.938C2.07 4.459 6.548.012 12.029.012 17.51.012 21.987 4.46 21.987 9.94c0 5.48-4.477 9.94-9.958 9.94z"/>
      </svg>
    </div>
    <div className="w-10 h-10 border-[3px] border-[#00a884] border-t-transparent rounded-full animate-spin mb-4" />
    <span className="text-sm text-[#54656f] font-medium tracking-wide">Loading ChatApp...</span>
  </div>
);

// Protects /chat — redirects to /login if not authenticated
const ProtectedRoute = ({ children }) => {
  const { token, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  // Strictly redirect to /login if no token
  return token ? children : <Navigate to="/login" replace />;
};

// Redirects authenticated users away from /login to /chat
const PublicRoute = ({ children }) => {
  const { token, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return token ? <Navigate to="/chat" replace /> : children;
};

function App() {
  return (
    <AuthProvider>
      <ChatProvider>
        <Router>
          <Routes>
            {/* Public: Login screen */}
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              }
            />

            {/* Protected: Main chat */}
            <Route
              path="/chat"
              element={
                <ProtectedRoute>
                  <ChatLayout />
                </ProtectedRoute>
              }
            />

            {/* Wildcard: unauthenticated → /login, authenticated → /chat */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Router>
      </ChatProvider>
    </AuthProvider>
  );
}

export default App;
