import { useMemo, useCallback } from 'react';

export const useStatisticsNavigation = (
  statCategories: any,
  stats: any,
  selectedStat: string,
  onStatChange: (stat: string) => void
) => {
  const allAvailableStats = useMemo(() => {
    const statsArray: string[] = [];
    Object.values(statCategories).forEach((category: any) => {
      category.stats.forEach((stat: string) => {
        if (stats[stat]) {
          statsArray.push(stat);
        }
      });
    });
    return statsArray;
  }, [statCategories, stats]);

  const navigationInfo = useMemo(() => {
    const currentIndex = allAvailableStats.indexOf(selectedStat);
    const isFirst = currentIndex === 0;
    const isLast = currentIndex === allAvailableStats.length - 1;
    const total = allAvailableStats.length;
    
    return {
      currentIndex,
      isFirst,
      isLast,
      total,
      hasNavigation: total > 1
    };
  }, [allAvailableStats, selectedStat]);

  const navigateToStat = useCallback((direction: 'next' | 'prev') => {
    const currentIndex = allAvailableStats.indexOf(selectedStat);
    if (currentIndex === -1) return;

    let newIndex;
    if (direction === 'next') {
      newIndex = (currentIndex + 1) % allAvailableStats.length;
    } else {
      newIndex = currentIndex === 0 ? allAvailableStats.length - 1 : currentIndex - 1;
    }

    onStatChange(allAvailableStats[newIndex]);
  }, [allAvailableStats, selectedStat, onStatChange]);

  return {
    allAvailableStats,
    navigationInfo,
    navigateToStat
  };
};