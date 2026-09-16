import Image from 'next/image';
import clsx from 'clsx';

export type ApexMatchLogoVariant = 'full' | 'icon' | 'vip';
export type ApexMatchLogoSize = 'sm' | 'md' | 'lg';

export interface ApexMatchLogoProps {
  /**
   * 'full' = isotipo + wordmark "APEXMATCH" (+ tagline en tamaños md/lg) — Navbar/Header/Footer.
   * 'icon' = solo el isotipo verde neón, recorte cuadrado — favicon, avatar, nav icon móvil.
   * 'vip'  = isotipo dentro del badge circular con candado y resplandor magenta — paywall / tarjetas VIP.
   */
  variant?: ApexMatchLogoVariant;
  size?: ApexMatchLogoSize;
  /** En variant="full", fuerza mostrar/ocultar el asset con tagline (por defecto: se muestra en md/lg). */
  showTagline?: boolean;
  className?: string;
}

// Assets oficiales de marca (ver /public/images/brand) — reemplazan el isotipo dibujado a mano.
const ASSETS = {
  fullWithTagline: { src: '/images/brand/logo-full.png', width: 1600, height: 356 },
  wordmarkOnly: { src: '/images/brand/logo-wordmark.png', width: 1600, height: 365 },
  icon: { src: '/images/brand/icon-square.png', width: 256, height: 256 },
  vipBadge: { src: '/images/brand/badge-vip.png', width: 300, height: 210 },
};

const GLOW_GREEN = 'drop-shadow-[0_0_12px_rgba(0,255,135,0.5)]';
const GLOW_MAGENTA = 'drop-shadow-[0_0_12px_rgba(255,42,133,0.5)]';

// Alto en px del asset horizontal (con o sin tagline) por tamaño; el ancho escala por aspect-ratio.
const FULL_HEIGHT: Record<ApexMatchLogoSize, number> = { sm: 22, md: 32, lg: 48 };
const ICON_SIZE: Record<ApexMatchLogoSize, number> = { sm: 24, md: 36, lg: 56 };
const VIP_SIZE: Record<ApexMatchLogoSize, number> = { sm: 56, md: 80, lg: 120 };

export default function ApexMatchLogo({
  variant = 'full',
  size = 'md',
  showTagline,
  className,
}: ApexMatchLogoProps) {
  if (variant === 'icon') {
    const px = ICON_SIZE[size];
    return (
      <Image
        src={ASSETS.icon.src}
        alt="ApexMatch"
        width={ASSETS.icon.width}
        height={ASSETS.icon.height}
        style={{ width: px, height: px }}
        className={clsx('rounded-full', GLOW_GREEN, className)}
        priority
      />
    );
  }

  if (variant === 'vip') {
    const px = VIP_SIZE[size];
    return (
      <Image
        src={ASSETS.vipBadge.src}
        alt="ApexMatch VIP"
        width={ASSETS.vipBadge.width}
        height={ASSETS.vipBadge.height}
        style={{ width: px, height: 'auto' }}
        className={clsx('rounded-full', GLOW_MAGENTA, className)}
      />
    );
  }

  // variant="full": por defecto el asset con tagline (isotipo + wordmark + tagline en un
  // solo PNG) se reserva para tamaños md/lg; showTagline fuerza el comportamiento.
  const withTagline = showTagline ?? size !== 'sm';
  const height = FULL_HEIGHT[size];

  if (withTagline) {
    const asset = ASSETS.fullWithTagline;
    const width = Math.round((asset.width / asset.height) * height);
    return (
      <Image
        src={asset.src}
        alt="ApexMatch — Quantitative Football Analytics"
        width={asset.width}
        height={asset.height}
        style={{ width, height }}
        className={clsx(GLOW_GREEN, className)}
        priority
      />
    );
  }

  // Sin tagline: el set de marca no incluye un PNG "isotipo + wordmark" independiente,
  // así que se compone el icono cuadrado + el wordmark de solo texto lado a lado.
  const wordmarkWidth = Math.round((ASSETS.wordmarkOnly.width / ASSETS.wordmarkOnly.height) * height);

  return (
    <span className={clsx('inline-flex items-center gap-2', className)}>
      <Image
        src={ASSETS.icon.src}
        alt=""
        aria-hidden="true"
        width={ASSETS.icon.width}
        height={ASSETS.icon.height}
        style={{ width: height, height }}
        className={GLOW_GREEN}
        priority
      />
      <Image
        src={ASSETS.wordmarkOnly.src}
        alt="ApexMatch"
        width={ASSETS.wordmarkOnly.width}
        height={ASSETS.wordmarkOnly.height}
        style={{ width: wordmarkWidth, height: height * 0.7 }}
        priority
      />
    </span>
  );
}
