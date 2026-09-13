import Image from "next/image";

/** Brand marks are decorative beside the visible integration names. */
export function AppIcon({ id }: { id: string }) {
  return (
    <span className={`app-icon ${id}`} aria-hidden="true">
      {id === "google-maps" && (
        <svg viewBox="0 0 48 64" fill="none">
          <path
            d="M24 0C10.75 0 0 10.75 0 24c0 15.5 17.5 29 21.2 37.8 1 2.9 4.6 2.9 5.6 0C30.5 53 48 39.5 48 24 48 10.75 37.25 0 24 0Z"
            fill="#00a650"
          />
          <path
            d="M24 0A24 24 0 000 24c0 9 5.9 17.5 12 25L43 9A24 24 0 0024 0Z"
            fill="#0085f7"
          />
          <path
            d="M0 24c0 4.5 1.5 9 4 13L31 1A24 24 0 000 24Z"
            fill="#0075e7"
          />
          <path
            d="M5.6 8.6A24 24 0 000 24c0 4.5 1.5 9 4 13l16-21Z"
            fill="#ff4031"
          />
          <path d="M4 37c2.3 4.1 5.2 8.1 8 12l18-23-10-10Z" fill="#ffbf00" />
          <circle cx="24" cy="24" r="9" fill="var(--paper)" />
        </svg>
      )}
      {id === "google-calendar" && (
        <svg viewBox="0 0 48 48" fill="none">
          <path
            d="M5 0h38a5 5 0 015 5v32L37 48H5a5 5 0 01-5-5V5a5 5 0 015-5Z"
            fill="#fff"
          />
          <path d="M0 5a5 5 0 015-5h32v11H11v26H0Z" fill="#1e88e5" />
          <path d="M37 0h6a5 5 0 015 5v6H37Z" fill="#1765bd" />
          <path d="M37 11h11v26H37Z" fill="#4caf50" />
          <path d="M11 37h26v11H11Z" fill="#fbc02d" />
          <path d="M0 37h11v11H5a5 5 0 01-5-5Z" fill="#1765bd" />
          <path d="M37 37h11L37 48Z" fill="#e53935" />
          <text
            x="24"
            y="31"
            textAnchor="middle"
            fontFamily="Arial,sans-serif"
            fontWeight="600"
            fontSize="21"
            fill="#1e88e5"
          >
            31
          </text>
        </svg>
      )}
      {id === "zinc" && (
        <Image
          src="/logos/zinc.webp"
          alt=""
          width={248}
          height={78}
          unoptimized
        />
      )}
    </span>
  );
}
