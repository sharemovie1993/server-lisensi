import axiosInstance from '../lib/axiosInstance';

export type StandardApiResponse<T> = {
  success: boolean;
  message?: string;
  data?: T;
};

export const standardApiCall = async <T>(
  apiCall: () => Promise<{ data: T }>,
  errorContext: string
): Promise<T> => {
  try {
    const response = await apiCall();
    return response.data;
  } catch (error: any) {
    console.error(`[API Error - ${errorContext}]:`, error);
    throw error;
  }
};

export async function requestWithFallback<T>(
  method: 'get' | 'post' | 'put' | 'delete' | 'patch',
  path: string,
  options?: { params?: any; data?: any; headers?: any; responseType?: any; onUploadProgress?: any; unwrapData?: boolean; timeout?: number }
): Promise<T> {
  const url = path.startsWith('/api') ? path : `/api${path}`;
  const config: any = {
    params: options?.params,
    headers: options?.headers ? { ...options.headers } : {},
    responseType: options?.responseType,
    timeout: options?.timeout,
    onUploadProgress: options?.onUploadProgress,
  };

  if (options?.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }

  let res;
  if (method === 'get') {
    res = await axiosInstance.get(url, config);
  } else if (method === 'post') {
    res = await axiosInstance.post(url, options?.data, config);
  } else if (method === 'put') {
    res = await axiosInstance.put(url, options?.data, config);
  } else if (method === 'patch') {
    res = await axiosInstance.patch(url, options?.data, config);
  } else {
    res = await axiosInstance.delete(url, { ...config, data: options?.data });
  }

  const d = res.data;
  return (options?.unwrapData ? (d?.data ?? d) : d) as T;
}
