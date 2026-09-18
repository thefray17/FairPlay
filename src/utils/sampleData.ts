import { MatchFormat, Player, SessionConfig } from '../types';

export const AVATAR_COLORS = [
  'bg-emerald-500 text-white',
  'bg-sky-500 text-white',
  'bg-amber-500 text-white',
  'bg-indigo-500 text-white',
  'bg-rose-500 text-white',
  'bg-teal-500 text-white',
  'bg-violet-500 text-white',
  'bg-orange-500 text-white',
  'bg-cyan-500 text-white',
  'bg-fuchsia-500 text-white',
];

export const INITIAL_PLAYERS: Player[] = [];

export const DEFAULT_CONFIG: SessionConfig = {
  sessionName: 'Club Session',
  sport: 'pickleball',
  format: 'doubles',
  playersPerTeam: 2,
  courtsCount: 2,
  targetPoints: 11,
  winByTwo: true,
  allowDraw: false,
};

export const SPORT_PRESETS: Record<
  string,
  { name: string; targetPoints: number; defaultFormat: MatchFormat }
> = {
  pickleball: { name: 'Pickleball', targetPoints: 11, defaultFormat: 'doubles' },
  badminton: { name: 'Badminton', targetPoints: 21, defaultFormat: 'doubles' },
  tennis: { name: 'Tennis', targetPoints: 6, defaultFormat: 'doubles' },
  'table-tennis': { name: 'Table Tennis', targetPoints: 11, defaultFormat: 'singles' },
  padel: { name: 'Padel', targetPoints: 6, defaultFormat: 'doubles' },
  volleyball: { name: 'Volleyball', targetPoints: 25, defaultFormat: 'triples' },
  custom: { name: 'Custom Sport', targetPoints: 15, defaultFormat: 'doubles' },
};
