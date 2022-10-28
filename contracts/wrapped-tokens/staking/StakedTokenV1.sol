/**
 * SPDX-License-Identifier: MIT
 *
 * Copyright (c) 2022 Coinbase, Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

pragma solidity 0.6.12;

import { FiatTokenV2_1 } from "centre-tokens/contracts/v2/FiatTokenV2_1.sol";

/**
 * @title StakedTokenV1
 * @notice ERC20 token backed by staked cryptocurrency reserves, version 1
 */
contract StakedTokenV1 is FiatTokenV2_1 {
    /**
     * @dev Storage slot with the address of the current oracle.
     * This is the keccak-256 hash of "org.coinbase.stakedToken.exchangeRateOracle"
     */
    bytes32 private constant _EXCHANGE_RATE_ORACLE_POSITION = keccak256(
        "org.coinbase.stakedToken.exchangeRateOracle"
    );
    /**
     * @dev Storage slot with the current exchange rate.
     * This is the keccak-256 hash of "org.coinbase.stakedToken.exchangeRate"
     */
    bytes32 private constant _EXCHANGE_RATE_POSITION = keccak256(
        "org.coinbase.stakedToken.exchangeRate"
    );

    /**
     * @dev Emitted when the oracle is updated
     * @param newOracle The address of the new oracle
     */
    event OracleUpdated(address indexed newOracle);

    /**
     * @dev Emitted when the exchange rate is updated
     * @param oracle The address initiating the exchange rate update
     * @param newExchangeRate The new exchange rate
     */
    event ExchangeRateUpdated(address indexed oracle, uint256 newExchangeRate);

    /**
     * @dev Throws if called by any account other than the oracle
     */
    modifier onlyOracle() {
        require(
            msg.sender == oracle(),
            "StakedTokenV1: caller is not the oracle"
        );
        _;
    }

    /**
     * @dev Function to update the oracle
     * @param newOracle The new oracle
     */
    function updateOracle(address newOracle) external onlyOwner {
        require(
            newOracle != address(0),
            "StakedTokenV1: oracle is the zero address"
        );
        require(
            newOracle != oracle(),
            "StakedTokenV1: new oracle is already the oracle"
        );
        bytes32 position = _EXCHANGE_RATE_ORACLE_POSITION;
        assembly {
            sstore(position, newOracle)
        }
        emit OracleUpdated(newOracle);
    }

    /**
     * @dev Function to update the exchange rate
     * @param newExchangeRate The new exchange rate
     */
    function updateExchangeRate(uint256 newExchangeRate) external onlyOracle {
        require(
            newExchangeRate > 0,
            "StakedTokenV1: new exchange rate cannot be 0"
        );
        bytes32 position = _EXCHANGE_RATE_POSITION;
        assembly {
            sstore(position, newExchangeRate)
        }
        emit ExchangeRateUpdated(msg.sender, newExchangeRate);
    }

    /**
     * @dev Returns the address of the current oracle
     * @return _oracle The address of the oracle
     */
    function oracle() public view returns (address _oracle) {
        bytes32 position = _EXCHANGE_RATE_ORACLE_POSITION;
        assembly {
            _oracle := sload(position)
        }
    }

    /**
     * @dev Returns the current exchange rate scaled by by 10**18
     * @return _exchangeRate The exchange rate
     */
    function exchangeRate() public view returns (uint256 _exchangeRate) {
        bytes32 position = _EXCHANGE_RATE_POSITION;
        assembly {
            _exchangeRate := sload(position)
        }
    }
}
