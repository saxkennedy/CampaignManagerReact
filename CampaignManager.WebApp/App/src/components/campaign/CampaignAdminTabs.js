import React, { useMemo, useState } from 'react';
import { Box, Card, CardHeader, Divider, Tabs, Tab, Typography } from '@mui/material';
import CampaignAdmin from './CampaignAdmin';
import PersonaManagement from './PersonaManagement';
import ReassignUsers from './ReassignUsers';
import { getAdminCapabilities } from './campaignPermissions';

// Tabbed shell for Campaign Administration. Each tab is shown only if the user
// holds the relevant permission in this campaign.
const CampaignAdminTabs = ({ campaignId, user }) => {
    const caps = useMemo(() => getAdminCapabilities(user, campaignId), [user, campaignId]);

    const tabs = useMemo(() => {
        const t = [];
        if (caps.canManageContent) t.push({ key: 'content', label: 'Content' });
        if (caps.canManagePersonas) t.push({ key: 'personas', label: 'Personas' });
        if (caps.canReassignUsers) t.push({ key: 'reassign', label: 'Users' });
        return t;
    }, [caps]);

    const [active, setActive] = useState(0);
    const idx = Math.min(active, Math.max(tabs.length - 1, 0));
    const current = tabs[idx]?.key;

    return (
        <Box sx={{ width: '100%' }}>
            <Card>
                <CardHeader title="Campaign Administration" subheader={`Campaign ID: ${campaignId}`} />
                <Divider />
                {tabs.length === 0 ? (
                    <Box sx={{ p: 3 }}>
                        <Typography color="text.secondary">
                            You don't have administrative permissions for this campaign.
                        </Typography>
                    </Box>
                ) : (
                    <>
                        <Tabs value={idx} onChange={(e, v) => setActive(v)} sx={{ px: 2 }}>
                            {tabs.map((t) => <Tab key={t.key} label={t.label} />)}
                        </Tabs>
                        <Divider />
                        <Box sx={{ p: 2 }}>
                            {current === 'content' && <CampaignAdmin campaignId={campaignId} />}
                            {current === 'personas' && <PersonaManagement campaignId={campaignId} />}
                            {current === 'reassign' && <ReassignUsers campaignId={campaignId} />}
                        </Box>
                    </>
                )}
            </Card>
        </Box>
    );
};

export default CampaignAdminTabs;
