'use client';
export const dynamic = 'force-dynamic';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import ChatWindow from '@/components/chat/ChatWindow';
import InputBar from '@/components/chat/InputBar';
import SessionHeader from '@/components/chat/SessionHeader';
import { useAuth } from '@/lib/hooks/useAuth';
import { useUIStore } from '@/lib/store/uiStore';
import { useChatStore } from '@/lib/store/chatStore';

// Modals
import RenameSessionModal from '@/components/chat/RenameSessionModal';
import DeleteSessionModal from '@/components/chat/DeleteSessionModal';
import AddToProjectModal from '@/components/chat/AddToProjectModal';
import RenameProjectModal from '@/components/chat/RenameProjectModal';
import DeleteProjectModal from '@/components/chat/DeleteProjectModal';

// Role-based views
import AdminDashboard from '@/components/admin/AdminDashboard';
import SuperUserPanel from '@/components/super-user/SuperUserPanel';

// app/page.tsx
export default function HomePage() {
  const { isAuthenticated, loading, isAdmin, isSuperUser } = useAuth();
  const router = useRouter();

  const {
    renameSessionModal, closeRenameSession,
    deleteSessionModal, closeDeleteSession,
    addToProjectModal, closeAddToProject,
    renameProjectModal, closeRenameProject,
    deleteProjectModal, closeDeleteProject,
    activeView
  } = useUIStore();

  const {
    renameSession, deleteSession, assignSessionToProject,
    renameProject, deleteProject, projects
  } = useChatStore();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, loading, router]);

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, don't render content (will redirect)
  if (!isAuthenticated) {
    //router.push('/login');
    return null;
  }

  return (
    <>
      <div className="flex h-screen w-screen overflow-hidden">
        {/* LEFT COLUMN — SIDEBAR */}
        <Sidebar />
        {activeView === 'chat' && <SessionHeader />}

        {/* RIGHT COLUMN — CHAT WINDOW / DASHBOARDS */}
        <div className="flex flex-col flex-1 bg-white">
          {activeView === 'chat' && (
            <>
              <ChatWindow />
              <InputBar />
            </>
          )}

          {activeView === 'admin_dashboard' && (isAdmin || isSuperUser) && <AdminDashboard />}

          {activeView === 'super_user_panel' && isSuperUser && <SuperUserPanel />}
        </div>
      </div>

      {/* GLOBAL MODALS */}
      {renameSessionModal.isOpen && (
        <RenameSessionModal
          currentTitle={renameSessionModal.title}
          onClose={closeRenameSession}
          onConfirm={(newTitle) => {
            renameSession(renameSessionModal.sessionId, newTitle);
            closeRenameSession();
          }}
        />
      )}

      {deleteSessionModal.isOpen && (
        <DeleteSessionModal
          sessionTitle={deleteSessionModal.title}
          onClose={closeDeleteSession}
          onConfirm={() => {
            deleteSession(deleteSessionModal.sessionId);
            closeDeleteSession();
          }}
        />
      )}

      {addToProjectModal.isOpen && (
        <AddToProjectModal
          projects={projects}
          currentProjectId={addToProjectModal.currentProjectId}
          onClose={closeAddToProject}
          onConfirm={(projectId) => {
            assignSessionToProject(addToProjectModal.sessionId, projectId);
            closeAddToProject();
          }}
        />
      )}

      {renameProjectModal.isOpen && (
        <RenameProjectModal
          currentName={renameProjectModal.name}
          onClose={closeRenameProject}
          onConfirm={(newName) => {
            renameProject(renameProjectModal.projectId, newName);
            closeRenameProject();
          }}
        />
      )}

      {deleteProjectModal.isOpen && (
        <DeleteProjectModal
          projectName={deleteProjectModal.name}
          onClose={closeDeleteProject}
          onConfirm={() => {
            deleteProject(deleteProjectModal.projectId);
            closeDeleteProject();
          }}
        />
      )}
    </>
  );
}
