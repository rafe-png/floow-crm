import type { SVGProps } from "react";

type LogoProps = SVGProps<SVGSVGElement> & { size?: number };

/**
 * Logo da Floow — símbolo do infinito (∞) traçado.
 * Usa `currentColor`, então a cor vem da classe de texto (ex: text-[#f5c518]).
 */
export function FloowLogo({ size = 24, ...props }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M12 12C8 7 2 7 2 12C2 17 8 17 12 12C16 7 22 7 22 12C22 17 16 17 12 12Z" />
    </svg>
  );
}
