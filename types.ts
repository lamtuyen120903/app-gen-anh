
export enum WorkflowType {
  SINGLE = 'SINGLE',
  BULK = 'BULK',
}

export enum AspectRatio {
  SQUARE = '1:1',
  PORTRAIT_3_4 = '3:4',
  PORTRAIT_2_3 = '2:3',
  PORTRAIT_4_5 = '4:5',
  PORTRAIT_9_16 = '9:16',
  PORTRAIT_1_2 = '1:2',
  LANDSCAPE_16_9 = '16:9',
  LANDSCAPE_4_3 = '4:3',
  LANDSCAPE_3_2 = '3:2',
  LANDSCAPE_5_4 = '5:4',
  LANDSCAPE_2_1 = '2:1',
  CUSTOM = 'Custom',
}

export interface BannerInput {
  headline: string;
  subHeadline: string;
  productDescription: string;
  bodyText: string;
  cta: string;
  primaryColor: string;
  secondaryColor: string;
  fontMain: string;
  fontSecondary: string;
  designStyle: string;
  designContext: string;
  logo: string | null; // Base64 or URL
  productImage: string | null; // Base64 or URL
  referenceImage: string | null; // Base64 or URL
  headlineFontReference: string | null; // New field for font shape reference
  aspectRatio: AspectRatio;
  variations: number;
  customWidth?: number;
  customHeight?: number;
}

export interface GeneratedImage {
  id: string;
  url: string; // Base64 data URL or Drive Link
  promptUsed: string;
  isMaster?: boolean;
}

export interface BatchItem {
  id: string;
  productImage: string; // Base64 or URL
  generatedBanner: GeneratedImage | null;
}

export enum AppStep {
  SELECT_WORKFLOW = 0,
  INPUT_DETAILS = 1,
  GENERATION_SINGLE = 2,
  MASTER_APPROVAL = 3,
  BATCH_PROCESSING = 4,
}

// --- UPDATED TYPES FOR RBAC & SHARING ---

export type UserRole = 'ADMIN' | 'USER';

export interface User {
  id: string;
  name: string;
  role: UserRole;
}

export interface ProjectData {
  id: string; // Timestamp ID
  name: string;
  ownerId: string;
  sharedWith?: string[]; // List of User IDs who can view/edit
  lastModified: string;
  workflow: WorkflowType;
  step: AppStep;
  input: BannerInput;
  generatedImages: GeneratedImage[];
  batchItems: BatchItem[];
}

// --- NEW TYPES FOR COST MANAGEMENT ---

export interface UsageLog {
  id: string;
  userId: string;
  timestamp: string;
  actionType: 'GENERATE_IMAGE' | 'EDIT_IMAGE' | 'BATCH_GENERATE';
  quantity: number; // Number of images
  cost: number; // Estimated cost in USD
  details?: string; // e.g., Project Name or Image ID
}

export interface UsageSummary {
  userId: string;
  userName: string;
  totalImages: number;
  totalCost: number;
  lastActive: string;
}
