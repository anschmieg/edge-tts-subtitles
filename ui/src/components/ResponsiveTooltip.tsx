import React from 'react';
import { Tooltip, useMediaQuery } from '@mui/material';

export function ResponsiveTooltip({ title, children, ...props }: { title: string; children: React.ReactNode;[key: string]: any }) {
  const isTouch = useMediaQuery('(hover: none) and (pointer: coarse)');
  if (!title) return <>{children}</>;
  return (
    <Tooltip
      title={title}
      placement={props.placement || 'top'}
      arrow
      enterTouchDelay={0}
      leaveTouchDelay={isTouch ? 2000 : 500}
      {...props}
    >
      <span style={{ display: 'inline-flex', width: '100%' }}>{children}</span>
    </Tooltip>
  );
}
