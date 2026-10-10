import { anilistApi } from '../src/services/anilistApi';
import { buildGraphModel } from '../src/services/graphBuilder';
import type { FilterState } from '../src/types/anilist';

async function testReachability() {
  const evaFranchise = await anilistApi.exploreFranchiseGraph(
    30,
    5,
    undefined,
    { mediaType: 'ANIME', includeCharacters: false }
  );

  console.log(`Initial fetched nodes: ${evaFranchise.nodes.size}`);

  const filtersWithSpinOffs: FilterState = {
    mediaType: 'ANIME',
    maxDepth: 5,
    titleLanguage: 'english',
    enabledRelations: {
      SEQUEL: true,
      PREQUEL: true,
      SPIN_OFF: true,
      SIDE_STORY: true,
      ALTERNATIVE: true,
      OTHER: true,
      SUMMARY: true,
      COMPILATION: true,
      ADAPTATION: true,
      CHARACTER: false
    },
    searchQuery: '',
    showCovers: false
  };

  const modelWithSpinOffs = buildGraphModel(evaFranchise, filtersWithSpinOffs);
  console.log(`With Spin-offs: ${modelWithSpinOffs.nodes.length} nodes, ${modelWithSpinOffs.edges.length} edges.`);

  const filtersWithoutSpinOffs: FilterState = {
    ...filtersWithSpinOffs,
    enabledRelations: {
      ...filtersWithSpinOffs.enabledRelations,
      SPIN_OFF: false
    }
  };

  const modelWithoutSpinOffs = buildGraphModel(evaFranchise, filtersWithoutSpinOffs);
  console.log(`Without Spin-offs: ${modelWithoutSpinOffs.nodes.length} nodes, ${modelWithoutSpinOffs.edges.length} edges.`);

  const hasPetitEva = modelWithoutSpinOffs.nodes.some((n) => (n.media.title.english || n.media.title.romaji || '').includes('Petit Eva'));
  console.log(`Is Petit Eva still there when Spin-offs are disabled? ${hasPetitEva}`);
}

testReachability();
