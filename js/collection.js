import SignClient from '@walletconnect/sign-client';
import { WalletConnectModal } from '@walletconnect/modal';
import { Contract, ElectrumNetworkProvider, SignatureTemplate } from "cashscript";
import contractArtifact from "/js/safebox.json";
import { decodeCashAddress, binToHex, hexToBin, vmNumberToBigInt, bigIntToVmNumber, encodeCashAddress, decodeTransaction,
    cashAddressToLockingBytecode, stringify,
    binToBigIntUintLE, lockingBytecodeToCashAddress, encodeLockingBytecodeP2sh20, hash160 } from '@bitauth/libauth';
import { ElectrumClient, ElectrumCluster, ElectrumTransport } from 'electrum-cash';
import { projectId, urlApiServer, tokenId, dustLimit, vaultReopenLocktime, maxSafeboxes, network, wcMetadata } from "/js/mintingParams.js";
import { listMarkings, listWeapons, listBackgrounds, listEyes, listColors, listSpecials } from "/js/attributes.js";

// Read URL Params
const urlParams = new URLSearchParams(window.location.search);
const urlParamAddr = urlParams.get("addr");
const urlParamFullCollection = urlParams.get("fullcollection");
const displayFullCollection = urlParamFullCollection == "";

// Define lists for ninja attributes
const checkboxLists = [listMarkings, listWeapons, listBackgrounds, listEyes, listColors, listColors, listSpecials];
const itemsPerAttributeList = [9, 22, 14, 16, 22, 22, 1];
const attributeNames = ["Markings", "Weapons", "Backgrounds", "Eyes", "Colors1", "Colors2", "Specials"];
const attributeKeys = ["Marking", "Weapon", "Background", "Eyes", "Primary Color", "Secondary Color", "Specials"];

// Create a custom 1-of-3 electrum cluster for bch-mainnet
const electrumCluster = new ElectrumCluster('Emerald-DAO', '1.5.1', 1, 3);
electrumCluster.addServer('fulcrum.greyh.at', ElectrumTransport.WSS.Port, ElectrumTransport.WSS.Scheme);
electrumCluster.addServer('bch.loping.net', ElectrumTransport.WSS.Port, ElectrumTransport.WSS.Scheme);
electrumCluster.addServer('electroncash.dk', ElectrumTransport.WSS.Port, ElectrumTransport.WSS.Scheme);
const electrum = network == "mainnet" ? electrumCluster : undefined;
// Initialise cashscript ElectrumNetworkProvider
const electrumServer = new ElectrumNetworkProvider(network, electrum);

// Client connection for event notifications
const electrumClient = new ElectrumClient('Emerald-DAO', '1.5.1', 'bch.imaginary.cash', ElectrumTransport.WSS.Port, ElectrumTransport.WSS.Scheme);

const handleNewBlocks = (data) => {
    console.log(`New block: ${data.height}`);
    refreshBCHBalance();
}

async function setElectrumEvents() {
    await electrumClient.connect();
    electrumClient.on('notification', handleNewBlocks);
    await electrumClient.subscribe(handleNewBlocks, 'blockchain.headers.subscribe');
}

// Fetch full BCMR file from server
const fetchBcmrPromise = await fetch(urlApiServer + "/bitcoin-cash-metadata-registry.json");
const fetchBcmrResult = await fetchBcmrPromise.json();
const nftMetadata = fetchBcmrResult.identities["180f0db4465c2af5ef9363f46bacde732fa6ffb3bfe65844452078085b2e7c93"]["2023-05-26T17:10:00.000Z"].token;

// 1. Setup Client with relay server
const signClient = await SignClient.init({
  projectId,
  // optional parameters
  relayUrl: 'wss://relay.walletconnect.com',
  metadata: wcMetadata
});

// Get last WalletConnect session from local storage is there is any
const lastKeyIndex = signClient.session.getAll().length - 1;
const lastSession = signClient.session.getAll()[lastKeyIndex];

