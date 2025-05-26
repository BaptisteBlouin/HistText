import { useState, useCallback } from 'react';

export const useAliasSelectorState = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const toggleDropdown = useCallback(() => {
    setIsOpen(prev => !prev);
    if (isOpen) {
      setSearchTerm('');
    }
  }, [isOpen]);

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setSearchTerm('');
  }, []);

  const openDropdown = useCallback(() => {
    setIsOpen(true);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchTerm('');
  }, []);

  return {
    isOpen,
    searchTerm,
    setSearchTerm,
    isLoading,
    setIsLoading,
    toggleDropdown,
    closeDropdown,
    openDropdown,
    clearSearch
  };
};