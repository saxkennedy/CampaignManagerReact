// components/campaign/CampaignDashboard.js
import React from 'react';
import { List, ListItem, ListItemText, Collapse, Box, IconButton, Menu, MenuItem } from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useParams, useLocation, useNavigate, useMatch } from 'react-router-dom';
import ContentViewer from '../utilities/ContentViewer';
import CampaignAdminTabs from './CampaignAdminTabs';
import CampaignContentService from '../../api/CampaignContentService';
import PotionLoader from '../utilities/PotionLoader';
import MyCharacters from './MyCharacters';
import { getAdminCapabilities, getCampaignName, isCampaignMember, NO_ACCESS_NOTICE } from './campaignPermissions';
import useDocumentTitle, { SITE_TITLE, titleFrom } from '../utilities/useDocumentTitle';
import {
    sidebarSx,
    sidebarPrimarySx,
    sidebarOutlinedSx,
    sidebarMutedSx,
    treeItemSx,
    treeDisabledSx,
    chevronButtonSx,
    menuPaperSx,
} from '../../theme/soulslike';

// ---------- helpers ----------
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
            (pick(a.raw, 'DisplayName', 'displayName') || '').localeCompare(
                pick(b.raw, 'DisplayName', 'displayName') || ''
            )
        );
        nodes.forEach((n) => sortRec(n.children));
    };
    sortRec(roots);
    return roots;
};

// categorize a node to decide URL segment (items/npcs/shops or none)
const categorize = (raw) => {
    if (raw?.ContentType?.Type == "Item") return 'items';
    if (raw?.ContentType?.Type == "NPC") return 'npcs';
    if (raw?.ContentType?.Type == "Shop") return 'shops';

    return '';
};

// Map tree nodes to the nav shape your left pane expects
const mapToNavShape = (node) => {
    const displayName = pick(node.raw, 'DisplayName', 'displayName') || '';
    const contentLink = pick(node.raw, 'ContentLink', 'contentLink') || '';
    const accessHierarchyLevel = Number(
        pick(node.raw, 'AccessHierarchyLevel', 'accessHierarchyLevel')
    );
    const id = pick(node.raw, 'Id', 'id');
    const category = categorize(node.raw);

    return {
        id,
        category,
        displayName,
        contentLink,
        accessHierarchyLevel,
        editable: Boolean(pick(node.raw, 'Editable', 'editable')),
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
            // A node the user can't read is still kept when it has readable
            // children, but only as a folder — never with its own content.
            out.push({ ...n, contentLink: allowed ? n.contentLink : '', children: kids });
        }
    }
    return out;
};