// Handle session events
signClient.on('session_event', ({ event }) => {
  console.log('session_event');
  console.log(event);
});

signClient.on('session_update', ({ topic, params }) => {
  console.log('session_update');
  console.log(params);
});

signClient.on('session_delete', () => {
  console.log('session_delete');
});

// Connect Client.
const walletConnectModal = new WalletConnectModal({
  projectId: projectId,
  themeMode: 'dark',
  themeVariables: {
    '--wcm-background-color': '#20c997',
    '--wcm-accent-color': '#20c997',
  },
  explorerExcludedWalletIds: 'ALL',
});

const connectedChain = network == "mainnet" ? "bch:bitcoincash" : "bch:bchtest";
const requiredNamespaces = {
  bch: {
    chains: [connectedChain],
    methods: ['bch_getAddresses', 'bch_signTransaction', 'bch_signMessage'],
    events: ['addressesChanged'],
  },
};

// Global variables
let unfilteredListNinjas = [];
let ninjasConnectedWallet = [];
let connectedUserAddress = "";
let networkMTPUnix = 0;
let networkMTPString;

// Try to reconnect to previous session on startup
let session;
if (lastSession) setTimeout(async () => {
  const confirmReuse = confirm("The collection page is going to re-use your previous WalletConnect session, make sure you have your wallet open");
  if (confirmReuse) {
    session = lastSession;
    fetchUserNinjas();
  }
}, 500);
else {
  const { uri, approval } = await signClient.connect({ requiredNamespaces });
  await walletConnectModal.openModal({ uri });
  // Await session approval from the wallet.
  session = await approval();
  // Close the QRCode modal in case it was open.
  walletConnectModal.closeModal();
  fetchUserNinjas();
};

// If urlParam has address, load collection 
if (urlParamAddr) setTimeout(async () => {
  const listCashninjas = await getNinjasOnAddr(urlParamAddr);
  updateCollection(listCashninjas);
  displayNinjas();
}, 500
);

async function refreshNinjas() {
  const listCashninjas = await getNinjasOnAddr(urlParamAddr);
  updateCollection(listCashninjas);
  displayNinjas();
}

setElectrumEvents();

if (displayFullCollection) setTimeout(async () => {
  let allNinjaNumbers = [];
  for (let i = 1; i <= 5000; i++) { allNinjaNumbers.push(i); }
  updateCollection(allNinjaNumbers);
  displayNinjas();
}, 500
);

async function fetchUserNinjas() {
  if (!ninjasConnectedWallet.length) {
    const userAddress = await getUserAddress();
    connectedUserAddress = userAddress;
    const listCashninjas = await getNinjasOnAddr(userAddress);
    //document.getElementById("myCollectionButton").textContent = `My Collection (${listCashninjas.length})`
    ninjasConnectedWallet = listCashninjas;
  }
  window.history.replaceState({}, "", `${location.pathname}?addr=${connectedUserAddress}`);
  updateCollection(ninjasConnectedWallet);
  displayNinjas();
  refreshBCHBalance();
}

async function refreshBCHBalance() {
  const el = document.getElementById("BCHBalance");
  const elmtp = document.getElementById("NetworkMTP");
  const elva = document.getElementById("VaultStatus");
  el.textContent = `Wallet BCH Balance: loading...`;
  elmtp.textContent = `Network MTP: updating...`;
  elva.textContent = `Vault Status: updating...`;

  const userAddress = await getUserAddress();
  const userUtxos = await electrumServer.getUtxos(userAddress);
  const filteredUserUtxos = userUtxos.filter(
    val => !val.token
  );
  const bchBalanceUser = userUtxos.reduce((total, utxo) => utxo.token ? total : total + utxo.satoshis, 0n);
  el.textContent = `Wallet BCH Balance: ${Number(bchBalanceUser)/100000000.0}`;

  networkMTPUnix = await getMTP();
  let dt=new Date(networkMTPUnix * 1000).toLocaleString();
  elmtp.textContent = `Network MTP: ${networkMTPUnix}` + ` (${dt})` + ` (${network})`;
  if(networkMTPUnix < Number(contractParams[1])) {
    elva.textContent = `Vault Status: CLOSED`;
  } else {
    elva.textContent = `Vault Status: OPEN`;
  }
}

