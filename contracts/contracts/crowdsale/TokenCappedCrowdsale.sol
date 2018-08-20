pragma solidity ^0.4.24;

import "../utils/SafeMath.sol";
import "./Crowdsale.sol";


/**
 * @title CappedCrowdsale
 * @dev Crowdsale with a limit for total contributions.
 */
contract TokenCappedCrowdsale is Crowdsale {
  using SafeMath for uint256;

  uint256 public tokenCap;

  /**
   * @dev Constructor, takes maximum amount of tokens sold in the crowdsale
   * @param _tokenCap Max amount of wei to be contributed
   */
  constructor(uint256 _tokenCap) public {
    require(_tokenCap > 0);
    tokenCap = _tokenCap;
  }

  /**
   * @dev Checks whether the cap has been reached.
   * @return Whether the cap was reached
   */
  function capReached() public view returns (bool) {
    return tokensSold >= tokenCap;
  }

  /**
   * @dev Extend parent behavior requiring purchase to respect the funding cap.
   * @param _beneficiary Token purchaser
   * @param _weiAmount Amount of wei contributed
   */
  function _preValidatePurchase(
    address _beneficiary,
    uint256 _weiAmount
  )
  internal
  {
    super._preValidatePurchase(_beneficiary, _weiAmount);
    //uint256 tokensPurchasing = super._getTokenAmount(_weiAmount);
    //require(tokensSold.add(tokensPurchasing) <= tokenCap);
  }

}
