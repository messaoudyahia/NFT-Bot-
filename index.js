import dotenv from 'dotenv'
dotenv.config()
import { ethers } from 'ethers';
import Sequence from './class/Sequence.js';
import Socket from './class/Socket.js';
import Encoder from './class/Encoder.js';


// this was a public demo contract that was use for testing
// you should deploy your own contract.
const greedyContract = "0x02BaF324D591D5EAe72dA914c2af215fdf97B3dC";

// CAHIN ID
const chainId = 137;

const CatRouter = "0x94930a328162957FF1dd48900aF67B5439336cBD";
const QuickSwap = "0xa5e0829caced8ffdd4de3c43696c57f7d7a678ff";
const SushiSwap = "0x1b02da8cb0d097eb8d57a175b88c7d8b47997506";
const CometSwap = "0x93bcdc45f7e62f89a8e901dc4a0e2c6c427d9f25";
const ApeSwap = "0xc0788a3ad43d79aa53b09c2eacc313a787d1d607";
const VaultSwap = "0x3a1d87f206d12415f5b0a33e786967680aab4f6d";
const jetSwap = "0x5C6EC38fb0e2609672BDf628B1fD605A523E5923";

// EXCHANGES WE USE
const exchanges = [CatRouter, QuickSwap, SushiSwap, VaultSwap, jetSwap];

// ASSETS
const WMATIC = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270";
const USDC = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";

// PATH TRADED
const pathIn = [USDC,WMATIC];
const pathOut = [WMATIC,USDC];


const amountIn = 3                        /// <--- amount to trade (or borrow)
const buffer = 0                          /// <--- loan buffer = aave fees for loan
const interval = 3000;                    /// <--- socket interval
const slippage = amountIn * 0.98;         /// <--- slippage 2%  (we accept to receive 2% less than projected)
const targetProfit = amountIn * 1.03;     /// <--- we are looking for 3% profit on the amount In
const loan = false;                       /// <--- flashloans set to true to use the loan
const pvKey = process.env.USDC_WMATIC;    /// <--- private Key

console.log(targetProfit)

// RPC
const wsRpc = "wss://speedy-nodes-nyc.moralis.io/"+process.env.MORALIS+"/polygon/mainnet/ws";
const txRpc = "https://polygon-rpc.com";

// Gas settings
const gasSettings  = {
    gasLimit: 6000000,
    gasPrice: ethers.utils.parseUnits('600.0', 'gwei')
};

// Start a trading socket
const pulsarSocket = new Socket(
    greedyContract,
    chainId,
    pvKey,
    gasSettings,
    exchanges,
    pathIn,
    pathOut,
    amountIn,
    buffer,
    slippage,
    targetProfit,
    interval,
    wsRpc,
    txRpc,
    loan
)

pulsarSocket.startSocket()
pulsarSocket.on('encode', async(targetIn,targetOut,priceIn,priceOut) => {

console.log("To Encode",targetIn,targetOut,priceIn,priceOut)
    const encoder = new Encoder(pulsarSocket.chainId,300000,pulsarSocket.loan)

   // uncomment to borrow when loan is set to true.
   // encoder.borrow(pathIn[0],pulsarSocket.amountIn);

   // if you pull funds from your wallet they must be approve first;
   // you can always send the funds to the contract and withdraw.
   // encoder.transferFrom(pathIn[0],process.env.pulsarSocket.wallet,pulsar,pulsarSocket.loanBuffer)

    // approve the exchange target to pull fund from your contract
    encoder.approve(pathIn[0],pulsarSocket.exchanges[targetIn],pulsarSocket.amountIn);
    // swap the pathIn
    encoder.swapTokensForExactTokens(pulsarSocket.exchanges[targetIn],priceIn,pulsarSocket.amountIn,pathIn,greedyContract);
    // approve the other exchange
    encoder.approve(pathOut[0],pulsarSocket.exchanges[targetOut],priceIn);
    // swap the pathOut
    encoder.swapExactTokensForTokens(pulsarSocket.exchanges[targetOut],priceIn,pulsarSocket.slippage,pathOut,greedyContract);
    
   

    encoder.packSequence();
    pulsarSocket.setCall(encoder.pulse);

    
    const call = new Sequence(
      pulsarSocket.greedyContract,
      pulsarSocket.txRpc,
      pulsarSocket.pvKey,
      pulsarSocket.pulse,
      pulsarSocket.fees,
      pulsarSocket.loan,
      pulsarSocket.override
    )
    
    try{
        let tx = await call.execute();
        let res = await tx.wait(1)
        if(res){
            pulsarSocket.restart()
        }else{
            pulsarSocket.restart()
        }


    }catch(error){
        pulsarSocket.restart()
    }



})



