'use strict'
import { ethers } from 'ethers';



export default class Sequence {
    constructor(
        greedyContract,
        rpc,
        privateKey,
        pulse,
        fees,
        loan,
        override
    ) {
        this.greedyContract = greedyContract;
        this.rpc = rpc;
        this.privateKey = privateKey;
        this.provider = new ethers.providers.JsonRpcProvider(rpc);
        this.wallet = new ethers.Wallet(privateKey,this.provider);
        this.loan = loan;
        this.override = override;
        this.signer = this.provider.getSigner(this.wallet.address);
        this.pulse = pulse
        this.fees = fees;
    }

        execute = async ( ) =>{
            let that = this;
            console.log('wallet',that.wallet.address )
            console.log('contract',that.override.gasLimit.toString() )
     
          const call = await that.wallet.sendTransaction({
              to: that.greedyContract,
              data: that.pulse,        
              from: that.wallet.address,
              maxPriorityFeePerGas:'100000000000',
              maxFeePerGas: '600000000000',
              gasLimit: that.override.gasLimit,
              maxFeePerGas: '600000000000',

              
          });
           console.log(call)
           await call.wait(1)

          console.log("Sequence Succeed")

          return true;

    }


}