"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useAuth = void 0;
const react_1 = require("react");
const useAuth = () => {
    const [user, setUser] = (0, react_1.useState)(null);
    const [loading, setLoading] = (0, react_1.useState)(true);
    (0, react_1.useEffect)(() => {
        const token = localStorage.getItem('auth-token');
        if (token) {
            try {
                const userData = localStorage.getItem('user-data');
                if (userData) {
                    setUser(JSON.parse(userData));
                }
            }
            catch (err) {
                console.error('Error parsing user data:', err);
                localStorage.removeItem('auth-token');
                localStorage.removeItem('user-data');
            }
        }
        setLoading(false);
    }, []);
    const login = async (email, password) => {
        try {
            const mockUser = {
                id: '1',
                email,
                username: email.split('@')[0],
                firstName: '张',
                lastName: '律师',
                role: 'LAWYER',
            };
            const mockToken = 'mock-jwt-token';
            localStorage.setItem('auth-token', mockToken);
            localStorage.setItem('user-data', JSON.stringify(mockUser));
            setUser(mockUser);
        }
        catch (err) {
            console.error('Login error:', err);
            throw err;
        }
    };
    const logout = () => {
        localStorage.removeItem('auth-token');
        localStorage.removeItem('user-data');
        setUser(null);
    };
    const updateProfile = async (data) => {
        try {
            const updatedUser = { ...user, ...data };
            localStorage.setItem('user-data', JSON.stringify(updatedUser));
            setUser(updatedUser);
        }
        catch (err) {
            console.error('Profile update error:', err);
            throw err;
        }
    };
    return {
        user,
        loading,
        isAuthenticated: !!user,
        login,
        logout,
        updateProfile,
    };
};
exports.useAuth = useAuth;
//# sourceMappingURL=useAuth.js.map