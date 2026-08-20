/* Queue de la bulle d'avis — SVG repris tel quel du paquet (blocs/avis.html).
   Meme teinte que .avis-bulle, decalee sous le bloc. */
export default function BulleQueue() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="88" height="32" viewBox="0 0 88 32" fill="none" aria-hidden="true">
      <g clipPath="url(#queue-bulle)">
        <path
          d="M50.2945 31.9995C50.2945 31.9995 57.2198 19.4833 56.3124 11.0184C55.0692 -0.578831 38.2207 -13.0005 38.2207 -13.0005L88.2207 -13.0005C88.2207 -13.0005 83.6642 6.43215 75.7032 15.608C68.3803 24.0482 50.2945 31.9995 50.2945 31.9995Z"
          fill="#FCEAFF"
        />
      </g>
      <defs>
        <clipPath id="queue-bulle">
          <rect width="88" height="32" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}
