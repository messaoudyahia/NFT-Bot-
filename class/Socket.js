import { ERC20 } from '@idecentralize/erclib';
import { ethers } from 'ethers';
import Pulsar from "./Pulsar.js";
import EventEmitter from 'events';

export default class Socket extends EventEmitter {
    constructor(
      greedyContract,
      chainId,
      pvKey,
      override,
      exchanges,
      pathIn,
      pathOut,
      amountIn,
      loanBuffer,
      slippage,
      targetProfit,
      interval,
      readRpc,
      txRpc,
      loan,
      onlyWithdraw

    ) {
        console.log("target socket",targetProfit)
      
        super();
        this.greedyContract = greedyContract;
        this.chainId = chainId;
        this.pvKey = pvKey;
        this.override = override;
        this.exchanges = exchanges;
        this.pathIn = pathIn;
        this.pathOut = pathOut;
        this.amountIn = ethers.utils.parseUnits(amountIn.toString(), ERC20[chainId][pathIn[0]].decimals);
        this.loanBuffer = ethers.utils.parseUnits(loanBuffer.toString(), ERC20[chainId][pathIn[0]].decimals);
        this.slippage = ethers.utils.parseUnits(slippage.toString(),ERC20[chainId][pathIn[0]].decimals);
        this.targetProfit = ethers.utils.parseUnits(targetProfit.toString(),ERC20[chainId][pathIn[0]].decimals);
        this.interval = interval;
        this.readRpc = readRpc;
        this.txRpc = txRpc;
        this.loan = loan;
        this.pulse;
        this.pulsar;
        this.onlyWithdraw = onlyWithdraw;
        this.wallet = new ethers.Wallet(pvKey).address;
        console.log("target socket raw",this.targetProfit)
        let formattedTargetProfit = parseFloat(ethers.utils.formatUnits(this.targetProfit, ERC20[this.chainId][this.pathIn[0]].decimals))
        console.log("target socket reformated",formattedTargetProfit)
    }

    startSocket(){

        

        let that = this;
        that.pulsar = new Pulsar(
            that.greedyContract,
            that.chainId ,
            that.readRpc,
            that.amountIn,
            that.pathIn,
            that.pathOut,
            that.exchanges,
            that.interval,
            that.onlyWithdraw,
            that.wallet,
            that.targetProfit,
            that.slippage
            );

            that.pulsar.on('withdraw', async(asset,amount) => {
                console.log('Withdrawing',asset,amount);
                // this event trigger the call encoding
                this.emit('xwithdraw',asset,amount)   
                 
            });
        
        that.pulsar.start()


        that.pulsar.on('trade', async(targetIn,targetOut,priceIn,priceOut) => {
            console.log('Trade Found',targetIn,targetOut,priceIn,priceOut);
            // this event trigger the call encoding
            this.emit('encode',targetIn,targetOut,priceIn,priceOut)   
            
        });

    }

    setCall(pulse){
        let that = this;
        that.pulse = pulse;
    }


    restart(){
        let that = this;
        that.pulsar.start()
    }


}