// Compute the user's most-privileged hierarchy for this campaign (lower = more privileged)
const getUserHierarchyForCampaign = (user, campaignId) => {
    if (!user) return Infinity;
    if (user.isAdmin) return 1;

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

// Stable key for expand/collapse state. Ids are unique; fall back to the old
// composite key for the (unexpected) case of a node without one.
const nodeKey = (node, level = 0) =>
    node?.id
        ? `id:${String(node.id).toLowerCase()}`
        : `${node?.displayName}_${node?.contentLink || 'nolink'}_${level}`;

// child key -> ordered list of ancestor keys, so a deep link can open its branch
const buildAncestorIndex = (nodes) => {
    const map = new Map();
    const walk = (xs, trail) => {
        for (const n of xs) {
            const key = nodeKey(n);
            map.set(key, trail);
            if (n.children?.length) walk(n.children, [...trail, key]);
        }
    };
    walk(nodes || [], []);
    return map;
};

// Build a pretty URL for a node (root if no node)
const routeForNode = (campaignId, node) => {
    if (!node?.id) return `/campaigns/${campaignId}`;
    return node.category
        ? `/campaigns/${campaignId}/${node.category}/${node.id}`
        : `/campaigns/${campaignId}/${node.id}`;
};

// ---------- component ----------
export const CampaignDashboard = (props) => {
    const params = useParams();
    const location = useLocation();
    const navigate = useNavigate();

    // The URL is the source of truth — a pasted link must win over whichever
    // campaign happened to be active in this session.
    const campaignId =
        params.campaignId ??
        location.state?.campaignId ??
        props.activeCampaignId ??
        null;

    const user = props?.user;

    const [selectedRoute, setSelectedRoute] = React.useState(null);
    const [selectedTitle, setSelectedTitle] = React.useState('');
    const [selectedId, setSelectedId] = React.useState(null);
    const [selectedEditable, setSelectedEditable] = React.useState(false);
    // Derived from the URL rather than held in state: the content-selection effect
    // below runs on every navigation and would otherwise reset it mid-click.
    const adminMode = !!useMatch('/campaigns/:campaignId/admin');

    const [navData, setNavData] = React.useState([]); // dynamic replacement for realmsBetwixt
    // Which campaign navData actually describes — guards against acting on the
    // previous campaign's tree while a new one is still loading.
    const [navCampaignId, setNavCampaignId] = React.useState(null);
    const [expanded, setExpanded] = React.useState({});
    const [loading, setLoading] = React.useState(true);
    const [myCharsOpen, setMyCharsOpen] = React.useState(false);
    // Right-click target in the tree: { x, y, node }, or null when closed.
    const [navMenu, setNavMenu] = React.useState(null);

    // Permissions:
    // Campaign Administration shows for anyone holding an admin permission in this campaign.
    const canAdmin = React.useMemo(
        () => getAdminCapabilities(user, campaignId).canAdmin,
        [user, campaignId]
    );

    const userHierarchy = React.useMemo(
        () => getUserHierarchyForCampaign(user, campaignId),
        [user, campaignId]
    );

    // Tab title: whatever is on screen, then the campaign it belongs to. With
    // several documents from one campaign open at once, the document name is
    // the only thing that tells the tabs apart, so it leads.
    const campaignName = React.useMemo(
        () => getCampaignName(user, campaignId),
        [user, campaignId]
    );
    useDocumentTitle(
        titleFrom(adminMode ? 'Administration' : selectedTitle, campaignName || SITE_TITLE)
    );

    // A shared link may point at a campaign the viewer isn't part of: send them
    // to the dashboard with a notice rather than showing an empty campaign.
    React.useEffect(() => {
        if (!user || !campaignId) return;
        if (isCampaignMember(user, campaignId)) return;
        navigate('/dashboard', { replace: true, state: { notice: NO_ACCESS_NOTICE } });
    }, [user, campaignId, navigate]);

    // Load structure dynamically and shape it for the left nav
    React.useEffect(() => {
        let cancelled = false;
        const run = async () => {
            try {
                setLoading(true);
                if (!campaignId) {
                    setNavData([]);
                    setNavCampaignId(null);
                    return;
                }
                const resp = await CampaignContentService.getStructure(campaignId);
                const contents = pick(resp, 'CampaignContent', 'campaignContent') || [];

                const tree = buildTree(contents).map(mapToNavShape);
                const filtered = Number.isFinite(userHierarchy)
                    ? filterByAccess(tree, userHierarchy)
                    : [];
                if (!cancelled) {
                    setNavData(filtered);
                    setNavCampaignId(campaignId);
                }
            } catch {
                // No usable tree — a failed load must not be mistaken for
                // "this content doesn't exist for you".
                if (!cancelled) {
                    setNavData([]);
                    setNavCampaignId(null);
                }
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

    // fast index: id -> node
    const indexById = React.useMemo(() => {
        const map = new Map();
        const walk = (xs = []) =>
            xs.forEach((n) => {
                if (n?.id) map.set(String(n.id).toLowerCase(), n);
                if (n?.children?.length) walk(n.children);
            });
        walk(navData);
        return map;
    }, [navData]);

    // ancestors of every node, for opening a branch when arriving via a link
    const ancestorsByKey = React.useMemo(() => buildAncestorIndex(navData), [navData]);

    const openBranchTo = React.useCallback(
        (node) => {
            const trail = ancestorsByKey.get(nodeKey(node));
            if (!trail?.length) return;
            setExpanded((prev) => {
                const next = { ...prev };
                trail.forEach((k) => { next[k] = true; });
                return next;
            });
        },
        [ancestorsByKey]
    );

    // When user clicks a node in the tree: open doc and push pretty URL
    const handleNavigateNode = (node) => {
        if (!node?.contentLink) return;
        setSelectedRoute(node.contentLink);
        setSelectedTitle(node.displayName || 'Campaign Document');
        setSelectedId(node.id ?? null);
        setSelectedEditable(!!node.editable);

        // A parent with its own content opens that content *and* reveals its children.
        if (node.children?.length) {
            setExpanded((prev) => ({ ...prev, [nodeKey(node)]: true }));
        }

        // push a readable path (requires routes defined in App.js)
        if (campaignId) {
            const url = routeForNode(campaignId, node);
            navigate(url, { replace: false });
        }
    };

    // Right-click a row that carries content to open it elsewhere. Rows without
    // content — folders, and nodes filtered down to folders by access level —
    // fall through to the browser's own menu, since there is nothing to open.
    const handleNodeContextMenu = (e, node) => {
        if (!node?.contentLink || !campaignId) return;
        e.preventDefault();
        e.stopPropagation();
        setNavMenu({ x: e.clientX, y: e.clientY, node });
    };

    const openNavMenuTarget = (mode) => {
        const node = navMenu?.node;
        setNavMenu(null);
        if (!node) return;

        const url = `${window.location.origin}${routeForNode(campaignId, node)}`;
        // Chrome only detaches a real window when the feature string asks for
        // one; with nothing but noopener it reuses a tab.
        const features =
            mode === 'window'
                ? 'noopener,noreferrer,popup=yes,width=1100,height=900'
                : 'noopener,noreferrer';
        window.open(url, '_blank', features);
    };

    // Open content from URL on load or when params change
    React.useEffect(() => {
        if (!campaignId) return;

        // Support both /campaigns/:campaignId/:contentId
        //     and /campaigns/:campaignId/(items|npcs|shops)/:contentId
        const contentId = params.contentId || null;

        if (!contentId) {
            // campaign root (or the admin route) — nothing selected
            setSelectedRoute(null);
            setSelectedTitle('');
            setSelectedId(null);
            setSelectedEditable(false);
            return;
        }

        // Only judge reachability against this campaign's fully-loaded tree.
        if (loading || navCampaignId !== campaignId) return;

        const node = indexById.get(String(contentId).toLowerCase());
        if (!node) {
            // Either the content is gone or it sits above this user's access level.
            navigate('/dashboard', { replace: true, state: { notice: NO_ACCESS_NOTICE } });
            return;
        }

        setSelectedRoute(node.contentLink || null);
        setSelectedTitle(node.displayName || 'Campaign Document');
        setSelectedId(node.id ?? null);
        setSelectedEditable(!!node.editable);
        openBranchTo(node);
    }, [campaignId, params.contentId, indexById, loading, navCampaignId, navigate, openBranchTo]);

    const renderNode = (item, level = 0) => {
        const hasChildren = Array.isArray(item.children) && item.children.length > 0;
        const pad = { paddingLeft: level * 16 };
        const key = nodeKey(item, level);
        const isSelected =
            !!selectedId && String(selectedId).toLowerCase() === String(item.id).toLowerCase();

        if (hasChildren) {
            const isOpen = !!expanded[key];
            // A parent may carry content of its own. When it does, the row opens that
            // content and the chevron is the only thing that expands/collapses.
            const opensContent = !!item.contentLink;
            return (
                <div key={key}>
                    <ListItem
                        button
                        selected={isSelected}
                        onClick={() => (opensContent ? handleNavigateNode(item) : handleToggle(key))}
                        onContextMenu={(e) => handleNodeContextMenu(e, item)}
                        style={pad}
                        sx={treeItemSx}
                    >
                        <ListItemText primary={item.displayName} />
                        <IconButton
                            size="small"
                            aria-label={isOpen ? 'Collapse' : 'Expand'}
                            aria-expanded={isOpen}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleToggle(key);
                            }}
                            sx={chevronButtonSx(isOpen)}
                        >
                            <ChevronRightIcon fontSize="small" />
                        </IconButton>
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
                    selected={isSelected}
                    onClick={() => handleNavigateNode(item)}
                    onContextMenu={(e) => handleNodeContextMenu(e, item)}
                    style={pad}
                    sx={treeItemSx}
                >
                    <ListItemText primary={item.displayName} />
                </ListItem>
            );
        }

        return (
            <ListItem key={key} style={pad} disabled sx={treeDisabledSx}>
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
            <List component="nav" sx={sidebarSx}>
                {/* Admin button (only for hierarchy 1 in this campaign) */}
                {canAdmin && (
                    <ListItem
                        button
                        selected={adminMode}
                        onClick={() => {
                            setSelectedRoute(null);
                            if (campaignId) navigate(`/campaigns/${campaignId}/admin`);
                        }}
                        sx={sidebarPrimarySx}
                    >
                        <ListItemText primary="Campaign Administration" />
                    </ListItem>
                )}

                {/* Bastions (visible to all members; access enforced server-side) */}
                <ListItem
                    button
                    onClick={() => campaignId && navigate(`/campaigns/${campaignId}/bastions`)}
                    sx={sidebarOutlinedSx}
                >
                    <ListItemText primary="Bastions" />
                </ListItem>

                {/* My Characters (any member; edit your own character names) */}
                <ListItem
                    button
                    onClick={() => setMyCharsOpen(true)}
                    sx={sidebarMutedSx}
                >
                    <ListItemText primary="My Characters" />
                </ListItem>

                {/* Loading → Empty → Tree */}
                {loading ? (
                    <PotionLoader label="Brewing your lore…" labelColor="#cbb994" labelShadow="none" />
                ) : navData.length === 0 ? (
                    <ListItem disabled sx={treeDisabledSx}>
                        <ListItemText primary="No content available." />
                    </ListItem>
                ) : (
                    navData.map((item) => renderNode(item, 0))
                )}
            </List>

            {/* Right content area */}
            <Box sx={{ flex: 1, minWidth: 0, display: 'flex' }}>
                {adminMode ? (
                    <CampaignAdminTabs campaignId={campaignId} user={props.user} />
                ) : selectedRoute ? (
                    <ContentViewer
                        url={selectedRoute}
                        title={selectedTitle}
                        topOffset={0}
                        editable={selectedEditable}
                    />
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

            <Menu
                open={!!navMenu}
                onClose={() => setNavMenu(null)}
                anchorReference="anchorPosition"
                anchorPosition={navMenu ? { top: navMenu.y, left: navMenu.x } : undefined}
                // Without this the modal's scroll lock nudges the whole page
                // sideways by a scrollbar width every time the menu opens.
                disableScrollLock
                slotProps={{ paper: { sx: menuPaperSx } }}
            >
                <MenuItem onClick={() => openNavMenuTarget('tab')}>Open in New Tab</MenuItem>
                <MenuItem onClick={() => openNavMenuTarget('window')}>Open in New Window</MenuItem>
            </Menu>

            {campaignId && (
                <MyCharacters campaignId={campaignId} open={myCharsOpen} onClose={() => setMyCharsOpen(false)} />
            )}
        </Box>
    );
};

export default CampaignDashboard;
