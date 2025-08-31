import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

interface ApiClientConfig {
  baseURL?: string;
  timeout?: number;
  headers?: Record<string, string>;
}

class ApiClient {
  private instance: AxiosInstance;

  constructor(config: ApiClientConfig = {}) {
    this.instance = axios.create({
      baseURL: config.baseURL || process.env.REACT_APP_API_URL || 'http://localhost:3001/api',
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.instance.interceptors.request.use(
      (config) => {
        // Add auth token if available
        const token = localStorage.getItem('auth-token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Add language header
        config.headers['Accept-Language'] = 'zh-CN';

        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.instance.interceptors.response.use(
      (response: AxiosResponse) => {
        return response;
      },
      (error) => {
        if (error.response?.status === 401) {
          // Token expired or invalid
          localStorage.removeItem('auth-token');
          window.location.href = '/login';
        }

        // Handle specific error codes
        if (error.response?.status === 429) {
          error.message = '请求过于频繁，请稍后再试';
        } else if (error.response?.status === 500) {
          error.message = '服务器内部错误';
        } else if (error.response?.status === 403) {
          error.message = '权限不足';
        } else if (error.response?.status === 404) {
          error.message = '资源不存在';
        }

        return Promise.reject(error);
      }
    );
  }

  // Generic request methods
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.instance.get(url, config);
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.instance.post(url, data, config);
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.instance.put(url, data, config);
  }

  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.instance.patch(url, data, config);
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.instance.delete(url, config);
  }

  // Knowledge base specific methods
  async getKnowledgeArticles(params?: any) {
    return this.get('/knowledge-base/articles', { params });
  }

  async getKnowledgeArticle(id: string) {
    return this.get(`/knowledge-base/articles/${id}`);
  }

  async createKnowledgeArticle(data: any) {
    return this.post('/knowledge-base/articles', data);
  }

  async updateKnowledgeArticle(id: string, data: any) {
    return this.put(`/knowledge-base/articles/${id}`, data);
  }

  async deleteKnowledgeArticle(id: string) {
    return this.delete(`/knowledge-base/articles/${id}`);
  }

  async searchKnowledge(query: any) {
    return this.post('/knowledge-base/search', query);
  }

  async getKnowledgeSuggestions(params: any) {
    return this.get('/knowledge-base/search/suggestions', { params });
  }

  async getKnowledgeCategories() {
    return this.get('/knowledge-base/categories');
  }

  async getKnowledgeTags() {
    return this.get('/knowledge-base/tags');
  }

  async getKnowledgeAnalytics() {
    return this.get('/knowledge-base/analytics');
  }

  // File upload methods
  async uploadFile(file: File, onProgress?: (progress: number) => void) {
    const formData = new FormData();
    formData.append('file', file);

    return this.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });
  }
}

// Create and export singleton instance
export const apiClient = new ApiClient();

// Export class for custom instances if needed
export { ApiClient };