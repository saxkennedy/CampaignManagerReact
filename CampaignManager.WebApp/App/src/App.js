import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import Navigation from './components/Navigation';
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

    setUser = (user) => {
        this.setState({ user: user });
    }

    login = () => {
        return (<Login user={this.state.user} setUser={this.setUser} />)
    }

    register = () => {
        return (<Register setUser={this.setUser} />)
    }

    render() {
        return (
            <div>                
                <Router>
                    <div style={{height:"4vh"} }>
                        {this.state.user && <Navigation user={this.state.user} setUser={this.setUser} />}
                    </div>
                    <div style={{ height: "96vh", width:"100vw" }}>
                        <Routes>                        
                            <Route path="/login" element={<Login user={this.state.user} setUser={this.setUser} />} />
                            <Route path="/register" element={<Register setUser={this.setUser} />} />
                            <Route path="/dashboard" element={this.state.user ? <Dashboard user={this.state.user} /> : <Navigate to="/login" />} />
                            <Route path="/" element={<Navigate to="/dashboard" />} />
                        </Routes>     
                    </div>
                </Router>
            </div>
        );
    }
}

export default App;