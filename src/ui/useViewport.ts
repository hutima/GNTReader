import { useEffect, useState } from 'react';

/** Mobile breakpoint (reference app convention): ≤ 767px gets the sheet UI. */
export const MOBILE_MAX = 767;

export function useIsMobile(): boolean {
  const query = `(max-width: ${MOBILE_MAX}px)`;
  const [mobile, setMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return mobile;
}
