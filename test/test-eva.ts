import { anilistApi } from '../src/services/anilistApi';

async function checkEva() {
  const eva = await anilistApi.getMedia(30);
  console.log(`Root: ${eva.title.english || eva.title.romaji}`);
  for (const edge of eva.relations?.edges || []) {
    console.log(`- [${edge.relationType}] (${edge.node.type}/${edge.node.format}) ${edge.node.title.english || edge.node.title.romaji} (ID: ${edge.node.id})`);
  }
}

checkEva();
