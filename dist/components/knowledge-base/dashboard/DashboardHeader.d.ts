import React from 'react';
interface User {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    avatar?: string;
}
interface DashboardHeaderProps {
    user: User;
    onNavigateToPortal: () => void;
    onNavigateToAdmin: () => void;
}
export declare const DashboardHeader: React.FC<DashboardHeaderProps>;
export {};
//# sourceMappingURL=DashboardHeader.d.ts.map