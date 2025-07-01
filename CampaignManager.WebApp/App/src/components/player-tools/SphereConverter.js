import React, { useState, useEffect } from 'react';
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
    Paper,
    Alert,
    Stack
} from '@mui/material';

const GEM_VALUES = {
    garnet: { chip: 0.01, mark: 0.1, broam: 0.5, skymark: 1 },
    zircon: { chip: 0.01, mark: 0.1, broam: 0.5, skymark: 1 },
    smokestone: { chip: 0.01, mark: 0.1, broam: 0.5, skymark: 1 },
    topaz: { chip: 0.05, mark: 0.5, broam: 2, skymark: 5 },
    heliodor: { chip: 0.05, mark: 0.5, broam: 2, skymark: 5 },
    ruby: { chip: 0.2, mark: 1, broam: 5, skymark: 10 },
    amethyst: { chip: 0.1, mark: 1, broam: 5, skymark: 10 },
    sapphire: { chip: 0.5, mark: 2, broam: 10, skymark: 25 },
    emerald: { chip: 1, mark: 4, broam: 15, skymark: 30 },
    diamond: { chip: 2, mark: 5, broam: 25, skymark: 100 }
};

const COIN_DENOMINATIONS = [
    { name: 'pp', value: 10 },
    { name: 'gp', value: 1 },
    { name: 'ep', value: 0.5 },
    { name: 'sp', value: 0.1 },
    { name: 'cp', value: 0.01 }
];

const sphereSizes = ['chip', 'mark', 'broam', 'skymark'];
const gemstones = Object.keys(GEM_VALUES);

