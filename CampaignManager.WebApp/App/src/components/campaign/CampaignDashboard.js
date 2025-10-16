import React from 'react';
import { List, ListItem, ListItemText, Collapse, Box } from '@mui/material';
import { useParams, useLocation } from 'react-router-dom';
import ContentViewer from '../utilities/ContentViewer';
import CampaignAdmin from './CampaignAdmin';
import CampaignContentService from '../../api/CampaignContentService';
import PotionLoader from '../utilities/PotionLoader'; 

// ----- helpers -----
const pick = (obj, pascal, camel) => obj?.[pascal] ?? obj?.[camel];

// Build tree from flat list
const buildTree = (items) => {
    const byId = new Map();
    const roots = [];
    for (const it of items) {
        const id = pick(it, 'Id', 'id');
        if (!id) continue;
        byId.set(id, { id, raw: it, children: [] });
    }
    for (const it of items) {
        const id = pick(it, 'Id', 'id');
        const parentId = pick(it, 'ParentContentId', 'parentContentId');
        const node = byId.get(id);
        if (!node) continue;
        if (parentId && byId.has(parentId)) {
            byId.get(parentId).children.push(node);
        } else {
            roots.push(node);
        }
    }
    // sort by display name
    const sortRec = (nodes) => {
        nodes.sort((a, b) =>
            (pick(a.raw, 'DisplayName', 'displayName') || '')
                .localeCompare(pick(b.raw, 'DisplayName', 'displayName') || '')
        );
        nodes.forEach((n) => sortRec(n.children));
    };
    sortRec(roots);
    return roots;
};

// Map tree nodes to the nav shape your left pane expects
const mapToNavShape = (node) => {
    const displayName = pick(node.raw, 'DisplayName', 'displayName') || '';
    const contentLink = pick(node.raw, 'ContentLink', 'contentLink') || '';
    const accessHierarchyLevel = Number(
        pick(node.raw, 'AccessHierarchyLevel', 'accessHierarchyLevel')
    );
    return {
        displayName,
        contentLink,
        accessHierarchyLevel,
        children: (node.children || []).map(mapToNavShape),
    };
};

// Filter by user hierarchy: allow if userLevel <= itemLevel
const filterByAccess = (nodes, userLevel) => {
    const out = [];
    for (const n of nodes) {
        const kids = filterByAccess(n.children || [], userLevel);
        const allowed = Number.isFinite(n.accessHierarchyLevel)
            ? userLevel <= n.accessHierarchyLevel
            : true; // if missing, default to visible
        if (allowed || kids.length > 0) {
            out.push({ ...n, children: kids });
        }
    }
    return out;
};

// Compute the user's most-privileged hierarchy for this campaign (lower = more privileged)
const getUserHierarchyForCampaign = (user, campaignId) => {
    if (!user) return Infinity;
    if (user.isAdmin) return 1;

    // DM persona shortcut: treat as level 1 (can see everything)
    const isDM = user?.CampaignPersonas?.some(
        (cp) =>
            (!campaignId ||
                cp.CampaignId?.toLowerCase() === campaignId?.toLowerCase()) &&
            /dungeon\s*master/i.test(cp.CampaignPersonaName || '')
    );
    if (isDM) return 1;

    // Otherwise, take the minimum hierarchy number for this campaign (lower = more privileged)
    const levels = (user?.CampaignPersonas || [])
        .filter((cp) =>
            !campaignId
                ? true
                : cp.CampaignId?.toLowerCase() === campaignId?.toLowerCase()
        )
        .map((cp) => Number(cp.Hierarchy))
        .filter((v) => Number.isFinite(v));

    if (levels.length === 0) return Infinity; // no persona match: see nothing
    return Math.min(...levels);
};

