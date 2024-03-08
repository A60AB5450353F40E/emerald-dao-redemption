// Configure minting params

// Wallet Connect projectId
const projectId = "2aca272d18deb10ff748260da5f78bfd";

// Url of the API server
const urlApiServer = ".";

// Contract Params safebox
const tokenId = "180f0db4465c2af5ef9363f46bacde732fa6ffb3bfe65844452078085b2e7c93";
const dustLimit = 800;
const vaultReopenLocktime = 1715774400;
const maxSafeboxes = 2000;
const network = "mainnet";

// old stuff from ninjas
const collectionSize = maxSafeboxes;
const numberOfThreads = 1;
const mintPriceSats = 10_000_000;
const payoutAddress = "bitcoincash:qqds0h006djrnast7ktvf7y3lrmvu0d7yqzhuzgvaa"; // with bitcoincash: or bchtest: prefix

// Wallet Connect Metadata
const wcMetadata = {
  name: 'Emerald-DAO',
  description: 'Emerald DAO',
  url: 'https://emerald-dao.cash/',
  icons: ['https://ipfs.pat.mn/ipfs/QmcNL1KcVmiDtwJe8WokrnzYeoHirsz1sNxNojncsxyb2p']
};

export { projectId, urlApiServer, tokenId, dustLimit, dustLimit, vaultReopenLocktime, maxSafeboxes, collectionSize, mintPriceSats, payoutAddress, numberOfThreads, network, wcMetadata };
