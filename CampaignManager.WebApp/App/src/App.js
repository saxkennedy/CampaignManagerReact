import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import Navigation from './components/Navigation';
import CampaignDashboard from './components/campaign/CampaignDashboard';
import React, { Component } from 'react';
import SphereConverter from './components/player-tools/SphereConverter';

export class App extends Component {
    constructor(props) {
        super(props);
        this.state = {
            user: null,
            fetching: true,
            isNewUser: false,
            openCampaignNav: false,   // kept for compatibility if you still toggle it
            activeCampaignId: null,   // ⬅️ NEW
        };
    }

    setOpenCampaignNav = (open) => {
        this.setState({ openCampaignNav: open });
    };

    setUser = (user) => {
        this.setState({ user: user });
        if (!user) {
            // on logout, clear active campaign too
            this.setState({ activeCampaignId: null, openCampaignNav: false });
        }
    };

    // ⬅️ NEW: store the currently-selected campaignId
    setActiveCampaignId = (campaignId) => {
        this.setState({ activeCampaignId: campaignId });
    };

    login = () => {
        return (<Login user={this.state.user} setUser={this.setUser} />);
    };

    register = () => {
        return (<Register setUser={this.setUser} />);
    };

    render() {
        return (
            <div style={{ backgroundColor: "#FCF5E5" }}>
                <Router>
                    <div>
                        {this.state.user && (
                            <Navigation
                                user={this.state.user}
                                setUser={this.setUser}
                                setOpenCampaignNav={this.setOpenCampaignNav}
                                // ⬅️ NEW: let Navigation set the selected campaignId
                                setActiveCampaignId={this.setActiveCampaignId}
                            />
                        )}
                    </div>
                    <Routes>
                        <Route
                            path="/login"
                            element={
                                <div style={{ height: "100vh", width: "100vw", position: "relative", top: "0" }}>
                                    <Login user={this.state.user} setUser={this.setUser} />
                                </div>
                            }
                        />
                        <Route path="/register" element={<Register setUser={this.setUser} />} />
                        <Route
                            path="/dashboard"
                            element={
                                this.state.user ? (
                                    <div style={{ height: "96vh", width: "100vw", position: "relative", top: "4vh" }}>
                                        <Dashboard user={this.state.user} />
                                    </div>
                                ) : (
                                    <Navigate to="/login" />
                                )
                            }
                        />
                        <Route path="/" element={<Navigate to="/dashboard" />} />
                        <Route
                            path="/sphereConverter"
                            element={
                                <div style={{ height: "96vh", width: "100vw", position: "relative", top: "4vh" }}>
                                    <SphereConverter user={this.state.user} />
                                </div>
                            }
                        />
                        <Route
                            path="/campaigns/:campaignId"
                            element={
                                this.state.user ? (
                                    <div style={{ height: "96vh", width: "100vw", position: "relative", top: "4vh" }}>
                                        <CampaignDashboard
                                            user={this.state.user}
                                            // pass the actively selected campaignId for the dashboard to prefer
                                            activeCampaignId={this.state.activeCampaignId}
                                        />
                                    </div>
                                ) : (
                                    <Navigate to="/login" />
                                )
                            }
                        />
                        <Route
                            path="/campaigns/:campaignId/:contentId"
                            element={
                                this.state.user ? (
                                    <div style={{ height: "96vh", width: "100vw", position: "relative", top: "4vh" }}>
                                        <CampaignDashboard
                                            user={this.state.user}
                                            activeCampaignId={this.state.activeCampaignId}
                                        />
                                    </div>
                                ) : (
                                    <Navigate to="/login" />
                                )
                            }
                        />
                        {['items', 'npcs', 'shops'].map(seg => (
                            <Route
                                key={seg}
                                path={`/campaigns/:campaignId/${seg}/:contentId`}
                                element={
                                    this.state.user ? (
                                        <div style={{ height: "96vh", width: "100vw", position: "relative", top: "4vh" }}>
                                            <CampaignDashboard
                                                user={this.state.user}
                                                activeCampaignId={this.state.activeCampaignId}
                                            />
                                        </div>
                                    ) : (
                                        <Navigate to="/login" />
                                    )
                                }
                            />
                        ))}
                    </Routes>
                </Router>
            </div>
        );
    }
}

export default App;
