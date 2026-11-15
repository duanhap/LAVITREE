import React, { useState, useEffect } from 'react';
import apiClient from '@/lib/api-client';
import type { DiseaseOption } from '../types';
import { formatTopicLabel } from '../lib';

export function useDiseaseOptions() {
  const [diseases, setDiseases] = useState<DiseaseOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    const fetchDiseases = async () => {
      try {
        const res = await apiClient.get('/diseases');
        const list: DiseaseOption[] = res.data || [];
        const sortedList = [...list].sort((a, b) => {
          const plantCmp = a.plantName.localeCompare(b.plantName, 'vi');
          if (plantCmp !== 0) return plantCmp;
          return formatTopicLabel(a.commonNameVi, a.classCode).localeCompare(
            formatTopicLabel(b.commonNameVi, b.classCode),
            'vi'
          );
        });
        if (mounted) {
          setDiseases(sortedList);
          setLoading(false);
        }
      } catch {
        if (mounted) setLoading(false);
      }
    };
    fetchDiseases();
    return () => {
      mounted = false;
    };
  }, []);

  const uniquePlants = React.useMemo(() => {
    const set = new Set<string>();
    diseases.forEach((d) => {
      if (d.plantName) set.add(d.plantName);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [diseases]);

  return { diseases, uniquePlants, loading };
}
