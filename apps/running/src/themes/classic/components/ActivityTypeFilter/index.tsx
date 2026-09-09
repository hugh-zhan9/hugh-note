import useActivities from '@/themes/classic/hooks/useActivities';
import styles from './style.module.css';

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  running: '跑步',
  cycling: '骑行',
  walking: '步行',
  hiking: '徒步',
  swimming: '游泳',
  skiing: '滑雪',
};

const ActivityTypeFilter = () => {
  const { availableTypes, selectedTypes, toggleActivityType } = useActivities();
  const optionalTypes = availableTypes.filter((type) => type !== 'running');
  const runningEnabled = selectedTypes.includes('running');

  if (availableTypes.length === 0) {
    return null;
  }

  return (
    <div className={styles.container}>
      <span className={styles.label}>活动类型</span>
      <div className={styles.options}>
        {runningEnabled && (
          <span className={`${styles.option} ${styles.optionPinned}`}>
            <span className={styles.optionText}>跑步</span>
            <span className={styles.optionHint}>默认</span>
          </span>
        )}
        {optionalTypes.map((type) => {
          const checked = selectedTypes.includes(type);
          return (
            <label
              className={`${styles.option} ${checked ? styles.optionActive : ''}`}
              key={type}
            >
              <input
                checked={checked}
                onChange={() => toggleActivityType(type)}
                type="checkbox"
              />
              <span className={styles.optionText}>
                {ACTIVITY_TYPE_LABELS[type] ?? type}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
};

export default ActivityTypeFilter;
