import { useEffect } from "react";

/**
 * Custom hook for keyboard accessibility and focus in alias/collection dropdowns.
 *
 * - Handles ESC key to close the dropdown when open.
 * - Handles Enter key to select the first filtered result.
 * - Focuses the search input field automatically when the dropdown opens.
 *
 * @param isOpen - Whether the dropdown is open.
 * @param onClose - Callback to close the dropdown.
 * @param searchInputRef - Ref to the search input element.
 * @param onSelectFirst - Optional callback to select the first filtered result.
 */
export const useAliasSelectorKeyboard = (
  isOpen: boolean,
  onClose: () => void,
  searchInputRef: React.RefObject<HTMLInputElement>,
  onSelectFirst?: () => void,
) => {
  // Register keyboard events for ESC and Enter
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      if (event.key === "Escape") {
        onClose();
      } else if (event.key === "Enter" && onSelectFirst) {
        // Only trigger if the search input is focused (to avoid conflicts with other inputs)
        if (document.activeElement === searchInputRef.current) {
          event.preventDefault();
          onSelectFirst();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose, onSelectFirst, searchInputRef]);

  // Autofocus search input when opening
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, searchInputRef]);
};
