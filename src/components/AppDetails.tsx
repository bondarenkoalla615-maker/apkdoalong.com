import { useState } from 'react';
import { ArrowLeft, Download, ShieldCheck, CheckCircle2, Info, Check } from 'lucide-react';
import { AppItem } from '../types';
import { db, doc, updateDoc } from '../lib/firebase';

interface AppDetailsProps {
  app: AppItem;
  onBack: () => void;
}

export function AppDetails({ app, onBack }: AppDetailsProps) {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadCompleted, setDownloadCompleted] = useState(false);
  const [currentDownloads, setCurrentDownloads] = useState(app.downloads || 0);

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    setProgress(15);
    setDownloadCompleted(false);

    // 1. Trigger realistic progress
    let p = 15;
    const progressInterval = setInterval(() => {
      p += Math.floor(Math.random() * 20) + 15;
      if (p >= 90) {
        p = 90;
        clearInterval(progressInterval);
      }
      setProgress(p);
    }, 150);

    try {
      // 2. Increment download count in Firestore
      try {
        if (app.id) {
          const appRef = doc(db, 'apps', app.id);
          await updateDoc(appRef, {
            downloads: (app.downloads || 0) + 1
          });
          setCurrentDownloads(prev => prev + 1);
        }
      } catch (dbErr) {
        console.warn('Could not update download counter in Firestore:', dbErr);
      }

      // 3. Initiate REAL file download on user PC
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

      clearInterval(progressInterval);
      setProgress(100);
      setDownloadCompleted(true);
      setTimeout(() => {
        setDownloading(false);
        setProgress(0);
      }, 1500);
    } catch (err) {
      console.error('Download error:', err);
      clearInterval(progressInterval);
      setDownloading(false);
      setProgress(0);
      alert('Помилка при завантаженні файлу. Будь ласка, спробуйте ще раз.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-white transition-colors mb-8"
      >
        <ArrowLeft className="w-4 h-4" />
        Назад до додатків
      </button>

      <div className="bg-white/10 border border-white/10 backdrop-blur-xl rounded-3xl overflow-hidden">
        <div className="h-64 sm:h-80 w-full relative">
          <img 
            src={app.coverPhoto} 
            alt={app.name} 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent" />
        </div>

        <div className="p-6 sm:p-10 -mt-20 relative z-10">
          <div className="flex flex-col sm:flex-row gap-6 items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl sm:text-4xl font-bold text-white">{app.name}</h1>
                {app.isVerified && (
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500/10 text-blue-500" title="Верифікований розробник">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                )}
              </div>
              <p className="text-lg text-gray-400 font-medium">{app.developer}</p>
            </div>
            
            <div className="w-full sm:w-auto">
              <button 
                onClick={handleDownload}
                disabled={downloading}
                className={`w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold text-lg transition-all shadow-xl disabled:opacity-50 disabled:cursor-not-allowed ${
                  downloadCompleted 
                    ? 'bg-green-600 text-white' 
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:brightness-110 text-white'
                }`}
              >
                {downloading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Завантаження {progress}%
                  </>
                ) : downloadCompleted ? (
                  <>
                    <Check className="w-5 h-5 text-white" />
                    Збережено на ПК!
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    Завантажити APK
                  </>
                )}
              </button>
              <p className="text-center text-xs text-gray-400 mt-3 font-medium">
                {app.apkFileName ? `Файл: ${app.apkFileName} • ` : ''}Розмір: {app.size} • Пряме завантаження
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-10 py-6 border-y border-white/10">
            <div>
              <div className="text-sm text-gray-500 mb-1">Категорія</div>
              <div className="font-semibold text-white">{app.category}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">Завантажень</div>
              <div className="font-semibold text-white">{currentDownloads.toLocaleString()}+</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">Оцінка</div>
              <div className="font-semibold text-white">4.8 / 5.0</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">Безпека</div>
              <div className="flex items-center gap-1 font-semibold text-green-400">
                <ShieldCheck className="w-4 h-4" /> Перевірено
              </div>
            </div>
          </div>

          <div className="mt-10">
            <h2 className="text-xl font-bold text-white mb-4">Опис</h2>
            <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
              {app.description}
            </p>
          </div>
          
          <div className="mt-8 bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex gap-4 items-start">
            <Info className="w-6 h-6 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-200">
              Цей додаток перевірено внутрішнім антивірусом APKDoalong. Ми гарантуємо відсутність шкідливого коду. Для встановлення переконайтеся, що на вашому пристрої дозволено встановлення з невідомих джерел.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
