import { builtInCapabilityMap } from '../capabilities/index';
import { builtInModelMap } from '../models/index';

const capabilityToDefaultModels: Record<string, string[]> = {
  'text-generation': [
    'doubao-seed-2-0-pro-260215',
    'doubao-seed-2-0-lite-260215',
    'doubao-seed-2-0-mini-260215',
  ],
  'detail-page-generation': [
    'kimi-k2-5-260127',
    'doubao-seed-2-0-pro-260215',
    'doubao-seed-2-0-lite-260215',
  ],
  'image-generation': [
    'doubao-seedream-5-0-260128',
  ],
  'image-editing': [
    'doubao-seedream-5-0-260128',
  ],
  'background-removal': [
    'doubao-seedream-5-0-260128',
  ],
  'scene-composition': [
    'doubao-seedream-5-0-260128',
  ],
  'model-dressing': [
    'doubao-seedream-5-0-260128',
  ],
  'video-generation': [
    'doubao-seedance-1-5-pro-251215',
  ],
  'style-cloning': [
    'doubao-seedance-1-5-pro-251215',
  ],
};

export interface RouteResult {
  capabilitySlug: string;
  modelSlug: string;
  modelName: string;
  provider: string;
}

export function routeCapability(capabilitySlug: string, preferredModel?: string): RouteResult | null {
  const capability = builtInCapabilityMap.get(capabilitySlug);
  if (!capability) return null;

  // If user specified a model, check if it supports this capability
  if (preferredModel) {
    const model = builtInModelMap.get(preferredModel);
    if (model && model.capabilities.includes(capabilitySlug)) {
      return { capabilitySlug, modelSlug: model.slug, modelName: model.name, provider: model.provider };
    }
  }

  // Find the first available model
  const defaultModels = capabilityToDefaultModels[capabilitySlug];
  if (defaultModels) {
    for (const slug of defaultModels) {
      const model = builtInModelMap.get(slug);
      if (model) {
        return { capabilitySlug, modelSlug: model.slug, modelName: model.name, provider: model.provider };
      }
    }
  }

  return null;
}

export function getModelsForCapability(capabilitySlug: string): string[] {
  return capabilityToDefaultModels[capabilitySlug] ?? [];
}