async function getMTP() {
    // get height
    await new Promise(resolve => setTimeout(resolve, 500));
    let height = await electrumServer.getBlockHeight();

    // get last 11 headers
    await new Promise(resolve => setTimeout(resolve, 500));
    new Date().toLocaleString();
    let headers = await electrumServer.performRequest("blockchain.block.headers", height-10, 11);
    let blocktimes = [];
    for(let i=0; i<11; i++) {
        blocktimes[i] = Number(binToBigIntUintLE(hexToBin(headers.hex.substring(136+i*160,136+i*160+8))));
    }
    blocktimes.sort();
    return blocktimes[5];
}

async function getNinjasOnAddr(address) {
  const userUtxos = await electrumServer.getUtxos(address);
  const cashNinjaUtxos = userUtxos.filter(val => val?.token?.category == tokenId);
  const listCashninjas = [];
  cashNinjaUtxos.forEach(ninjaUtxo => {
    const ninjaCommitment = ninjaUtxo.token.nft.commitment;
    const ninjaNumber = (binToBigIntUintLE(hexToBin(ninjaCommitment.slice(0,4))) + 1n);
    const ninjaAmount = binToBigIntUintLE(hexToBin(ninjaCommitment.slice(4,16)));
    const keycardData = {['keycardNumber']: ninjaNumber, ['keycardAmount']: ninjaAmount, ['keycardCommitment']: ninjaCommitment};
    listCashninjas.push(keycardData);
  });
  listCashninjas.sort((a, b) => {
      if (a.keycardNumber < b.keycardNumber) {
        return -1;
      }
      if (a.keycardNumber == b.keycardNumber) {
        return 0;
      }
      if (a.keycardNumber > b.keycardNumber) {
        return 1;
      }
    });
  return listCashninjas;
}

async function displayNinjas(offset = 0) {
  const filteredNinjaList = filterNinjaList(unfilteredListNinjas);
  const listNinjas = filteredNinjaList.sort((a, b) => a - b);
  const startPoint = offset * 100;
  const slicedArray = listNinjas.slice(startPoint, startPoint + 100);
  // Pagination logic
  renderPagination(offset, filteredNinjaList.length);

  // Create the HTML rendering setup
  const Placeholder = document.getElementById("PlaceholderNinjaList");
  const ninjaList = document.createElement("div");
  ninjaList.setAttribute("id", "PlaceholderNinjaList");
  ninjaList.classList.add("g-6", "row");
  // Render no ninjas if they don't own any
  if (slicedArray.length === 0) {
    const template = document.getElementById("no-ninjas");
    const noNinjasTemplate = document.importNode(template.content, true);
    ninjaList.appendChild(noNinjasTemplate);
    Placeholder.replaceWith(ninjaList);
  } else {
    // Render list of cashninjas
    const template = document.getElementById("ninja-template");
    slicedArray.forEach(keycardData => {
      const ninjaTemplate = document.importNode(template.content, true);
      const ninjaImage = ninjaTemplate.getElementById("ninjaImage");
      ninjaImage.src = urlApiServer + '/images/dao-pic.png';
      const ninjaName = ninjaTemplate.getElementById("ninjaName");
      const safeboxValue = ninjaTemplate.getElementById("safeboxValue");
      const redeemButton = ninjaTemplate.getElementById("redeemButton");
      ninjaName.textContent = `Emerald DAO Keycard #${keycardData.keycardNumber}`;
      safeboxValue.textContent = `Safebox Value: ${Number(keycardData.keycardAmount)/100000000.0} BCH`;
      redeemButton.id = `${keycardData.keycardCommitment}`;
        try {
          redeemButton.addEventListener('click', async () => {
            console.log('click ' + redeemButton.id);
            redeemNFT(redeemButton.id);
          });
        } catch (error) { console.log(error); }
      
      ninjaList.appendChild(ninjaTemplate);
    });
    Placeholder.replaceWith(ninjaList);
  }
}

