import React from 'react';

export default function Badge({
  children,
  variant = 'teal', // 'vata' | 'pitta' | 'kapha' | 'tridosha' | 'teal' | 'success' | 'warning'
  icon,
  style,
}) {
  const getVariantClass = () => {
    switch (variant?.toLowerCase()) {
      case 'vata':
        return 'ayur-badge-vata';
      case 'pitta':
        return 'ayur-badge-pitta';
      case 'kapha':
        return 'ayur-badge-kapha';
      case 'tridosha':
        return 'ayur-badge-tridosha';
      default:
        return 'ayur-badge-teal';
    }
  };

  return (
    <span className={`ayur-badge ${getVariantClass()}`} style={style}>
      {icon && <span>{icon}</span>}
      <span>{children}</span>
    </span>
  );
}
