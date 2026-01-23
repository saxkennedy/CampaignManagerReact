import React, { useEffect, useMemo, useState } from "react";
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    TextField,
    Typography,
    Alert,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Paper
} from "@mui/material";
import UserService from "../../api/UserService";

export default function JoinCampaign(props) {
    const [campaigns, setCampaigns] = useState([]);
    const [search, setSearch] = useState("");
    const [pageError, setPageError] = useState("");
    const [pageSuccess, setPageSuccess] = useState("");

    const [pwOpen, setPwOpen] = useState(false);
    const [pwValue, setPwValue] = useState("");
    const [pwError, setPwError] = useState("");
    const [joiningCampaign, setJoiningCampaign] = useState(null);

    const memberCampaignIds = useMemo(() => {
        const cps = props.user?.CampaignPersonas ?? [];
        return new Set(cps.map(cp => cp.CampaignId));
    }, [props.user]);

    const filtered = useMemo(() => {
        const s = search.trim().toLowerCase();
        if (!s) return campaigns;
        return campaigns.filter(c =>
            (c.name || "").toLowerCase().includes(s) ||
            (c.description || "").toLowerCase().includes(s)
        );
    }, [campaigns, search]);

    useEffect(() => {
        (async () => {
            try {
                setPageError("");
                const rows = await UserService.ListJoinableCampaigns();
                setCampaigns(rows || []);
            } catch (e) {
                setPageError(e?.message || "Failed to load campaigns");
            }
        })();
    }, []);

    const closePasswordDialog = () => {
        setPwOpen(false);
        setJoiningCampaign(null);
        setPwValue("");
        setPwError("");
    };

    const beginJoin = (campaign) => {
        setPageError("");
        setPageSuccess("");
        setPwError("");
        setPwValue("");

        if (memberCampaignIds.has(campaign.id)) return;

        if (campaign.isPasswordProtected) {
            setJoiningCampaign(campaign);
            setPwOpen(true);
        } else {
            doJoin(campaign, "");
        }
    };

    const looksLikePasswordError = (err) => {
        const status = err?.status;
        const msg = (err?.message || String(err || "")).toLowerCase();
        return (
            status === 403 ||
            msg.includes("password") ||
            msg.includes("forbidden") ||
            msg.includes("invalid join")
        );
    };

    const doJoin = async (campaign, password) => {
        setPageError("");
        setPageSuccess("");
        setPwError("");

        try {
            const result = await UserService.JoinCampaign(campaign.id, password);

            if (result?.joined === true) {
                const me = await UserService.Me();
                props.setUser(me);

                setPageSuccess(`Joined "${campaign.name}" successfully.`);
                closePasswordDialog();
            } else {
                // Defensive: if API returns 200 but joined isn't true
                if (pwOpen) {
                    setPwError("Join was not completed. Please verify the password and try again.");
                } else {
                    setPageError("Join was not completed.");
                }
            }
        } catch (e) {
            // ✅ If we are in the password flow, show password-related errors on the modal
            if (pwOpen || campaign?.isPasswordProtected) {
                if (looksLikePasswordError(e)) {
                    setPwError(e?.message || "Incorrect password. Please try again.");
                    return; // keep modal open, don't show above-table error
                }
            }

            // otherwise: general error above table
            setPageError(e?.message || "Failed to join campaign.");
        }
    };

    return (
        <Box sx={{ p: 3 }} component="form" autoComplete="off">
            <Typography variant="h4" sx={{ mb: 2, fontWeight: 700 }}>
                Join a Campaign
            </Typography>

            <Typography sx={{ mb: 2, color: "text.secondary" }}>
                Search for an active campaign and click Join. Password-protected campaigns will prompt you.
            </Typography>

            <TextField
                fullWidth
                label="Search campaigns"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                sx={{ mb: 2 }}
                autoComplete="off"
                inputProps={{ autoComplete: "new-password", name: "campaignSearch" }}
            />

            {pageError && <Alert severity="error" sx={{ mb: 2 }}>{pageError}</Alert>}
            {pageSuccess && <Alert severity="success" sx={{ mb: 2 }}>{pageSuccess}</Alert>}

            <Paper elevation={2}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Protected</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Member</TableCell>
                            <TableCell sx={{ fontWeight: 700 }} align="right">Action</TableCell>
                        </TableRow>
                    </TableHead>

                    <TableBody>
                        {filtered.map((c) => {
                            const isMember = memberCampaignIds.has(c.id);
                            return (
                                <TableRow key={c.id}>
                                    <TableCell>{c.name}</TableCell>
                                    <TableCell>{c.description}</TableCell>
                                    <TableCell>{c.isPasswordProtected ? "Yes" : "No"}</TableCell>
                                    <TableCell>{isMember ? "✓" : ""}</TableCell>
                                    <TableCell align="right">
                                        <Button
                                            variant="contained"
                                            onClick={() => beginJoin(c)}
                                            disabled={isMember}
                                            title={isMember ? "You are already a member of this campaign" : "Join this campaign"}
                                        >
                                            {isMember ? "Joined" : "Join"}
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            );
                        })}

                        {filtered.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5}>
                                    <Typography sx={{ py: 2, color: "text.secondary" }}>
                                        No campaigns found.
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </Paper>

            <Dialog open={pwOpen} onClose={closePasswordDialog} maxWidth="xs" fullWidth>
                <DialogTitle>
                    Enter Campaign Password
                    {joiningCampaign?.name ? ` — ${joiningCampaign.name}` : ""}
                </DialogTitle>

                <DialogContent>
                    {/* ✅ Modal-specific error */}
                    {pwError && <Alert severity="error" sx={{ mb: 2 }}>{pwError}</Alert>}

                    <TextField
                        autoFocus
                        fullWidth
                        margin="dense"
                        label="Password"
                        type="password"
                        value={pwValue}
                        onChange={(e) => {
                            setPwValue(e.target.value);
                            if (pwError) setPwError(""); // clear on typing
                        }}
                        autoComplete="new-password"
                        inputProps={{ name: "campaignJoinPassword" }}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                if (joiningCampaign) doJoin(joiningCampaign, pwValue);
                            }
                        }}
                    />
                </DialogContent>

                <DialogActions>
                    <Button onClick={closePasswordDialog}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={() => doJoin(joiningCampaign, pwValue)}
                        disabled={!joiningCampaign}
                    >
                        Join
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
