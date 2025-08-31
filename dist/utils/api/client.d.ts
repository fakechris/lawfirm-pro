import { AxiosRequestConfig, AxiosResponse } from 'axios';
interface ApiClientConfig {
    baseURL?: string;
    timeout?: number;
    headers?: Record<string, string>;
}
declare class ApiClient {
    private instance;
    constructor(config?: ApiClientConfig);
    private setupInterceptors;
    get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    getKnowledgeArticles(params?: any): Promise<AxiosResponse<T>>;
    getKnowledgeArticle(id: string): Promise<AxiosResponse<T>>;
    createKnowledgeArticle(data: any): Promise<AxiosResponse<T>>;
    updateKnowledgeArticle(id: string, data: any): Promise<AxiosResponse<T>>;
    deleteKnowledgeArticle(id: string): Promise<AxiosResponse<T>>;
    searchKnowledge(query: any): Promise<AxiosResponse<T>>;
    getKnowledgeSuggestions(params: any): Promise<AxiosResponse<T>>;
    getKnowledgeCategories(): Promise<AxiosResponse<T>>;
    getKnowledgeTags(): Promise<AxiosResponse<T>>;
    getKnowledgeAnalytics(): Promise<AxiosResponse<T>>;
    uploadFile(file: File, onProgress?: (progress: number) => void): Promise<AxiosResponse<T>>;
}
export declare const apiClient: ApiClient;
export { ApiClient };
//# sourceMappingURL=client.d.ts.map