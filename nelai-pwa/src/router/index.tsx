import { createBrowserRouter } from 'react-router-dom'
import { AppProviders } from '@/providers/AppProviders'
import MainLayout from '@/layouts/MainLayout'
import Home from '@/pages/Home'
import Accounts from '@/pages/Accounts'
import AccountDetail from '@/pages/AccountDetail'
import CreateAccount from '@/pages/CreateAccount'
import ImportAccount from '@/pages/ImportAccount'
import Send from '@/pages/Send'
import Receive from '@/pages/Receive'
import Transactions from '@/pages/Transactions'
import TransactionDetail from '@/pages/TransactionDetail'
import Networks from '@/pages/Networks'
import Contacts from '@/pages/Contacts'
import Documents from '@/pages/Documents'
import DocumentsNew from '@/pages/DocumentsNew'
import DocumentDetail from '@/pages/DocumentDetail'
import DocumentEditor from '@/pages/DocumentEditor'
import DocumentEditorEtherpad from '@/pages/DocumentEditorEtherpad'
import Emergencies from '@/pages/Emergencies'
import Settings from '@/pages/Settings'
import Identity from '@/pages/Identity'
import VerifyProcedence from '@/pages/VerifyProcedence'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import AuthGoogleCallback from '@/pages/AuthGoogleCallback'
import AuthEmailVerified from '@/pages/AuthEmailVerified'
import WorkspaceOrganization from '@/pages/WorkspaceOrganization'
import PlatformAdminLayout from '@/layouts/PlatformAdminLayout'
import PlatformOverview from '@/pages/platform/PlatformOverview'
import PlatformOrganizations from '@/pages/platform/PlatformOrganizations'
import PlatformUsers from '@/pages/platform/PlatformUsers'
import PlatformLlm from '@/pages/platform/PlatformLlm'

// Obtener el base path desde import.meta.env.BASE_URL (configurado por Vite)
// En desarrollo será '/', en producción será '/aura-pwa/' para GitHub Pages
const basename = import.meta.env.BASE_URL || '/'

export const router = createBrowserRouter([
  {
    element: <AppProviders />,
    children: [
      {
        path: 'login',
        element: <Login />,
      },
      {
        path: 'register',
        element: <Register />,
      },
      {
        path: 'auth/google/callback',
        element: <AuthGoogleCallback />,
      },
      {
        path: 'auth/email-verified',
        element: <AuthEmailVerified />,
      },
      {
        path: 'platform',
        element: <PlatformAdminLayout />,
        children: [
          { index: true, element: <PlatformOverview /> },
          { path: 'organizations', element: <PlatformOrganizations /> },
          { path: 'users', element: <PlatformUsers /> },
          { path: 'llm', element: <PlatformLlm /> },
        ],
      },
      // Layout sin `path`: envuelve el Outlet de AppProviders (Keyring, sesión, etc.).
      // `path: '/'` aquí puede romper el árbol de contextos en el data router.
      {
        element: <MainLayout />,
        children: [
      {
        index: true,
        element: <Home />,
      },
      {
        path: 'organization',
        element: <WorkspaceOrganization />,
      },
      {
        path: 'accounts',
        children: [
          {
            index: true,
            element: <Accounts />,
          },
          {
            path: 'create',
            element: <CreateAccount />,
          },
          {
            path: 'import',
            element: <ImportAccount />,
          },
          {
            path: ':address',
            element: <AccountDetail />,
          },
        ],
      },
      {
        path: 'send',
        element: <Send />,
      },
      {
        path: 'receive',
        element: <Receive />,
      },
      {
        path: 'transactions',
        children: [
          {
            index: true,
            element: <Transactions />,
          },
          {
            path: ':hash',
            element: <TransactionDetail />,
          },
        ],
      },
      {
        path: 'networks',
        element: <Networks />,
      },
      {
        path: 'contacts',
        element: <Contacts />,
      },
      {
        path: 'documents',
        children: [
          {
            index: true,
            element: <Documents />,
          },
          {
            path: 'new',
            element: <DocumentsNew />,
          },
          {
            path: 'new-etherpad',
            element: <DocumentEditorEtherpad />,
          },
          {
            path: 'new-local',
            element: <DocumentEditor />,
          },
          {
            path: ':documentId',
            element: <DocumentDetail />,
          },
          {
            path: ':documentId/edit',
            element: <DocumentEditorEtherpad />,
          },
          {
            path: ':documentId/edit-quill',
            element: <DocumentEditor />,
          },
        ],
      },
      {
        path: 'emergencies',
        element: <Emergencies />,
      },
      {
        path: 'verify',
        element: <VerifyProcedence />,
      },
      {
        path: 'settings',
        element: <Settings />,
      },
      {
        path: 'identity',
        element: <Identity />,
      },
    ],
      },
    ],
  },
], {
  basename: basename,
})

