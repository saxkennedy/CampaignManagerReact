import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import Navigation from './components/Navigation';
import CampaignDashboard from './components/campaign/CampaignDashboard';
import React, { Component } from 'react';
import SphereConverter from './components/player-tools/SphereConverter';
import ProtectedRoute from './components/utilities/ProtectedRoute';
import UserService from './api/UserService';
import JoinCampaign from './components/campaign/JoinCampaign';
import CreateCampaign from './components/campaign/CreateCampaign';

export class App extends Component {
    constructor(props) {
        super(props);
        this.state = {
            user: null,
            fetching: true,
            isNewUser: false,
            openCampaignNav: false,
            activeCampaignId: null,
        };

        this.idleTimeout = null;
        this.activityHandler = this.activityHandler.bind(this);
    }

    componentDidMount() {
        // ✅ restore session if token exists
        this.restoreSession();

        // ✅ listen for activity to enforce idle timeout
        ["mousemove", "mousedown", "keydown", "scroll", "touchstart"].forEach(evt => {
            window.addEventListener(evt, this.activityHandler, { passive: true });
        });

        // Start/refresh the idle timer
        this.resetIdleTimer();
    }

    componentWillUnmount() {
        ["mousemove", "mousedown", "keydown", "scroll", "touchstart"].forEach(evt => {
            window.removeEventListener(evt, this.activityHandler);
        });

        if (this.idleTimeout) clearTimeout(this.idleTimeout);
    }

    activityHandler() {
        if (!this.state.user) return; // only track idle when logged in
        UserService.updateLastActivity();
        this.resetIdleTimer();
    }

    resetIdleTimer() {
        if (this.idleTimeout) clearTimeout(this.idleTimeout);

        const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
        this.idleTimeout = setTimeout(() => {
            // Only auto-logout if currently logged in
            if (this.state.user) this.logout();
        }, FOUR_HOURS_MS);
    }

    async restoreSession() {
        const token = localStorage.getItem("authToken");
        if (!token) {
            this.setState({ fetching: false });
            return;
        }

        try {
            const me = await UserService.Me();
            this.setState({ user: me, fetching: false });
        } catch {
            UserService.clearToken();
            this.setState({ user: null, fetching: false });
        }
    }

    setOpenCampaignNav = (open) => {
        this.setState({ openCampaignNav: open });
    };

    setUser = (user) => {
        this.setState({ user: user });

        if (!user) {
            this.setState({ activeCampaignId: null, openCampaignNav: false });
        } else {
            UserService.updateLastActivity();
            this.resetIdleTimer();
        }
    };

    setActiveCampaignId = (campaignId) => {
        this.setState({ activeCampaignId: campaignId });
    };

    logout = () => {
        UserService.clearToken();
        this.setUser(null);
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
                                <ProtectedRoute user={this.state.user} isLoading={this.state.fetching}>
                                    <div style={{ height: "96vh", width: "100vw", position: "relative", top: "4vh" }}>
                                        <Dashboard user={this.state.user} />
                                    </div>
                                </ProtectedRoute>
                            }
                        />

                        <Route path="/" element={<Navigate to="/dashboard" />} />

                        <Route
                            path="/sphereConverter"
                            element={
                                <ProtectedRoute user={this.state.user} isLoading={this.state.fetching}>
                                    <div style={{ height: "96vh", width: "100vw", position: "relative", top: "4vh" }}>
                                        <SphereConverter user={this.state.user} />
                                    </div>
                                </ProtectedRoute>
                            }
                        />

                        <Route
                            path="/join"
                            element={
                                <ProtectedRoute user={this.state.user} isLoading={this.state.fetching}>
                                    <div style={{ height: "96vh", width: "100vw", position: "relative", top: "4vh" }}>
                                        <JoinCampaign user={this.state.user} setUser={this.setUser} />
                                    </div>
                                </ProtectedRoute>
                            }
                        />

                        {/* ✅ NEW */}
                        <Route
                            path="/create"
                            element={
                                <ProtectedRoute user={this.state.user} isLoading={this.state.fetching}>
                                    <div style={{ height: "96vh", width: "100vw", position: "relative", top: "4vh" }}>
                                        <CreateCampaign user={this.state.user} setUser={this.setUser} />
                                    </div>
                                </ProtectedRoute>
                            }
                        />

                        <Route
                            path="/campaigns/:campaignId"
                            element={
                                <ProtectedRoute user={this.state.user} isLoading={this.state.fetching}>
                                    <div style={{ height: "96vh", width: "100vw", position: "relative", top: "4vh" }}>
                                        <CampaignDashboard user={this.state.user} activeCampaignId={this.state.activeCampaignId} />
                                    </div>
                                </ProtectedRoute>
                            }
                        />

                        <Route
                            path="/campaigns/:campaignId/:contentId"
                            element={
                                <ProtectedRoute user={this.state.user} isLoading={this.state.fetching}>
                                    <div style={{ height: "96vh", width: "100vw", position: "relative", top: "4vh" }}>
                                        <CampaignDashboard user={this.state.user} activeCampaignId={this.state.activeCampaignId} />
                                    </div>
                                </ProtectedRoute>
                            }
                        />

                        {['items', 'npcs', 'shops'].map(seg => (
                            <Route
                                key={seg}
                                path={`/campaigns/:campaignId/${seg}/:contentId`}
                                element={
                                    <ProtectedRoute user={this.state.user} isLoading={this.state.fetching}>
                                        <div style={{ height: "96vh", width: "100vw", position: "relative", top: "4vh" }}>
                                            <CampaignDashboard user={this.state.user} activeCampaignId={this.state.activeCampaignId} />
                                        </div>
                                    </ProtectedRoute>
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
