"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentProcessingUtils = void 0;
class ContentProcessingUtils {
    static sanitizeHtml(html) {
        return html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
            .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
            .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
            .replace(/on\w+="[^"]*"/g, '')
            .replace(/javascript:/gi, '');
    }
    static extractTextFromHtml(html) {
        return html
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
    static generateExcerpt(content, maxLength = 200) {
        const plainText = this.extractTextFromHtml(content);
        if (plainText.length <= maxLength) {
            return plainText;
        }
        const truncated = plainText.substring(0, maxLength);
        const lastSpace = truncated.lastIndexOf(' ');
        if (lastSpace > maxLength * 0.8) {
            return truncated.substring(0, lastSpace) + '...';
        }
        return truncated + '...';
    }
    static formatContent(content, contentType) {
        switch (contentType) {
            case 'article':
                return this.formatArticle(content);
            case 'guide':
                return this.formatGuide(content);
            case 'case_study':
                return this.formatCaseStudy(content);
            case 'training':
                return this.formatTraining(content);
            case 'policy':
                return this.formatPolicy(content);
            case 'procedure':
                return this.formatProcedure(content);
            default:
                return content;
        }
    }
    static formatArticle(content) {
        return content
            .replace(/^# (.*?)$/gm, '<h1>$1</h1>')
            .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
            .replace(/^### (.*?)$/gm, '<h3>$1</h3>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/^(.*)$/gm, '<p>$1</p>');
    }
    static formatGuide(content) {
        return content
            .replace(/^# (.*?)$/gm, '<h1 class="guide-title">$1</h1>')
            .replace(/^## (.*?)$/gm, '<h2 class="guide-section">$1</h2>')
            .replace(/^\d+\. (.*?)$/gm, '<div class="guide-step">$1</div>')
            .replace(/^Note: (.*?)$/gm, '<div class="guide-note">$1</div>')
            .replace(/^Warning: (.*?)$/gm, '<div class="guide-warning">$1</div>');
    }
    static formatCaseStudy(content) {
        return content
            .replace(/^# (.*?)$/gm, '<h1 class="case-title">$1</h1>')
            .replace(/^## (.*?)$/gm, '<h2 class="case-section">$1</h2>')
            .replace(/^### (.*?)$/gm, '<h3 class="case-subsection">$1</h3>')
            .replace(/^Background: (.*?)$/gm, '<div class="case-background">$1</div>')
            .replace(/^Challenge: (.*?)$/gm, '<div class="case-challenge">$1</div>')
            .replace(/^Solution: (.*?)$/gm, '<div class="case-solution">$1</div>')
            .replace(/^Result: (.*?)$/gm, '<div class="case-result">$1</div>');
    }
    static formatTraining(content) {
        return content
            .replace(/^# (.*?)$/gm, '<h1 class="training-title">$1</h1>')
            .replace(/^## (.*?)$/gm, '<h2 class="training-module">$1</h2>')
            .replace(/^### (.*?)$/gm, '<h3 class="training-lesson">$1</h3>')
            .replace(/^Learning Objective: (.*?)$/gm, '<div class="training-objective">$1</div>')
            .replace(/^Exercise: (.*?)$/gm, '<div class="training-exercise">$1</div>')
            .replace(/^Quiz: (.*?)$/gm, '<div class="training-quiz">$1</div>');
    }
    static formatPolicy(content) {
        return content
            .replace(/^# (.*?)$/gm, '<h1 class="policy-title">$1</h1>')
            .replace(/^## (.*?)$/gm, '<h2 class="policy-section">$1</h2>')
            .replace(/^Policy: (.*?)$/gm, '<div class="policy-statement">$1</div>')
            .replace(/^Scope: (.*?)$/gm, '<div class="policy-scope">$1</div>')
            .replace(/^Responsibilities: (.*?)$/gm, '<div class="policy-responsibilities">$1</div>');
    }
    static formatProcedure(content) {
        return content
            .replace(/^# (.*?)$/gm, '<h1 class="procedure-title">$1</h1>')
            .replace(/^## (.*?)$/gm, '<h2 class="procedure-section">$1</h2>')
            .replace(/^\d+\. (.*?)$/gm, '<div class="procedure-step">$1</div>')
            .replace(/^Input: (.*?)$/gm, '<div class="procedure-input">$1</div>')
            .replace(/^Output: (.*?)$/gm, '<div class="procedure-output">$1</div>');
    }
    static processTemplate(template, variables) {
        let processed = template;
        processed = processed.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return variables[key] !== undefined ? String(variables[key]) : match;
        });
        processed = processed.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, variable, content) => {
            return variables[variable] ? content : '';
        });
        processed = processed.replace(/\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (match, arrayName, templateContent) => {
            const array = variables[arrayName];
            if (!Array.isArray(array))
                return '';
            return array.map((item, index) => {
                let itemContent = templateContent;
                itemContent = itemContent.replace(/\{\{this\}\}/g, String(item));
                itemContent = itemContent.replace(/\{\{@index\}\}/g, String(index));
                if (typeof item === 'object' && item !== null) {
                    Object.keys(item).forEach(key => {
                        itemContent = itemContent.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(item[key]));
                    });
                }
                return itemContent;
            }).join('');
        });
        return processed;
    }
    static validateTemplateVariables(template, variables) {
        const missing = [];
        const variablePattern = /\{\{(\w+)\}\}/g;
        const conditionalPattern = /\{\{#if\s+(\w+)\}\}/g;
        const loopPattern = /\{\{#each\s+(\w+)\}\}/g;
        const allVariables = new Set();
        let match;
        while ((match = variablePattern.exec(template)) !== null) {
            if (match[1] !== 'this' && match[1] !== '@index') {
                allVariables.add(match[1]);
            }
        }
        while ((match = conditionalPattern.exec(template)) !== null) {
            allVariables.add(match[1]);
        }
        while ((match = loopPattern.exec(template)) !== null) {
            allVariables.add(match[1]);
        }
        allVariables.forEach(variable => {
            if (!(variable in variables)) {
                missing.push(variable);
            }
        });
        return {
            isValid: missing.length === 0,
            missing
        };
    }
    static generateSearchKeywords(content) {
        const text = this.extractTextFromHtml(content).toLowerCase();
        const words = text.split(/\s+/).filter(word => word.length > 2);
        const stopWords = new Set([
            'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
            'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did',
            'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that',
            'these', 'those', 'a', 'an', 'some', 'any', 'all', 'each', 'every', 'either', 'neither'
        ]);
        return words.filter(word => !stopWords.has(word));
    }
    static highlightSearchResults(content, query) {
        const plainText = this.extractTextFromHtml(content);
        const queryLower = query.toLowerCase();
        const regex = new RegExp(`(${query})`, 'gi');
        return plainText.replace(regex, '<mark>$1</mark>');
    }
    static analyzeContent(content) {
        const plainText = this.extractTextFromHtml(content);
        const words = plainText.split(/\s+/).filter(word => word.length > 0);
        const wordCount = words.length;
        const readingTime = Math.ceil(wordCount / 200);
        const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'helpful', 'useful', 'effective', 'successful'];
        const negativeWords = ['bad', 'poor', 'terrible', 'awful', 'horrible', 'useless', 'ineffective', 'failed', 'problem', 'issue'];
        const positiveCount = words.filter(word => positiveWords.includes(word.toLowerCase())).length;
        const negativeCount = words.filter(word => negativeWords.includes(word.toLowerCase())).length;
        let sentiment = 'neutral';
        if (positiveCount > negativeCount)
            sentiment = 'positive';
        else if (negativeCount > positiveCount)
            sentiment = 'negative';
        const wordFreq = new Map();
        words.forEach(word => {
            const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
            if (cleanWord.length > 3) {
                wordFreq.set(cleanWord, (wordFreq.get(cleanWord) || 0) + 1);
            }
        });
        const topics = Array.from(wordFreq.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([word]) => word);
        return {
            wordCount,
            readingTime,
            sentiment,
            topics
        };
    }
    static optimizeForSEO(content, title, description) {
        const suggestions = [];
        let optimizedContent = content;
        if (title.length > 60) {
            suggestions.push('Title is too long for SEO (recommended: 60 characters or less)');
        }
        if (description.length > 160) {
            suggestions.push('Meta description is too long (recommended: 160 characters or less)');
        }
        const headingCount = (content.match(/^#/gm) || []).length;
        if (headingCount === 0) {
            suggestions.push('Add headings to improve content structure');
        }
        const imageCount = (content.match(/<img/gi) || []).length;
        if (imageCount === 0) {
            suggestions.push('Add images to make content more engaging');
        }
        const linkCount = (content.match(/<a /gi) || []).length;
        if (linkCount === 0) {
            suggestions.push('Add internal links to improve SEO');
        }
        optimizedContent = optimizedContent.replace(/<img(?![^>]*alt=)/gi, '<img alt="Image"');
        return {
            optimizedContent,
            suggestions
        };
    }
    static exportToMarkdown(content) {
        return content
            .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1')
            .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1')
            .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1')
            .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
            .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
            .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
            .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
            .replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>/gi, '![${2}](${1})')
            .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
            .replace(/<div[^>]*>(.*?)<\/div>/gi, '$1\n')
            .replace(/<[^>]*>/g, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }
    static exportToPDF(content) {
        return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Content Export</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; margin: 40px; }
          h1 { color: #333; border-bottom: 2px solid #333; }
          h2 { color: #555; margin-top: 30px; }
          h3 { color: #666; margin-top: 25px; }
          p { margin-bottom: 15px; }
          code { background: #f4f4f4; padding: 2px 4px; border-radius: 3px; }
          pre { background: #f4f4f4; padding: 15px; border-radius: 5px; overflow-x: auto; }
          blockquote { border-left: 4px solid #ccc; margin: 0; padding-left: 20px; }
        </style>
      </head>
      <body>
        ${content}
      </body>
      </html>
    `;
    }
}
exports.ContentProcessingUtils = ContentProcessingUtils;
//# sourceMappingURL=processingUtils.js.map