export const SphereConverter = () => {
    const [mode, setMode] = useState('Spheres to Coinage');
    const [entries, setEntries] = useState([{ gemstone: 'garnet', size: 'chip', qty: 1 }]);
    const [coinInput, setCoinInput] = useState({ pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 });
    const [gemPreference, setGemPreference] = useState('any');
    const [result, setResult] = useState(null);
    const [remainder, setRemainder] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [omitPlatinum, setOmitPlatinum] = useState(false);
    const [omitElectrum, setOmitElectrum] = useState(false);

    useEffect(() => {
        if (
            (mode === 'Spheres to Coinage' || mode === 'Spheres to Other Spheres') &&
            entries.length === 0
        ) {
            addEntry();
        }
    }, [mode, entries]);

    const addEntry = () => {
        setEntries(prev => [...prev, { gemstone: 'garnet', size: 'chip', qty: 1 }]);
    };

    const clearEntries = () => {
        setEntries([]);
    };

    const updateEntry = (index, field, value) => {
        const updated = [...entries];
        updated[index][field] = field === 'qty' ? parseInt(value) : value;
        setEntries(updated);
    };

    const handleOmitPlatinumChange = (e) => {
        const checked = e.target.checked;
        setOmitPlatinum(checked);
        if (result && mode === 'Spheres to Coinage') {
            setLoading(true);
            setTimeout(() => {
                convertSpheresToCoinage(checked, omitElectrum);
                setLoading(false);
            }, 100);
        }
    };

    const handleOmitElectrumChange = (e) => {
        const checked = e.target.checked;
        setOmitElectrum(checked);
        if (result && mode === 'Spheres to Coinage') {
            setLoading(true);
            setTimeout(() => {
                convertSpheresToCoinage(omitPlatinum, checked);
                setLoading(false);
            }, 100);
        }
    };

    const handleConversion = () => {
        setLoading(true);
        setError('');
        setRemainder(null);
        setResult(null);

        setTimeout(() => {
            if (mode === 'Spheres to Coinage') convertSpheresToCoinage();
            else if (mode === 'Coinage to Spheres') convertCoinageToSpheres();
            else if (mode === 'Spheres to Other Spheres') convertSpheresToOtherSpheres();
            setLoading(false);
        }, 100);
    };

    const formatResult = (res, isCoin = false) => {
        if (isCoin) {
            const coinOrder = ['pp', 'gp', 'ep', 'sp', 'cp'];
            return coinOrder
                .filter(coin => res[coin] > 0)
                .map(coin => `${res[coin]} ${coin}`)
                .join(', ');
        } else {
            const sizeOrder = { skymark: 4, broam: 3, mark: 2, chip: 1 };
            return [...res]
                .sort((a, b) => {
                    if (a.gemstone === b.gemstone) {
                        return sizeOrder[b.size] - sizeOrder[a.size];
                    }
                    return a.gemstone.localeCompare(b.gemstone);
                })
                .map(({ gemstone, size, qty }) => `${qty} ${gemstone} ${size}${qty > 1 ? 's' : ''}`)
                .join(', ');
        }
    };

    const convertSpheresToCoinage = (
        omitPlatinumOverride = omitPlatinum,
        omitElectrumOverride = omitElectrum
    ) => {
        let total = 0;
        entries.forEach(({ gemstone, size, qty }) => {
            total += GEM_VALUES[gemstone][size] * qty;
        });
        let remaining = total;
        const result = {};
        for (const { name, value } of COIN_DENOMINATIONS) {
            const omitCoin =
                (omitPlatinumOverride && name === 'pp') ||
                (omitElectrumOverride && name === 'ep');
            if (omitCoin) continue;
            result[name] = Math.floor(remaining / value);
            remaining = +(remaining % value).toFixed(2);
        }
        setResult(result);
    };

    const convertCoinageToSpheres = () => {
        let total = 0;
        for (const [key, val] of Object.entries(coinInput)) {
            const coin = COIN_DENOMINATIONS.find(c => c.name === key);
            total += val * coin.value;
        }

        if (gemPreference === 'any') {
            const options = [];
            gemstones.forEach(gem =>
                sphereSizes.forEach(size =>
                    options.push({ gemstone: gem, size, value: GEM_VALUES[gem][size] })
                )
            );
            options.sort((a, b) => b.value - a.value);
            const output = [];

            for (const { gemstone, size, value } of options) {
                const count = Math.floor(total / value);
                if (count > 0) {
                    output.push({ gemstone, size, qty: count });
                    total = +(total % value).toFixed(2);
                }
            }
            setResult(output);
            return;
        }

        const output = [];
        for (let i = sphereSizes.length - 1; i >= 0; i--) {
            const value = GEM_VALUES[gemPreference][sphereSizes[i]];
            const count = Math.floor(total / value);
            if (count > 0) {
                output.push({ gemstone: gemPreference, size: sphereSizes[i], qty: count });
                total = +(total % value).toFixed(2);
            }
        }
        setResult(output);
    };

    const convertSpheresToOtherSpheres = () => {
        let totalGp = 0;
        entries.forEach(({ gemstone, size, qty }) => {
            totalGp += GEM_VALUES[gemstone][size] * qty;
        });

        if (gemPreference === 'any') {
            const options = [];
            gemstones.forEach(gem =>
                sphereSizes.forEach(size =>
                    options.push({ gemstone: gem, size, value: GEM_VALUES[gem][size] })
                )
            );
            options.sort((a, b) => b.value - a.value);
            const output = [];

            for (const { gemstone, size, value } of options) {
                const count = Math.floor(totalGp / value);
                if (count > 0) {
                    output.push({ gemstone, size, qty: count });
                    totalGp = +(totalGp % value).toFixed(2);
                }
            }
            setResult(output);
            return;
        }

        const output = [];
        let remaining = totalGp;
        let found = false;

        for (let i = sphereSizes.length - 1; i >= 0; i--) {
            const val = GEM_VALUES[gemPreference][sphereSizes[i]];
            const count = Math.floor(remaining / val);
            if (count > 0) {
                output.push({ gemstone: gemPreference, size: sphereSizes[i], qty: count });
                remaining = +(remaining % val).toFixed(2);
                found = true;
            }
        }

        if (!found) {
            setResult(null);
            setError('Not enough value to convert into any target spheres.');
            return;
        }

        const alt = [];
        for (let i = sphereSizes.length - 1; i >= 0; i--) {
            for (let gem of gemstones) {
                if (GEM_VALUES[gemPreference]["chip"] <= GEM_VALUES[gem][sphereSizes[i]]) continue;
                const val = GEM_VALUES[gem][sphereSizes[i]];
                const count = Math.floor(remaining / val);
                if (count > 0) {
                    alt.push({ gemstone: gem, size: sphereSizes[i], qty: count });
                    remaining = +(remaining % val).toFixed(2);
                }
            }
        }

        setResult(output);
        if (alt.length > 0) setRemainder(alt);
    };

    return (
        <Box sx={{ p: 4, maxWidth: 800, mx: 'auto' }}>
            <Typography variant="h4" gutterBottom>Sphere Converter</Typography>
            <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>Mode</InputLabel>
                <Select
                    value={mode}
                    label="Mode"
                    onChange={e => {
                        setMode(e.target.value);
                        setResult(null);
                        setError('');
                        setRemainder(null);
                    }}
                >
                    <MenuItem value="Spheres to Coinage">Spheres to Coinage</MenuItem>
                    <MenuItem value="Coinage to Spheres">Coinage to Spheres</MenuItem>
                    <MenuItem value="Spheres to Other Spheres">Spheres to Other Spheres</MenuItem>
                </Select>
            </FormControl>

            {/* Input Rows */}
            {(mode === 'Spheres to Coinage' || mode === 'Spheres to Other Spheres') && entries.map((entry, i) => (
                <Grid container spacing={2} key={i} sx={{ mb: 2 }}>
                    <Grid item xs={4}>
                        <FormControl fullWidth>
                            <InputLabel>Gemstone</InputLabel>
                            <Select
                                value={entry.gemstone}
                                label="Gemstone"
                                onChange={e => updateEntry(i, 'gemstone', e.target.value)}
                            >
                                {gemstones.map(gem => (
                                    <MenuItem key={gem} value={gem}>{gem}</MenuItem>
                                ))}
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
                                {sphereSizes.map(size => (
                                    <MenuItem key={size} value={size}>{size}</MenuItem>
                                ))}
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

            {/* Coin input fields */}
            {mode === 'Coinage to Spheres' && (
                <Grid container spacing={2} sx={{ mb: 2 }}>
                    {COIN_DENOMINATIONS.map(({ name }) => (
                        <Grid item xs={2.4} key={name}>
                            <TextField
                                label={name.toUpperCase()}
                                type="number"
                                fullWidth
                                value={coinInput[name]}
                                onChange={e => setCoinInput({ ...coinInput, [name]: parseInt(e.target.value) || 0 })}
                            />
                        </Grid>
                    ))}
                </Grid>
            )}

            {/* Gem preference selector */}
            {(mode === 'Coinage to Spheres' || mode === 'Spheres to Other Spheres') && (
                <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Gem Preference</InputLabel>
                    <Select
                        value={gemPreference}
                        label="Gem Preference"
                        onChange={e => setGemPreference(e.target.value)}
                    >
                        <MenuItem value="any">Any (fewest spheres)</MenuItem>
                        {gemstones.map(g => (
                            <MenuItem key={g} value={g}>{g}</MenuItem>
                        ))}
                    </Select>
                </FormControl>
            )}

            {/* Action buttons */}
            <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                <Button variant="contained" onClick={addEntry}>Add Row</Button>
                <Button variant="outlined" color="error" onClick={clearEntries}>Remove All Rows</Button>
                <Button variant="contained" color="success" onClick={handleConversion}>Convert</Button>
            </Stack>

            {/* Optional checkboxes */}
            {(mode === 'Spheres to Coinage') && (
                <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                    <FormControl>
                        <label>
                            <input
                                type="checkbox"
                                checked={omitPlatinum}
                                onChange={handleOmitPlatinumChange}
                            /> Omit Platinum (pp)
                        </label>
                    </FormControl>
                    <FormControl>
                        <label>
                            <input
                                type="checkbox"
                                checked={omitElectrum}
                                onChange={handleOmitElectrumChange}
                            /> Omit Electrum (ep)
                        </label>
                    </FormControl>
                </Stack>
            )}

            {error && (
                <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>
            )}

            {loading && (
                <Alert severity="info" sx={{ mb: 2 }}>Converting...</Alert>
            )}

            {result && (
                <Paper sx={{ p: 2, mb: 2 }}>
                    <Typography variant="h6">Conversion Result:</Typography>
                    <Typography>{formatResult(result, typeof result === 'object' && !Array.isArray(result))}</Typography>
                </Paper>
            )}

            {remainder && (
                <Paper sx={{ p: 2, backgroundColor: '#fff8e1' }}>
                    <Typography variant="h6">Suggested Remainder in Lesser Spheres:</Typography>
                    <Typography>{formatResult(remainder)}</Typography>
                </Paper>
            )}
        </Box>
    );
};

export default SphereConverter;
