import { useEffect } from "react";

/**
 * React hook to detect and handle clicks outside of a referenced element.
 *
 * Calls the provided callback when a click occurs outside the target element.
 *
 * @param ref - React ref to the element to detect outside clicks for.
 * @param callback - Function to execute when an outside click is detected.
 */
export const useClickOutside = (
  ref: React.RefObject<HTMLElement>,
  callback: () => void,
) => {
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        callback();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [ref, callback]);
};
