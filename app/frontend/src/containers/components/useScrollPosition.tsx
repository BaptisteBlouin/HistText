import { useEffect, useState } from "react";

/**
 * A hook that returns the top position of the sidebar based on the current
 * scroll position of the window. The position is calculated as the maximum
 * of 0 and the initialTop minus the current scrollY.
 *
 * @param {number} initialTop The initial top position of the sidebar. Defaults to 5.
 * @returns {number} The top position of the sidebar.
 */
const useScrollPosition = (initialTop: number = 5) => {
  const [sidebarTop, setSidebarTop] = useState<number>(initialTop);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const newTop = Math.max(0, initialTop - scrollY);
      setSidebarTop(newTop);
    };

    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [initialTop]);

  return sidebarTop;
};

export default useScrollPosition;
