import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Navigate } from 'react-router-dom';
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

    setUser = (user) => {
        this.setState({ user: user });
    }

    login = () => {
        return(<Login user = { this.state.user } setUser = { this.setUser } />)
    }

    register = () => {
        return (<Register setUser={this.setUser} />)
    }
    render() {
        return (
            <div>
                <Router>
                    {this.state.user &&
                        <>

                            <Route path="/login" render={this.login} />
                            <Route path="/register" render={this.register} />
                        </>
                    }
                    <>
                    <Navigation>                        
                        <Route path="/dashboard" element={this.state.user ? <Dashboard user={this.state.user} /> : <Navigate to="/login" />} />
                    </Navigation>
                        <Route path="/" element={<Navigate to="/dashboard" />} />
                    </>
                </Router>
            </div>
        );
    }
}

export default App;