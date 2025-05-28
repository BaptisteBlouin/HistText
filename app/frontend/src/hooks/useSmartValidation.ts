// app/frontend/src/hooks/useSmartValidation.ts
import { useMemo } from 'react';

interface ValidationRule {
  test: (value: string) => boolean;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

interface FieldValidation {
  status: 'valid' | 'warning' | 'error' | 'empty';
  message: string;
  suggestions?: string[];
  hasValue: boolean;
}

interface FormValidation {
  fieldValidations: Record<string, FieldValidation>;
  canSubmit: boolean;
  overallStatus: 'error' | 'ready' | 'empty';
  summary: string;
}

export const useSmartValidation = (
  formData: any,
  metadata: any[],
  collectionInfo: any
) => {
  const validationRules: Record<string, ValidationRule[]> = {
    default: [
      {
        test: (value) => value.length >= 2,
        message: 'Highlighting will not work for search terms shorter than 2 characters.',
        severity: 'warning'
      },
      {
        test: (value) => value.length <= 100,
        message: 'Very long search terms may affect performance',
        severity: 'warning'
      },
      {
        test: (value) => !/^\s+|\s+$/.test(value),
        message: 'Remove leading/trailing spaces for better results',
        severity: 'info'
      },
      {
        test: (value) => !value.includes('"'),
        message: 'Do not use quotes - they are added automatically',
        severity: 'error'
      }
    ],
    text_field: [
      {
        test: (value) => !value.includes('"'),
        message: 'Quotes are not needed - exact matching is handled automatically',
        severity: 'error'
      },
      {
        test: (value) => value.split(' ').length <= 10,
        message: 'Long phrases may return fewer results',
        severity: 'info'
      },
      {
        test: (value) => !/[(){}[\]]/g.test(value),
        message: 'Special characters like parentheses are not needed',
        severity: 'warning'
      }
    ],
    date_field: [
      {
        test: (value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value),
        message: 'Use YYYY-MM-DD format for dates',
        severity: 'error'
      }
    ]
  };

  const validateField = useMemo(() => {
    return (fieldName: string, entries: any[]): FieldValidation => {
      if (!entries || entries.length === 0) {
        return {
          status: 'empty',
          message: '',
          hasValue: false
        };
      }

      const hasValue = entries.some(entry => entry.value && entry.value.trim());
      
      if (!hasValue) {
        return {
          status: 'empty',
          message: '',
          hasValue: false
        };
      }

      // Determine field type for appropriate validation
      const field = metadata.find(f => f.name === fieldName);
      const isTextField = collectionInfo?.text_field === fieldName;
      const isDateField = fieldName.toLowerCase().includes('date');
      
      let applicableRules = [...validationRules.default];
      
      if (isTextField) {
        applicableRules.push(...validationRules.text_field);
      }
      if (isDateField) {
        applicableRules.push(...validationRules.date_field);
      }

      // Check all entries for validation issues
      let worstSeverity: 'valid' | 'info' | 'warning' | 'error' = 'valid';
      let validationMessage = '';
      const suggestions: string[] = [];

      for (const entry of entries) {
        if (!entry.value || !entry.value.trim()) continue;

        for (const rule of applicableRules) {
          if (!rule.test(entry.value)) {
            if (rule.severity === 'error' || 
                (rule.severity === 'warning' && worstSeverity !== 'error') ||
                (rule.severity === 'info' && worstSeverity === 'valid')) {
              worstSeverity = rule.severity;
              validationMessage = rule.message;
            }
            break;
          }
        }
      }

      // Add smart suggestions based on field type and content
      if (isTextField && hasValue) {
        const totalLength = entries.reduce((sum, entry) => sum + (entry.value?.length || 0), 0);
        if (totalLength < 2) {
          suggestions.push('Try more specific terms for better results');
        }
      }

      // Check for potential boolean logic issues
      const hasMultipleEntries = entries.filter(e => e.value?.trim()).length > 1;
      if (hasMultipleEntries) {
        const operators = entries.map(e => e.operator).filter(Boolean);
        if (operators.length === 0) {
          suggestions.push('Consider using AND/OR operators for multiple terms');
        }
      }

      return {
        status: worstSeverity,
        message: validationMessage,
        suggestions,
        hasValue: true
      };
    };
  }, [formData, metadata, collectionInfo, validationRules]);

  // FIXED: This should be a computed value, not a function
  const formValidation = useMemo((): FormValidation => {
    const fieldValidations: Record<string, FieldValidation> = {};
    let hasAnySearchTerms = false;
    let hasErrors = false;

    Object.entries(formData).forEach(([fieldName, entries]) => {
      if (fieldName === 'min_date' || fieldName === 'max_date') return;
      
      const validation = validateField(fieldName, entries as any[]);
      fieldValidations[fieldName] = validation;
      
      if (validation.hasValue) hasAnySearchTerms = true;
      if (validation.status === 'error') hasErrors = true;
    });

    return {
      fieldValidations,
      canSubmit: hasAnySearchTerms && !hasErrors,
      overallStatus: hasErrors ? 'error' : hasAnySearchTerms ? 'ready' : 'empty',
      summary: hasErrors ? 'Fix errors before searching' : 
               hasAnySearchTerms ? 'Ready to search' : 'Enter search terms to begin'
    };
  }, [formData, validateField]);

  return {
    validateField,
    formValidation
  };
};