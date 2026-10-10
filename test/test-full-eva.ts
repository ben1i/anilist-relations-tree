import { anilistApi } from '../src/services/anilistApi';

async function testFullEva() {
  anilistApi.clearCache();

  // Test Evangelion (ID 30)
  const evaFranchise = await anilistApi.exploreFranchiseGraph(
    30,
    5,
    undefined,
    { mediaType: 'ANIME', includeCharacters: false }
  );

  console.log(`Evangelion franchise size: ${evaFranchise.nodes.size}`);
  for (const [id, m] of evaFranchise.nodes.entries()) {
    console.log(`  - [${m.format}] ${m.title.english || m.title.romaji} (${id})`);
  }
}

testFullEva();
