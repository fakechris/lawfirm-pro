import React from 'react';
type AdminView = 'list' | 'create' | 'edit' | 'categories' | 'analytics';
interface AdminHeaderProps {
    currentView: AdminView;
    onViewChange: (view: AdminView) => void;
    onBackToPortal: () => void;
    articleCount: number;
}
export declare const AdminHeader: React.FC<AdminHeaderProps>;
export {};
//# sourceMappingURL=AdminHeader.d.ts.map