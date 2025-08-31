import { KnowledgeBaseContent, ContentTemplate } from '../../models/knowledge-base';

export class ContentProcessingUtils {
  // Text Processing
  static sanitizeHtml(html: string): string {
    // Remove potentially dangerous HTML tags while preserving safe formatting
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
      .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
      .replace(/on\w+="[^"]*"/g, '')
      .replace(/javascript:/gi, '');
  }

  static extractTextFromHtml(html: string): string {
    // Remove HTML tags and extract plain text
    return html
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  static generateExcerpt(content: string, maxLength: number = 200): string {
    const plainText = this.extractTextFromHtml(content);
    
    if (plainText.length <= maxLength) {
      return plainText;
    }

    // Try to break at word boundary
    const truncated = plainText.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSpace > maxLength * 0.8) {
      return truncated.substring(0, lastSpace) + '...';
    }

    return truncated + '...';
  }

  static formatContent(content: string, contentType: string): string {
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

  private static formatArticle(content: string): string {
    // Add article-specific formatting
    return content
      .replace(/^# (.*?)$/gm, '<h1>$1</h1>')
      .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
      .replace(/^### (.*?)$/gm, '<h3>$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/^(.*)$/gm, '<p>$1</p>');
  }

  private static formatGuide(content: string): string {
    // Add guide-specific formatting with steps
    return content
      .replace(/^# (.*?)$/gm, '<h1 class="guide-title">$1</h1>')
      .replace(/^## (.*?)$/gm, '<h2 class="guide-section">$1</h2>')
      .replace(/^\d+\. (.*?)$/gm, '<div class="guide-step">$1</div>')
      .replace(/^Note: (.*?)$/gm, '<div class="guide-note">$1</div>')
      .replace(/^Warning: (.*?)$/gm, '<div class="guide-warning">$1</div>');
  }

  private static formatCaseStudy(content: string): string {
    // Add case study-specific formatting
    return content
      .replace(/^# (.*?)$/gm, '<h1 class="case-title">$1</h1>')
      .replace(/^## (.*?)$/gm, '<h2 class="case-section">$1</h2>')
      .replace(/^### (.*?)$/gm, '<h3 class="case-subsection">$1</h3>')
      .replace(/^Background: (.*?)$/gm, '<div class="case-background">$1</div>')
      .replace(/^Challenge: (.*?)$/gm, '<div class="case-challenge">$1</div>')
      .replace(/^Solution: (.*?)$/gm, '<div class="case-solution">$1</div>')
      .replace(/^Result: (.*?)$/gm, '<div class="case-result">$1</div>');
  }

  private static formatTraining(content: string): string {
    // Add training-specific formatting
    return content
      .replace(/^# (.*?)$/gm, '<h1 class="training-title">$1</h1>')
      .replace(/^## (.*?)$/gm, '<h2 class="training-module">$1</h2>')
      .replace(/^### (.*?)$/gm, '<h3 class="training-lesson">$1</h3>')
      .replace(/^Learning Objective: (.*?)$/gm, '<div class="training-objective">$1</div>')
      .replace(/^Exercise: (.*?)$/gm, '<div class="training-exercise">$1</div>')
      .replace(/^Quiz: (.*?)$/gm, '<div class="training-quiz">$1</div>');
  }

  private static formatPolicy(content: string): string {
    // Add policy-specific formatting
    return content
      .replace(/^# (.*?)$/gm, '<h1 class="policy-title">$1</h1>')
      .replace(/^## (.*?)$/gm, '<h2 class="policy-section">$1</h2>')
      .replace(/^Policy: (.*?)$/gm, '<div class="policy-statement">$1</div>')
      .replace(/^Scope: (.*?)$/gm, '<div class="policy-scope">$1</div>')
      .replace(/^Responsibilities: (.*?)$/gm, '<div class="policy-responsibilities">$1</div>');
  }

  private static formatProcedure(content: string): string {
    // Add procedure-specific formatting
    return content
      .replace(/^# (.*?)$/gm, '<h1 class="procedure-title">$1</h1>')
      .replace(/^## (.*?)$/gm, '<h2 class="procedure-section">$1</h2>')
      .replace(/^\d+\. (.*?)$/gm, '<div class="procedure-step">$1</div>')
      .replace(/^Input: (.*?)$/gm, '<div class="procedure-input">$1</div>')
      .replace(/^Output: (.*?)$/gm, '<div class="procedure-output">$1</div>');
  }

  // Template Processing
  static processTemplate(template: string, variables: Record<string, any>): string {
    let processed = template;

    // Replace simple variables {{variable}}
    processed = processed.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables[key] !== undefined ? String(variables[key]) : match;
    });

    // Replace conditional blocks {{#if variable}}...{{/if}}
    processed = processed.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, variable, content) => {
      return variables[variable] ? content : '';
    });

    // Replace loops {{#each array}}...{{/each}}
    processed = processed.replace(/\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (match, arrayName, templateContent) => {
      const array = variables[arrayName];
      if (!Array.isArray(array)) return '';

      return array.map((item, index) => {
        let itemContent = templateContent;
        
        // Replace {{this}} with current item
        itemContent = itemContent.replace(/\{\{this\}\}/g, String(item));
        
        // Replace {{@index}} with current index
        itemContent = itemContent.replace(/\{\{@index\}\}/g, String(index));
        
        // If item is an object, replace its properties
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

  static validateTemplateVariables(template: string, variables: Record<string, any>): { isValid: boolean; missing: string[] } {
    const missing: string[] = [];
    
    // Extract all variable references from template
    const variablePattern = /\{\{(\w+)\}\}/g;
    const conditionalPattern = /\{\{#if\s+(\w+)\}\}/g;
    const loopPattern = /\{\{#each\s+(\w+)\}\}/g;
    
    const allVariables = new Set<string>();
    
    let match;
    
    // Find simple variables
    while ((match = variablePattern.exec(template)) !== null) {
      if (match[1] !== 'this' && match[1] !== '@index') {
        allVariables.add(match[1]);
      }
    }
    
    // Find conditional variables
    while ((match = conditionalPattern.exec(template)) !== null) {
      allVariables.add(match[1]);
    }
    
    // Find loop variables
    while ((match = loopPattern.exec(template)) !== null) {
      allVariables.add(match[1]);
    }
    
    // Check for missing variables
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

  // Search Processing
  static generateSearchKeywords(content: string): string[] {
    const text = this.extractTextFromHtml(content).toLowerCase();
    const words = text.split(/\s+/).filter(word => word.length > 2);
    
    // Remove common stop words
    const stopWords = new Set([
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that',
      'these', 'those', 'a', 'an', 'some', 'any', 'all', 'each', 'every', 'either', 'neither'
    ]);

    return words.filter(word => !stopWords.has(word));
  }

  static highlightSearchResults(content: string, query: string): string {
    const plainText = this.extractTextFromHtml(content);
    const queryLower = query.toLowerCase();
    
    // Simple highlighting - wrap matching text in <mark> tags
    const regex = new RegExp(`(${query})`, 'gi');
    return plainText.replace(regex, '<mark>$1</mark>');
  }

  // Content Analysis
  static analyzeContent(content: string): {
    wordCount: number;
    readingTime: number;
    sentiment: 'positive' | 'neutral' | 'negative';
    topics: string[];
  } {
    const plainText = this.extractTextFromHtml(content);
    const words = plainText.split(/\s+/).filter(word => word.length > 0);
    const wordCount = words.length;
    
    // Estimate reading time (average 200 words per minute)
    const readingTime = Math.ceil(wordCount / 200);
    
    // Simple sentiment analysis
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'helpful', 'useful', 'effective', 'successful'];
    const negativeWords = ['bad', 'poor', 'terrible', 'awful', 'horrible', 'useless', 'ineffective', 'failed', 'problem', 'issue'];
    
    const positiveCount = words.filter(word => positiveWords.includes(word.toLowerCase())).length;
    const negativeCount = words.filter(word => negativeWords.includes(word.toLowerCase())).length;
    
    let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
    if (positiveCount > negativeCount) sentiment = 'positive';
    else if (negativeCount > positiveCount) sentiment = 'negative';
    
    // Simple topic extraction (based on word frequency)
    const wordFreq = new Map<string, number>();
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

  // Content Optimization
  static optimizeForSEO(content: string, title: string, description: string): {
    optimizedContent: string;
    suggestions: string[];
  } {
    const suggestions: string[] = [];
    let optimizedContent = content;

    // Check title length
    if (title.length > 60) {
      suggestions.push('Title is too long for SEO (recommended: 60 characters or less)');
    }

    // Check description length
    if (description.length > 160) {
      suggestions.push('Meta description is too long (recommended: 160 characters or less)');
    }

    // Check for headings
    const headingCount = (content.match(/^#/gm) || []).length;
    if (headingCount === 0) {
      suggestions.push('Add headings to improve content structure');
    }

    // Check for images
    const imageCount = (content.match(/<img/gi) || []).length;
    if (imageCount === 0) {
      suggestions.push('Add images to make content more engaging');
    }

    // Check for links
    const linkCount = (content.match(/<a /gi) || []).length;
    if (linkCount === 0) {
      suggestions.push('Add internal links to improve SEO');
    }

    // Add alt text to images if missing
    optimizedContent = optimizedContent.replace(/<img(?![^>]*alt=)/gi, '<img alt="Image"');

    return {
      optimizedContent,
      suggestions
    };
  }

  // Content Export
  static exportToMarkdown(content: string): string {
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

  static exportToPDF(content: string): string {
    // Return HTML formatted for PDF generation
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