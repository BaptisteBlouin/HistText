export const getFieldIcon = (fieldName: string) => {
  const name = fieldName.toLowerCase();
  if (name.includes('title') || name.includes('name')) return 'Article';
  if (name.includes('content') || name.includes('text') || name.includes('body')) return 'Description';
  if (name.includes('date') || name.includes('time')) return 'Info';
  if (name.includes('id')) return 'DataObject';
  return 'Label';
};

export const getFieldPriority = (fieldName: string): number => {
  const name = fieldName.toLowerCase();
  if (name.includes('title')) return 1;
  if (name.includes('content') || name.includes('text') || name.includes('body')) return 2;
  if (name.includes('date')) return 3;
  if (name.includes('id')) return 10;
  return 5;
};

export const isLongContent = (content: string): boolean => {
  return typeof content === 'string' && content.length > 200;
};

export const processDocumentFields = (document: any) => {
  if (!document) return [];
  
  return Object.entries(document)
    .filter(([key]) => !(key.startsWith('_') && key.endsWith('_')))
    .filter(([key]) => !key.startsWith('score'))
    .sort(([a], [b]) => getFieldPriority(a) - getFieldPriority(b));
};