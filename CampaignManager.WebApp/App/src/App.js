import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import React, { Component } from 'react';

export class App extends Component {
    constructor(props) {
        super(props);
        this.state = {
            user: null,
            fetching: true,
            isNewUser: false
        }
    }

    render() {
        return (
            <div>
                <Router>
                <Routes>
                    <Route path="/login" element={!this.state.user ? <Login /> : <Navigate to="/dashboard" />} />
                        <Route path="/register" element={!this.state.user ? <Register/> : <Navigate to="/dashboard" />} />
                        <Route path="/dashboard" element={this.state.user ? <Dashboard user={this.state.user} /> : <Navigate to="/login" />} />
                        <Route path="/" element={<Navigate to="/dashboard" />} />
                    </Routes>
                </Router>
            </div>
        );
    }
}

export default App;