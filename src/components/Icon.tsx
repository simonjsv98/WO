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
