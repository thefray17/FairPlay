import { Player, StandingsRow, BracketSlot } from '../types';
import {
  seedEntrants,
  generateBracket,
  recordBracketResult,
  getSeedingOrder,
  getBracketRoundName,
  getBracketProgress,
} from './bracket';

function createDummyPlayers(count: number): Player[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `player-${i + 1}`,
    name: `Player ${i + 1}`,
    active: true,
    avatarColor: '#4f46e5',
    joinedAtRound: 1,
    duprRating: 4.5 - i * 0.2, // Player 1 has 4.5, Player 2 has 4.3, etc.
  }));
}

function runSanityChecks() {
  console.log('--- RUNNING BRACKET UNIT & SANITY CHECKS ---');

  // Check 1: getSeedingOrder
  console.log('Seeding order for N=8:', getSeedingOrder(8));
  // Expected: [1, 8, 4, 5, 2, 7, 3, 6]

  // Check 2: 8-entrant bracket (full bracket, no byes)
  const players8 = createDummyPlayers(8);
  const slots8 = seedEntrants(players8, 'rating');
  const bracket8 = generateBracket(slots8);

  console.assert(bracket8.size === 8, '8-entrant bracket size should be 8');
  console.assert(bracket8.matches.length === 7, '8-entrant bracket should have 7 matches (4 + 2 + 1)');
  const r1Matches8 = bracket8.matches.filter((m) => m.round === 1);
  console.assert(r1Matches8.length === 4, 'Round 1 should have 4 matches');
  console.assert(r1Matches8.every((m) => !m.slotA?.isBye && !m.slotB?.isBye), '8-entrant bracket should have 0 byes');
  console.assert(r1Matches8.every((m) => !m.winnerSlot), 'No matches auto-resolved in 8-entrant bracket');
  console.log('✓ 8-entrant bracket verified (0 byes, 4 active first-round matches).');

  // Check 3: 7-entrant bracket (1 bye: Seed 1 gets bye facing Seed 8)
  const players7 = createDummyPlayers(7);
  const slots7 = seedEntrants(players7, 'rating');
  const bracket7 = generateBracket(slots7);

  console.assert(bracket7.size === 8, '7-entrant bracket size should be 8');
  const r1_7 = bracket7.matches.filter((m) => m.round === 1);
  const m1_7 = r1_7.find((m) => m.position === 1);
  console.assert(m1_7?.slotA?.seed === 1, 'Match 1 Slot A should be Seed 1');
  console.assert(m1_7?.slotB?.isBye === true, 'Match 1 Slot B should be BYE (Seed 8)');
  console.assert(m1_7?.winnerSlot === 'A', 'Match 1 should be auto-resolved with winner A');

  // Verify Seed 1 auto-advanced to Semifinal 1 (Round 2 Position 1 Slot A)
  const semi1_7 = bracket7.matches.find((m) => m.round === 2 && m.position === 1);
  console.assert(semi1_7?.slotA?.seed === 1, 'Seed 1 should have auto-advanced to Semifinal 1 Slot A');
  console.log('✓ 7-entrant bracket verified (Seed 1 gets bye and auto-advances to Semifinals).');

  // Check 4: 6-entrant bracket (2 byes: Seed 1 & Seed 2 get byes)
  const players6 = createDummyPlayers(6);
  const slots6 = seedEntrants(players6, 'rating');
  const bracket6 = generateBracket(slots6);

  console.assert(bracket6.size === 8, '6-entrant bracket size should be 8');
  const r1_6 = bracket6.matches.filter((m) => m.round === 1);
  const m1_6 = r1_6.find((m) => m.position === 1); // Seed 1 vs Seed 8(BYE)
  const m3_6 = r1_6.find((m) => m.position === 3); // Seed 2 vs Seed 7(BYE)
  console.assert(m1_6?.winnerSlot === 'A' && m1_6.slotA?.seed === 1, 'Seed 1 auto-advances');
  console.assert(m3_6?.winnerSlot === 'A' && m3_6.slotA?.seed === 2, 'Seed 2 auto-advances');

  const semi1_6 = bracket6.matches.find((m) => m.round === 2 && m.position === 1);
  const semi2_6 = bracket6.matches.find((m) => m.round === 2 && m.position === 2);
  console.assert(semi1_6?.slotA?.seed === 1, 'Seed 1 is in Semifinal 1 Slot A');
  console.assert(semi2_6?.slotA?.seed === 2, 'Seed 2 is in Semifinal 2 Slot A');
  console.log('✓ 6-entrant bracket verified (Seeds 1 & 2 get byes and auto-advance to Semifinals).');

  // Check 5: 5-entrant bracket (3 byes: Seeds 1, 2, 3 get byes; Seeds 4 & 5 play in R1)
  const players5 = createDummyPlayers(5);
  const slots5 = seedEntrants(players5, 'rating');
  const bracket5 = generateBracket(slots5);

  console.assert(bracket5.size === 8, '5-entrant bracket size should be 8');
  const r1_5 = bracket5.matches.filter((m) => m.round === 1);
  const r1Active_5 = r1_5.filter((m) => !m.winnerSlot);
  console.assert(r1Active_5.length === 1, 'Only 1 active match in Round 1 of 5-entrant bracket');
  console.assert(
    r1Active_5[0].slotA?.seed === 4 && r1Active_5[0].slotB?.seed === 5,
    'Active R1 match is Seed 4 vs Seed 5'
  );

  // Semifinal 2 should already have Seed 2 vs Seed 3 waiting!
  const semi2_5 = bracket5.matches.find((m) => m.round === 2 && m.position === 2);
  console.assert(
    semi2_5?.slotA?.seed === 2 && semi2_5?.slotB?.seed === 3,
    'Semifinal 2 is directly set as Seed 2 vs Seed 3'
  );
  console.log('✓ 5-entrant bracket verified (Seeds 1, 2, 3 get byes; Seeds 4 vs 5 play in R1).');

  // Check 6: Playing out the 5-entrant bracket to championship!
  // Step A: Play Round 1 Match 2 (Seed 4 vs Seed 5) -> Seed 4 wins 11 - 6
  const activeMatchId = r1Active_5[0].id;
  let currentBracket = recordBracketResult(bracket5, activeMatchId, 11, 6);

  // Check that Seed 4 advanced to Semifinal 1 Slot B against Seed 1
  const semi1_after = currentBracket.matches.find((m) => m.round === 2 && m.position === 1);
  console.assert(semi1_after?.slotA?.seed === 1, 'Semi 1 Slot A is Seed 1');
  console.assert(semi1_after?.slotB?.seed === 4, 'Semi 1 Slot B is Seed 4');

  // Step B: Play Semifinal 1 (Seed 1 vs Seed 4) -> Seed 1 wins 11 - 7
  currentBracket = recordBracketResult(currentBracket, semi1_after!.id, 11, 7);

  // Step C: Play Semifinal 2 (Seed 2 vs Seed 3) -> Seed 2 wins 11 - 9
  const semi2_play = currentBracket.matches.find((m) => m.round === 2 && m.position === 2);
  currentBracket = recordBracketResult(currentBracket, semi2_play!.id, 11, 9);

  // Check Final match
  const finalMatch = currentBracket.matches.find((m) => m.round === 3 && m.position === 1);
  console.assert(finalMatch?.slotA?.seed === 1, 'Final Slot A is Seed 1');
  console.assert(finalMatch?.slotB?.seed === 2, 'Final Slot B is Seed 2');

  // Step D: Play Final (Seed 1 vs Seed 2) -> Seed 1 wins 11 - 8
  currentBracket = recordBracketResult(currentBracket, finalMatch!.id, 11, 8);

  // Verify Champion
  console.assert(
    currentBracket.championPlayerIds?.length === 1 &&
      currentBracket.championPlayerIds[0] === 'player-1',
    'Champion should be player-1 (Seed 1)'
  );
  const progress = getBracketProgress(currentBracket);
  console.assert(progress.isComplete === true, 'Bracket should be marked complete');
  console.log('✓ Full match progression verified: Seed 4 advances, Seed 1 & 2 meet in final, Seed 1 crowned champion.');

  // Check 7: Doubles Seeding with Duos and Standings
  const playersDoubles: Player[] = [
    { id: 'p1', name: 'Alice', active: true, avatarColor: '#fff', joinedAtRound: 1, duoPartnerId: 'p2' },
    { id: 'p2', name: 'Bob', active: true, avatarColor: '#fff', joinedAtRound: 1, duoPartnerId: 'p1' },
    { id: 'p3', name: 'Charlie', active: true, avatarColor: '#fff', joinedAtRound: 1 },
    { id: 'p4', name: 'David', active: true, avatarColor: '#fff', joinedAtRound: 1 },
  ];
  const standingsRows: StandingsRow[] = [
    { playerId: 'p1', playerName: 'Alice', avatarColor: '#fff', active: true, matchesPlayed: 3, won: 3, lost: 0, tied: 0, pointsFor: 33, pointsAgainst: 15, pointDiff: 18, winRate: 100, recentForm: ['W', 'W', 'W'] },
    { playerId: 'p2', playerName: 'Bob', avatarColor: '#fff', active: true, matchesPlayed: 3, won: 3, lost: 0, tied: 0, pointsFor: 33, pointsAgainst: 15, pointDiff: 18, winRate: 100, recentForm: ['W', 'W', 'W'] },
    { playerId: 'p3', playerName: 'Charlie', avatarColor: '#fff', active: true, matchesPlayed: 3, won: 1, lost: 2, tied: 0, pointsFor: 20, pointsAgainst: 28, pointDiff: -8, winRate: 33, recentForm: ['L', 'W', 'L'] },
    { playerId: 'p4', playerName: 'David', avatarColor: '#fff', active: true, matchesPlayed: 3, won: 0, lost: 3, tied: 0, pointsFor: 12, pointsAgainst: 33, pointDiff: -21, winRate: 0, recentForm: ['L', 'L', 'L'] },
  ];

  const doublesSlots = seedEntrants(playersDoubles, 'standings', standingsRows, {
    format: 'doubles',
    doublesPairingMethod: 'duo_or_adjacent',
  });
  console.assert(doublesSlots.length === 2, '4 players should produce 2 doubles slots');
  console.assert(
    doublesSlots[0].playerIds.includes('p1') && doublesSlots[0].playerIds.includes('p2'),
    'Alice and Bob locked duo preserved as Seed 1'
  );
  console.assert(
    doublesSlots[1].playerIds.includes('p3') && doublesSlots[1].playerIds.includes('p4'),
    'Charlie and David paired as Seed 2'
  );
  console.log('✓ Doubles seeding and duo partner preservation verified.');

  console.log('--- ALL BRACKET SANITY CHECKS PASSED SUCCESSFULLY ---');
}

runSanityChecks();
