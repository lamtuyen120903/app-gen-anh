import React, { useState, useEffect } from 'react';
import { WorkflowType, AspectRatio, BannerInput, GeneratedImage, AppStep, BatchItem, User, ProjectData, UsageLog } from './types';
import { generateBanner, editBannerWithMask } from './services/geminiService';
import { saveProjectToBackend, loadProjectsFromBackend, loadProjectData, shareProject, changePassword, logUsage, getUsageStats, getAllUsers } from './services/googleBackend';
import { InputForm } from './components/InputForm';
import { ImageEditor } from './components/ImageEditor';
import { LoginScreen } from './components/LoginScreen';
import { AdminPanel } from './components/AdminPanel';
import { UsageDashboard } from './components/UsageDashboard';
import { Layers, Wand2, ArrowRight, Download, ImagePlus, CheckCircle, Trash2, Edit3, X, ZoomIn, RefreshCw, Save, FolderOpen, LogOut, Cloud, Users, Key, Shield, Database, AlertCircle, Share2, Coins, Receipt, TrendingUp, Search, Filter, UserMinus, UserPlus } from 'lucide-react';

const INITIAL_INPUT: BannerInput = {
  headline: '',
  subHeadline: '',
  productDescription: '',
  bodyText: '',
  cta: '',
  primaryColor: '', 
  secondaryColor: '',
  fontMain: '',
  fontSecondary: '',
  designStyle: '',
  designContext: '',
  logo: null,
  productImage: null,
  referenceImage: null,
  headlineFontReference: null, // Initial state for font reference
  aspectRatio: AspectRatio.SQUARE,
  customWidth: 1080,
  customHeight: 1080,
  variations: 2,
};

// ESTIMATED COST CONSTANTS
const COST_PER_IMAGE = 0.04; // $0.04 per generated image (Gemini 3 Pro approx)

const getEnv = (key: string): string | undefined => {
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) return import.meta.env[key];
  } catch (e) {}
  try {
    const globalScope = typeof globalThis !== 'undefined' ? globalThis : window;
    // @ts-ignore
    if (globalScope && globalScope.process && globalScope.process.env) return globalScope.process.env[key];
  } catch (e) {}
  return undefined;
};

