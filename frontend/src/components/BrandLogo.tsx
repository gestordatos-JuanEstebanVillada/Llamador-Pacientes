type BrandLogoProps = {
  className?: string;
  alt?: string;
};

export function BrandLogo({
  className = "h-12 w-auto mx-auto",
  alt = "Fundación La Liga - Ama Salvar Vidas",
}: BrandLogoProps) {
  return (
    <img
      src="/img/logo-liga-50.png"
      alt={alt}
      className={className}
    />
  );
}
