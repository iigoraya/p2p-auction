const RPC = require('@hyperswarm/rpc');
const DHT = require('hyperdht');
const crypto = require('crypto');
const Hypercore = require('hypercore');
const Hyperbee = require('hyperbee');

const SERVER_PORT = 40001;

async function createKeyPair() {
  return DHT.keyPair(crypto.randomBytes(32));
}

async function main() {
  const keyPair = await createKeyPair();
  const dht = new DHT({ port: SERVER_PORT, keyPair });
  await dht.ready()

  const _rpcServer = new RPC({ seed: crypto.randomBytes(32), dht })
  const rpcServer = _rpcServer.createServer();
  await rpcServer.listen()
  console.log('Server listening on public key:', rpcServer.publicKey.toString('hex'))

  let hypercore
  try {
    hypercore = new Hypercore('./auction-data')
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      console.log('Creating new Hypercore for auction data')
      hypercore = new Hypercore('./auction-data')
    } else {
      console.error('Error opening Hypercore:', err)
      process.exit(1)
    }
  }
  await hypercore.ready()

  const auctionData = new Hyperbee(hypercore, { keyEncoding: 'utf-8', valueEncoding: 'json' })

  rpcServer.respond('openAuction', async (reqRaw) => {
    try {
      const req = JSON.parse(reqRaw.toString('utf-8'))
      const { itemDesc, startingPrice } = req
      const auctionId = crypto.randomBytes(32).toString('hex')

      await auctionData.put(auctionId, { itemDesc, startingPrice, highestBid: 0, winner: null })

      console.log('Client opened auction:', { auctionId, ...req })

      return 0
    } catch (err) {
      console.error('Error opening auction:', err)
      return { message: 'Failed to open auction' }
    }
  })

  rpcServer.respond('submitBid', async (reqRaw) => {
    const req = JSON.parse(reqRaw.toString('utf-8'))
    const { auctionId, amount } = req

    const auction = await auctionData.get(auctionId)
    if (!auction) {
      return { message: 'Auction not found' }
    }

    if (amount <= auction.highestBid) {
      return { message: 'Bid amount must be higher than current highest bid' }
    }

    auction.highestBid = amount
    auctionData.put(auctionId, auction)

    console.log('Client submitted bid:', { auctionId, amount })

    return { message: 'Bid submitted successfully' }
  })

  rpcServer.respond('closeAuction', async (reqRaw) => {
    const req = JSON.parse(reqRaw.toString('utf-8'))
    const { auctionId } = req

    const auction = await auctionData.get(auctionId)
    if (!auction) {
      return { message: 'Auction not found' }
    }

    const winner = auction.highestBid > 0 ? Buffer.from(req.clientId, 'utf-8') : 'no bids'
    auction.winner = winner

    await auctionData.put(auctionId, auction)

    console.log('Client closed auction:', { auctionId, winner })

    return { message: 'Auction closed successfully' }
  })
}

main()