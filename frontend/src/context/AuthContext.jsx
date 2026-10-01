import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(null);
  }, []);

  // Keep Axios Authorization header in sync with token
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  // Validate token and fetch current user on mount / token change
  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    axios
      .get(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (!cancelled) setUser(res.data);
      })
      .catch(() => {
        if (!cancelled) logout();
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, logout]);

  const sendPhoneOtp = async (phone) => {
    const res = await axios.post(`${API_URL}/api/auth/send-phone-otp`, { phone });
    return res.data;
  };

  const verifyPhoneOtp = async (phone, otp) => {
    const res = await axios.post(`${API_URL}/api/auth/verify-phone-otp`, { phone, otp });
    if (!res.data.isNewUser && res.data.token) {
      localStorage.setItem('token', res.data.token);
      setToken(res.data.token);
      setUser(res.data.user);
    }
    return res.data;
  };

  const sendEmailOtp = async (email) => {
    const res = await axios.post(`${API_URL}/api/auth/send-email-otp`, { email });
    return res.data;
  };

  const verifyEmailOtp = async (email, otp) => {
    const res = await axios.post(`${API_URL}/api/auth/verify-email-otp`, { email, otp });
    if (!res.data.isNewUser && res.data.token) {
      localStorage.setItem('token', res.data.token);
      setToken(res.data.token);
      setUser(res.data.user);
    }
    return res.data;
  };

  const setupProfile = async ({ phone, email, name, profilePic = '', about = '' }) => {
    const res = await axios.post(`${API_URL}/api/auth/setup-profile`, {
      phone,
      email,
      name,
      profilePic,
      about,
    });
    if (res.data.token) {
      localStorage.setItem('token', res.data.token);
      setToken(res.data.token);
      setUser(res.data.user);
    }
    return res.data;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        token,
        loading,
        sendPhoneOtp,
        verifyPhoneOtp,
        sendEmailOtp,
        verifyEmailOtp,
        setupProfile,
        logout,
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
};
