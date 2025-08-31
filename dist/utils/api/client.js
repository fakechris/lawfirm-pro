"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiClient = exports.apiClient = void 0;
const axios_1 = __importDefault(require("axios"));
class ApiClient {
    constructor(config = {}) {
        this.instance = axios_1.default.create({
            baseURL: config.baseURL || process.env.REACT_APP_API_URL || 'http://localhost:3001/api',
            timeout: config.timeout || 30000,
            headers: {
                'Content-Type': 'application/json',
                ...config.headers,
            },
        });
        this.setupInterceptors();
    }
    setupInterceptors() {
        this.instance.interceptors.request.use((config) => {
            const token = localStorage.getItem('auth-token');
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
            config.headers['Accept-Language'] = 'zh-CN';
            return config;
        }, (error) => {
            return Promise.reject(error);
        });
        this.instance.interceptors.response.use((response) => {
            return response;
        }, (error) => {
            if (error.response?.status === 401) {
                localStorage.removeItem('auth-token');
                window.location.href = '/login';
            }
            if (error.response?.status === 429) {
                error.message = '请求过于频繁，请稍后再试';
            }
            else if (error.response?.status === 500) {
                error.message = '服务器内部错误';
            }
            else if (error.response?.status === 403) {
                error.message = '权限不足';
            }
            else if (error.response?.status === 404) {
                error.message = '资源不存在';
            }
            return Promise.reject(error);
        });
    }
    async get(url, config) {
        return this.instance.get(url, config);
    }
    async post(url, data, config) {
        return this.instance.post(url, data, config);
    }
    async put(url, data, config) {
        return this.instance.put(url, data, config);
    }
    async patch(url, data, config) {
        return this.instance.patch(url, data, config);
    }
    async delete(url, config) {
        return this.instance.delete(url, config);
    }
    async getKnowledgeArticles(params) {
        return this.get('/knowledge-base/articles', { params });
    }
    async getKnowledgeArticle(id) {
        return this.get(`/knowledge-base/articles/${id}`);
    }
    async createKnowledgeArticle(data) {
        return this.post('/knowledge-base/articles', data);
    }
    async updateKnowledgeArticle(id, data) {
        return this.put(`/knowledge-base/articles/${id}`, data);
    }
    async deleteKnowledgeArticle(id) {
        return this.delete(`/knowledge-base/articles/${id}`);
    }
    async searchKnowledge(query) {
        return this.post('/knowledge-base/search', query);
    }
    async getKnowledgeSuggestions(params) {
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
    async uploadFile(file, onProgress) {
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
exports.ApiClient = ApiClient;
exports.apiClient = new ApiClient();
//# sourceMappingURL=client.js.map