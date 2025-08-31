// Mobile-responsive utilities and breakpoints
export const breakpoints = {
  xs: '0px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

export const mediaQueries = {
  xs: `@media (min-width: ${breakpoints.xs})`,
  sm: `@media (min-width: ${breakpoints.sm})`,
  md: `@media (min-width: ${breakpoints.md})`,
  lg: `@media (min-width: ${breakpoints.lg})`,
  xl: `@media (min-width: ${breakpoints.xl})`,
  '2xl': `@media (min-width: ${breakpoints['2xl']})`,
} as const;

// Responsive container component
export const ResponsiveContainer: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  return (
    <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${className}`}>
      {children}
    </div>
  );
};

// Grid system components
export const Grid: React.FC<{
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
}> = ({ 
  children, 
  cols = { xs: 1, sm: 2, md: 3, lg: 4 }, 
  gap = 4,
  className = '' 
}) => {
  const gridClasses = Object.entries(cols)
    .map(([breakpoint, colCount]) => {
      if (breakpoint === 'xs') return `grid-cols-${colCount}`;
      return `${breakpoint}:grid-cols-${colCount}`;
    })
    .join(' ');

  return (
    <div className={`grid grid-cols-1 ${gridClasses} gap-${gap} ${className}`}>
      {children}
    </div>
  );
};

// Mobile menu component
export const MobileMenu: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
        onClick={onClose}
      />
      
      {/* Menu Panel */}
      <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl transform transition-transform lg:hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">菜单</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4">
          {children}
        </div>
      </div>
    </>
  );
};

// Mobile navigation button
export const MobileNavButton: React.FC<{
  onClick: () => void;
  className?: string;
}> = ({ onClick, className = '' }) => {
  return (
    <button
      onClick={onClick}
      className={`p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors lg:hidden ${className}`}
    >
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
  );
};

// Responsive card component
export const ResponsiveCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}> = ({ children, className = '', hover = false }) => {
  return (
    <div className={`
      bg-white rounded-lg shadow-sm border border-gray-200
      ${hover ? 'hover:shadow-md transition-shadow' : ''}
      ${className}
    `}>
      {children}
    </div>
  );
};

// Responsive text components
export const ResponsiveText = {
  Heading: ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <h1 className={`text-2xl sm:text-3xl font-bold text-gray-900 ${className}`}>
      {children}
    </h1>
  ),
  
  Subheading: ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <h2 className={`text-xl sm:text-2xl font-semibold text-gray-900 ${className}`}>
      {children}
    </h2>
  ),
  
  Title: ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <h3 className={`text-lg sm:text-xl font-semibold text-gray-900 ${className}`}>
      {children}
    </h3>
  ),
  
  Body: ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <p className={`text-sm sm:text-base text-gray-600 ${className}`}>
      {children}
    </p>
  ),
  
  Caption: ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <p className={`text-xs sm:text-sm text-gray-500 ${className}`}>
      {children}
    </p>
  ),
};

// Responsive spacing utilities
export const ResponsiveSpacing = {
  Container: ({ children }: { children: React.ReactNode }) => (
    <div className="px-4 sm:px-6 lg:px-8">
      {children}
    </div>
  ),
  
  Padding: ({ 
    children, 
    size = 'medium' 
  }: { 
    children: React.ReactNode; 
    size?: 'small' | 'medium' | 'large' 
  }) => {
    const sizes = {
      small: 'p-4 sm:p-6',
      medium: 'p-6 sm:p-8',
      large: 'p-8 sm:p-12',
    };
    
    return <div className={sizes[size]}>{children}</div>;
  },
  
  Margin: ({ 
    children, 
    size = 'medium' 
  }: { 
    children: React.ReactNode; 
    size?: 'small' | 'medium' | 'large' 
  }) => {
    const sizes = {
      small: 'm-4 sm:m-6',
      medium: 'm-6 sm:m-8',
      large: 'm-8 sm:m-12',
    };
    
    return <div className={sizes[size]}>{children}</div>;
  },
};

// Responsive button component
export const ResponsiveButton: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  className?: string;
}> = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  size = 'medium',
  disabled = false,
  className = '' 
}) => {
  const baseClasses = 'font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 disabled:bg-blue-300',
    secondary: 'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500 disabled:bg-gray-300',
    outline: 'border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:ring-gray-500 disabled:bg-gray-100 disabled:text-gray-400',
  };
  
  const sizeClasses = {
    small: 'px-3 py-2 text-sm',
    medium: 'px-4 py-2 text-sm sm:text-base',
    large: 'px-6 py-3 text-base sm:text-lg',
  };
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        ${baseClasses}
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {children}
    </button>
  );
};