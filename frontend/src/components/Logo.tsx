interface LogoProps {
  size?: number;
  className?: string;
}

export function Logo({ size = 36, className = "" }: LogoProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="DoseWise"
    >
      <path
        d="M22 30C13 17 22 4 31 4C32 18 30 27 26 33Z"
        fill="#4A9598"
        stroke="#1B3A5F"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="M31 32C31 16 42 4 51 6C49 22 42 31 36 35Z"
        fill="#4A9598"
        stroke="#1B3A5F"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="M27 28L30 9"
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M37 30L46 11"
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <rect
        x="21"
        y="28"
        width="22"
        height="32"
        rx="11"
        fill="white"
        stroke="#1B3A5F"
        strokeWidth="2.5"
      />
      <path
        d="M23.5 44H40.5V49C40.5 55 37 58 32 58C27 58 23.5 55 23.5 49V44Z"
        fill="#2A5F66"
      />
    </svg>
  );
}
