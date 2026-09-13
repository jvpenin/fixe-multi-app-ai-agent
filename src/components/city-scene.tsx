"use client";
import { motion } from "framer-motion";

export function Landy({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 220 160"
      fill="none"
      aria-label="Landy, your flying companion"
      role="img"
    >
      <defs>
        <linearGradient
          id="wing"
          x1="65"
          y1="30"
          x2="150"
          y2="140"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#fffefa" />
          <stop offset=".58" stopColor="#eeeae1" />
          <stop offset="1" stopColor="#c7c7c4" />
        </linearGradient>
        <linearGradient
          id="body"
          x1="110"
          y1="40"
          x2="135"
          y2="120"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="white" />
          <stop offset="1" stopColor="#dbdedc" />
        </linearGradient>
        <filter id="shadow">
          <feDropShadow
            dx="0"
            dy="12"
            stdDeviation="8"
            floodColor="#25372e"
            floodOpacity=".16"
          />
        </filter>
      </defs>
      <g filter="url(#shadow)">
        <path
          d="M27 73Q18 66 33 62L186 22Q201 18 192 32L124 137Q119 145 114 131L98 91Z"
          fill="url(#wing)"
        />
        <path d="M98 91L190 25L117 110L114 131Z" fill="#183c36" />
        <path
          d="M55 77Q46 69 61 64L178 30Q192 26 183 38L118 111Q105 125 100 109L94 89Z"
          fill="url(#body)"
        />
        <ellipse
          cx="123"
          cy="79"
          rx="3.2"
          ry="5"
          transform="rotate(35 123 79)"
          fill="#19352f"
        />
        <ellipse
          cx="136"
          cy="69"
          rx="3.2"
          ry="5"
          transform="rotate(35 136 69)"
          fill="#19352f"
        />
      </g>
    </svg>
  );
}
function Building({
  x,
  y,
  w,
  h,
  d = 27,
  color = "#efeee6",
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  d?: number;
  color?: string;
}) {
  return (
    <g>
      <path d={`M${x} ${y}v${-h}l${w} ${-w / 2}v${h}Z`} fill={color} />
      <path
        d={`M${x + w} ${y - w / 2}v${-h}l${d} ${d / 2}v${h}Z`}
        fill="#d2d7ca"
      />
      <path
        d={`M${x} ${y - h}l${w} ${-w / 2}l${d} ${d / 2}l${-w} ${w / 2}Z`}
        fill="#faf9f2"
      />
      {Array.from({ length: Math.floor(h / 15) }, (_, i) => (
        <path
          key={i}
          d={`M${x + 7} ${y - h + 12 + i * 15}l${w - 14} ${-(w - 14) / 2}`}
          stroke="#b5c3b7"
          strokeWidth="3"
          strokeDasharray="4 5"
        />
      ))}
    </g>
  );
}
export function CityScene({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`city-scene ${compact ? "compact" : ""}`}>
      <div className="scene-orbit orbit-one" />
      <div className="scene-orbit orbit-two" />
      <svg
        viewBox="0 0 650 540"
        className="city-svg"
        role="img"
        aria-label="A floating neighborhood with a destination pin and a flight path"
      >
        <defs>
          <filter id="cityShadow">
            <feDropShadow
              dx="0"
              dy="24"
              stdDeviation="20"
              floodColor="#546454"
              floodOpacity=".15"
            />
          </filter>
          <linearGradient id="base" x2="1" y2="1">
            <stop stopColor="#edf0e4" />
            <stop offset="1" stopColor="#d9e3d0" />
          </linearGradient>
        </defs>
        <ellipse
          cx="340"
          cy="427"
          rx="216"
          ry="54"
          fill="#dce0d3"
          opacity=".25"
        />
        <g filter="url(#cityShadow)">
          <path
            d="M92 316L343 184Q359 176 375 185L574 292Q590 301 574 312L333 451Q320 458 306 451L92 334Z"
            fill="#c9d5be"
          />
          <path
            d="M92 313L343 178Q359 170 375 179L574 286Q590 295 574 306L333 439Q320 447 306 439L92 322Q85 318 92 313Z"
            fill="url(#base)"
          />
          <path
            d="M131 298L354 418M198 262L422 382M265 225L489 345M329 191L550 310M148 349L393 209M214 384L458 244M280 419L523 279"
            stroke="#fafaf4"
            strokeWidth="14"
          />
          <path
            d="M148 349L393 209M214 384L458 244M280 419L523 279"
            stroke="#d3dccc"
            strokeWidth="1"
            strokeDasharray="5 5"
          />
          <path d="M285 318l53-30 44 24-55 32Z" fill="#aebd95" />
          <path d="M292 319l44-24 32 18-43 23Z" fill="#bfccaa" />
          <Building x={289} y={241} w={35} h={68} />
          <Building x={343} y={221} w={27} h={93} />
          <Building x={392} y={254} w={42} h={56} />
          <Building x={455} y={287} w={27} h={91} />
          <Building x={218} y={280} w={33} h={50} />
          <Building x={160} y={313} w={27} h={43} />
          <Building x={227} y={363} w={40} h={79} />
          <Building x={361} y={361} w={32} h={52} />
          <Building x={417} y={332} w={25} h={35} />
          <Building x={299} y={402} w={33} h={39} />
          {(
            [
              [199, 320],
              [280, 276],
              [335, 308],
              [355, 321],
              [487, 313],
              [329, 372],
              [412, 285],
              [270, 380],
            ] as [number, number][]
          ).map(([x, y], i) => (
            <g key={i}>
              <path d={`M${x} ${y}v-21`} stroke="#7d8a6a" strokeWidth="3" />
              <ellipse
                cx={x}
                cy={y - 24}
                rx="10"
                ry="16"
                fill={i % 2 ? "#91a87b" : "#a9bb90"}
              />
              <ellipse cx={x - 3} cy={y - 28} rx="6" ry="10" fill="#bccba5" />
            </g>
          ))}
        </g>
        <motion.path
          d="M60 175C-5 300 180 437 299 362S420 282 402 191"
          stroke="#6c8d75"
          strokeWidth="2"
          strokeDasharray="5 7"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 2.5 }}
        />
        <motion.g
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        >
          <ellipse
            cx="400"
            cy="272"
            rx="19"
            ry="8"
            fill="#294d39"
            opacity=".13"
          />
          <path
            d="M400 257s-28-33-28-52a28 28 0 1156 0c0 19-28 52-28 52Z"
            fill="#284f3c"
          />
          <circle cx="400" cy="205" r="10" fill="#eff3e6" />
        </motion.g>
      </svg>
      <motion.div
        className="scene-landy"
        animate={{ y: [0, -15, 0], rotate: [-6, 1, -6] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      >
        <Landy />
      </motion.div>
      <motion.div
        className="floating-card calendar-float"
        animate={{ y: [0, -7, 0] }}
        transition={{ duration: 5, repeat: Infinity }}
      >
        <span className="calendar-icon">15</span>
        <div>
          <strong>A little more settled.</strong>
          <small>Your first 72 hours, handled.</small>
        </div>
        <span className="card-check">✓</span>
      </motion.div>
      <motion.div
        className="floating-card place-float"
        animate={{ y: [0, 7, 0] }}
        transition={{ duration: 6, repeat: Infinity }}
      >
        <span className="pin-icon">⌖</span>
        <div>
          <strong>Your new neighborhood</strong>
          <small>Good things are close by.</small>
        </div>
      </motion.div>
      <div className="package-float">
        ▱<span>Essentials, sorted</span>
      </div>
      {!compact && (
        <div className="scene-caption">
          <span className="live-dot" /> A softer landing starts here.
        </div>
      )}
    </div>
  );
}