async function signTransaction(options) {
  try {
    const result = await signClient.request({
      chainId: connectedChain,
      topic: session.topic,
      request: {
        method: "bch_signTransaction",
        params: JSON.parse(stringify(options)),
      },
    });

    return result;
  } catch (error) {
    return undefined;
  }
}

async function getUserAddress() {
  try {
    const result = await signClient.request({
      chainId: connectedChain,
      topic: session.topic,
      request: {
        method: "bch_getAddresses",
        params: {},
      },
    });
    return result[0];
  } catch (error) {
    return undefined;
  }
};

// The array of parameters to use for generating the contract
const contractParams = [
  BigInt(dustLimit),
  BigInt(vaultReopenLocktime),
  BigInt(maxSafeboxes),
];

// Instantiate a new minting contract
const options = { provider: electrumServer };
const contract = new Contract(contractArtifact, contractParams, options);
const p2sh20 = lockingBytecodeToCashAddress(encodeLockingBytecodeP2sh20(hash160(hexToBin(contract.bytecode))));

async function redeemNFT(keycardCommitment) {
  let confirmRedemption = false;
  if(networkMTPUnix < Number(contractParams[1])) {
      alert("Can not redeem yet, timelock hasn't expired yet.");
      console.log('timelock not expired yet');
  } else {
    confirmRedemption = confirm("WARNING\n\nRedemption will burn the selected NFT #"+(binToBigIntUintLE(hexToBin(keycardCommitment.slice(0,4))) + 1n)+" in exchange for "+ Number(binToBigIntUintLE(hexToBin(keycardCommitment.slice(4,16))))/100000000.0 +" BCH value from the matching safebox.\nThe BCH will be deposited into the same address which held the NFT.\n\nDo you want to proceed?");
  }
  if(confirmRedemption) {
      const mintButton = document.getElementById(keycardCommitment);
      // Visual feedback for user, disable button onclick
      mintButton.textContent = `Building transaction...`;
      const prevClick = mintButton.onclick;
      mintButton.onclick = () => { };

      // Get userInput for mint
      const userAddress = await getUserAddress();
      console.log(userAddress);
      const userUtxos = await electrumServer.getUtxos(userAddress);
      const filteredUserUtxos = userUtxos.filter(
        val => val?.token?.category == tokenId && val?.token?.nft.commitment == keycardCommitment
      );
      const userInput = filteredUserUtxos[0];

      // Get matching safebox utxo
      const contractAddress = p2sh20;
      console.log(contractAddress);
      const contractUtxos = await electrumServer.getUtxos(contractAddress);
      const filteredContractUtxos = contractUtxos.filter(
        val => val?.token?.category == tokenId && val?.token?.nft.commitment == keycardCommitment.slice(0,4)
      );
      const contractInput = filteredContractUtxos[0];
      
      // start transaction building
      const sendAmount = userInput.satoshis + contractInput.satoshis - 400n;

      // empty usersig
      const userSig = new SignatureTemplate(Uint8Array.from(Array(32)));

      function toTokenAddress(address) {
        const addressInfo = decodeCashAddress(address);
        const pkhPayoutBin = addressInfo.payload;
        const prefix = network === "mainnet" ? 'bitcoincash' : 'bchtest';
        const tokenAddress = encodeCashAddress(prefix, "p2pkhWithTokens", pkhPayoutBin);
        return tokenAddress;
      }

      const transaction = contract.functions.OnlyOne()
        .from(contractInput)
        .fromP2PKH(userInput, userSig)
        .to(userAddress, sendAmount)
        .withMinChange(2100000000000000n)
        .withoutTokenChange()
        .withHardcodedFee(0)
        .withTime(Number(contractParams[1]));
      // end transaction building

      console.log(transaction);

      try {

        const rawTransactionHex = await transaction.build();
        const decodedTransaction = decodeTransaction(hexToBin(rawTransactionHex));
        decodedTransaction.inputs[1].unlockingBytecode = Uint8Array.from([]);

        // construct new transaction object for SourceOutputs, for stringify & not to mutate current network provider 
        const listSourceOutputs = [{
          ...decodedTransaction.inputs[0],
          lockingBytecode: (cashAddressToLockingBytecode(contract.tokenAddress)).bytecode,
          valueSatoshis: BigInt(contractInput.satoshis),
          token: contractInput.token && {
            ...contractInput.token,
            category: hexToBin(contractInput.token.category),
            nft: contractInput.token.nft && {
              ...contractInput.token.nft,
              commitment: hexToBin(contractInput.token.nft.commitment),
            },
          },
          contract: {
            abiFunction: transaction.abiFunction,
            redeemScript: contract.redeemScript,
            artifact: contract.artifact,
          }
        }, {
          ...decodedTransaction.inputs[1],
          lockingBytecode: (cashAddressToLockingBytecode(userAddress)).bytecode,
          valueSatoshis: BigInt(userInput.satoshis),
          token: userInput.token && {
            ...userInput.token,
            category: hexToBin(userInput.token.category),
            nft: userInput.token.nft && {
              ...userInput.token.nft,
              commitment: hexToBin(userInput.token.nft.commitment),
            },
          },
        }];

        const wcTransactionObj = {
          transaction: decodedTransaction,
          sourceOutputs: listSourceOutputs,
          broadcast: true,
          userPrompt: "Redeem Emerald DAO NFT for BCH"
        };

        console.log(wcTransactionObj);
        setTimeout(() => alert('Approve the redemption transaction in Cashonize'), 100);
        const signResult = await signTransaction(wcTransactionObj);
        console.log(signResult);

        if (signResult) {
          alert(`Redemption succesful! txid: ${signResult.signedTransactionHash}`);
          console.log(`Redemption succesful! txid: ${signResult.signedTransactionHash}`);
          mintButton.textContent = "Redeem Now";
          refreshNinjas();
          refreshBCHBalance();
        } else {
          alert('Redemption transaction cancelled');
          console.log('Redemption transaction cancelled');
          mintButton.textContent = "Redeem Now";
          mintButton.onclick = prevClick;
        }
      } catch (error) {
        alert(error);
        console.log(error);
        //cleanupFailedMint();
      }
  } else {
      console.log('user bailed or timelock not expired');
  }
}

