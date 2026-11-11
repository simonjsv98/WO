const PATHS = {
  home: 'M4 11.5 12 4l8 7.5M6.5 10v9.5h11V10',
  program: 'M5 5h14v15H5zM5 9.5h14M9 3v4M15 3v4',
  dumbbell: 'M3 9v6M6.5 6.5v11M17.5 6.5v11M21 9v6M6.5 12h11',
  chart: 'M5 20V11M12 20V4M19 20v-6',
  settings: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 9.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4ZM9 19.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4Z',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  back: 'M14.5 5 8 12l6.5 7',
  forward: 'M9.5 5 16 12l-6.5 7',
  play: 'M8 5.5v13l11-6.5z',
  pause: 'M8 5.5v13M16 5.5v13',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  close: 'm6 6 12 12M18 6 6 18',
  timer: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM12 9v4.5M9.5 2.5h5',
  trash: 'M5 7h14M9.5 7V4.5h5V7M7 7l.8 12.5h8.4L17 7',
  search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM20 20l-4.6-4.6',
  reset: 'M4.5 12a7.5 7.5 0 1 0 2.4-5.5M4.5 4.5v4h4',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5.5M12 7.6v.2',
  swap: 'M4 8h13M13.5 4.5 17 8l-3.5 3.5M20 16H7M10.5 12.5 7 16l3.5 3.5',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20c.8-3.6 3.8-5.5 7.5-5.5s6.700 1.900 7.500 5.500',
  pin: 'M12 21v-6M7 15h10l-1.500-4.500V5.500h1V4H7.500v1.500h1V10.500z',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H4.500c0 3 1.500 4.500 3.500 4.500M16 6h3.500c0 3-1.500 4.500-3.500 4.500M12 13v4M8.500 20h7M9.500 17h5',
  calendar: 'M5 5h14v15H5zM5 9.500h14M9 3v4M15 3v4',
  moon: 'M19.500 14.500A8 8 0 0 1 9.500 4.500a8 8 0 1 0 10 10z',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={name === 'play' ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={name === 'play' ? 0 : 1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
