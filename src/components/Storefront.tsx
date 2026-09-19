import React, { useState, useEffect } from 'react';
import { Download, CheckCircle2, Star, Check } from 'lucide-react';
import { AppItem, CATEGORIES } from '../types';
import { db, collection, getDocs, query, orderBy, doc, updateDoc } from '../lib/firebase';

interface StorefrontProps {
  onAppSelect: (app: AppItem) => void;
}

export function Storefront({ onAppSelect }: StorefrontProps) {
  const [activeCategory, setActiveCategory] = useState<string>('Всі');
  const [apps, setApps] = useState<AppItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchApps = async () => {
      try {
        const q = query(collection(db, 'apps'), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        const fetchedApps = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as AppItem[];
        setApps(fetchedApps);
      } catch (error) {
        console.error('Error fetching apps:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchApps();
  }, []);

  const handleDirectDownload = async (e: React.MouseEvent, app: AppItem) => {
    e.stopPropagation();
    if (downloadingId === app.id) return;
    setDownloadingId(app.id);

    try {
      // 1. Update downloads count in Firestore
      if (app.id) {
        try {
          const appRef = doc(db, 'apps', app.id);
          await updateDoc(appRef, {
            downloads: (app.downloads || 0) + 1
          });
          setApps(prev => prev.map(a => a.id === app.id ? { ...a, downloads: (a.downloads || 0) + 1 } : a));
        } catch (err) {
          console.warn('Could not update downloads count:', err);
        }
      }

      // 2. Real file download directly to PC
      const downloadTarget = app.downloadUrl || `/api/download?name=${encodeURIComponent(app.name)}`;
      const fileName = app.apkFileName || (app.name.endsWith('.apk') ? app.name : `${app.name}.apk`);

      const link = document.createElement('a');
      link.href = downloadTarget.includes('?') 
        ? `${downloadTarget}&name=${encodeURIComponent(fileName)}`
        : `${downloadTarget}?name=${encodeURIComponent(fileName)}`;
      link.download = fileName;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error downloading APK:', err);
    } finally {
      setTimeout(() => {
        setDownloadingId(null);
      }, 1500);
    }
  };
  
  const filteredApps = activeCategory === 'Всі' 
    ? apps 
    : apps.filter(app => app.category === activeCategory);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Categories Banner */}
      <div className="mb-12">
        <h1 className="text-3xl font-bold text-white mb-6">Категорії</h1>
        <div className="flex overflow-x-auto pb-4 gap-4 hide-scrollbar">
          <button
            onClick={() => setActiveCategory('Всі')}
            className={`flex-none px-6 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap border ${
              activeCategory === 'Всі' 
                ? 'bg-blue-500/20 text-blue-300 border-blue-400/30' 
                : 'bg-white/5 text-white/70 hover:bg-white/10 border-transparent'
            }`}
          >
            Всі додатки
          </button>
          {CATEGORIES.map(category => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`flex-none px-6 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap border ${
                activeCategory === category 
                  ? 'bg-blue-500/20 text-blue-300 border-blue-400/30' 
                  : 'bg-white/5 text-white/70 hover:bg-white/10 border-transparent'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Apps Grid */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-6">
          {activeCategory === 'Всі' ? 'Популярні додатки' : activeCategory}
        </h2>
        
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredApps.map(app => (
              <div 
                key={app.id} 
                onClick={() => onAppSelect(app)}
                className="group bg-white/10 border border-white/10 backdrop-blur-md rounded-2xl overflow-hidden hover:border-blue-400/30 transition-all cursor-pointer hover:shadow-xl hover:bg-white/15"
              >
                <div className="aspect-video w-full overflow-hidden relative">
                  <img 
                    src={app.coverPhoto} 
                    alt={app.name} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent opacity-80" />
                  <div className="absolute bottom-4 left-4 flex gap-2">
                    <span className="bg-black/50 backdrop-blur-md text-white text-xs px-2.5 py-1 rounded-md font-medium border border-white/10">
                      {app.category}
                    </span>
                  </div>
                </div>
                
                <div className="p-5">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        {app.name}
                        {app.isVerified && <CheckCircle2 className="w-4 h-4 text-blue-500" />}
                      </h3>
                      <p className="text-sm text-gray-400 mt-0.5">{app.developer}</p>
                    </div>
                    <div className="flex items-center gap-1 text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded text-xs font-medium">
                      <Star className="w-3 h-3 fill-current" />
                      4.8
                    </div>
                  </div>
                  
                  <p className="text-gray-400 text-sm mt-3 line-clamp-2">
                    {app.description}
                  </p>
                  
                  <div className="mt-6 flex items-center justify-between">
                    <div className="text-xs text-gray-500 font-medium">
                      {(app.downloads || 0).toLocaleString()} завантажень
                    </div>
                    <button 
                      onClick={(e) => handleDirectDownload(e, app)}
                      className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:brightness-110 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-md active:scale-95"
                      title="Завантажити APK файл на ПК"
                    >
                      {downloadingId === app.id ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Завантаження...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          <span>Встановити</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {!loading && filteredApps.length === 0 && (
          <div className="text-center py-20">
            <p className="text-gray-500">У цій категорії поки немає додатків.</p>
          </div>
        )}
      </div>
    </div>
  );
}