function updateCollection(newCollection) {
  unfilteredListNinjas = newCollection;
  // Create obj of attributes object to track unique items
  const attributeObjs = {};
  attributeKeys.forEach(attributeKey => {
    attributeObjs[attributeKey] = {};
  });

  // Create count of occurance for each attribute
  unfilteredListNinjas.forEach(ninjaNumber => {
    const ninjaCommitment = 0;//binToHex(bigIntToVmNumber(BigInt(ninjaNumber - 1)));
    const ninjaData = nftMetadata[ninjaCommitment];
    const ninjaAttributes = ninjaData?.extensions.attributes;

    if (ninjaData) {
      let attributeClasses = "attributeClasses";
      Object.keys(ninjaAttributes).forEach((attributeKey, index) => {
        const attibuteObj = attributeObjs[attributeKey];
        const attributeValue = ninjaAttributes[attributeKey];
        let attributeClass = " " + (attributeKey + attributeValue).replace(/\s/g, '_');
        if (attributeKey == "Specials") attributeClass = " Specials";
        attributeClasses += attributeClass;
        if (attibuteObj[attributeValue]) attibuteObj[attributeValue] += 1;
        else attibuteObj[attributeValue] = 1;
      });
    }
  });
}

function renderPagination(offset, listLength) {
  const paginationDiv = document.querySelector(".pagination");
  const nrOfPages = Math.ceil(listLength / 100);
  if (nrOfPages <= 1) {
    paginationDiv.style.display = "none";
    return;
  }
  paginationDiv.style.display = "flex";
  // Show buttons by default
  ["pageLast", "pageMiddle", "skipPages", "pageLast"].forEach(elem => {
    document.getElementById(elem).style.display = "block";
  });
  document.getElementById("endingDots").style.display = "flex";
  // Hide page buttons depending on the nrOfPages
  document.getElementById("pageLast").firstChild.textContent = nrOfPages;
  if (nrOfPages <= 4) document.getElementById("endingDots").style.display = "none";
  if (nrOfPages <= 3) document.getElementById("pageMiddle").style.display = "none";
  if (nrOfPages == 2) {
    document.getElementById("skipPages").style.display = "none";
    document.getElementById("pageLast").style.display = "none";
  }
  // Page button functionality
  const pageButtons = ["pageOne", "pageTwo", "pageMiddle", "pageLast"];
  const setActiveButton = (activePageButton) => {
    pageButtons.forEach(pageButton => {
      const pageButtonElem = document.getElementById(pageButton);
      if (pageButton != activePageButton) pageButtonElem.classList.remove("active");
      else pageButtonElem.classList.add("active");
    });
  };
  // Logic for numbering, highlighting & dots
  const changeActivePage = (pageNumber, nrOfPages) => {
    let activePageButton;
    if (pageNumber == 1) activePageButton = pageButtons[0];
    else if (pageNumber == 2) activePageButton = pageButtons[1];
    else if (pageNumber == nrOfPages) activePageButton = pageButtons[3];
    else {
      activePageButton = pageButtons[2];
      document.getElementById(activePageButton).firstChild.textContent = pageNumber;
      const startingDots = document.getElementById("startingDots");
      const endingDots = document.getElementById("endingDots");
      if (pageNumber == 3) startingDots.style.display = "none";
      else startingDots.style.display = "flex";
      if (pageNumber == nrOfPages - 1) endingDots.style.display = "none";
      else endingDots.style.display = "flex";
    }
    setActiveButton(activePageButton);
    displayNinjas(pageNumber - 1);
  };
  // reset active page button after filtering
  if (offset == 0) setActiveButton("pageOne");
  // onclick events buttons
  pageButtons.forEach(pageButton => {
    const pageButtonElem = document.getElementById(pageButton);
    pageButtonElem.onclick = () => changeActivePage(+pageButtonElem.textContent, nrOfPages);
  });
  // Previous page button functionality
  const previousPageButton = document.getElementById("previousPage");
  if (offset == 0) {
    previousPageButton.classList.add("disabled");
    previousPageButton.onclick = () => { };
  } else {
    const pageNumber = offset + 1;
    previousPageButton.onclick = () => changeActivePage(pageNumber - 1, nrOfPages);
    previousPageButton.classList.remove("disabled");
  }
  // Next page button functionality
  const nextPageButton = document.getElementById("nextPage");
  const startPoint = offset * 100;
  if (startPoint + 100 >= listLength) {
    nextPageButton.classList.add("disabled");
    nextPageButton.onclick = () => { };
  } else {
    const pageNumber = offset + 1;
    nextPageButton.onclick = () => changeActivePage(pageNumber + 1, nrOfPages);
    nextPageButton.classList.remove("disabled");
  }
  // Skip pages button functionality
  const skipPagesButton = document.getElementById("skipPages");
  if (startPoint + 100 >= listLength) {
    skipPagesButton.classList.add("disabled");
    skipPagesButton.onclick = () => { };
  } else {
    const pageNumber = offset + 1;
    const newPageNr = (pageNumber + 10 < nrOfPages) ? pageNumber + 10 : nrOfPages;
    skipPagesButton.onclick = () => changeActivePage(newPageNr, nrOfPages);
    skipPagesButton.classList.remove("disabled");
  }
}

// Fuctions for filtering the NinjaList
function filterNinjaList(listCashninjas) {
  return listCashninjas;
}
