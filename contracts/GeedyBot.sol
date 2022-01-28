/*
GreeyBot.sol
SPDX-License-Identifier: MIT


idecentralize.eth
author: ian.dorion.eth

This is the Greedy Bot Contract. It belong to the deployer


**/

pragma solidity 0.8.10;
pragma experimental ABIEncoderV2;

import "./interfaces/protocols/aave/FlashLoanReceiverBase.sol";
import "./interfaces/protocols/aave/ILendingPool.sol";
import "./interfaces/protocols/aave/ILendingPoolAddressesProvider.sol";
import "./libs/Sequencer.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract GreedyContract is FlashLoanReceiverBase {

    using SafeERC20 for IERC20;
    using Sequencer for Sequencer.LoanSequence;
    using Sequencer for Sequencer.TradeSequence;

    ILendingPoolAddressesProvider provider;
    address lendingPoolAddr;
    address public owner;
  
 
    event Sequenced(address user);

    modifier onlyPool() {
        require(msg.sender == lendingPoolAddr, "pool not Paul");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "42");
        _;
    }

    constructor(
        ILendingPoolAddressesProvider _addressProvider,
        address _devAddress,
        address _greedyBot,
        uint _greedyBotId
    ) FlashLoanReceiverBase(_addressProvider) {
        owner = _devAddress;
        provider = _addressProvider;
        lendingPoolAddr = provider.getLendingPool();
    }

    /// @notice this function can only be called by the aave lending pool
    /// @param assets an array of all the asset's you borrowed.
    /// @param amounts array of amount's borrowed
    /// @param premiums the fees you have to pay back for each asset
    /// @param initiator The initiator of the loan
    /// @param params Your trade sequence that you built(logic)

    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external virtual override onlyPool returns (bool) {
        Sequencer.TradeSequence memory sequence = _decodeTradeSequence(params);
        for (uint256 tid = 0; tid < sequence.target.length; ++tid) {
            _executeCall(sequence.target[tid], sequence.callData[tid]);
        }
        for (uint256 lid = 0; lid < assets.length; ++lid) {
            require(
                assets[lid] == sequence.withdraw[lid],
                "Asset's must match"
            );
            IERC20(assets[lid]).safeApprove(
                lendingPoolAddr,
                amounts[lid] + premiums[lid]
            );
            payback(sequence.withdraw[lid], amounts[lid] + premiums[lid]);
        }
        if (sequence.withdraw.length > assets.length) {
            for (
                uint256 wid = assets.length;
                wid < sequence.withdraw.length;
                ++wid
            ) {
                payback(sequence.withdraw[wid], 0);
            }
        }

        emit Sequenced(initiator);

        return true;
    }

    /// @notice Call to make a loan with aave
    /// @param loanData the assets and amounts you want to borrow
    /// @param tradeData the trade sequence encoded into on bytes argument
    /// @param useLoan Bool
    /// @dev

    function executeSequence(
        Sequencer.LoanSequence memory loanData,
        bytes memory tradeData,
        bool useLoan
    ) external onlyOwner {
        ILendingPool _lendingPool = ILendingPool(lendingPoolAddr);
        Sequencer.LoanSequence memory loans = loanData;

        if (useLoan) {
            _lendingPool.flashLoan(
                address(this),
                loans.assets,
                loans.amounts,
                loans.modes,
                msg.sender,
                tradeData,
                0
            );
        } else {
            runSequence(tradeData);
            emit Sequenced(msg.sender);
        }
    }

    function runSequence(bytes memory _sequence) internal {
        Sequencer.TradeSequence memory sequence = _decodeTradeSequence(
            _sequence
        );
        for (uint256 tid = 0; tid < sequence.target.length; ++tid) {
            _executeCall(sequence.target[tid], sequence.callData[tid]);
        }
        for (uint256 wid = 0; wid < sequence.withdraw.length; ++wid) {
            payback(sequence.withdraw[wid], 0);
        }
        emit Sequenced(msg.sender);
    }

    /**
       @dev execute a low level call for any solidity version
       @param target the target the call is made to
       @param callData the data for that call
       @return bool
     */

    function _executeCall(address target, bytes memory callData)
        internal
        returns (bytes memory)
    {
        // no internal rentry
        require(target != address(this), "Internal reentry");
        bool success;
        bytes memory _res;
        // solhint-disable-next-line avoid-low-level-calls
        (success, _res) = target.call(callData);
        if (!success && _res.length > 0) {
            // solhint-disable-next-line no-inline-assembly
            assembly {
                returndatacopy(0, 0, returndatasize())
                revert(0, returndatasize())
            }
        } else if (!success) {
            revert("VM: executeCall reverted");
        }
        return _res;
    }

    /**
     * @dev Decodes the information encoded for the trade sequence
     * @param params the trade sequence parameter
     * @return TradeSequence struct containing decoded params
     */
    function _decodeTradeSequence(bytes memory params)
        internal
        pure
        returns (Sequencer.TradeSequence memory)
    {
        (
            address[] memory target,
            bytes[] memory callData,
            address[] memory withdraw
        ) = abi.decode(params, (address[], bytes[], address[]));
        return Sequencer.TradeSequence(target, callData, withdraw);
    }

    /**
     * @dev Decodes the information encoded for the trade sequence
     * @param params the trade sequence parameter
     * @return TradeSequence struct containing decoded params
     */
    function _decodeLoanSequence(bytes memory params)
        internal
        pure
        returns (Sequencer.LoanSequence memory)
    {
        (
            address[] memory assets,
            uint256[] memory amounts,
            uint256[] memory modes
        ) = abi.decode(params, (address[], uint256[], uint256[]));
        return Sequencer.LoanSequence(assets, amounts, modes);
    }

    ///@notice Sends the funds back to the caller. This contract keep no funds. You must request all your funds back
    ///@dev your withdraw array must at least match your loan array.

    function payback(address _asset, uint256 _premiums) internal {
        if (_asset == address(0)) {
            if ((address(this).balance - _premiums) > 0) {
                payable(owner).transfer(
                    address(this).balance - _premiums
                );
            }
        } else {
            if ((IERC20(_asset).balanceOf(address(this)) - _premiums) > 0) {
                IERC20(_asset).transfer(
                    owner,
                    IERC20(_asset).balanceOf(address(this)) - _premiums
                );
            }
        }
    }



}
