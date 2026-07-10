import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button } from '@mui/material';

// Reusable in-app confirmation modal (replaces window.confirm).
// Drive it with a nullable state object and render one per screen.
export default function ConfirmDialog({
    open,
    title = 'Are you sure?',
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    confirmColor = 'primary',
    busy = false,
    onConfirm,
    onClose,
}) {
    return (
        <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
            <DialogTitle>{title}</DialogTitle>
            {message != null && (
                <DialogContent>
                    <DialogContentText component="div">{message}</DialogContentText>
                </DialogContent>
            )}
            <DialogActions>
                <Button onClick={onClose} disabled={busy}>{cancelLabel}</Button>
                <Button variant="contained" color={confirmColor} onClick={onConfirm} disabled={busy}>
                    {busy ? 'Working…' : confirmLabel}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
