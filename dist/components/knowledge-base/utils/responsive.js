"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResponsiveButton = exports.ResponsiveSpacing = exports.ResponsiveText = exports.ResponsiveCard = exports.MobileNavButton = exports.MobileMenu = exports.Grid = exports.ResponsiveContainer = exports.mediaQueries = exports.breakpoints = void 0;
exports.breakpoints = {
    xs: '0px',
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
};
exports.mediaQueries = {
    xs: `@media (min-width: ${exports.breakpoints.xs})`,
    sm: `@media (min-width: ${exports.breakpoints.sm})`,
    md: `@media (min-width: ${exports.breakpoints.md})`,
    lg: `@media (min-width: ${exports.breakpoints.lg})`,
    xl: `@media (min-width: ${exports.breakpoints.xl})`,
    '2xl': `@media (min-width: ${exports.breakpoints['2xl']})`,
};
const ResponsiveContainer = ({ children, className = '' }) => {
    return (<div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${className}`}>
      {children}
    </div>);
};
exports.ResponsiveContainer = ResponsiveContainer;
const Grid = ({ children, cols = { xs: 1, sm: 2, md: 3, lg: 4 }, gap = 4, className = '' }) => {
    const gridClasses = Object.entries(cols)
        .map(([breakpoint, colCount]) => {
        if (breakpoint === 'xs')
            return `grid-cols-${colCount}`;
        return `${breakpoint}:grid-cols-${colCount}`;
    })
        .join(' ');
    return (<div className={`grid grid-cols-1 ${gridClasses} gap-${gap} ${className}`}>
      {children}
    </div>);
};
exports.Grid = Grid;
const MobileMenu = ({ isOpen, onClose, children }) => {
    if (!isOpen)
        return null;
    return (<>
      
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden" onClick={onClose}/>
      
      
      <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl transform transition-transform lg:hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">菜单</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className="p-4">
          {children}
        </div>
      </div>
    </>);
};
exports.MobileMenu = MobileMenu;
const MobileNavButton = ({ onClick, className = '' }) => {
    return (<button onClick={onClick} className={`p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors lg:hidden ${className}`}>
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
      </svg>
    </button>);
};
exports.MobileNavButton = MobileNavButton;
const ResponsiveCard = ({ children, className = '', hover = false }) => {
    return (<div className={`
      bg-white rounded-lg shadow-sm border border-gray-200
      ${hover ? 'hover:shadow-md transition-shadow' : ''}
      ${className}
    `}>
      {children}
    </div>);
};
exports.ResponsiveCard = ResponsiveCard;
exports.ResponsiveText = {
    Heading: ({ children, className = '' }) => (<h1 className={`text-2xl sm:text-3xl font-bold text-gray-900 ${className}`}>
      {children}
    </h1>),
    Subheading: ({ children, className = '' }) => (<h2 className={`text-xl sm:text-2xl font-semibold text-gray-900 ${className}`}>
      {children}
    </h2>),
    Title: ({ children, className = '' }) => (<h3 className={`text-lg sm:text-xl font-semibold text-gray-900 ${className}`}>
      {children}
    </h3>),
    Body: ({ children, className = '' }) => (<p className={`text-sm sm:text-base text-gray-600 ${className}`}>
      {children}
    </p>),
    Caption: ({ children, className = '' }) => (<p className={`text-xs sm:text-sm text-gray-500 ${className}`}>
      {children}
    </p>),
};
exports.ResponsiveSpacing = {
    Container: ({ children }) => (<div className="px-4 sm:px-6 lg:px-8">
      {children}
    </div>),
    Padding: ({ children, size = 'medium' }) => {
        const sizes = {
            small: 'p-4 sm:p-6',
            medium: 'p-6 sm:p-8',
            large: 'p-8 sm:p-12',
        };
        return <div className={sizes[size]}>{children}</div>;
    },
    Margin: ({ children, size = 'medium' }) => {
        const sizes = {
            small: 'm-4 sm:m-6',
            medium: 'm-6 sm:m-8',
            large: 'm-8 sm:m-12',
        };
        return <div className={sizes[size]}>{children}</div>;
    },
};
const ResponsiveButton = ({ children, onClick, variant = 'primary', size = 'medium', disabled = false, className = '' }) => {
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
    return (<button onClick={onClick} disabled={disabled} className={`
        ${baseClasses}
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}>
      {children}
    </button>);
};
exports.ResponsiveButton = ResponsiveButton;
//# sourceMappingURL=responsive.js.map