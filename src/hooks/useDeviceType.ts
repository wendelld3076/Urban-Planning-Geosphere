import { useState, useEffect } from 'react';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

export interface DeviceTypeInfo {
  deviceType: DeviceType;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  width: number;
  height: number;
  touchCapable: boolean;
}

export function useDeviceType(): DeviceTypeInfo {
  const [info, setInfo] = useState<DeviceTypeInfo>(() => {
    if (typeof window === 'undefined') {
      return {
        deviceType: 'desktop',
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        width: 1200,
        height: 800,
        touchCapable: false,
      };
    }
    return calculateDeviceType();
  });

  function calculateDeviceType(): DeviceTypeInfo {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const touchCapable =
      (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) ||
      (typeof window !== 'undefined' && 'ontouchstart' in window);

    const ua = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';

    const isIPad =
      /ipad/.test(ua) ||
      (/macintosh/.test(ua) && touchCapable && navigator.maxTouchPoints > 1);
    const isAndroid = /android/.test(ua);
    const isTabletUA = isIPad || (isAndroid && !/mobile/.test(ua));

    let deviceType: DeviceType;

    if (width < 768) {
      deviceType = 'mobile';
    } else if (width <= 1180 || isTabletUA || (touchCapable && width <= 1180)) {
      deviceType = 'tablet';
    } else {
      deviceType = 'desktop';
    }

    return {
      deviceType,
      isMobile: deviceType === 'mobile',
      isTablet: deviceType === 'tablet',
      isDesktop: deviceType === 'desktop',
      width,
      height,
      touchCapable,
    };
  }

  useEffect(() => {
    function handleResize() {
      setInfo(calculateDeviceType());
    }

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  return info;
}
