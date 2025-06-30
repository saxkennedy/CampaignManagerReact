import React, { useState } from 'react';
import {
    Box,
    Button,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    TextField,
    Typography,
    Grid,
    Paper
} from '@mui/material';

// Gemstone values per denomination (in gold piece equivalents)
const GEM_VALUES = {
    garnet: { chip: 0.01, mark: 0.1, broam: 0.5, skymark: 1 },
    zircon: { chip: 0.01, mark: 0.1, broam: 0.5, skymark: 1 },
    smokestone: { chip: 0.01, mark: 0.1, broam: 0.5, skymark: 1 },
    topaz: { chip: 0.05, mark: 0.5, broam: 2, skymark: 5 },
    heliodor: { chip: 0.05, mark: 0.5, broam: 2, skymark: 5 },
    ruby: { chip: 0.2, mark: 1, broam: 5, skymark: 10 },
    amethyst: { chip: 0.1, mark: 1, broam: 5, skymark: 10 },
    sapphire: { chip: 0.5, mark: 2, broam: 10, skymark: 25 },
    emerald: { chip: 1, mark: 2, broam: 10, skymark: 25 },
    diamond: { chip: 2, mark: 5, broam: 25, skymark: 100 },
};

const COIN_DENOMINATIONS = [
    { name: 'pp', value: 100 },
    { name: 'gp', value: 1 },
    { name: 'ep', value: 0.5 },
    { name: 'sp', value: 0.1 },
    { name: 'cp', value: 0.01 },
];

const sphereSizes = ['chip', 'mark', 'broam', 'skymark'];
const gemstones = Object.keys(GEM_VALUES);
const modes = ['Spheres to Coinage', 'Coinage to Spheres', 'Spheres to Other Spheres'];

