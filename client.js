const RPC = require('@hyperswarm/rpc')
const DHT = require('hyperdht')
const crypto = require('crypto')

const CLIENT_PORT = 50001

async function createKeyPair() {
  return DHT.keyPair(crypto.randomBytes(32))
}

async function main() {
  const keyPair = await createKeyPair()
  const dht = new DHT({ port: CLIENT_PORT, keyPair })
  await dht.ready()

  const rpcClient = new RPC({ dht })
  let serverPublicKey = null;

  async function openAuctionCLI(itemDesc, startingPrice) {
    const payload = { itemDesc, startingPrice }
    const payloadRaw = Buffer.from(JSON.stringify(payload), 'utf-8')
    try {
      const response = await rpcClient.request(serverPublicKey, 'openAuction', payloadRaw)
      console.log(response)
    } catch (err) {
      console.error('Error opening auction:', err)
    }
  }

  async function submitBidCLI(auctionId, amount) {
    const payload = { auctionId, amount }
    const payloadRaw = Buffer.from(JSON.stringify(payload), 'utf-8')
    try {
      const response = await rpcClient.request(serverPublicKey, 'submitBid', payloadRaw)
      console.log('Submit bid response:', JSON.parse(response.toString('utf-8')))
    } catch (err) {
      console.error('Error submitting bid:', err)
    }
  }

  async function closeAuctionCLI(auctionId) {
    const payload = { auctionId }
    const payloadRaw = Buffer.from(JSON.stringify(payload), 'utf-8')
    try {
      const response = await rpcClient.request(serverPublicKey, 'closeAuction', payloadRaw)
      console.log('Close auction response:', JSON.parse(response.toString('utf-8')))
    } catch (err) {
      console.error('Error closing auction:', err)
    }
  }

  async function discoverServer(serverPublicKeyStr) {
    if (serverPublicKeyStr) {
      try {
        serverPublicKey = Buffer.from(serverPublicKeyStr, 'hex')
        console.log('Using provided server public key:', serverPublicKey.toString('hex'))
      } catch (err) {
        console.error('Invalid server public key format. Please provide a valid hex string.')
        return;
      }
    } else {
      const peers = await dht.findPeers(Buffer.from('server', 'utf-8'))
      if (peers.length > 0) {
        serverPublicKey = peers[0]
        console.log('Found server with public key:', serverPublicKey.toString('hex'))
      } else {
        console.error('Server not found. Please ensure server is running.')
      }
    }
  }

  const action = process.argv[2];
  const serverPublicKeyStr = process.argv[3];
  const itemDesc = process.argv[4];
  const startingPrice = process.argv[5];
  const auctionId = process.argv[6];
  const amount = process.argv[7];

  if (serverPublicKeyStr) {
    await discoverServer(serverPublicKeyStr);
  } else {
    await discoverServer();
  }

  if (!serverPublicKey) {
    console.error('Server discovery failed. Exiting.')
    return;
  }

  if (action === 'open' && itemDesc && startingPrice) {
    await openAuctionCLI(itemDesc, startingPrice);
  } else if (action === 'bid' && auctionId && amount) {
    await submitBidCLI(auctionId, amount);
  } else if (action === 'close' && auctionId) {
    await closeAuctionCLI(auctionId);
  } else {
    console.error('Invalid arguments. Usage:');
    console.error('  node client.js open server_public_key "item description" starting_price');
    console.error('  node client.js bid server_public_key auction_id bid_amount ');
    console.error('  node client.js close server_public_key auction_id');
  }
}

main()