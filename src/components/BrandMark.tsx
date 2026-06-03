import brandIcon from "../assets/neko-break-icon.png";

type Props = {
  className?: string;
};

export function BrandMark({ className }: Props) {
  return <img className={className} src={brandIcon} alt="Neko Break" />;
}