export const CampaignDashboard = (props) => {
    const params = useParams();
    const location = useLocation();
    const campaignId =
        location.state?.campaignId ??
        props.activeCampaignId ??
        params.campaignId ??
        null;

    const user = props?.user;

    const [selectedRoute, setSelectedRoute] = React.useState(null);
    const [selectedTitle, setSelectedTitle] = React.useState('');
    const [adminMode, setAdminMode] = React.useState(false);

    const [navData, setNavData] = React.useState([]); // dynamic replacement for realmsBetwixt
    const [expanded, setExpanded] = React.useState({});
    const [loading, setLoading] = React.useState(true); // NEW

    // Permissions
    const canAdmin =
        !!(user?.isAdmin) ||
        !!user?.CampaignPersonas?.some(
            (cp) =>
                (!campaignId ||
                    cp.CampaignId?.toLowerCase() === campaignId?.toLowerCase()) &&
                /dungeon\s*master/i.test(cp.CampaignPersonaName || '')
        );

    const userHierarchy = React.useMemo(
        () => getUserHierarchyForCampaign(user, campaignId),
        [user, campaignId]
    );

    // Load structure dynamically and shape it for the left nav
    React.useEffect(() => {
        let cancelled = false;
        const run = async () => {
            try {
                setLoading(true);
                const resp = await CampaignContentService.getStructure(campaignId);
                const contents =
                    pick(resp, 'CampaignContent', 'campaignContent') || [];

                const tree = buildTree(contents).map(mapToNavShape);
                const filtered = Number.isFinite(userHierarchy)
                    ? filterByAccess(tree, userHierarchy)
                    : [];
                if (!cancelled) setNavData(filtered);
            } catch {
                if (!cancelled) setNavData([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        run();
        return () => {
            cancelled = true;
        };
    }, [campaignId, userHierarchy]);

    const handleToggle = (key) =>
        setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

    const handleNavigate = (route, title = 'Campaign Document') => {
        if (route) {
            setAdminMode(false);
            setSelectedRoute(route);
            setSelectedTitle(title);
        }
    };

    const renderNode = (item, level = 0) => {
        const hasChildren = Array.isArray(item.children) && item.children.length > 0;
        const pad = { paddingLeft: level * 16 };
        const key = `${item.displayName}_${item.contentLink || 'nolink'}_${level}`;

        if (hasChildren) {
            const isOpen = !!expanded[key];
            return (
                <div key={key}>
                    <ListItem button onClick={() => handleToggle(key)} style={pad}>
                        <ListItemText primary={item.displayName} />
                        {isOpen ? '^' : '>'}
                    </ListItem>
                    <Collapse in={isOpen} timeout="auto" unmountOnExit>
                        <List component="div" disablePadding>
                            {item.children.map((child) => renderNode(child, level + 1))}
                        </List>
                    </Collapse>
                </div>
            );
        }

        if (item.contentLink) {
            return (
                <ListItem
                    key={key}
                    button
                    onClick={() => handleNavigate(item.contentLink, item.displayName)}
                    style={pad}
                >
                    <ListItemText primary={item.displayName} />
                </ListItem>
            );
        }

        return (
            <ListItem key={key} style={pad} disabled>
                <ListItemText primary={item.displayName} />
            </ListItem>
        );
    };

    return (
        <Box
            sx={{
                pt: { xs: 7, sm: 8 },
                minHeight: '100vh',
                display: 'flex',
                gap: 2,
                p: { xs: 1, sm: 2 },
                backgroundColor: '#F6F0E1',
                backgroundImage:
                    'radial-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), radial-gradient(rgba(0,0,0,0.025) 1px, transparent 1px)',
                backgroundSize: '8px 8px, 16px 16px',
                backgroundPosition: '0 0, 4px 4px',
                boxSizing: 'border-box',
            }}
        >
            {/* Left sidenav */}
            <List
                component="nav"
                sx={{
                    width: 'fit-content',
                    minWidth: 240,
                    maxWidth: 400,
                    bgcolor: 'transparent',
                    boxSizing: 'border-box',
                }}
            >
                {/* Admin button (only for DMs/admins) */}
                {canAdmin && (
                    <ListItem
                        button
                        onClick={() => {
                            setAdminMode(true);
                            setSelectedRoute(null);
                        }}
                        sx={{
                            mb: 1,
                            borderRadius: 1.5,
                            backgroundColor: 'warning.main',
                            color: 'black',
                            fontWeight: 700,
                            '&:hover': { backgroundColor: 'warning.dark', color: 'white' },
                        }}
                    >
                        <ListItemText primary="Campaign Administration" />
                    </ListItem>
                )}

                {/* Loading → Empty → Tree */}
                {loading ? (
                    <PotionLoader label="Brewing your lore…" />
                ) : navData.length === 0 ? (
                    <ListItem disabled>
                        <ListItemText primary="No content available." />
                    </ListItem>
                ) : (
                    navData.map((item) => renderNode(item, 0))
                )}
            </List>

            {/* Right content area */}
            <Box sx={{ flex: 1, minWidth: 0, display: 'flex' }}>
                {adminMode ? (
                    <CampaignAdmin campaignId={campaignId} user={props.user?.Id} />
                ) : selectedRoute ? (
                    <ContentViewer url={selectedRoute} title={selectedTitle} topOffset={0} />
                ) : loading ? (
                    <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <PotionLoader label="Identifying ancient scripts…" minHeight={240} />
                    </Box>
                ) : (
                    <Box sx={{ p: 2, color: 'text.secondary' }}>
                        Select an item to view its content.
                    </Box>
                )}
            </Box>
        </Box>
    );
};

export default CampaignDashboard;