const getApiKey = () => {
  const reactAppKey = getEnv('REACT_APP_GEMINI_API_KEY');
  if (reactAppKey) return reactAppKey;
  const viteKey = getEnv('VITE_GEMINI_API_KEY');
  if (viteKey) return viteKey;
  return getEnv('API_KEY');
};

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [step, setStep] = useState<AppStep>(AppStep.SELECT_WORKFLOW);
  const [workflow, setWorkflow] = useState<WorkflowType>(WorkflowType.SINGLE);
  const [input, setInput] = useState<BannerInput>(INITIAL_INPUT);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Editor State
  const [editingImageId, setEditingImageId] = useState<string | null>(null);
  
  // Zoom State
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  
  // Regeneration State
  const [regenerateModalOpen, setRegenerateModalOpen] = useState<{id: string, url: string} | null>(null);
  const [regenerationInstruction, setRegenerationInstruction] = useState('');

  // Bulk State
  const [masterImage, setMasterImage] = useState<GeneratedImage | null>(null);
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);

  // Project Management State
  const [projectName, setProjectName] = useState('My New Project');
  const [projectId, setProjectId] = useState<string | null>(null); // Track current project ID
  const [sharedWith, setSharedWith] = useState<string[]>([]); // Track current project shares
  
  // Custom Modal States
  const [showProjectList, setShowProjectList] = useState(false);
  const [savedProjects, setSavedProjects] = useState<any[]>([]);
  
  // PROJECT FILTER STATES
  const [projectSearch, setProjectSearch] = useState('');
  const [projectUserFilter, setProjectUserFilter] = useState('ALL');
  
  // NEW: Save Modal State
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveNameInput, setSaveNameInput] = useState('');

  // NEW: Share Modal State
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareTargetId, setShareTargetId] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [shareSearch, setShareSearch] = useState('');
  const [selectedShareIds, setSelectedShareIds] = useState<string[]>([]);

  // NEW: Usage Modal State (REPLACED OLD LOGIC)
  const [isUsageDashboardOpen, setIsUsageDashboardOpen] = useState(false);

  // NEW: Error/Status State
  const [statusMessage, setStatusMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  // UI Panels
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  // API Key State
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    const checkApiKey = async () => {
      try {
        const aistudio = (window as any).aistudio;
        if (aistudio) {
          const hasKey = await aistudio.hasSelectedApiKey();
          if (hasKey) {
            setHasApiKey(true);
            return;
          }
        } 
      } catch(e) { console.warn("AI Studio check failed", e); }
      if (getApiKey()) setHasApiKey(true);
    };
    checkApiKey();
  }, []);

  const handleSelectKey = async () => {
    const aistudio = (window as any).aistudio;
    if (aistudio) {
      await aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
  };

  const handleLogout = () => {
    setUser(null);
    setStep(AppStep.SELECT_WORKFLOW);
    setInput(INITIAL_INPUT);
    setGeneratedImages([]);
    setProjectId(null);
  };

  // --- SAVE / LOAD LOGIC ---
  
  const initiateSave = (e?: React.MouseEvent) => {
    if(e) { e.preventDefault(); e.stopPropagation(); }
    if (!user) {
        alert("You must be logged in to save.");
        return;
    }
    
    // Auto-suggest name logic
    let defaultName = projectName;
    const isIncomplete = !input.productImage || !input.headline?.trim();
    if (isIncomplete && !defaultName.toLowerCase().includes('draft')) {
       defaultName = `${defaultName} (Draft)`;
    }
    setSaveNameInput(defaultName);
    setIsSaveModalOpen(true);
    setStatusMessage(null);
  };

  const confirmSave = async () => {
    if (!saveNameInput.trim()) return;

    setIsSaveModalOpen(false); // Close modal first
    setIsProcessing(true); // Show global spinner
    
    setProjectName(saveNameInput);
    
    // Maintain ID if we are editing an existing project, otherwise create new ID
    const pid = projectId || Date.now().toString();

    const projectData: ProjectData = {
      id: pid,
      name: saveNameInput,
      ownerId: user!.id,
      sharedWith: sharedWith, // Preserve shared list
      lastModified: new Date().toISOString(),
      workflow,
      step,
      input, // Save whatever input exists, even if empty
      generatedImages,
      batchItems
    };

    try {
      console.log("Saving project...", projectData);
      const result = await saveProjectToBackend(projectData);
      console.log("Save result:", result);
      
      if (result.success) {
        setProjectId(pid); // Update ID to current
        setStatusMessage({ type: 'success', text: "Project saved successfully to Drive!" });
      } else {
        setStatusMessage({ type: 'error', text: "Failed to save: " + result.message });
      }
    } catch (error) {
       console.error("Critical Save Error:", error);
       setStatusMessage({ type: 'error', text: "Network Error: " + String(error) });
    } finally {
       setIsProcessing(false);
       // Clear success message after 3s
       setTimeout(() => {
          if (statusMessage?.type === 'success') setStatusMessage(null);
       }, 3000);
    }
  };

  const handleLoadProjectsList = async () => {
    if (!user) return;
    setIsProcessing(true);
    setStatusMessage(null);
    setProjectSearch('');
    setProjectUserFilter('ALL');
    
    // Pass user role to handle Admin visibility
    const result = await loadProjectsFromBackend(user.id, user.role);
    
    // Also load users to resolve names in the list (needed for filters)
    try {
       const userRes = await getAllUsers(user.id);
       if(userRes.success && userRes.users) {
          setAllUsers(userRes.users);
       }
    } catch(e) {}
    
    setIsProcessing(false);
    
    if (result.success && result.projects) {
      setSavedProjects(result.projects);
      setShowProjectList(true);
    } else {
      setStatusMessage({ type: 'error', text: "Failed to load projects: " + (result.message || 'Unknown error') });
    }
  };

  const loadSelectedProject = async (proj: any) => {
    setIsProcessing(true);
    try {
      let data: ProjectData;

      if (proj.fileId) {
        const res = await loadProjectData(proj.fileId);
        if (res.success && res.data) {
          data = res.data;
        } else {
          throw new Error(res.message || "Failed to load project file from Drive.");
        }
      } else {
        data = JSON.parse(proj.data);
      }
      
      setWorkflow(data.workflow);
      setStep(data.step);
      setInput(data.input);
      setGeneratedImages(data.generatedImages || []);
      setBatchItems(data.batchItems || []);
      setProjectName(data.name.replace(' (Draft)', ''));
      setProjectId(data.id);
      setSharedWith(data.sharedWith || []);
      
      setShowProjectList(false);
    } catch (e) {
      console.error("Error loading project", e);
      setStatusMessage({ type: 'error', text: "Could not load project data." });
    } finally {
      setIsProcessing(false);
    }
  };

  // --- SHARE LOGIC ---
  
  const handleOpenShareModal = async (e: React.MouseEvent, targetId: string, currentShares?: string[]) => {
      e.stopPropagation();
      if (!targetId) {
          setStatusMessage({ type: 'error', text: "Cannot share unsaved project. Please save first." });
          return;
      }

      setShareTargetId(targetId);
      setShareSearch('');
      
      let initialIds: string[] = [];
      
      // FIX 1: Prioritize getting the latest shares from savedProjects state if available
      // This ensures if we just saved/shared, we see the latest data, not stale props
      const projectFromState = savedProjects.find(p => p.id === targetId);
      
      if (projectFromState && projectFromState.sharedWith) {
          initialIds = [...projectFromState.sharedWith];
      } else if (targetId === projectId) {
          initialIds = [...sharedWith];
      } else if (currentShares) {
          initialIds = [...currentShares];
      }
      
      // CLEANUP: Ensure no empty strings
      initialIds = initialIds.filter(id => id && id.trim() !== '');

      setSelectedShareIds(initialIds);
      setIsShareModalOpen(true);

      // Fetch users if not already loaded fully
      if (user && allUsers.length <= 1) { // 1 because current user might be dummy loaded
          setIsLoadingUsers(true);
          try {
             const res = await getAllUsers(user.id);
             if (res.success && res.users) {
                 setAllUsers(res.users);
             } 
          } catch(e) { console.error(e); }
          setIsLoadingUsers(false);
      }
  };

  const addUserToShare = (uid: string) => {
      if (!selectedShareIds.includes(uid)) {
          setSelectedShareIds([...selectedShareIds, uid]);
      }
  };

  const removeUserFromShare = (uid: string) => {
      setSelectedShareIds(selectedShareIds.filter(id => id !== uid));
  };

  const confirmShare = async () => {
     if (!shareTargetId || !user) return;
     
     const newShareList = selectedShareIds;
     
     setIsShareModalOpen(false);
     setIsProcessing(true);
     
     try {
         // 1. Call Backend Share (handles permissions)
         const res = await shareProject(shareTargetId, newShareList);
         
         if (res.success) {
            
            // 2. CRITICAL FIX: MANUALLY SAVE PROJECT DATA TO PERSIST SHARE LIST
            // This ensures the JSON file on Drive is updated with the new sharedWith array
            // If we don't do this, 'reload' fetches the old JSON which has empty shares.
            
            // Scenario A: Sharing the CURRENTLY OPEN project
            if (shareTargetId === projectId) {
                setSharedWith(newShareList); // Update state

                const currentProjectData: ProjectData = {
                  id: projectId,
                  name: projectName,
                  ownerId: user.id,
                  sharedWith: newShareList, // Force the new list into the save payload
                  lastModified: new Date().toISOString(),
                  workflow,
                  step,
                  input,
                  generatedImages,
                  batchItems
                };
                
                // Silent save to ensure persistence
                await saveProjectToBackend(currentProjectData);
            } 
            // Scenario B: Sharing a project from the LIST (not open)
            // We must fetch it, update the list, and save it back.
            else {
                try {
                    const projMeta = savedProjects.find(p => p.id === shareTargetId);
                    if (projMeta && projMeta.fileId) {
                        const loadRes = await loadProjectData(projMeta.fileId);
                        if (loadRes.success && loadRes.data) {
                           const fullData = loadRes.data;
                           fullData.sharedWith = newShareList; // Update the list
                           await saveProjectToBackend(fullData); // Save back to Drive
                        }
                    }
                } catch(err) {
                   console.error("Failed to background update share list", err);
                }
            }

            // 3. Update local list state so UI reflects immediately
            setSavedProjects(prev => prev.map(p => {
                if (p.id === shareTargetId) return { ...p, sharedWith: newShareList };
                return p;
            }));

            setStatusMessage({ type: 'success', text: "Project shared & saved successfully." });

         } else {
            setStatusMessage({ type: 'error', text: "Failed to share: " + res.message });
         }
     } catch (e) {
         setStatusMessage({ type: 'error', text: "Network Error during sharing." });
     } finally {
         setIsProcessing(false);
     }
  }

  // Helper to get name from ID
  const getUserName = (id: string) => {
      const u = allUsers.find(user => user.id === id);
      return u ? u.name : id;
  };

  // --- PASSWORD CHANGE ---
  const handleChangePass = async () => {
      const newP = prompt("Enter your new password:");
      if(!newP) return;
      
      setIsProcessing(true);
      const res = await changePassword(user!.id, newP);
      setIsProcessing(false);
      
      if(res.success) alert("Password changed successfully.");
      else alert(res.message);
  }

  // --- CORE GENERATION LOGIC ---

  const handleGenerate = async () => {
    const apiKey = getApiKey(); 
    if (!apiKey && !hasApiKey) {
       alert("API Key is missing. Please connect your API key.");
       return;
    }
    const finalKey = apiKey || "";
    setIsProcessing(true);
    try {
      const promises = [];
      for(let i=0; i<input.variations; i++) {
        promises.push(generateBanner(input, finalKey));
      }
      const results = await Promise.all(promises);
      const flattened = results.flat();
      const newImages: GeneratedImage[] = flattened.map((url, idx) => ({
        id: Date.now().toString() + idx,
        url,
        promptUsed: 'Standard generation',
      }));
      setGeneratedImages(newImages);
      setStep(workflow === WorkflowType.SINGLE ? AppStep.GENERATION_SINGLE : AppStep.MASTER_APPROVAL);

      // LOG USAGE COST
      const count = flattened.length;
      if (user && count > 0) {
          logUsage(user.id, 'GENERATE_IMAGE', count, count * COST_PER_IMAGE, 'Single Workflow');
      }

    } catch (error) {
      console.error(error);
      alert("Generation failed. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRegenerate = async () => {
    const apiKey = getApiKey();
    if ((!apiKey && !hasApiKey) || !regenerateModalOpen) return;

    setIsProcessing(true);
    try {
      const relatedBatchItem = batchItems.find(item => item.generatedBanner?.id === regenerateModalOpen.id);
      const isBatchItem = !!relatedBatchItem;
      const newUrls = await generateBanner(
        { ...input, variations: 1 }, 
        apiKey || "", 
        isBatchItem ? relatedBatchItem.productImage : undefined,
        (workflow === WorkflowType.BULK || isBatchItem) ? masterImage?.url : undefined, 
        regenerationInstruction
      );
      if(newUrls.length > 0) {
        const newImage: GeneratedImage = {
          id: Date.now().toString(),
          url: newUrls[0],
          promptUsed: `Regenerated: ${regenerationInstruction}`,
        };
        if (isBatchItem) {
           setBatchItems(prev => prev.map(item => {
             if (item.generatedBanner?.id === regenerateModalOpen.id) {
               return { ...item, generatedBanner: newImage };
             }
             return item;
           }));
        } else {
           setGeneratedImages(prev => [newImage, ...prev]);
        }
        
        // LOG USAGE
        if (user) logUsage(user.id, 'GENERATE_IMAGE', 1, COST_PER_IMAGE, 'Regeneration');
      }
      setRegenerateModalOpen(null);
      setRegenerationInstruction('');
    } catch (error) {
      console.error(error);
      alert("Regeneration failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInpaintingSave = async (maskBase64: string, prompt: string) => {
    const apiKey = getApiKey();
    if (!editingImageId || (!apiKey && !hasApiKey)) return;
    let originalUrl = '';
    const imgInList = generatedImages.find(img => img.id === editingImageId);
    const itemInBatch = batchItems.find(item => item.generatedBanner?.id === editingImageId);
    if (imgInList) originalUrl = imgInList.url;
    else if (itemInBatch && itemInBatch.generatedBanner) originalUrl = itemInBatch.generatedBanner.url;
    if (!originalUrl) return;

    setIsProcessing(true);
    try {
      const newUrl = await editBannerWithMask(originalUrl, maskBase64, prompt, apiKey || "");
      const newImage: GeneratedImage = {
        id: Date.now().toString(),
        url: newUrl,
        promptUsed: prompt,
      };
      if (imgInList) {
        setGeneratedImages(prev => [newImage, ...prev]);
      } else if (itemInBatch) {
        setBatchItems(prev => prev.map(item => {
           if (item.generatedBanner?.id === editingImageId) return { ...item, generatedBanner: newImage };
           return item;
        }));
      }
      setEditingImageId(null); 
      // LOG USAGE
      if (user) logUsage(user.id, 'EDIT_IMAGE', 1, COST_PER_IMAGE, 'Magic Editor');

    } catch (error) {
      console.error(error);
      alert("Editing failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadImage = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const confirmMasterStyle = (img: GeneratedImage) => {
    setMasterImage({ ...img, isMaster: true });
    setStep(AppStep.BATCH_PROCESSING);
  };

  const handleBatchUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach((file) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setBatchItems(prev => [...prev, {
            id: Date.now().toString() + Math.random(),
            productImage: reader.result as string,
            generatedBanner: null
          }]);
        };
        reader.readAsDataURL(file as Blob);
      });
    }
  };

  const generateBatchItem = async (itemId: string) => {
    const apiKey = getApiKey();
    if (!apiKey && !hasApiKey) {
      alert("API Key missing");
      return;
    }
    const item = batchItems.find(i => i.id === itemId);
    if (!item || !masterImage) return;

    setIsProcessing(true);
    try {
      const newBanners = await generateBanner(
        { ...input, variations: 1 }, 
        apiKey || "", 
        item.productImage, 
        masterImage.url
      );
      if (newBanners.length > 0) {
        setBatchItems(prev => prev.map(i => {
           if (i.id === itemId) return { ...i, generatedBanner: { id: Date.now().toString(), url: newBanners[0], promptUsed: 'Batch Gen' } };
           return i;
        }));
        
        // LOG USAGE
        if (user) logUsage(user.id, 'BATCH_GENERATE', 1, COST_PER_IMAGE, 'Batch Item');
      }
    } catch (e) {
      console.error(e);
      alert("Failed to generate for this item");
    } finally {
      setIsProcessing(false);
    }
  };

  // --- RENDERERS ---

  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  if (!hasApiKey) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 font-sans">
        <div className="bg-white p-10 rounded-2xl shadow-xl max-w-md w-full text-center border border-slate-100">
           <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
             <Wand2 className="text-red-600" size={32} />
           </div>
           <h2 className="text-2xl font-bold mb-3 text-slate-800">Activation Required</h2>
           <p className="text-slate-600 mb-8 leading-relaxed">
             To access high-quality AI design tools, please select a valid API key with billing enabled.
           </p>
           <button onClick={handleSelectKey} className="bg-red-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-red-700 w-full transition shadow-lg shadow-red-500/30">
             Connect API Key
           </button>
        </div>
      </div>
    );
  }

  const renderWorkflowSelection = () => (
    <div className="max-w-5xl mx-auto py-16 px-4">
      <div className="text-center mb-16">
        <h1 className="text-5xl font-extrabold text-slate-900 mb-6 tracking-tight">Ads Banner Design AI <span className="text-red-600 text-2xl font-bold block mt-2">by ABC Digi</span></h1>
        <p className="text-xl text-slate-500 w-full max-w-3xl mx-auto whitespace-nowrap overflow-hidden text-ellipsis">Define your content, brand identity, and upload assets to get started.</p>
      </div>
      
      <div className="grid md:grid-cols-2 gap-8">
        <div 
          onClick={() => { setWorkflow(WorkflowType.SINGLE); setStep(AppStep.INPUT_DETAILS); }}
          className="group relative bg-white p-10 rounded-3xl shadow-sm border border-slate-200 hover:border-red-500 hover:shadow-2xl hover:shadow-red-500/10 transition-all duration-300 cursor-pointer overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Wand2 size={120} className="text-red-600" />
          </div>
          <div className="bg-red-50 w-16 h-16 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition duration-300">
            <Wand2 className="text-red-600" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-4">Single Design</h2>
          <p className="text-slate-600 mb-8 leading-relaxed">Design a specific banner for one product. Ideal for quick campaigns, A/B testing, and detailed customization.</p>
          <div className="flex items-center text-red-600 font-bold group-hover:translate-x-2 transition-transform">
            Start Designing <ArrowRight className="ml-2 w-5 h-5" />
          </div>
        </div>

        <div 
          onClick={() => { setWorkflow(WorkflowType.BULK); setStep(AppStep.INPUT_DETAILS); }}
          className="group relative bg-white p-10 rounded-3xl shadow-sm border border-slate-200 hover:border-orange-500 hover:shadow-2xl hover:shadow-orange-500/10 transition-all duration-300 cursor-pointer overflow-hidden"
        >
           <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Layers size={120} className="text-orange-600" />
          </div>
          <div className="bg-orange-50 w-16 h-16 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition duration-300">
            <Layers className="text-orange-600" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-4">Bulk Generation</h2>
          <p className="text-slate-600 mb-8 leading-relaxed">Create a master style and apply it to an entire product catalog automatically. Maintain consistency at scale.</p>
          <div className="flex items-center text-orange-600 font-bold group-hover:translate-x-2 transition-transform">
            Start Bulk Process <ArrowRight className="ml-2 w-5 h-5" />
          </div>
        </div>
      </div>
    </div>
  );

  const renderGallery = (title: string, subtitle: string, isSelectionMode = false) => (
    <div className="max-w-7xl mx-auto py-10 px-4">
      <div className="flex flex-col md:flex-row md:justify-between md:items-end mb-10 gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 mb-2">{title}</h2>
          <p className="text-slate-500 text-lg">{subtitle}</p>
        </div>
        <div className="flex gap-2">
            {/* Share Button for Current Project */}
            {projectId && (
                <button 
                  onClick={(e) => handleOpenShareModal(e, projectId, sharedWith)} 
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-50 border border-blue-200 text-blue-700 font-semibold rounded-lg hover:bg-blue-100 transition shadow-sm"
                >
                  <Users size={16} /> Share
                </button>
            )}
            <button 
              onClick={() => setStep(AppStep.INPUT_DETAILS)} 
              className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 font-semibold rounded-lg hover:border-red-500 hover:text-red-600 hover:bg-red-50 transition shadow-sm"
            >
              <Edit3 size={16} /> Edit Inputs
            </button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {generatedImages.map((img) => (
          <div key={img.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden group hover:shadow-xl transition-all duration-300">
            <div className="aspect-square relative bg-slate-100 cursor-pointer" onClick={() => setZoomedImage(img.url)}>
               <img src={img.url} alt="Generated Banner" className="w-full h-full object-contain" />
               <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center gap-4 backdrop-blur-sm px-4">
                  <button onClick={(e) => { e.stopPropagation(); setZoomedImage(img.url); }} className="bg-white/10 text-white p-3 rounded-full hover:bg-white hover:text-slate-900 backdrop-blur-md transition transform hover:scale-110"><ZoomIn size={24} /></button>
                  <button onClick={(e) => { e.stopPropagation(); downloadImage(img.url, `banner-${img.id}.png`); }} className="bg-white/10 text-white p-3 rounded-full hover:bg-white hover:text-slate-900 backdrop-blur-md transition transform hover:scale-110"><Download size={24} /></button>
                  <button onClick={(e) => { e.stopPropagation(); setEditingImageId(img.id); }} className="bg-white/10 text-white p-3 rounded-full hover:bg-white hover:text-slate-900 backdrop-blur-md transition transform hover:scale-110"><Edit3 size={24} /></button>
                  <button onClick={(e) => { e.stopPropagation(); setRegenerateModalOpen({id: img.id, url: img.url}); }} className="bg-white/10 text-white p-3 rounded-full hover:bg-white hover:text-slate-900 backdrop-blur-md transition transform hover:scale-110"><RefreshCw size={24} /></button>
               </div>
            </div>
            <div className="p-5 bg-white border-t border-slate-100">
              {isSelectionMode ? (
                <button onClick={() => confirmMasterStyle(img)} className="w-full bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 transition shadow-lg shadow-red-500/20">Select as Master Style</button>
              ) : (
                <div className="flex justify-between items-center text-sm text-slate-400">
                  <span className="truncate max-w-[150px]">ID: {img.id.slice(-6)}</span>
                  <span className="bg-slate-50 px-2 py-1 rounded text-xs border border-slate-100">AI Generated</span>
                </div>
              )}
            </div>
          </div>
        ))}
        {generatedImages.length === 0 && !isProcessing && (
           <div className="col-span-full text-center py-20 text-slate-400 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
             <ImagePlus className="mx-auto mb-4 opacity-50" size={48} />
             <p className="text-lg font-medium">No designs generated yet.</p>
           </div>
        )}
      </div>
    </div>
  );

  const renderBatchProcessing = () => (
    <div className="max-w-7xl mx-auto py-10 px-4">
      <div className="flex flex-col md:flex-row items-start md:items-center gap-8 mb-12 bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
        <div className="w-32 h-32 bg-slate-100 rounded-2xl overflow-hidden flex-shrink-0 border border-red-200 shadow-md">
          {masterImage && <img src={masterImage.url} className="w-full h-full object-cover" alt="Master" />}
        </div>
        <div className="flex-1 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold uppercase tracking-wider">
            <CheckCircle size={12} /> Master Style Active
          </div>
          <h3 className="text-2xl font-bold text-slate-900">Batch Generation in Progress</h3>
          <p className="text-slate-600">Upload multiple product images below.</p>
        </div>
        <div className="relative">
          <input type="file" multiple accept="image/*" onChange={handleBatchUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
          <button className="bg-red-600 text-white px-8 py-4 rounded-xl font-bold hover:bg-red-700 hover:shadow-lg hover:shadow-red-500/30 transition flex items-center gap-3">
            <ImagePlus size={20} /> Upload Products
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {batchItems.map((item, index) => (
          <div key={item.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col gap-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <span className="font-bold text-slate-700">Product #{index + 1}</span>
              <button onClick={() => setBatchItems(prev => prev.filter(i => i.id !== item.id))} className="text-slate-400 hover:text-red-500 transition"><Trash2 size={20} /></button>
            </div>
            <div className="grid grid-cols-2 gap-6 h-64">
              <div className="bg-slate-50 rounded-xl flex items-center justify-center p-4 relative border border-dashed border-slate-300">
                <img src={item.productImage} className="max-h-full max-w-full object-contain drop-shadow-sm" alt="Product" />
              </div>
              <div className="bg-slate-50 rounded-xl flex items-center justify-center p-4 relative border border-slate-200 overflow-hidden group">
                {item.generatedBanner ? (
                  <>
                    <img src={item.generatedBanner.url} className="max-h-full max-w-full object-contain cursor-pointer" onClick={() => setZoomedImage(item.generatedBanner!.url)} alt="Result" />
                    <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all duration-200">
                       <button onClick={() => downloadImage(item.generatedBanner!.url, `batch-${index}.png`)} className="bg-white shadow-md p-2 rounded-full hover:bg-blue-50 text-slate-700 hover:text-blue-600"><Download size={16} /></button>
                       <button onClick={() => setEditingImageId(item.generatedBanner!.id)} className="bg-white shadow-md p-2 rounded-full hover:bg-blue-50 text-slate-700 hover:text-blue-600"><Edit3 size={16} /></button>
                       <button onClick={() => setZoomedImage(item.generatedBanner!.url)} className="bg-white shadow-md p-2 rounded-full hover:bg-blue-50 text-slate-700 hover:text-blue-600"><ZoomIn size={16} /></button>
                    </div>
                  </>
                ) : (
                  <button onClick={() => generateBatchItem(item.id)} disabled={isProcessing} className="w-full h-full bg-white border border-red-200 text-red-600 px-4 py-2 rounded-lg hover:bg-red-50 shadow-sm text-sm font-bold">Generate Banner</button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      {batchItems.length > 0 && <div className="flex justify-center mt-12 mb-12"><button onClick={() => batchItems.forEach(item => { if(!item.generatedBanner) generateBatchItem(item.id); })} className="bg-slate-900 text-white px-10 py-4 rounded-xl font-bold text-lg hover:bg-slate-800 disabled:opacity-50" disabled={isProcessing}>Generate All</button></div>}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-12 font-sans text-slate-900">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setStep(AppStep.SELECT_WORKFLOW)}>
            <div className="bg-gradient-to-br from-red-600 to-orange-600 text-white p-2 rounded-lg shadow-lg shadow-red-500/20 group-hover:shadow-red-500/40 transition-all">
               <Wand2 size={24} />
            </div>
            <div>
               <h1 className="font-bold text-xl tracking-tight text-slate-900 leading-none">AdsGen<span className="text-red-600">AI</span></h1>
               <span className="text-[10px] text-slate-400 font-medium tracking-wider uppercase">by ABC Digi | Hi, {user.name}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
             {user.role === 'ADMIN' && (
                 <button 
                    onClick={() => setShowAdminPanel(true)}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 transition"
                 >
                    <Shield size={16} /> Admin
                 </button>
             )}
             
             <button 
                onClick={handleLoadProjectsList} 
                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
             >
                <FolderOpen size={16} /> Projects
             </button>
             <button 
                type="button"
                onClick={initiateSave} 
                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition shadow-lg shadow-slate-900/20"
             >
                <Save size={16} /> Save
             </button>
             
             <div className="relative group/menu">
                <button className="p-2 text-slate-400 hover:text-slate-800 transition"><Users size={20} /></button>
                {/* INVISIBLE BRIDGE APPLIED HERE: top-full and pt-2 to create connected hover area */}
                <div className="absolute right-0 top-full pt-2 w-56 hidden group-hover/menu:block hover:block z-50">
                    <div className="bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                      <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsUsageDashboardOpen(true); }} className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-2 text-sm text-slate-700">
                          <TrendingUp size={16} className="text-green-600" /> Usage & Billing
                      </button>
                      <button onClick={handleChangePass} className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-2 text-sm text-slate-700">
                          <Key size={16} /> Change Password
                      </button>
                      <button onClick={handleLogout} className="w-full text-left px-4 py-3 hover:bg-red-50 flex items-center gap-2 text-sm text-red-600 border-t border-slate-100">
                          <LogOut size={16} /> Logout
                      </button>
                    </div>
                </div>
             </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-8">
        
        {/* GLOBAL STATUS MESSAGES - FIXED POSITION Z-INDEX FIX */}
        {statusMessage && (
            <div className={`fixed top-24 right-6 z-[100] max-w-sm animate-slide-in`}>
                <div className={`p-4 rounded-xl flex items-center gap-3 shadow-xl border border-opacity-50 backdrop-blur-md ${statusMessage.type === 'error' ? 'bg-red-50/95 border-red-200 text-red-800' : 'bg-green-50/95 border-green-200 text-green-800'}`}>
                    {statusMessage.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
                    <span className="font-medium text-sm">{statusMessage.text}</span>
                    <button onClick={() => setStatusMessage(null)} className="ml-auto opacity-50 hover:opacity-100"><X size={18} /></button>
                </div>
            </div>
        )}

        {step === AppStep.SELECT_WORKFLOW && renderWorkflowSelection()}
        {step === AppStep.INPUT_DETAILS && (
          <div className="px-4">
             <div className="text-center mb-10">
               <h2 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-orange-600 mb-3">Configure Your Design</h2>
               <p className="text-slate-500 text-lg w-full max-w-3xl mx-auto whitespace-nowrap overflow-hidden text-ellipsis">Define your content, brand identity, and upload assets to get started.</p>
             </div>
             <InputForm input={input} setInput={setInput} onNext={handleGenerate} onBack={() => setStep(AppStep.SELECT_WORKFLOW)} isProcessing={isProcessing} />
          </div>
        )}
        {step === AppStep.GENERATION_SINGLE && renderGallery("Generated Designs", "Click on any design to zoom, edit, or download.")}
        {step === AppStep.MASTER_APPROVAL && renderGallery("Select Master Style", "Choose the best design to serve as the template for your bulk generation.", true)}
        {step === AppStep.BATCH_PROCESSING && renderBatchProcessing()}
      </main>

      {/* Overlays */}
      {editingImageId && <ImageEditor imageUrl={generatedImages.find(i => i.id === editingImageId)?.url || batchItems.find(item => item.generatedBanner?.id === editingImageId)?.generatedBanner?.url || ''} onSave={handleInpaintingSave} onCancel={() => setEditingImageId(null)} isProcessing={isProcessing} />}
      
      {zoomedImage && <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 md:p-10" onClick={() => setZoomedImage(null)}><button className="absolute top-6 right-6 text-white/50 hover:text-white p-2" onClick={() => setZoomedImage(null)}><X size={32} /></button><img src={zoomedImage} alt="Zoomed" className="max-w-full max-h-full rounded-lg shadow-2xl object-contain" onClick={(e) => e.stopPropagation()} /></div>}
      
      {regenerateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6 relative">
            <button onClick={() => setRegenerateModalOpen(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700"><X size={24} /></button>
            <div className="mb-6"><h3 className="text-xl font-bold text-slate-900 mb-2">Regenerate Design</h3><p className="text-sm text-slate-500">Provide new instructions.</p></div>
            <div className="space-y-4">
              <div className="bg-slate-50 p-3 rounded-lg flex items-center justify-center border border-slate-100"><img src={regenerateModalOpen.url} className="h-32 object-contain rounded" alt="Previous" /></div>
              <div><label className="block text-sm font-semibold text-slate-700 mb-2">Instructions</label><textarea value={regenerationInstruction} onChange={(e) => setRegenerationInstruction(e.target.value)} rows={3} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg outline-none resize-none" /></div>
              <div className="flex gap-3 pt-2"><button onClick={() => setRegenerateModalOpen(null)} className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg">Cancel</button><button onClick={handleRegenerate} disabled={isProcessing || !regenerationInstruction.trim()} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-bold">{isProcessing ? 'Processing...' : 'Regenerate'}</button></div>
            </div>
          </div>
        </div>
      )}

      {/* Save Project Modal */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 animate-scale-in">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-slate-900">Save Project</h3>
                    <button onClick={() => setIsSaveModalOpen(false)}><X className="text-slate-400 hover:text-slate-800" /></button>
                </div>
                <p className="text-slate-600 mb-4 text-sm">Give your project a name to save it to your Google Drive.</p>
                <input 
                    type="text" 
                    value={saveNameInput} 
                    onChange={(e) => setSaveNameInput(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none mb-6 font-medium text-slate-800"
                    placeholder="Project Name..."
                    autoFocus
                />
                <div className="flex gap-3">
                    <button onClick={() => setIsSaveModalOpen(false)} className="flex-1 py-3 border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
                    <button onClick={confirmSave} disabled={!saveNameInput.trim()} className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 disabled:opacity-50 transition">Save to Drive</button>
                </div>
            </div>
        </div>
      )}

      {/* SHARE PROJECT MODAL - REDESIGNED */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6 animate-scale-in flex flex-col max-h-[85vh]">
                
                {/* Modal Header */}
                <div className="flex justify-between items-center mb-2 flex-shrink-0">
                    <div className="flex items-center gap-2">
                       <div className="bg-blue-100 p-2 rounded-lg text-blue-600"><Share2 size={20} /></div>
                       <div>
                         <h3 className="text-xl font-bold text-slate-900">Share Project</h3>
                         <p className="text-xs text-slate-500">Manage who has access to this project.</p>
                       </div>
                    </div>
                    <button onClick={() => setIsShareModalOpen(false)} className="p-1 hover:bg-slate-100 rounded-full transition"><X className="text-slate-400 hover:text-slate-800" /></button>
                </div>
                
                {/* SECTION 1: PEOPLE WITH ACCESS */}
                <div className="mb-6 flex-shrink-0">
                  <h4 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
                    People with access
                    <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full text-xs">{selectedShareIds.length}</span>
                  </h4>
                  <div className="max-h-40 overflow-y-auto border border-slate-100 rounded-xl bg-slate-50/50">
                    {selectedShareIds.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400">No one else has access yet.</div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {selectedShareIds.map(uid => {
                          const userName = getUserName(uid);
                          return (
                            <div key={uid} className="flex items-center justify-between p-3">
                              <div className="flex items-center gap-3 overflow-hidden">
                                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                                  {userName.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-sm font-medium text-slate-800 truncate">{userName}</div>
                                  <div className="text-xs text-slate-400 truncate">@{uid}</div>
                                </div>
                              </div>
                              <button 
                                onClick={() => removeUserFromShare(uid)}
                                className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition"
                                title="Remove Access"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* SECTION 2: ADD PEOPLE */}
                <div className="flex-1 flex flex-col min-h-0">
                    <h4 className="text-sm font-bold text-slate-800 mb-2">Add people</h4>
                    
                    {/* Search Bar */}
                    <div className="relative mb-3 flex-shrink-0">
                       <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                         <Search size={16} />
                       </div>
                       <input 
                          type="text"
                          value={shareSearch}
                          onChange={(e) => setShareSearch(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm text-slate-800 placeholder:text-slate-400"
                          placeholder="Search users to add..."
                       />
                    </div>

                    {/* Available Users List */}
                    <div className="flex-1 overflow-y-auto border border-slate-100 rounded-xl bg-white">
                        {isLoadingUsers ? (
                            <div className="p-8 text-center text-slate-400 flex flex-col items-center">
                                <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent mb-2"></div>
                                <span>Loading users...</span>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {allUsers
                                    .filter(u => 
                                        !selectedShareIds.includes(u.id) && // Filter out already added
                                        (u.id !== user?.id) && // Filter out self
                                        (u.name.toLowerCase().includes(shareSearch.toLowerCase()) || 
                                         u.id.toLowerCase().includes(shareSearch.toLowerCase()))
                                    )
                                    .map(u => (
                                        <div 
                                            key={u.id} 
                                            className="flex items-center justify-between p-3 hover:bg-slate-50 transition-colors group"
                                        >
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                                    {u.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-sm font-medium text-slate-800 truncate">{u.name}</div>
                                                    <div className="text-xs text-slate-400 truncate">@{u.id}</div>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => addUserToShare(u.id)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                                            >
                                                <UserPlus size={14} /> Add
                                            </button>
                                        </div>
                                    ))
                                }
                                {allUsers.filter(u => !selectedShareIds.includes(u.id) && u.id !== user?.id).length === 0 && (
                                    <div className="p-8 text-center text-slate-400 text-sm">
                                       No other users found to add.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                
                <div className="flex gap-3 mt-4 flex-shrink-0 pt-4 border-t border-slate-100">
                    <button onClick={() => setIsShareModalOpen(false)} className="flex-1 py-3 border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
                    <button onClick={confirmShare} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-500/20">
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* NEW: USAGE & BILLING DASHBOARD */}
      {isUsageDashboardOpen && user && (
          <UsageDashboard currentUser={user} onClose={() => setIsUsageDashboardOpen(false)} />
      )}

      {/* Admin Panel Modal */}
      {showAdminPanel && user?.role === 'ADMIN' && (
          <AdminPanel currentUser={user} onClose={() => setShowAdminPanel(false)} />
      )}

      {/* Project List Modal - ENHANCED */}
      {showProjectList && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl h-[85vh] flex flex-col animate-scale-in">
            
            {/* Header with Search and Filter */}
            <div className="p-6 border-b border-slate-100 flex-shrink-0 bg-white z-10 rounded-t-2xl">
               <div className="flex justify-between items-start mb-4">
                   <div>
                       <h3 className="text-2xl font-bold text-slate-900">Project Workspace</h3>
                       <p className="text-sm text-slate-500">
                          {user?.role === 'ADMIN' ? 'All Projects (Admin View)' : 'My Projects & Shared With Me'}
                       </p>
                   </div>
                   <button onClick={() => setShowProjectList(false)} className="p-2 hover:bg-slate-100 rounded-full transition"><X size={24} className="text-slate-400" /></button>
               </div>

               {/* Filter Bar */}
               <div className="flex flex-col md:flex-row gap-3">
                  <div className="relative flex-1">
                     <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
                        <Search size={16} />
                     </div>
                     <input 
                        type="text" 
                        placeholder="Search projects..." 
                        value={projectSearch}
                        onChange={(e) => setProjectSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none"
                     />
                  </div>
                  
                  <div className="relative md:w-64">
                     <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
                        <Filter size={16} />
                     </div>
                     <select 
                        value={projectUserFilter}
                        onChange={(e) => setProjectUserFilter(e.target.value)}
                        className="w-full pl-10 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none appearance-none cursor-pointer"
                     >
                        <option value="ALL">All Owners</option>
                        {/* Get unique owners from savedProjects */}
                        {Array.from(new Set(savedProjects.map(p => p.ownerId))).map(uid => (
                           <option key={uid} value={uid}>Owner: {getUserName(uid as string)}</option>
                        ))}
                     </select>
                  </div>
               </div>
            </div>

            {/* Project List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-slate-50/50">
               {savedProjects.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                     <FolderOpen size={48} className="mb-4 opacity-30" />
                     <p>No projects found.</p>
                  </div>
               ) : (
                  savedProjects
                    .filter(p => {
                       const matchSearch = p.name.toLowerCase().includes(projectSearch.toLowerCase());
                       const matchUser = projectUserFilter === 'ALL' || p.ownerId === projectUserFilter;
                       return matchSearch && matchUser;
                    })
                    .map((p: any) => {
                    const isOwner = p.ownerId === user?.id;
                    const sharedList = p.sharedWith || [];
                    
                    return (
                        <div key={p.id} className="p-5 border border-slate-200 rounded-xl hover:border-red-500 hover:bg-white bg-white shadow-sm hover:shadow-md cursor-pointer transition flex flex-col md:flex-row md:items-center justify-between group gap-4">
                            <div onClick={() => loadSelectedProject(p)} className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-1">
                                    <h4 className="font-bold text-lg text-slate-800 truncate">{p.name}</h4>
                                    {!isOwner && <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">Shared</span>}
                                    {p.fileId && <span className="text-slate-400" title="Saved in Drive Folder"><Cloud size={16} /></span>}
                                </div>
                                
                                <div className="text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-1 items-center">
                                    <span className="flex items-center gap-1">
                                       Created by <span className="font-semibold text-slate-700">{getUserName(p.ownerId)}</span>
                                    </span>
                                    <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                    <span>{new Date(p.timestamp).toLocaleDateString()}</span>
                                </div>

                                {/* Shared With Display */}
                                {sharedList.length > 0 && (
                                   <div className="mt-3 flex items-center gap-2">
                                      <div className="flex -space-x-2">
                                         {sharedList.slice(0, 5).map((uid: string) => (
                                            <div key={uid} className="w-6 h-6 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-blue-600" title={getUserName(uid)}>
                                               {getUserName(uid).charAt(0).toUpperCase()}
                                            </div>
                                         ))}
                                         {sharedList.length > 5 && (
                                            <div className="w-6 h-6 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-500">
                                               +{sharedList.length - 5}
                                            </div>
                                         )}
                                      </div>
                                      <span className="text-xs text-slate-400">Shared with {sharedList.length} users</span>
                                   </div>
                                )}
                            </div>
                            
                            <div className="flex items-center gap-2 border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-4">
                                <button 
                                    onClick={(e) => handleOpenShareModal(e, p.id, p.sharedWith)} 
                                    className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-2 group/btn"
                                    title="Manage Access"
                                >
                                    <Users size={18} />
                                    <span className="md:hidden text-sm font-medium">Share</span>
                                </button>
                                <button 
                                    onClick={() => loadSelectedProject(p)}
                                    className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2 md:hidden"
                                >
                                    <FolderOpen size={18} />
                                    <span className="text-sm font-medium">Open</span>
                                </button>
                                <button 
                                   onClick={(e) => { e.stopPropagation(); loadSelectedProject(p); }} 
                                   className="hidden md:block p-2 hover:bg-slate-100 rounded-full transition text-slate-300 hover:text-red-600 ml-2"
                                >
                                    <ArrowRight size={20} />
                                </button>
                            </div>
                        </div>
                    );
                  })
               )}
               {savedProjects.filter(p => p.name.toLowerCase().includes(projectSearch.toLowerCase())).length === 0 && savedProjects.length > 0 && (
                  <div className="text-center py-10 text-slate-400">
                     No projects match your search.
                  </div>
               )}
            </div>
          </div>
        </div>
      )}

      {isProcessing && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
           <div className="relative">
             <div className="animate-spin rounded-full h-20 w-20 border-t-4 border-b-4 border-red-600 mb-4"></div>
             <div className="absolute inset-0 flex items-center justify-center"><Wand2 className="text-red-600 animate-pulse" size={24} /></div>
           </div>
           <p className="text-xl font-bold text-slate-800 mt-4">Processing...</p>
        </div>
      )}
    </div>
  );
}

export default App;
