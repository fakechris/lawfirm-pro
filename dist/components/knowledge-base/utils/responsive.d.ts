export declare const breakpoints: {
    readonly xs: "0px";
    readonly sm: "640px";
    readonly md: "768px";
    readonly lg: "1024px";
    readonly xl: "1280px";
    readonly '2xl': "1536px";
};
export declare const mediaQueries: {
    readonly xs: "@media (min-width: 0px)";
    readonly sm: "@media (min-width: 640px)";
    readonly md: "@media (min-width: 768px)";
    readonly lg: "@media (min-width: 1024px)";
    readonly xl: "@media (min-width: 1280px)";
    readonly '2xl': "@media (min-width: 1536px)";
};
export declare const ResponsiveContainer: React.FC<{
    children: React.ReactNode;
    className?: string;
}>;
export declare const Grid: React.FC<{
    children: React.ReactNode;
    cols?: {
        xs?: number;
        sm?: number;
        md?: number;
        lg?: number;
        xl?: number;
    };
    gap?: number;
    className?: string;
}>;
export declare const MobileMenu: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
}>;
export declare const MobileNavButton: React.FC<{
    onClick: () => void;
    className?: string;
}>;
export declare const ResponsiveCard: React.FC<{
    children: React.ReactNode;
    className?: string;
    hover?: boolean;
}>;
export declare const ResponsiveText: {
    Heading: ({ children, className }: {
        children: React.ReactNode;
        className?: string;
    }) => any;
    Subheading: ({ children, className }: {
        children: React.ReactNode;
        className?: string;
    }) => any;
    Title: ({ children, className }: {
        children: React.ReactNode;
        className?: string;
    }) => any;
    Body: ({ children, className }: {
        children: React.ReactNode;
        className?: string;
    }) => any;
    Caption: ({ children, className }: {
        children: React.ReactNode;
        className?: string;
    }) => any;
};
export declare const ResponsiveSpacing: {
    Container: ({ children }: {
        children: React.ReactNode;
    }) => any;
    Padding: ({ children, size }: {
        children: React.ReactNode;
        size?: "small" | "medium" | "large";
    }) => any;
    Margin: ({ children, size }: {
        children: React.ReactNode;
        size?: "small" | "medium" | "large";
    }) => any;
};
export declare const ResponsiveButton: React.FC<{
    children: React.ReactNode;
    onClick?: () => void;
    variant?: 'primary' | 'secondary' | 'outline';
    size?: 'small' | 'medium' | 'large';
    disabled?: boolean;
    className?: string;
}>;
//# sourceMappingURL=responsive.d.ts.map