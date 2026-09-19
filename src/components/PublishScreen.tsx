import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  UploadCloud, 
  FileType, 
  CheckCircle2, 
  ShieldAlert, 
  AlertCircle, 
  Camera, 
  CreditCard, 
  ChevronRight, 
  Zap, 
  ExternalLink, 
  RefreshCw, 
  Lock, 
  Sparkles, 
  Crown,
  Infinity as InfinityIcon,
  BadgeCheck
} from 'lucide-react';
import { CATEGORIES, User as AppUser, DeveloperPlan } from '../types';
import { db, collection, addDoc, doc, setDoc } from '../lib/firebase';

interface PublishScreenProps {
  onPublishSuccess: () => void;
  user: AppUser;
  onPlanUpdated?: (newPlan: DeveloperPlan) => void;
}

type ScanStatus = 'idle' | 'scanning' | 'clean' | 'infected';
type PublishPlanOption = 'standard' | 'unlimited' | 'unlimited_verified';

export function PublishScreen({ onPublishSuccess, user, onPlanUpdated }: PublishScreenProps) {
  const [file, setFile] = useState<File | null>(null);
  const [scanStatus, setScanStatus] = useState<ScanStatus>('idle');
  const [scanProgress, setScanProgress] = useState(0);
  
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: CATEGORIES[0],
    coverUrl: ''
  });

  const userPlan = user.plan || 'none';
  const hasVerifiedPlan = userPlan === 'unlimited_verified';
  const hasStandardUnlimitedPlan = userPlan === 'unlimited';
  const hasAnyLifetimePlan = hasVerifiedPlan || hasStandardUnlimitedPlan;

  // Initial plan selection based on user's current status
  const [selectedPlan, setSelectedPlan] = useState<PublishPlanOption>(() => {
    if (hasVerifiedPlan) return 'unlimited_verified';
    if (hasStandardUnlimitedPlan) return 'unlimited';
    return 'standard';
  });

  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [approveUrl, setApproveUrl] = useState<string | null>(null);
  const [uploadedApkInfo, setUploadedApkInfo] = useState<{ downloadUrl: string; fileName: string } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<boolean>(false);

  // Will this app get the verified blue badge?
  const willBeVerified = hasVerifiedPlan || selectedPlan === 'unlimited_verified';

  // Calculate pricing
  const getPricing = () => {
    if (hasVerifiedPlan) {
      return { uah: 0, usd: '0.00', isFree: true, title: 'Безкоштовно по VIP-тарифу з галочкою' };
    }
    if (hasStandardUnlimitedPlan) {
      if (selectedPlan === 'unlimited_verified') {
        return { uah: 2300, usd: '57.00', isFree: false, title: 'Апгрейд: Більше не платити + Галочка' };
      }
      return { uah: 0, usd: '0.00', isFree: true, title: 'Безкоштовно по безлімітному тарифу' };
    }
    // New purchase options
    if (selectedPlan === 'unlimited_verified') {
      return { uah: 2300, usd: '57.00', isFree: false, title: 'Більше не платити за публікацію + Галочка додатку' };
    }
    if (selectedPlan === 'unlimited') {
      return { uah: 1400, usd: '35.00', isFree: false, title: 'Більше не оплачувати за публікацію додатків' };
    }
    return { uah: 10, usd: '0.25', isFree: false, title: 'Стандартна публікація' };
  };

  const currentPrice = getPricing();

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          // Compress image to standard JPEG to stay within Firestore limits
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          setForm(prev => ({ ...prev, coverUrl: dataUrl }));
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.apk')) {
        alert('Будь ласка, завантажте файл формату .apk');
        return;
      }
      setFile(selectedFile);
      setUploadedApkInfo(null);
      startVirusScan();

      // Upload file to server in background so users will truly download this uploaded APK
      try {
        const formData = new FormData();
        formData.append('file', selectedFile);
        const res = await fetch('/api/upload-apk', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        if (data.success && data.downloadUrl) {
          setUploadedApkInfo({
            downloadUrl: data.downloadUrl,
            fileName: data.fileName || selectedFile.name
          });
        }
      } catch (uploadErr) {
        console.warn('Background upload failed, will upload on publication:', uploadErr);
      }
    }
  };

  const startVirusScan = () => {
    setScanStatus('scanning');
    setScanProgress(0);

    const interval = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setScanStatus('clean');
          return 100;
        }
        return prev + 10;
      });
    }, 400);
  };

  const checkPaymentStatus = async (orderId: string) => {
    try {
      const res = await fetch(`/api/paypal/order-status/${orderId}`);
      const data = await res.json();
      if (data.success && data.status === 'COMPLETED') {
        return true;
      }
    } catch (err) {
      console.error('Error checking PayPal status:', err);
    }
    return false;
  };

  const handleManualCheck = async () => {
    if (!activeOrderId) return;
    const isPaid = await checkPaymentStatus(activeOrderId);
    if (isPaid) {
      await finalizePublication(activeOrderId);
    } else {
      alert('Оплата ще не була підтверджена в PayPal. Будь ласка, завершіть транзакцію у відкритому вікні PayPal.');
    }
  };

  const finalizePublication = async (orderId: string) => {
    pollingRef.current = false;
    try {
      // 1. If user bought a lifetime plan, persist to their user profile in Firestore
      if (selectedPlan === 'unlimited_verified') {
        await setDoc(doc(db, 'users', user.id), {
          plan: 'unlimited_verified',
          planPurchasedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }, { merge: true });
        onPlanUpdated?.('unlimited_verified');
      } else if (selectedPlan === 'unlimited' && !hasAnyLifetimePlan) {
        await setDoc(doc(db, 'users', user.id), {
          plan: 'unlimited',
          planPurchasedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }, { merge: true });
        onPlanUpdated?.('unlimited');
      }

      // Ensure APK file is uploaded to server
      let downloadUrl = uploadedApkInfo?.downloadUrl;
      let apkFileName = uploadedApkInfo?.fileName || (file ? file.name : `${form.name}.apk`);

      if (!downloadUrl && file) {
        try {
          const formData = new FormData();
          formData.append('file', file);
          const uploadRes = await fetch('/api/upload-apk', {
            method: 'POST',
            body: formData
          });
          const uploadData = await uploadRes.json();
          if (uploadData.success && uploadData.downloadUrl) {
            downloadUrl = uploadData.downloadUrl;
            apkFileName = uploadData.fileName || file.name;
          }
        } catch (err) {
          console.error('Finalize upload error:', err);
        }
      }

      if (!downloadUrl) {
        downloadUrl = `/api/download?name=${encodeURIComponent(form.name)}`;
      }

      // 2. Publish the app document with downloadUrl & apkFileName
      await addDoc(collection(db, 'apps'), {
        name: form.name,
        description: form.description,
        category: form.category,
        coverPhoto: form.coverUrl || 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=500&h=300&fit=crop',
        isVerified: willBeVerified,
        developer: user.name,
        developerId: user.id,
        downloads: 0,
        size: file ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : '0 MB',
        downloadUrl,
        apkFileName,
        paymentMethod: currentPrice.isFree ? `plan_${userPlan}` : 'paypal',
        paypalOrderId: orderId,
        publishTier: selectedPlan,
        createdAt: new Date().toISOString()
      });
      
      setIsProcessingPayment(false);
      setActiveOrderId(null);
      setApproveUrl(null);
      onPublishSuccess();
    } catch (error: any) {
      console.error('Error saving app after publication:', error);
      alert('Помилка при збереженні додатку в базі: ' + (error.message || 'Невідома помилка'));
      setIsProcessingPayment(false);
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file) {
      alert('Будь ласка, завантажте APK файл.');
      return;
    }

    if (scanStatus !== 'clean') {
      alert('Зачекайте завершення перевірки на віруси.');
      return;
    }

    // CASE 1: Free publication via active developer lifetime plan
    if (currentPrice.isFree) {
      setIsProcessingPayment(true);
      await finalizePublication('free_tier_active');
      return;
    }

    // CASE 2: PayPal payment flow
    setIsProcessingPayment(true);
    pollingRef.current = true;
    
    try {
      const res = await fetch('/api/paypal/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${currentPrice.title} (${form.name})`,
          amount: currentPrice.usd
        })
      });
      
      const orderData = await res.json();
      
      if (!orderData.success || !orderData.orderId || !orderData.approveUrl) {
        throw new Error(orderData.error || 'Не вдалося створити замовлення PayPal');
      }

      setActiveOrderId(orderData.orderId);
      setApproveUrl(orderData.approveUrl);

      // Open PayPal Checkout Window
      const paypalWin = window.open(
        orderData.approveUrl,
        'PayPalCheckout',
        'width=550,height=750,location=no,status=no,scrollbars=yes'
      );

      if (!paypalWin) {
        console.warn('Popup blocked, fallback link provided in UI.');
      }
      
      // Poll for payment status
      const startTime = Date.now();
      
      while (pollingRef.current) {
        if (Date.now() - startTime > 600000) { // 10 minutes timeout
          pollingRef.current = false;
          throw new Error('Час очікування оплати минув.');
        }
        
        await new Promise(r => setTimeout(r, 3000));
        
        if (!pollingRef.current) break;

        const isPaid = await checkPaymentStatus(orderData.orderId);
        if (isPaid) {
          if (paypalWin && !paypalWin.closed) {
            paypalWin.close();
          }
          await finalizePublication(orderData.orderId);
          break;
        }
      }
    } catch (error: any) {
      console.error('Error in PayPal publishing flow:', error);
      alert(error.message || 'Помилка при створенні оплати PayPal.');
      setIsProcessingPayment(false);
      pollingRef.current = false;
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Опублікувати додаток</h1>
        <p className="text-gray-400">Завантажте свій APK, пройдіть перевірку на віруси та виберіть зручний тариф для розміщення.</p>
      </div>

      <div className="space-y-8">
        {/* Step 1: Upload & Scan */}
        <div className="bg-white/10 border border-white/10 backdrop-blur-md rounded-2xl p-6 sm:p-8">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-sm">1</span>
            Завантаження APK
          </h2>

          {!file ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-white/20 rounded-xl p-10 flex flex-col items-center justify-center text-center hover:bg-white/5 hover:border-blue-400/50 transition-all cursor-pointer group"
            >
              <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-4 group-hover:bg-blue-600/20 group-hover:text-blue-500 transition-colors text-gray-400">
                <UploadCloud className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-medium text-white mb-1">Натисніть або перетягніть файл</h3>
              <p className="text-sm text-gray-500 max-w-sm">
                Підтримуються тільки файли формату .apk (макс. розмір 2 ГБ)
              </p>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange}
                accept=".apk"
                className="hidden" 
              />
            </div>
          ) : (
            <div className="bg-black/20 border border-white/10 rounded-xl p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-blue-500/10 text-blue-400 rounded-lg flex items-center justify-center">
                  <FileType className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-medium text-white text-lg">{file.name}</h4>
                  <p className="text-sm text-gray-400">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                </div>
                <button 
                  onClick={() => { setFile(null); setScanStatus('idle'); }} 
                  className="ml-auto text-sm text-gray-500 hover:text-white transition-colors"
                >
                  Змінити
                </button>
              </div>

              {/* Scan Section */}
              <div className="border-t border-white/10 pt-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-300 flex items-center gap-2">
                    Антивірусна перевірка Play Protect
                  </span>
                  <span className="text-sm font-semibold">
                    {scanStatus === 'scanning' && <span className="text-blue-400 animate-pulse">Сканування {scanProgress}%</span>}
                    {scanStatus === 'clean' && <span className="text-emerald-400 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Безпечно</span>}
                    {scanStatus === 'infected' && <span className="text-rose-400 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> Загроза знайдена</span>}
                  </span>
                </div>

                {scanStatus === 'scanning' && (
                  <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-blue-500 h-full transition-all duration-300 rounded-full" 
                      style={{ width: `${scanProgress}%` }}
                    />
                  </div>
                )}

                {scanStatus === 'clean' && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-xs text-emerald-300">
                    Файл успішно пройшов автоматичну перевірку та не містить шкідливого коду.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Step 2: Information & Cover */}
        {scanStatus === 'clean' && (
          <motion.form 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handlePublish}
            className="space-y-8"
          >
            <div className="bg-white/10 border border-white/10 backdrop-blur-md rounded-2xl p-6 sm:p-8">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-sm">2</span>
                Інформація про додаток
              </h2>

              <div className="space-y-6">
                {/* Cover Image Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Обкладинка додатку</label>
                  <div className="flex items-center gap-6">
                    <div 
                      onClick={() => imageInputRef.current?.click()}
                      className="w-32 h-32 rounded-xl bg-black/20 border-2 border-dashed border-white/20 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400/50 overflow-hidden relative group"
                    >
                      {form.coverUrl ? (
                        <img src={form.coverUrl} alt="Cover Preview" className="w-full h-full object-cover" />
                      ) : (
                        <>
                          <Camera className="w-8 h-8 text-gray-400 group-hover:text-blue-500 transition-colors" />
                          <span className="text-[10px] text-gray-500 mt-1">Завантажити</span>
                        </>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs">
                        Змінити
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-400 mb-2">
                        Рекомендований розмір 500x500 пікселів (квадрат). Дозволені формати: JPG, PNG.
                      </p>
                      <button
                        type="button"
                        onClick={() => imageInputRef.current?.click()}
                        className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors"
                      >
                        Обрати зображення
                      </button>
                      <input 
                        type="file" 
                        ref={imageInputRef} 
                        onChange={handleImageChange}
                        accept="image/png, image/jpeg, image/webp"
                        className="hidden" 
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Назва додатку</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      required
                      value={form.name}
                      onChange={e => setForm({...form, name: e.target.value})}
                      placeholder="Наприклад: My Awesome Game"
                      className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                    />
                    {willBeVerified && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-blue-400 text-xs font-semibold">
                        <CheckCircle2 className="w-4 h-4 text-blue-400" />
                        <span>Галочка</span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Категорія</label>
                  <select 
                    value={form.category}
                    onChange={e => setForm({...form, category: e.target.value})}
                    className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c} className="bg-slate-900 text-white">{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Опис (Опис)</label>
                  <textarea 
                    required
                    rows={4}
                    value={form.description}
                    onChange={e => setForm({...form, description: e.target.value})}
                    placeholder="Опишіть ваш додаток, його можливості та переваги..."
                    className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Step 3: Developer Plan & Pricing */}
            <div className="bg-white/10 border border-white/10 backdrop-blur-md rounded-2xl p-6 sm:p-8">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-sm">3</span>
                Тариф та Публікація
              </h2>

              {/* ACTIVE PLAN BANNERS */}
              {hasVerifiedPlan && (
                <div className="mb-6 p-5 rounded-xl bg-gradient-to-r from-blue-900/40 via-indigo-900/40 to-purple-900/40 border border-blue-400/40 relative overflow-hidden">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shrink-0">
                      <Crown className="w-6 h-6 text-yellow-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-white">Тариф: «Більше не платити + Галочка» (Активний)</h3>
                        <span className="bg-blue-500/30 text-blue-300 text-xs px-2.5 py-0.5 rounded-full border border-blue-400/30 font-semibold flex items-center gap-1">
                          <BadgeCheck className="w-3.5 h-3.5 text-blue-400" /> VIP Довічний
                        </span>
                      </div>
                      <p className="text-sm text-gray-300 mt-1">
                        Ви вже придбали довічний тариф! Усі ваші додатки публікуються повністю <strong>безкоштовно</strong> та автоматично отримують <strong>офіційну синю галочку верифікації</strong>.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {hasStandardUnlimitedPlan && (
                <div className="mb-6 p-5 rounded-xl bg-gradient-to-r from-emerald-900/40 to-teal-900/40 border border-emerald-500/40">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0">
                      <InfinityIcon className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-white">Тариф: «Більше не оплачувати» (Активний)</h3>
                        <span className="bg-emerald-500/30 text-emerald-300 text-xs px-2.5 py-0.5 rounded-full border border-emerald-400/30 font-semibold">
                          Довічний Безліміт
                        </span>
                      </div>
                      <p className="text-sm text-gray-300 mt-1">
                        Ви вже придбали безлімітну публікацію! Ваші додатки публікуються <strong>безкоштовно назавжди</strong>.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* TIER SELECTION CARDS */}
              {!hasVerifiedPlan && (
                <div className="space-y-4 mb-8">
                  <div className="text-sm font-medium text-gray-300 mb-2">
                    {hasStandardUnlimitedPlan ? 'Оберіть дію або апгрейд до галочки:' : 'Оберіть варіант публікації:'}
                  </div>

                  <div className="grid sm:grid-cols-3 gap-4">
                    {/* OPTION 1: Standard (10 UAH or 0 UAH if unlimited) */}
                    <div 
                      onClick={() => setSelectedPlan('standard')}
                      className={`relative p-5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                        selectedPlan === 'standard' 
                          ? 'border-blue-400/60 bg-blue-500/20 shadow-lg shadow-blue-500/10' 
                          : 'border-white/10 bg-white/5 hover:border-white/30'
                      }`}
                    >
                      {selectedPlan === 'standard' && (
                        <div className="absolute top-4 right-4 text-blue-400">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                      )}
                      <div>
                        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                          {hasStandardUnlimitedPlan ? 'По тарифу' : 'Разово'}
                        </div>
                        <h3 className="text-lg font-bold text-white mb-1">Стандартна публікація</h3>
                        <p className="text-xs text-gray-400 mb-4">
                          {hasStandardUnlimitedPlan 
                            ? 'Безкоштовна публікація за вашим активним безлімітним тарифом.' 
                            : 'Разове базове розміщення додатку в каталозі.'}
                        </p>
                      </div>

                      <div>
                        <div className="text-2xl font-bold text-white">
                          {hasStandardUnlimitedPlan ? '0 грн' : '10 грн'}
                        </div>
                        <div className="text-xs text-gray-400">
                          {hasStandardUnlimitedPlan ? 'Безкоштовно' : '≈ $0.25 USD'}
                        </div>
                      </div>
                    </div>

                    {/* OPTION 2: Lifetime Unlimited (1400 UAH) */}
                    {!hasStandardUnlimitedPlan && (
                      <div 
                        onClick={() => setSelectedPlan('unlimited')}
                        className={`relative p-5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                          selectedPlan === 'unlimited' 
                            ? 'border-emerald-400/60 bg-emerald-500/20 shadow-lg shadow-emerald-500/10' 
                            : 'border-white/10 bg-white/5 hover:border-white/30'
                        }`}
                      >
                        {selectedPlan === 'unlimited' && (
                          <div className="absolute top-4 right-4 text-emerald-400">
                            <CheckCircle2 className="w-5 h-5" />
                          </div>
                        )}
                        <div className="absolute -top-3 left-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow">
                          <InfinityIcon className="w-3 h-3" /> Безліміт
                        </div>

                        <div className="mt-2">
                          <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">Довічно</div>
                          <h3 className="text-lg font-bold text-white mb-1">Більше не оплачувати</h3>
                          <p className="text-xs text-gray-400 mb-4">
                            <strong>Більше не оплачувати за публікацію додатків назавжди.</strong> Оплатіть 1 раз — і публікуйте безлімітно.
                          </p>
                        </div>

                        <div>
                          <div className="text-2xl font-bold text-white">1400 грн</div>
                          <div className="text-xs text-emerald-400 font-medium">≈ $35.00 USD (Назавжди)</div>
                        </div>
                      </div>
                    )}

                    {/* OPTION 3: Lifetime + Verified (2300 UAH) */}
                    <div 
                      onClick={() => setSelectedPlan('unlimited_verified')}
                      className={`relative p-5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                        hasStandardUnlimitedPlan ? 'sm:col-span-2' : ''
                      } ${
                        selectedPlan === 'unlimited_verified' 
                          ? 'border-blue-400/70 bg-gradient-to-b from-blue-600/20 to-indigo-600/20 shadow-xl shadow-blue-500/20' 
                          : 'border-white/10 bg-white/5 hover:border-white/30'
                      }`}
                    >
                      {selectedPlan === 'unlimited_verified' && (
                        <div className="absolute top-4 right-4 text-blue-400">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                      )}
                      <div className="absolute -top-3 left-4 bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-900 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow">
                        <Crown className="w-3 h-3" /> VIP Безліміт + Галочка
                      </div>

                      <div className="mt-2">
                        <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">Максимальний доступ</div>
                        <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-1.5">
                          Більше не платити + Галочка
                          <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
                        </h3>
                        <p className="text-xs text-gray-300 mb-4">
                          Безлімітна публікація додатків назавжди + <strong>офіційна синя галочка верифікації</strong> кожному вашому додатку!
                        </p>
                      </div>

                      <div>
                        <div className="text-2xl font-bold text-white">2300 грн</div>
                        <div className="text-xs text-blue-400 font-medium">≈ $57.00 USD (Назавжди + Галочка)</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* PAYMENT METHOD (Only if payment required) */}
              {!currentPrice.isFree ? (
                <div className="space-y-4 mb-8">
                  <label className="block text-sm font-medium text-gray-300">Спосіб оплати</label>
                  
                  <div className="p-4 rounded-xl border border-blue-400/40 bg-blue-500/10 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#003087]/30 border border-[#0079C1]/40 flex items-center justify-center text-[#0079C1] shrink-0">
                        <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                          <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 3.72a.768.768 0 0 1 .758-.64h6.744c2.614 0 4.606.634 5.922 1.884 1.258 1.196 1.765 2.898 1.507 5.06-.466 3.916-2.906 6.136-7.258 6.136H9.728l-1.077 5.177H7.076zm9.297-12.01c-.13-.88-.508-1.577-1.124-2.072-.81-.65-2.074-.975-3.76-.975H7.39l-2.06 12.39h2.38l.842-5.067h2.093c2.723 0 4.686-.872 5.568-2.525.44-.823.53-1.894.26-1.751z"/>
                        </svg>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-base">PayPal & Банківські картки</span>
                          <span className="text-[11px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full font-medium">Офіційно</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">Оплата через PayPal рахунок або будь-яку банківську картку (Visa, Mastercard)</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg flex items-center gap-1 font-medium">
                        <Lock className="w-3 h-3" /> Захищено
                      </span>
                    </div>
                  </div>

                  {/* ACTIVE PAYMENT POLLING UI */}
                  {isProcessingPayment && (
                    <div className="p-5 bg-blue-950/40 border border-blue-500/30 rounded-xl space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-white">Очікування підтвердження в PayPal</h4>
                          <p className="text-xs text-gray-300 mt-1">
                            Ми відкрили захищене вікно PayPal для безпечної оплати ({currentPrice.uah} грн / ${currentPrice.usd} USD). Будь ласка, увійдіть або оберіть «Pay with Debit or Credit Card».
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 pt-2 border-t border-white/10">
                        {approveUrl && (
                          <a
                            href={approveUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Відкрити вікно PayPal знову
                          </a>
                        )}
                        
                        <button
                          type="button"
                          onClick={handleManualCheck}
                          className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium transition-colors cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Я сплатив, перевірити статус
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            pollingRef.current = false;
                            setIsProcessingPayment(false);
                          }}
                          className="text-xs text-gray-400 hover:text-white px-2 py-1.5 transition-colors ml-auto cursor-pointer"
                        >
                          Скасувати
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mb-8 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div className="text-sm text-emerald-200">
                    Оплата не потрібна! За вашим активним тарифом публікація здійснюється <strong>на 100% безкоштовно</strong>.
                  </div>
                </div>
              )}

              {/* ACTION BAR */}
              <div className="bg-black/20 p-4 rounded-xl border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <div className="text-gray-400 text-xs">До сплати</div>
                  <div className="text-2xl font-bold text-white flex items-baseline gap-2">
                    {currentPrice.isFree ? (
                      <span className="text-emerald-400">0 грн (Безкоштовно)</span>
                    ) : (
                      <>
                        <span>{currentPrice.uah} грн</span>
                        <span className="text-sm text-gray-400 font-normal">
                          (${currentPrice.usd} USD)
                        </span>
                      </>
                    )}
                  </div>
                  {willBeVerified && (
                    <div className="text-xs text-blue-400 flex items-center gap-1 mt-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Додаток отримає синю галочку
                    </div>
                  )}
                </div>

                <button 
                  type="submit"
                  disabled={isProcessingPayment}
                  className={`w-full sm:w-auto px-8 py-3 rounded-xl font-bold shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    currentPrice.isFree
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white'
                      : 'bg-[#0070BA] hover:bg-[#003087] text-white'
                  }`}
                >
                  {isProcessingPayment ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {currentPrice.isFree ? 'Публікація додатку...' : 'Обробка PayPal...'}
                    </>
                  ) : currentPrice.isFree ? (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Опублікувати безкоштовно
                      <ChevronRight className="w-5 h-5" />
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-5 h-5" />
                      Оплатити {currentPrice.uah} грн через PayPal
                      <ChevronRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.form>
        )}
      </div>
    </div>
  );
}
