import clsx from 'clsx';

const RISK_STYLES = {
  low: { label: 'Riesgo Bajo', className: 'bg-neon-green/15 text-neon-green' },
  medium: { label: 'Riesgo Medio', className: 'bg-electric-blue/15 text-electric-blue' },
  high: { label: 'Riesgo Alto', className: 'bg-neon-magenta/15 text-neon-magenta' },
};

export default function RiskBadge({ level = 'medium' }) {
  const style = RISK_STYLES[level] ?? RISK_STYLES.medium;
  return <span className={clsx('badge', style.className)}>{style.label}</span>;
}
