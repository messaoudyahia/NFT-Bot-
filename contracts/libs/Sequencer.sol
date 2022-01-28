// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library Sequencer {
  
    /// AAVE

    struct TradeSequence {
        address[] target;  // the target where the call will be made
        bytes[] callData;  // the callData to pass to the traget (your trade)
        address[] withdraw;  // the asset the contract send you back at the end
    }

    struct LoanSequence {
        address[] assets;   // the asset to borrow
        uint256[] amounts;  // the amount to borrow
        uint256[] modes;    // the mode only used with aave
    }

}

