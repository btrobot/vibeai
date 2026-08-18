import { aiModels } from '../../db/schema/gateway';
import type { AdapterModel } from './adapters/protocol-adapter.interface';

export function toAdapterModel(row: typeof aiModels.$inferSelect): AdapterModel {
  return {
    slug: row.slug,
    name: row.name,
    sdkModelId: row.sdkModelId,
    modality: row.modality as AdapterModel['modality'],
    outputType: row.outputType,
    providerName: row.providerName,
    sdkClient: row.sdkClient,
    capabilities: row.capabilities ?? [],
    constraints: (row.constraints as Record<string, unknown>) || {},
    inputSchema: (row.inputSchema as Record<string, unknown> | undefined) || {},
    defaultParams: (row.defaultParams as Record<string, unknown>) || {},
    costCredits: row.costCredits,
    sortOrder: row.sortOrder,
  };
}
