/** Credit and support contact of the agency that built this installation (Madex IT Solutions). */
export const MADEX = {
  name: "Madex IT Solutions",
  url: "https://madex-it.ch",
  email: "info@madex-it.ch",
  phone: "+41 52 589 67 59",
  phoneHref: "tel:+41525896759",
};

/** The Madex mark (three folded bars). `light` for dark surfaces. */
export function MadexMark({ size = 20, light = false }: { size?: number; light?: boolean }) {
  const a = light ? "#ffffff" : "#025159";
  const b = light ? "#5fd0c8" : "#028d86";
  return (
    <svg viewBox="0 0 806.12 425.46" width={size * 1.9} height={size} aria-hidden="true" className="a-madexmark">
      <path fill={a} d="m114.77,124.96v275.73c0,21.93-26.51,32.91-42.02,17.4L7.21,352.55c-4.62-4.62-7.21-10.88-7.21-17.4V59.42c0-21.93,26.51-32.91,42.02-17.41l65.54,65.54c4.62,4.62,7.21,10.88,7.21,17.41Z" />
      <path fill={a} d="m460.12,124.96v275.73c0,21.93-26.51,32.91-42.02,17.41l-65.55-65.55c-4.62-4.62-7.21-10.88-7.21-17.41v-195.77c0-13.59-11.02-24.61-24.61-24.61h-146.35c-21.96,0-32.93-26.57-17.37-42.06L222.85,7.17c4.61-4.59,10.86-7.17,17.37-7.17h94.93c6.53,0,12.79,2.59,17.4,7.21l100.36,100.35c4.62,4.62,7.21,10.88,7.21,17.41Z" />
      <path fill={b} d="m680.57.3h-94.6c-6.48,0-12.7,2.56-17.31,7.12l-65.68,64.98c-15.63,15.47-4.68,42.11,17.31,42.11h145.79c13.59,0,24.61,11.02,24.61,24.61v195.46c0,6.53,2.59,12.79,7.21,17.41l66.21,66.21c15.51,15.51,42.02,4.52,42.02-17.41V124.79c0-6.57-2.63-12.87-7.3-17.5L697.88,7.42c-4.61-4.56-10.83-7.12-17.31-7.12Z" />
    </svg>
  );
}

/** Small mark at the bottom right of every dashboard page: logo + name, links to the support contact. */
export function MadexSignature() {
  return (
    <a href={MADEX.url} target="_blank" rel="noopener" className="a-signature" title={`Support: ${MADEX.email} · ${MADEX.phone}`}>
      <MadexMark size={10} />
      <span>{MADEX.name}</span>
    </a>
  );
}

/** Small «Erstellt von Madex» line for the login and footers. */
export function MadexCredit({ light = false, className }: { light?: boolean; className?: string }) {
  return (
    <a href={MADEX.url} target="_blank" rel="noopener" className={`a-madex${light ? " a-madex--light" : ""}${className ? " " + className : ""}`}>
      <MadexMark size={11} light={light} />
      <span>
        Erstellt von <strong>{MADEX.name}</strong>
      </span>
    </a>
  );
}
