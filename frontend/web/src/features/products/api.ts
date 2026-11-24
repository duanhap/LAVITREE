import apiClient from '@/lib/api-client';
import type {
  ProductDetailResponse,
  ProductEvidenceItem,
  ProductUsageRuleItem,
  CreateUsageRulePayload,
  UpdateUsageRulePayload,
} from './types';

export async function getProduct(id: number): Promise<ProductDetailResponse> {
  const res = await apiClient.get<ProductDetailResponse>(`/medicines/${id}`);
  return res.data;
}

export async function getProductEvidence(
  id: number,
  diseaseCode?: string
): Promise<ProductEvidenceItem[]> {
  const params: Record<string, any> = {};
  if (diseaseCode) {
    params.diseaseCode = diseaseCode;
  }
  const res = await apiClient.get<ProductEvidenceItem[]>(`/medicines/${id}/evidence`, { params });
  return res.data;
}

export async function unlinkProductSuggestion(
  suggestionId: number
): Promise<{ message: string; remaining_evidence_for_disease: number }> {
  const res = await apiClient.post<{ message: string; remaining_evidence_for_disease: number }>(
    `/knowledge/product-suggestions/${suggestionId}/unlink`
  );
  return res.data;
}

export async function updateProduct(
  id: number,
  payload: Record<string, any>
): Promise<any> {
  const res = await apiClient.patch(`/medicines/${id}`, payload);
  return res.data;
}

export async function getUsageRules(productId: number): Promise<ProductUsageRuleItem[]> {
  const res = await apiClient.get<ProductUsageRuleItem[]>(`/medicines/${productId}/usage-rules`);
  return res.data;
}

export async function createUsageRule(
  productId: number,
  payload: CreateUsageRulePayload
): Promise<ProductUsageRuleItem> {
  const res = await apiClient.post<ProductUsageRuleItem>(
    `/medicines/${productId}/usage-rules`,
    payload
  );
  return res.data;
}

export async function updateUsageRule(
  productId: number,
  ruleId: number,
  payload: UpdateUsageRulePayload
): Promise<ProductUsageRuleItem> {
  const res = await apiClient.patch<ProductUsageRuleItem>(
    `/medicines/${productId}/usage-rules/${ruleId}`,
    payload
  );
  return res.data;
}

export async function verifyUsageRule(
  productId: number,
  ruleId: number,
  verified: boolean
): Promise<ProductUsageRuleItem> {
  const res = await apiClient.post<ProductUsageRuleItem>(
    `/medicines/${productId}/usage-rules/${ruleId}/verify`,
    { verified }
  );
  return res.data;
}

export async function deleteUsageRule(productId: number, ruleId: number): Promise<void> {
  await apiClient.delete(`/medicines/${productId}/usage-rules/${ruleId}`);
}
