export declare class ContentProcessingUtils {
    static sanitizeHtml(html: string): string;
    static extractTextFromHtml(html: string): string;
    static generateExcerpt(content: string, maxLength?: number): string;
    static formatContent(content: string, contentType: string): string;
    private static formatArticle;
    private static formatGuide;
    private static formatCaseStudy;
    private static formatTraining;
    private static formatPolicy;
    private static formatProcedure;
    static processTemplate(template: string, variables: Record<string, any>): string;
    static validateTemplateVariables(template: string, variables: Record<string, any>): {
        isValid: boolean;
        missing: string[];
    };
    static generateSearchKeywords(content: string): string[];
    static highlightSearchResults(content: string, query: string): string;
    static analyzeContent(content: string): {
        wordCount: number;
        readingTime: number;
        sentiment: 'positive' | 'neutral' | 'negative';
        topics: string[];
    };
    static optimizeForSEO(content: string, title: string, description: string): {
        optimizedContent: string;
        suggestions: string[];
    };
    static exportToMarkdown(content: string): string;
    static exportToPDF(content: string): string;
}
//# sourceMappingURL=processingUtils.d.ts.map