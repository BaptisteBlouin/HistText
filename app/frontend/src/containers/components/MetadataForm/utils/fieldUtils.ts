export const shouldExcludeField = (fieldName: string, collectionInfo: any): boolean => {
  if (
    fieldName.toLowerCase().includes('date') ||
    fieldName.toLowerCase().includes('year') ||
    fieldName.toLowerCase().includes('month') ||
    fieldName.toLowerCase().includes('day')
  ) {
    return true;
  }

  if (collectionInfo?.to_not_display && collectionInfo.to_not_display.includes(fieldName)) {
    return true;
  }

  return false;
};

export const isTextField = (fieldName: string, collectionInfo: any): boolean => {
  return collectionInfo?.text_field === fieldName;
};

export const getFieldPriority = (field: any): number => {
  const name = field.name.toLowerCase();
  if (name.includes('title')) return 1;
  if (name.includes('content') || name.includes('text') || name.includes('body')) return 2;
  if (name.includes('date')) return 3;
  if (name.includes('id')) return 10;
  return 5;
};

export const sortFieldsByPriority = (fields: any[]): any[] => {
  return [...fields].sort((a, b) => getFieldPriority(a) - getFieldPriority(b));
};