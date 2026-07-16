import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/apiClient';
import type { Product } from '../types/product';

export function useProducts() {
  return useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: async () => {
      const res = await apiClient.get('/api/admin/products');
      return res.data?.data || [];
    },
    staleTime: 5 * 60 * 1000 // Cache for 5 minutes
  });
}
