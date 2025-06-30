import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import Navigation from './components/Navigation';
import CampaignSideNav from './components/campaign/CampaignSideNav';
import React, { Component } from 'react';
import SphereConverter from './components/player-tools/SphereConverter';


export class App extends Component {
    constructor(props) {
        super(props);
        this.state = {
            user: null,
            fetching: true,
            isNewUser: false,
            selectedCampaign: null
        }
    }

    setCampaignDetails = (campaign) => {
        this.setState({ selectedCampaign: campaign });
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
                    <div style={{ height: "4vh" }}>
                        {this.state.user && <Navigation user={this.state.user} setUser={this.setUser} setCampaignDetails={this.setCampaignDetails} />}
                    </div>
                    <div style={{ height: "96vh", width:"100vw" }}>
                        <Routes>                        
                            <Route path="/login" element={<Login user={this.state.user} setUser={this.setUser} />} />
                            {/* <Route path="/register" element={<Register setUser={this.setUser} />} />*/}
                            <Route path="/dashboard" element={this.state.user ? <Dashboard user={this.state.user} /> : <Navigate to="/login" />} />
                            <Route path="/" element={<Navigate to="/dashboard" />} />
                            <Route path="/sphereConverter" element={<SphereConverter user={this.state.user} />} />"
                        </Routes>     
                    </div>
                </Router>
                {
                    this.state.user && this.state.selectedCampaign &&
                    <CampaignSideNav user={this.state.user} campaign={this.state.selectedCampaign} />
                }
            </div>
        );
    }
}

export default App;