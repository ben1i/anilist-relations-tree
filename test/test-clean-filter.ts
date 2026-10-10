import { anilistApi } from '../src/services/anilistApi';

async function run() {
  const root = await anilistApi.getMedia(9756);
  console.log('Root:', root.title.english || root.title.romaji, 'type:', root.type);

  // Print all direct relations of Madoka Magica
  for (const edge of root.relations?.edges || []) {
    console.log(`- [${edge.relationType}] (${edge.node.type}/${edge.node.format}) ${edge.node.title.english || edge.node.title.romaji}`);
  }
}

run();
