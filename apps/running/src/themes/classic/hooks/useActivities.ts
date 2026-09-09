import { useContext } from 'react';
import { ActivitiesContext } from '@/themes/classic/contexts/ActivitiesContext';

const useActivities = () => {
  const context = useContext(ActivitiesContext);

  if (!context) {
    throw new Error('useActivities must be used within an ActivitiesProvider');
  }

  return context;
};

export default useActivities;
