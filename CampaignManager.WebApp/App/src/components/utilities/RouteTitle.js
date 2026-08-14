// Tab titles for the fixed routes, in one place rather than a line in each of
// a dozen page components. Renders nothing.
import { useLocation } from 'react-router-dom';
import useDocumentTitle, { SITE_TITLE, titleFrom } from './useDocumentTitle';

// Keys are lower-cased paths. Campaign routes are deliberately absent: those
// pages title themselves from the content or bastion they end up loading, and
// a static entry here would race them for it.
const STATIC_TITLES = {
    '/login': 'Sign In',
    '/register': 'Register',
    '/verify': 'Verify Email',
    '/forgot-password': 'Forgot Password',
    '/reset-password': 'Reset Password',
    '/change-password': 'Change Password',
    '/sphereconverter': 'Sphere Converter',
    '/bastionfacilities': 'Bastion Facilities',
    '/datatools': 'Admin Tools',
    '/join': 'Join a Campaign',
    '/create': 'Create a Campaign',
    // /dashboard is the site's own landing page, so the site name says it all.
};

export default function RouteTitle() {
    const { pathname } = useLocation();
    const path = pathname.toLowerCase().replace(/\/+$/, '') || '/';
    const ownedByPage = path.startsWith('/campaigns');

    useDocumentTitle(ownedByPage ? null : titleFrom(STATIC_TITLES[path], SITE_TITLE));

    return null;
}
