import apiClient from '@/lib/api-client';
import type { ProductDetailResponse, ProductEvidenceItem } from './types';

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
