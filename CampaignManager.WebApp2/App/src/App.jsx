import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import '@mantine/core/styles.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
   // const token = localStorage.getItem('token');
   // if (token) {
   //   auth.getCurrentUser()
   //     .then(response => {
   //       setUser(response.data);
   //     })
   //     .catch(() => {
   //       localStorage.removeItem('token');
   //     })
   //     .finally(() => {
   //       setLoading(false);
   //     });
   // } else {
      setLoading(false);
   // }
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <MantineProvider>
      <Router>
        <Routes>
          <Route path="/login" element={!user ? <Login setUser={setUser} /> : <Navigate to="/dashboard" />} />
          <Route path="/register" element={!user ? <Register setUser={setUser} /> : <Navigate to="/dashboard" />} />
          <Route path="/dashboard" element={user ? <Dashboard user={user} /> : <Navigate to="/login" />} />
          <Route path="/" element={<Navigate to="/dashboard" />} />
        </Routes>
      </Router>
    </MantineProvider>
  );
}

export default App;