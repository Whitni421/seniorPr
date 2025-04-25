import React from 'react';
import { Box } from '@mui/material';

interface LogoProps {
  size?: number;
}

const Logo: React.FC<LogoProps> = ({ size = 40 }) => {
  return (
    <Box
      sx={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg width={size} height={size} viewBox="0 0 100 100">
        <path
          d="M50 90 L10 10 L90 10 Z"
          fill="none"
          stroke="#FF4081"
          strokeWidth="3"
          strokeLinejoin="round"
        />
      </svg>
    </Box>
  );
};

export default Logo; 