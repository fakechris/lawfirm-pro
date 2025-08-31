interface User {
    id: string;
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    role: string;
    avatar?: string;
}
interface UseAuthReturn {
    user: User | null;
    loading: boolean;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
    updateProfile: (data: Partial<User>) => Promise<void>;
}
export declare const useAuth: () => UseAuthReturn;
export {};
//# sourceMappingURL=useAuth.d.ts.map