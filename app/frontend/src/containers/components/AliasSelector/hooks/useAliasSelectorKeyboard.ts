import { useEffect } from "react";

/**
 * Custom hook for keyboard accessibility and focus in alias/collection dropdowns.
 *
 * - Handles ESC key to close the dropdown when open.
 * - Focuses the search input field automatically when the dropdown opens.
 *
 * @param isOpen - Whether the dropdown is open.
 * @param onClose - Callback to close the dropdown.
 * @param searchInputRef - Ref to the search input element.
 */
export const useAliasSelectorKeyboard = (
  isOpen: boolean,
  onClose: () => void,
  searchInputRef: React.RefObject<HTMLInputElement>,
) => {
  // Register ESC key event for closing when open
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscKey);
    return () => {
      document.removeEventListener("keydown", handleEscKey);
    };
  }, [isOpen, onClose]);

  // Autofocus search input when opening
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, searchInputRef]);
};
