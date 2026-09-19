import { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { LoginModal } from './components/LoginModal';
import { Storefront } from './components/Storefront';
import { AppDetails } from './components/AppDetails';
import { PublishScreen } from './components/PublishScreen';
import { User as AppUser, ViewState, AppItem, DeveloperPlan } from './types';
import { auth, onAuthStateChanged, signOut, db, doc, getDoc } from './lib/firebase';

export default function App() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [currentView, setCurrentView] = useState<ViewState>('store');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<AppItem | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        let plan: DeveloperPlan = 'none';
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userSnap = await getDoc(userDocRef);
          if (userSnap.exists()) {
            plan = userSnap.data().plan || 'none';
          }
        } catch (err) {
          console.error('Error fetching user plan:', err);
        }

        setUser({
          id: firebaseUser.uid,
          name: firebaseUser.displayName || 'Developer',
          email: firebaseUser.email || '',
          avatar: firebaseUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${firebaseUser.uid}&backgroundColor=c0aede,b6e3f4,ffdfbf`,
          plan
        });
      } else {
        setUser(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const handlePlanUpdated = (newPlan: DeveloperPlan) => {
    setUser(prev => prev ? { ...prev, plan: newPlan } : null);
  };

  const handleNavigate = (view: ViewState) => {
    if (view === 'publish' && !user) {
      setIsLoginModalOpen(true);
      return;
    }
    setCurrentView(view);
    if (view !== 'appDetails') {
      setSelectedApp(null);
    }
  };

  const handleAppSelect = (app: AppItem) => {
    setSelectedApp(app);
    setCurrentView('appDetails');
  };

  const handlePublishSuccess = () => {
    alert('Вітаємо! Ваш додаток успішно опубліковано.');
    handleNavigate('store');
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      if (currentView === 'publish') {
        setCurrentView('store');
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div className="min-h-screen font-sans selection:bg-blue-500/30 bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#334155] text-white relative">
      <div className="fixed inset-0 pointer-events-none opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.4) 0%, transparent 40%), radial-gradient(circle at 80% 80%, rgba(255, 255, 255, 0.4) 0%, transparent 40%)' }}></div>
      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar 
          user={user} 
          currentView={currentView}
          onNavigate={handleNavigate}
          onLoginClick={() => setIsLoginModalOpen(true)}
          onLogout={handleLogout}
        />

        <main>
          {currentView === 'store' && (
            <Storefront onAppSelect={handleAppSelect} />
          )}
          
          {currentView === 'appDetails' && selectedApp && (
            <AppDetails 
              app={selectedApp} 
              onBack={() => handleNavigate('store')} 
            />
          )}
          
          {currentView === 'publish' && user && (
            <PublishScreen 
              onPublishSuccess={handlePublishSuccess} 
              user={user} 
              onPlanUpdated={handlePlanUpdated}
            />
          )}
        </main>

        <LoginModal 
          isOpen={isLoginModalOpen} 
          onClose={() => setIsLoginModalOpen(false)} 
        />
      </div>
    </div>
  );
}
