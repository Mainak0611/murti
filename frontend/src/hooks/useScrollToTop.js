import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function useScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Function to find ANY scrolled element and reset it
    const resetAllScrollbars = () => {
      // 1. Reset Window/Body (The basics)
      window.scrollTo(0, 0);
      document.body.scrollTop = 0;
      document.documentElement.scrollTop = 0;

      // 2. Find ALL elements on the page that might be scrolled
      // We look for divs, main, sections, etc.
      // Note: 'querySelectorAll' returns a NodeList, we iterate over it
      const allElements = document.querySelectorAll('*');
      
      for (const el of allElements) {
        // If an element has been scrolled down, reset it
        if (el.scrollTop > 0) {
          el.scrollTop = 0;
        }
      }
    };

    // Run immediately
    resetAllScrollbars();

    // Run again after a short delay (50ms) to catch React rendering lag
    // This serves as a safety net for slower renders
    const timer = setTimeout(resetAllScrollbars, 50);

    return () => clearTimeout(timer);
  }, [pathname]); // Runs every time URL changes
}