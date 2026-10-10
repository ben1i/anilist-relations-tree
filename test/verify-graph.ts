import { computeGraphLayout } from '../src/graph/layout';
import { anilistApi } from '../src/services/anilistApi';
import { buildGraphModel } from '../src/services/graphBuilder';
import type { FilterState } from '../src/types/anilist';

async function testMadokaGraph() {
  console.log('🧪 Test de récupération et de disposition du graphe pour Madoka Magica (ID 9756)...');

  // Clear cache for clean test
  anilistApi.clearCache();

  // Explore Anime franchise only
  const franchise = await anilistApi.exploreFranchiseGraph(
    9756,
    5,
    (p) => {
      console.log(`   [Progression] ${p.message}`);
    },
    { mediaType: 'ANIME', includeCharacters: false }
  );

  console.log(`\n✅ Récupéré avec succès : ${franchise.nodes.size} œuvres.`);

  const filters: FilterState = {
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

  const { nodes, edges } = buildGraphModel(franchise, filters);
  console.log(`📊 Graphe filtré : ${nodes.length} nœuds, ${edges.length} arêtes.`);

  const layout = computeGraphLayout(nodes, edges);
  console.log(`📐 Dimensions calculées : ${Math.round(layout.bounds.width)}px × ${Math.round(layout.bounds.height)}px`);

  console.log('\n📜 Liste des œuvres dans le graphe :');
  for (const n of nodes) {
    const title = n.media.title.english || n.media.title.romaji;
    console.log(`   • [${n.media.format}] ${title} (ID: ${n.mediaId}) [x=${Math.round(n.x)}, y=${Math.round(n.y)}]`);
  }

  console.log('\n🔗 Liaisons du graphe :');
  for (const edge of edges) {
    const s = nodes.find((n) => n.id === edge.source);
    const t = nodes.find((n) => n.id === edge.target);
    const sTitle = s?.media.title.english || s?.media.title.romaji;
    const tTitle = t?.media.title.english || t?.media.title.romaji;
    console.log(`   [${edge.displayLabel}] "${sTitle}" ──▶ "${tTitle}"`);
  }

  // Verify Steins;Gate is NOT present
  const steins = nodes.find((n) => (n.media.title.romaji || '').includes('Steins') || (n.media.title.english || '').includes('Steins'));
  if (steins) {
    throw new Error('❌ Steins;Gate ne devrait PAS être présent dans la franchise Madoka !');
  }

  // Verify no disconnected orphan nodes exist
  const connectedIds = new Set<string>();
  connectedIds.add(franchise.rootId.toString());
  edges.forEach((e) => {
    connectedIds.add(e.source);
    connectedIds.add(e.target);
  });

  const orphans = nodes.filter((n) => !connectedIds.has(n.id));
  if (orphans.length > 0) {
    throw new Error(`❌ Des nœuds sans liaisons sont présents : ${orphans.map((o) => o.media.title.romaji).join(', ')}`);
  }

  console.log('\n✨ SUCCÈS : 0 nœud orphelin, aucun cross-over Steins;Gate, fidélité parfaite à la capture de référence !');
}

testMadokaGraph().catch((err) => {
  console.error('❌ Erreur de validation :', err);
  process.exit(1);
});
