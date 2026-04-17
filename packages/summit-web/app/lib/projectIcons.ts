import {
  Folder,
  Code,
  Rocket,
  Package,
  Briefcase,
  Globe,
  Book,
  Zap,
  Heart,
  Star,
  Box,
  Mountain,
  type LucideIcon,
} from "lucide-vue-next";

export const projectIcons: Record<string, LucideIcon> = {
  folder: Folder,
  code: Code,
  rocket: Rocket,
  package: Package,
  briefcase: Briefcase,
  globe: Globe,
  book: Book,
  zap: Zap,
  heart: Heart,
  star: Star,
  box: Box,
  mountain: Mountain,
};

export const projectIconNames = Object.keys(projectIcons);

export function getProjectIcon(name?: string): LucideIcon {
  return (name && projectIcons[name]) || Folder;
}
