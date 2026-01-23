import React, { useMemo, useState, useEffect } from "react";
import {
    Box,
    Button,
    Card,
    CardContent,
    TextField,
    Typography,
    Alert,
    IconButton,
    MenuItem,
    Select,
    InputLabel,
    FormControl,
    Divider,
    Stack,
    Grid
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import { useNavigate } from "react-router-dom";
import UserService from "../../api/UserService";

const MAX_PERSONAS = 10;

const DEFAULT_PERSONAS = [
    { displayName: "Creator", hierarchy: 1, lockedCreator: true },
    { displayName: "Player", hierarchy: 5, lockedCreator: false },
    { displayName: "Spectator", hierarchy: 10, lockedCreator: false }
];

// Hierarchy choices for non-creator personas (explicitly excludes 1)
const HIERARCHY_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 9, 10];

export default function CreateCampaign(props) {
    const navigate = useNavigate();

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");

    const [personas, setPersonas] = useState(DEFAULT_PERSONAS);

    const [joinPassword, setJoinPassword] = useState("");
    const [joinPasswordConfirm, setJoinPasswordConfirm] = useState("");

    const [joinHierarchy, setJoinHierarchy] = useState(() => {
        const player = DEFAULT_PERSONAS.find(p => p.hierarchy === 5);
        return player ? player.hierarchy : 5;
    });

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const canAddPersona = personas.length < MAX_PERSONAS;

    // Join persona cannot be hierarchy 1
    const joinOptions = useMemo(() => {
        return personas
            .filter(p => Number(p.hierarchy) !== 1)
            .map(p => ({
                label: `${p.displayName} (Hierarchy ${p.hierarchy})`,
                hierarchy: Number(p.hierarchy)
            }));
    }, [personas]);

    const setPersonaField = (idx, field, value) => {
        setPersonas(prev => {
            const next = [...prev];
            next[idx] = { ...next[idx], [field]: value };
            return next;
        });
    };

    const removePersona = (idx) => {
        if (personas[idx].lockedCreator) return;

        setPersonas(prev => {
            const next = prev.filter((_, i) => i !== idx);

            // If join persona got removed, select the first non-creator persona
            const stillExists = next.some(p => Number(p.hierarchy) === Number(joinHierarchy));
            if (!stillExists) {
                const fallback = next.find(p => Number(p.hierarchy) !== 1);
                if (fallback) setJoinHierarchy(Number(fallback.hierarchy));
            }

            return next;
        });
    };

    const addPersona = () => {
        if (!canAddPersona) return;

        const used = new Set(personas.map(p => Number(p.hierarchy)));
        const firstFree = HIERARCHY_OPTIONS.find(h => !used.has(h)) ?? 2;

        setPersonas(prev => [
            ...prev,
            { displayName: "", hierarchy: firstFree, lockedCreator: false }
        ]);
    };

    // Ensure each row only offers hierarchy numbers not already used by other rows (plus its own)
    const hierarchyOptionsForRow = (idx) => {
        const thisH = Number(personas[idx].hierarchy);
        const usedByOthers = new Set(
            personas
                .filter((_, i) => i !== idx)
                .map(p => Number(p.hierarchy))
        );

        return HIERARCHY_OPTIONS.filter(h => h === thisH || !usedByOthers.has(h));
    };

    const validate = () => {
        setError("");
        setSuccess("");

        if (!name.trim()) return "Campaign Name is required.";
        if (personas.length < 2) return "At least 2 personas are required.";

        const creator = personas.find(p => Number(p.hierarchy) === 1);
        if (!creator) return "A persona at hierarchy 1 is required.";

        if (personas.some(p => !p.displayName?.trim()))
            return "All personas must have a display name.";

        const hier = personas.map(p => Number(p.hierarchy));
        const set = new Set(hier);
        if (set.size !== hier.length)
            return "Each persona must have a unique hierarchy number.";

        if (personas.some(p => !p.lockedCreator && Number(p.hierarchy) === 1))
            return "Hierarchy 1 is reserved for the Creator persona.";

        if (Number(joinHierarchy) === 1)
            return "Join persona cannot be the Creator persona.";

        if (!personas.some(p => Number(p.hierarchy) === Number(joinHierarchy)))
            return "Join persona must match one of the personas in the list.";

        if (joinPassword && joinPassword !== joinPasswordConfirm)
            return "Join password confirmation does not match.";

        return null;
    };

    const handleSubmit = async () => {
        const msg = validate();
        if (msg) {
            setError(msg);
            return;
        }

        try {
            setError("");
            setSuccess("");

            const payload = {
                name: name.trim(),
                description: description || "",
                campaignJoinPassword: joinPassword || "",
                campaignJoinPersonaHierarchy: Number(joinHierarchy),
                personas: personas.map(p => ({
                    displayName: p.displayName.trim(),
                    hierarchy: Number(p.hierarchy)
                }))
            };

            const result = await UserService.CreateCampaign(payload);

            const me = await UserService.Me();
            props.setUser(me);

            setSuccess("Campaign created successfully.");
            navigate(`/campaigns/${result.campaignId}`);
        } catch (e) {
            setError(e?.message || "Failed to create campaign.");
        }
    };

    // Keep joinHierarchy valid if personas change
    useEffect(() => {
        const nonCreator = personas.filter(p => Number(p.hierarchy) !== 1);
        if (nonCreator.length === 0) return;

        const exists = personas.some(p => Number(p.hierarchy) === Number(joinHierarchy));
        if (!exists || Number(joinHierarchy) === 1) {
            setJoinHierarchy(Number(nonCreator[0].hierarchy));
        }
    }, [personas]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <Box sx={{ p: 3 }} component="form" autoComplete="off">
            <Typography variant="h4" sx={{ mb: 2, fontWeight: 700 }}>
                Create Campaign
            </Typography>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

            <Card elevation={2}>
                <CardContent>
                    {/* ✅ Single vertical column layout */}
                    <Stack spacing={2}>
                        {/* Campaign fields */}
                        <TextField
                            fullWidth
                            label="Campaign Name (required)"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            autoComplete="off"
                            inputProps={{ autoComplete: "new-password", name: "campaignName" }}
                        />

                        <TextField
                            fullWidth
                            label="Description (optional)"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            multiline
                            minRows={2}
                            autoComplete="off"
                            inputProps={{ autoComplete: "new-password", name: "campaignDescription" }}
                        />

                        {/* Personas section beneath */}
                        <Divider />
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                            Personas (2–10)
                        </Typography>
                        <Typography sx={{ color: "text.secondary" }}>
                            Persona hierarchy values must be unique. Hierarchy 1 is reserved for the Creator persona.
                        </Typography>

                        {/* ✅ One persona per line within this section */}
                        <Stack spacing={1.5}>
                            {personas.map((p, idx) => (
                                <Grid
                                    key={idx}
                                    container
                                    spacing={2}
                                    alignItems="center"
                                    sx={{ width: "100%" }}
                                >
                                    {/* Name column */}
                                    <Grid item xs={12} md={7}>
                                        <TextField
                                            fullWidth
                                            label={p.lockedCreator ? "Creator Persona Name (Hierarchy 1)" : "Persona Name"}
                                            value={p.displayName}
                                            onChange={(e) => setPersonaField(idx, "displayName", e.target.value)}
                                            autoComplete="off"
                                            inputProps={{ autoComplete: "new-password", name: `personaName_${idx}` }}
                                        />
                                    </Grid>

                                    {/* Hierarchy column — TRUE fixed width */}
                                    <Grid
                                        item
                                        xs={12}
                                        md="auto"
                                        sx={{ display: "flex", justifyContent: "center" }}
                                    >
                                        <Box sx={{ width: 180 }}>
                                            {p.lockedCreator ? (
                                                <TextField
                                                    fullWidth
                                                    label="Hierarchy"
                                                    value={1}
                                                    disabled
                                                />
                                            ) : (
                                                <FormControl fullWidth>
                                                    <InputLabel id={`hierLabel_${idx}`}>Hierarchy</InputLabel>
                                                    <Select
                                                        labelId={`hierLabel_${idx}`}
                                                        label="Hierarchy"
                                                        value={Number(p.hierarchy)}
                                                        onChange={(e) => setPersonaField(idx, "hierarchy", Number(e.target.value))}
                                                    >
                                                        {hierarchyOptionsForRow(idx).map(h => (
                                                            <MenuItem key={h} value={h}>{h}</MenuItem>
                                                        ))}
                                                    </Select>
                                                </FormControl>
                                            )}
                                        </Box>
                                    </Grid>

                                    {/* Trash column — fixed width */}
                                    <Grid
                                        item
                                        xs={12}
                                        md="auto"
                                        sx={{
                                            width: 64,
                                            display: "flex",
                                            justifyContent: "center",
                                            alignItems: "center"
                                        }}
                                    >
                                        <IconButton
                                            onClick={() => removePersona(idx)}
                                            disabled={p.lockedCreator}
                                            title={p.lockedCreator ? "Creator persona cannot be removed" : "Remove persona"}
                                        >
                                            <DeleteIcon />
                                        </IconButton>
                                    </Grid>
                                </Grid>
                            ))}


                            {/* ✅ Add button beneath bottom persona and disappears at 10 */}
                            {canAddPersona && (
                                <Box>
                                    <Button
                                        startIcon={<AddIcon />}
                                        variant="outlined"
                                        onClick={addPersona}
                                    >
                                        Add Persona (max 10)
                                    </Button>
                                </Box>
                            )}
                        </Stack>

                        {/* Password fields BELOW personas */}
                        <Divider />
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                            Optional Join Password
                        </Typography>

                        <TextField
                            fullWidth
                            label="Join Password (optional)"
                            type="password"
                            value={joinPassword}
                            onChange={(e) => {
                                setJoinPassword(e.target.value);
                                if (!e.target.value) setJoinPasswordConfirm("");
                            }}
                            autoComplete="new-password"
                            inputProps={{ name: "campaignJoinPassword" }}
                        />

                        <TextField
                            fullWidth
                            label="Confirm Join Password"
                            type="password"
                            value={joinPasswordConfirm}
                            onChange={(e) => setJoinPasswordConfirm(e.target.value)}
                            disabled={!joinPassword}
                            autoComplete="new-password"
                            inputProps={{ name: "campaignJoinPasswordConfirm" }}
                        />

                        {/* Create button at bottom */}
                        <Button
                            variant="contained"
                            size="large"
                            onClick={handleSubmit}
                            sx={{ fontWeight: 700 }}
                        >
                            Create Campaign
                        </Button>
                    </Stack>
                </CardContent>
            </Card>
        </Box>
    );
}
