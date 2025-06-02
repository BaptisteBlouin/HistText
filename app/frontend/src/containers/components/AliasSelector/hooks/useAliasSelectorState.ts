import { useState, useCallback } from 'react';

/**
 * Custom hook to manage the state of a collection/alias dropdown selector.
 * 
 * Provides open/close state, loading status, search term, and convenience handlers for dropdowns.
 *
 * @returns Object containing dropdown state and control methods.
 */
export const useAliasSelectorState = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Toggle the dropdown open/closed. Clears search term when closing.
   */
  const toggleDropdown = useCallback(() => {
    setIsOpen(prev => !prev);
    if (isOpen) {
      setSearchTerm('');
    }
  }, [isOpen]);

  /**
   * Close the dropdown and clear the search term.
   */
  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setSearchTerm('');
  }, []);

  /**
   * Open the dropdown.
   */
  const openDropdown = useCallback(() => {
    setIsOpen(true);
  }, []);

  /**
   * Clear the current search term.
   */
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