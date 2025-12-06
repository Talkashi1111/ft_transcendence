import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

export default buildModule('TournamentScoresModule', (m) => {
  const tournamentScores = m.contract('TournamentScores');

  return { tournamentScores };
});
