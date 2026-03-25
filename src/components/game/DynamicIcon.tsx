import {
  Trophy, Star, HeartPulse, Target, Footprints, ShieldCheck, Medal,
  Globe, BookOpen, Handshake, Dumbbell, Flame, Crown, TrendingUp,
  Brain, Sprout, Megaphone, Search, Building2, BadgeDollarSign,
  ClipboardList, Shield, Rocket, Swords, Coins, Circle, Zap,
  BarChart3, MapPin, CalendarDays, PenLine, Angry, Phone, Newspaper,
  Mic, Clock, Eye, Sunset, TrendingDown, Home, Plane, Wrench,
  CheckCircle2, Pickaxe,
  Sparkles, UserMinus, AlertTriangle, AlertCircle, RotateCcw,
  HeartCrack, Repeat, LayoutGrid, Award,
  Castle, Gem,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ICON_MAP: Record<string, LucideIcon> = {
  trophy: Trophy,
  star: Star,
  'heart-pulse': HeartPulse,
  target: Target,
  footprints: Footprints,
  'shield-check': ShieldCheck,
  medal: Medal,
  globe: Globe,
  'book-open': BookOpen,
  handshake: Handshake,
  dumbbell: Dumbbell,
  flame: Flame,
  crown: Crown,
  'trending-up': TrendingUp,
  'trending-down': TrendingDown,
  brain: Brain,
  sprout: Sprout,
  megaphone: Megaphone,
  search: Search,
  building: Building2,
  'badge-dollar': BadgeDollarSign,
  clipboard: ClipboardList,
  shield: Shield,
  rocket: Rocket,
  swords: Swords,
  coins: Coins,
  circle: Circle,
  zap: Zap,
  'bar-chart': BarChart3,
  'map-pin': MapPin,
  calendar: CalendarDays,
  'pen-line': PenLine,
  angry: Angry,
  phone: Phone,
  newspaper: Newspaper,
  mic: Mic,
  clock: Clock,
  eye: Eye,
  sunset: Sunset,
  home: Home,
  plane: Plane,
  wrench: Wrench,
  'check-circle': CheckCircle2,
  pickaxe: Pickaxe,
  sparkles: Sparkles,
  'user-minus': UserMinus,
  'alert-triangle': AlertTriangle,
  'alert-circle': AlertCircle,
  'rotate-ccw': RotateCcw,
  'heart-crack': HeartCrack,
  repeat: Repeat,
  'layout-grid': LayoutGrid,
  award: Award,
  castle: Castle,
  gem: Gem,
};

interface DynamicIconProps {
  name: string;
  className?: string;
}

export function DynamicIcon({ name, className }: DynamicIconProps) {
  const Icon = ICON_MAP[name];
  if (!Icon) return <Star className={cn('w-4 h-4', className)} />;
  return <Icon className={cn('w-4 h-4', className)} />;
}