export const SphereConverter = () => {
    const [mode, setMode] = useState(modes[0]);
    const [entries, setEntries] = useState([{ gemstone: 'garnet', size: 'chip', qty: 1 }]);
    const [coinInput, setCoinInput] = useState({ pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 });
    const [gemPreference, setGemPreference] = useState('any');
    const [result, setResult] = useState(null);

    const addEntry = () => {
        setEntries([...entries, { gemstone: 'garnet', size: 'chip', qty: 1 }]);
    };

    const updateEntry = (index, field, value) => {
        const updated = [...entries];
        updated[index][field] = field === 'qty' ? parseInt(value) : value;
        setEntries(updated);
    };

    const handleConversion = () => {
        if (mode === modes[0]) convertSpheresToCoinage();
        else if (mode === modes[1]) convertCoinageToSpheres();
        else if (mode === modes[2]) convertSpheresToOtherSpheres();
    };

    const convertSpheresToCoinage = () => {
        let totalGp = 0;
        entries.forEach(({ gemstone, size, qty }) => {
            totalGp += GEM_VALUES[gemstone][size] * qty;
        });
        let remaining = totalGp;
        const coinResult = {};
        for (let { name, value } of COIN_DENOMINATIONS) {
            coinResult[name] = Math.floor(remaining / value);
            remaining = +(remaining % value).toFixed(2);
        }
        setResult(coinResult);
    };

    const convertCoinageToSpheres = () => {
        let totalGp = 0;
        for (let [key, val] of Object.entries(coinInput)) {
            const coin = COIN_DENOMINATIONS.find(c => c.name === key);
            totalGp += val * coin.value;
        }
        let output = [];
        const gemstoneList = gemPreference === 'any' ? gemstones : [gemPreference];
        for (let i = sphereSizes.length - 1; i >= 0; i--) {
            for (let gem of gemstoneList) {
                const val = GEM_VALUES[gem][sphereSizes[i]];
                const count = Math.floor(totalGp / val);
                if (count > 0) {
                    output.push({ gemstone: gem, size: sphereSizes[i], qty: count });
                    totalGp = +(totalGp % val).toFixed(2);
                    break;
                }
            }
        }
        setResult(output);
    };

    const convertSpheresToOtherSpheres = () => {
        let totalGp = 0;
        entries.forEach(({ gemstone, size, qty }) => {
            totalGp += GEM_VALUES[gemstone][size] * qty;
        });
        const output = [];
        const gemstoneList = gemPreference === 'any' ? gemstones : [gemPreference];
        for (let i = sphereSizes.length - 1; i >= 0; i--) {
            for (let gem of gemstoneList) {
                const val = GEM_VALUES[gem][sphereSizes[i]];
                const count = Math.floor(totalGp / val);
                if (count > 0) {
                    output.push({ gemstone: gem, size: sphereSizes[i], qty: count });
                    totalGp = +(totalGp % val).toFixed(2);
                    break;
                }
            }
        }
        setResult(output);
    };

    return (
        <Box sx={{ p: 4, maxWidth: 800, mx: 'auto' }}>
            <Typography variant="h4" gutterBottom>Sphere Converter</Typography>

            <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>Mode</InputLabel>
                <Select value={mode} label="Mode" onChange={e => setMode(e.target.value)}>
                    {modes.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                </Select>
            </FormControl>

            {(mode === modes[0] || mode === modes[2]) && entries.map((entry, i) => (
                <Grid container spacing={2} key={i} sx={{ mb: 2 }}>
                    <Grid item xs={4}>
                        <FormControl fullWidth>
                            <InputLabel>Gemstone</InputLabel>
                            <Select
                                value={entry.gemstone}
                                label="Gemstone"
                                onChange={e => updateEntry(i, 'gemstone', e.target.value)}
                            >
                                {gemstones.map(g => <MenuItem key={g} value={g}>{g}</MenuItem>)}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={4}>
                        <FormControl fullWidth>
                            <InputLabel>Size</InputLabel>
                            <Select
                                value={entry.size}
                                label="Size"
                                onChange={e => updateEntry(i, 'size', e.target.value)}
                            >
                                {sphereSizes.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={4}>
                        <TextField
                            label="Quantity"
                            type="number"
                            fullWidth
                            value={entry.qty}
                            onChange={e => updateEntry(i, 'qty', e.target.value)}
                        />
                    </Grid>
                </Grid>
            ))}

            {(mode === modes[0] || mode === modes[2]) && (
                <Button variant="contained" onClick={addEntry} sx={{ mb: 3 }}>Add Row</Button>
            )}

            {mode === modes[1] && (
                <Grid container spacing={2} sx={{ mb: 3 }}>
                    {COIN_DENOMINATIONS.map(c => (
                        <Grid item xs={2.4} key={c.name}>
                            <TextField
                                label={c.name.toUpperCase()}
                                type="number"
                                fullWidth
                                value={coinInput[c.name]}
                                onChange={e => setCoinInput({ ...coinInput, [c.name]: parseInt(e.target.value) || 0 })}
                            />
                        </Grid>
                    ))}
                </Grid>
            )}

            {(mode === modes[1] || mode === modes[2]) && (
                <FormControl fullWidth sx={{ mb: 3 }}>
                    <InputLabel>{mode === modes[1] ? 'Gem Preference' : 'Target Gem Type'}</InputLabel>
                    <Select value={gemPreference} label="Gem Preference" onChange={e => setGemPreference(e.target.value)}>
                        <MenuItem value="any">Any (fewest spheres)</MenuItem>
                        {gemstones.map(g => <MenuItem key={g} value={g}>{g}</MenuItem>)}
                    </Select>
                </FormControl>
            )}

            <Button variant="contained" color="success" onClick={handleConversion} sx={{ mb: 3 }}>Convert</Button>

            {result && (
                <Paper sx={{ p: 2 }}>
                    <Typography variant="h6">Conversion Result:</Typography>
                    <pre>{JSON.stringify(result, null, 2)}</pre>
                </Paper>
            )}
        </Box>
    );
};

export default SphereConverter;
