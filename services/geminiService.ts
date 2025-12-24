import { GoogleGenAI } from "@google/genai";
import { BannerInput, AspectRatio } from "../types";

// Using the strongest image preview model as requested
const MODEL_NAME = 'gemini-3-pro-image-preview';

// Helper to strip the data:image/xyz;base64, prefix
const cleanBase64 = (dataUrl: string) => {
  return dataUrl.split(',')[1];
};

const getMimeType = (dataUrl: string) => {
  return dataUrl.substring(dataUrl.indexOf(':') + 1, dataUrl.indexOf(';'));
};

const getClosestAspectRatio = (width: number, height: number): string => {
  const targetRatio = width / height;
  
  const ratios = [
    { name: "1:1", value: 1.0 },
    { name: "3:4", value: 3/4 }, // 0.75
    { name: "4:3", value: 4/3 }, // 1.33
    { name: "9:16", value: 9/16 }, // 0.5625
    { name: "16:9", value: 16/9 }, // 1.777
  ];

  const closest = ratios.reduce((prev, curr) => {
    return (Math.abs(curr.value - targetRatio) < Math.abs(prev.value - targetRatio) ? curr : prev);
  });

  return closest.name;
};

export const generateBanner = async (
  input: BannerInput,
  apiKey: string,
  customProductImage?: string, // Optional override for batch mode
  masterStyleImage?: string, // Optional reference for batch mode
  regenerationInstruction?: string // New: Instruction for fixing/regenerating
): Promise<string[]> => {
  const ai = new GoogleGenAI({ apiKey });

  const productImage = customProductImage || input.productImage;
  
  if (!productImage) {
    throw new Error("Product image is required");
  }

  // Determine Aspect Ratio Logic
  let targetRatioConfig = "1:1"; // Default fallback
  let dimensionInstruction = "";

  if (input.aspectRatio === AspectRatio.CUSTOM) {
     const w = input.customWidth || 1080;
     const h = input.customHeight || 1080;
     // Calculate closest supported ratio for the API config
     targetRatioConfig = getClosestAspectRatio(w, h);
     // Add explicit instructions to the prompt
     dimensionInstruction = `\n- TARGET DIMENSIONS: ${w}px width by ${h}px height. The layout MUST be optimized for this exact size.`;
  } else {
     // Standard Logic
     if ([AspectRatio.LANDSCAPE_16_9, AspectRatio.LANDSCAPE_2_1].includes(input.aspectRatio)) targetRatioConfig = "16:9";
     if ([AspectRatio.PORTRAIT_9_16, AspectRatio.PORTRAIT_1_2].includes(input.aspectRatio)) targetRatioConfig = "9:16";
     if ([AspectRatio.PORTRAIT_3_4, AspectRatio.PORTRAIT_4_5, AspectRatio.PORTRAIT_2_3].includes(input.aspectRatio)) targetRatioConfig = "3:4";
     if ([AspectRatio.LANDSCAPE_4_3, AspectRatio.LANDSCAPE_5_4, AspectRatio.LANDSCAPE_3_2].includes(input.aspectRatio)) targetRatioConfig = "4:3";
  }


  // Construct a detailed prompt for the designer model
  let prompt = `Design a high-conversion advertising banner. 
  
  Product Information:
  - Product Description: "${input.productDescription}"
  - Headline: "${input.headline}" (PRIMARY TEXT: Largest and most prominent text element)
  - Sub-Headline: "${input.subHeadline}" (SECONDARY TEXT: Must be bigger/bolder than body text, but smaller/less prominent than the Headline. Supports the headline.)
  - Body Copy: "${input.bodyText}"
  - CTA Button: "${input.cta}"
  
  Branding & Visuals:
  - Primary Color: ${input.primaryColor || 'Brand Compatible'}
  - Secondary Color: ${input.secondaryColor || 'Complementary'}
  - Font Style: ${input.fontMain || 'Modern Sans'} (Headlines), ${input.fontSecondary || 'Readable Sans'} (Body)
  
  Design Direction:
  - Aspect Ratio Config: ${targetRatioConfig} (API Setting) ${dimensionInstruction}
  - Design Style: ${input.designStyle || 'Modern, Clean, Professional, Mobile-First'}
  - Context/Background: ${input.designContext || 'Contextual to the product, ensuring high text readability'}
  - Ensure the product image is the focal point.
  - If a logo is provided, place it appropriately (usually top corner).
  `;

  if (masterStyleImage) {
    // UPDATED PROMPT LOGIC FOR BATCH MODE
    prompt += `\n\nCAMPAIGN CONSISTENCY MODE:
    You are creating a new banner for a DIFFERENT product but within the SAME AD CAMPAIGN as the provided "Master Reference Image".
    
    INSTRUCTIONS:
    1. ANALYZE the Master Reference Image: Extract the brand identity, color palette, font treatment, graphic decorations, lighting style, and overall "vibe".
    2. ADAPT for the New Product: The new product provided here has its own angle, perspective, and lighting. Do NOT blindly copy-paste the background from the master image if it clashes with the new product's perspective.
    3. GENERATE: Create a FRESH background and layout that perfectly matches the perspective and physics of the *new* product, while strictly adhering to the *Brand Identity* (fonts, colors, elements) of the Master Image.
    
    The goal is for the two banners to look like siblings in a cohesive campaign, not identical clones with pasted products.`;
  }

  // Handle Regeneration specific instruction
  if (regenerationInstruction) {
    prompt += `\n\nREVISION REQUEST: The user is not satisfied with the previous version. Please regenerate the banner with this specific correction: "${regenerationInstruction}". Keep the core product info, but adapt the design to satisfy this request.`;
  }

  // Handle Headline Font Reference Instruction
  if (input.headlineFontReference) {
    prompt += `\n\nTYPOGRAPHY STYLE INSTRUCTION (IMPORTANT):
    - An image labeled 'Headline Font Style' has been provided.
    - ANALYZE the SHAPE, WEIGHT, and STYLE (Serif/Sans/Script) of the text in that reference image.
    - RECREATE this exact font style/shape for the main Headline text in the banner.
    - CRITICAL: IGNORE the color of the text in the reference image. You must color the text based on the defined 'Primary Color' or 'Secondary Color' to ensure harmony with the overall banner design.`;
  }

  const parts: any[] = [
    { text: prompt }
  ];

  // Add Product Image
  parts.push({
    inlineData: {
      data: cleanBase64(productImage),
      mimeType: getMimeType(productImage)
    }
  });

  // Add Logo if exists
  if (input.logo) {
    parts.push({
      inlineData: {
        data: cleanBase64(input.logo),
        mimeType: getMimeType(input.logo)
      }
    });
    prompt += "\nInclude the provided logo in the design.";
  }

  // Add Reference Image if exists (and not using master style yet)
  if (input.referenceImage && !masterStyleImage) {
    parts.push({
      inlineData: {
        data: cleanBase64(input.referenceImage),
        mimeType: getMimeType(input.referenceImage)
      }
    });
    prompt += "\nUse the provided reference image as visual inspiration for the mood and layout.";
  }

  // Add Headline Font Reference if exists
  if (input.headlineFontReference) {
    parts.push({
      inlineData: {
        data: cleanBase64(input.headlineFontReference),
        mimeType: getMimeType(input.headlineFontReference)
      }
    });
  }

  // Add Master Style for Batch Mode
  if (masterStyleImage) {
    parts.push({
      inlineData: {
        data: cleanBase64(masterStyleImage),
        mimeType: getMimeType(masterStyleImage)
      }
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: parts,
      },
      config: {
        imageConfig: {
          aspectRatio: targetRatioConfig,
        },
      }
    });

    const generatedImages: string[] = [];

    if (response.candidates && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          generatedImages.push(`data:image/png;base64,${part.inlineData.data}`);
        }
      }
    }

    return generatedImages;

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

export const editBannerWithMask = async (
  imageUrl: string,
  maskBase64: string,
  prompt: string,
  apiKey: string
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey });

  const parts: any[] = [
    { text: prompt },
    {
      inlineData: {
        data: cleanBase64(imageUrl),
        mimeType: getMimeType(imageUrl)
      }
    },
    {
      inlineData: {
        data: cleanBase64(maskBase64),
        mimeType: getMimeType(maskBase64)
      }
    }
  ];

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: parts,
      },
    });

    if (response.candidates && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    throw new Error("No image generated from edit request");
  } catch (error) {
    console.error("Gemini API Error (Edit):", error);
    throw error;
  }
};
