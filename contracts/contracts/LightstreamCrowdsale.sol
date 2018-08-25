pragma solidity ^0.4.24;

import "./crowdsale/TokenCappedCrowdsale.sol";
import "./distribution/FinalizableCrowdsale.sol";
import "./distribution/MonthlyVestingWithBonus.sol";
import "./escrow/TokenEscrow.sol";
import "./crowdsale/MintedCrowdsale.sol";
import "./crowdsale/TimedCrowdsale.sol";
import "./crowdsale/WhitelistedCrowdsale.sol";
import "./LightstreamToken.sol";


/**
 * @title LightstreamCrowdsale
 * The way to add new features to a base crowdsale is by multiple inheritance.
 * In this example we are providing following extensions:
 * TimedCrowdsale -
 * TokenCappedCrowdsale - sets a max boundary for the number of tokens minted
 * MintedCrowdsale - Creates tokens as the are sold in the sale
 * WhitelistedCrowdsale - only whitelisted addresses are allowed to purchase
 * FinalizableCrowdsale - finalizing sale mints tokens and send them to the team distribution contract
 * After adding multiple features it's good practice to run integration tests
 * to ensure that subcontracts works together as intended.
 */

contract LightstreamCrowdsale is TimedCrowdsale, TokenCappedCrowdsale, MintedCrowdsale, WhitelistedCrowdsale, FinalizableCrowdsale {

  // Token Distribution
  // =============================
  uint8 public constant decimals = 18;
  uint256 public constant decimalFactor = 10 ** uint256(decimals);
  uint256 public maxTokens =           300000000 * decimalFactor; // There will be total 300 million PTH Tokens
  uint256 public tokensForTeam =       135000000 * decimalFactor; // 45 percent will be reserved for the team
  uint256 public tokensForSale =       165000000 * decimalFactor; // 65 percent will be sold in Crowdsale
  uint256 public initalRate =               2733; // in Eth if Eth = 410 USD for this 2733 PHT = 1 Eth
  address public distributionContract;
  address public token;

  constructor(
    uint256 _openingTime, // Timestamp in epoch format (online calculator: https://www.unixtimestamp.com/index.php)
    uint256 _closingTime,
    address _wallet,  // address of the wallet that receives funds
    LightstreamToken _token, // address of deployed token contract
    address _distributionContract
  )
  public
  Crowdsale(initalRate, _wallet, _token, _openingTime)
  TimedCrowdsale(_openingTime, _closingTime)
  TokenCappedCrowdsale(tokensForSale)
  MonthlyVestingWithBonus(_token)
  TokenEscrow(_token, _wallet)
  WhitelistedCrowdsale()
  FinalizableCrowdsale() {
    distributionContract = _distributionContract;
    token = _token;
  }

  function finalization() internal {
    // emit tokens for the foundation
    MintableToken(token).mint(distributionContract, tokensForTeam);

    // NOTE: cannot call super here because it would finish minting and
    // the continuous sale would not be able to proceed
  }
}
