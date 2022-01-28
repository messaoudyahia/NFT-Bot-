'use strict'
import { ethers } from 'ethers';
import fs from 'fs'
import EventEmitter from 'events';
import { ERC20, ROUTER } from '@idecentralize/erclib';

const abiJsonRaw = fs.readFileSync('./abis/full/UniV2.json')
const routerABI = JSON.parse(abiJsonRaw)

export default class Pulsar extends EventEmitter {
    constructor(
        greedyContract,
        chainId,
        rpc,
        amountIn,
        pathIn,
        pathOut,
        targets,
        interval,
        onlyWithdraw,
        wallet,
        targetProfit,
        slippage
    ) {
        super();
        this.greedyContract = greedyContract;
        this.pulsarOn = false;
        this.chainId = chainId;
        this.amountIn = amountIn;
        this.pathIn = pathIn;
        this.pathOut = pathOut;
        this.interval = interval;
        this.targets = targets;
        this.intervalID = null;
        this.rpc = rpc;
        this.wallet = wallet;
        this.provider = ethers.getDefaultProvider(rpc);
        this.profitable = false;
        this.onlyWithdraw = onlyWithdraw;
        this.targetProfit = targetProfit;
        this.slippage = slippage;

        console.log("slippage pulsar",this.slippage)
        let formattedSlippage = parseFloat(ethers.utils.formatUnits(this.slippage, ERC20[this.chainId][this.pathIn[0]].decimals))
        console.log("target pulsar",formattedSlippage)

    }

    /*
    Start Pulsar
    */

    async start() {

        let that = this;

        // if we only withdraw from contract
        if(that.onlyWithdraw){
            this.emit('withdraw',that.pathIn[0],that.amountIn) 
            return
        }

        if (that.profitable) {
            this.doNothing()
        }

        if (that.pulsarOn) {
            console.log("Pulsar is already running");
            return
        } else {
            console.log("Greedy🤖 is searching!");
            clearInterval(that.intervalID)
            if (!that.intervalID) {
                that.intervalID = setInterval(await this.runLogic.bind(that), that.interval);

            } else {

                that.intervalID = setInterval(await this.runLogic.bind(that), that.interval);

            }
        }
    }

    /*
    Run Arbitrage Logic
    */

    async runLogic() {
        let that = this;
        if (that.pulsarOn) {
            return
        }
        that.pulsarOn = true;
        let bestPrice = 0;
        let priceTarget = 0;
        let bestReturn = 0;
        let returnTarget = 0;

        function evalPrice(price, targetId, returned) {
            let formattedPrice = parseFloat(ethers.utils.formatUnits(price))
            let formattedCurrentBest = parseFloat(ethers.utils.formatUnits(bestPrice))
            let formattedCurrentBestReturn = parseFloat(ethers.utils.formatUnits(bestReturn))

            if (!returned) {
                if (formattedPrice > formattedCurrentBest) {
                    bestPrice = price;
                    priceTarget = targetId
                }
            } else {
                if (formattedPrice > formattedCurrentBestReturn) {
                    bestReturn = price;
                    returnTarget = targetId
                }
            }
        }

        let len = that.targets.length;
        let amountOut = 0;
        let i = 0;

        for (i = 0; i < len; i++) {
            amountOut = await this.getAmountOut(that.targets[i], that.amountIn, that.pathIn, false)
            if (!that.pulsarOn) {
                return
            }
            setTimeout(this.doNothing, 500)
            evalPrice(amountOut[1], i, false)
        }

        let bestPriceFound = parseFloat(ethers.utils.formatUnits(bestPrice, ERC20[that.chainId][that.pathIn[that.pathIn.length - 1]].decimals))
        console.log("Best Price Found", bestPriceFound)

        let amountReturned = 0;
        for (i = 0; i < len; i++) {
            amountReturned = await this.getAmountOut(that.targets[i], bestPrice, that.pathOut, true)
            if (!that.pulsarOn) {
                return
            }
            setTimeout(this.doNothing, 500)
            evalPrice(amountReturned[amountReturned.length - 1], i, true)
        }

        let formattedCurrentBest = parseFloat(ethers.utils.formatUnits(bestPrice, ERC20[that.chainId][that.pathIn[that.pathIn.length - 1]].decimals))
        let formattedCurrentBestReturn = parseFloat(ethers.utils.formatUnits(bestReturn, ERC20[that.chainId][that.pathOut[that.pathOut.length - 1]].decimals))
        let formattedAmountIn = parseFloat(ethers.utils.formatUnits(that.amountIn, ERC20[that.chainId][that.pathIn[0]].decimals))
        let formattedTargetProfit = parseFloat(ethers.utils.formatUnits(that.targetProfit, ERC20[that.chainId][that.pathIn[0]].decimals))

        console.log("Input amount", formattedAmountIn, ERC20[that.chainId][that.pathIn[0]].symbol)
        console.log("Target Profit", formattedTargetProfit, ERC20[that.chainId][that.pathIn[0]].symbol)
        console.log("Best price on first exchange", formattedCurrentBest, ERC20[that.chainId][that.pathIn[that.pathIn.length - 1]].symbol, "from", ROUTER[that.chainId][that.targets[priceTarget]].name)
        console.log("Best price on return", formattedCurrentBestReturn, ERC20[that.chainId][that.pathIn[0]].symbol, "from", ROUTER[that.chainId][that.targets[returnTarget]].name)

        /// here is the place to make your decision
        // if the best return > then amount we put in * targeted profit.
        console.log(formattedTargetProfit)

        if (formattedCurrentBestReturn >= formattedTargetProfit) {

            
            that.profitable = true;

            clearInterval(that.intervalID)

            this.emit(
                'trade',
                priceTarget,
                returnTarget,
                bestPrice,
                bestReturn
            )
            console.log("💰 Profitable arbitrage found");

        } else {
            console.log("😐 No profitable trade found at this time");
            this.restart()
        }

        return
    }

   /*
    Get Amounts out for univ2
    */
    getAmountOut = async (router, amountIn, path, returned) => {
        let that = this
        const contract = new ethers.Contract(router, routerABI, that.provider);
        let call
        try {
            call = await contract.getAmountsOut(amountIn, path)
        } catch (error) {
            console.log(error)
            that.pulsarOn = false

            return this.start()
        }

        let amount1 = ethers.utils.formatUnits(call[0], ERC20[that.chainId][path[0]].decimals)
        let amount2 = ethers.utils.formatUnits(call[1], ERC20[that.chainId][path[path.length - 1]].decimals)

        if (returned) {
            console.log(
                amount1,
                ERC20[that.chainId][path[0]].symbol,
                "=>",
                amount2,
                ERC20[that.chainId][path[path.length - 1]].symbol,
                "on",
                ROUTER[that.chainId][router].name
            );
        } else {
            console.log(
                amount1,
                ERC20[that.chainId][path[0]].symbol,
                "=>",
                amount2,
                ERC20[that.chainId][path[path.length - 1]].symbol,
                "on",
                ROUTER[that.chainId][router].name
            );
        }

        return call;
    }

    resume() {
        let that = this;
        that.profitable = false;
        return this.start();
    }
    restart() {
        let that = this;
        that.profitable = false;
        that.pulsarOn = false;
        this.start();
        return
    }

    doNothing() {
        //empty function to wait
    }

}

