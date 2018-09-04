pragma solidity ^0.4.24;

import "../utils/SafeMath.sol";
import "./Crowdsale.sol";


/**
 * @title TokenCappedCrowdsale
 * @dev Crowdsale with a limit for the amount of tokens that can be sold
 */
contract TokenCappedCrowdsale is Crowdsale {
  using SafeMath for uint256;

  uint256 public tokenCap;

  /**
   * @dev Constructor, takes maximum amount of tokens sold in the crowdsale
   * @param _tokenCap Max amount of tokens to be sold
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
    uint256 tokensPurchasing = super._getTokenAmount(_weiAmount);
    require(tokensSold.add(tokensPurchasing) <= tokenCap, 'tokenCap');
  }

  function _preValidateMintAndVest(
    address _beneficiary,
    uint256 _tokens,
    uint256 _bonus
  )
  internal
  {
    super._preValidateMintAndVest(_beneficiary, _tokens, _bonus);
    require(tokensSold.add(_tokens).add(_bonus) <= tokenCap, 'tokenCap');
  }


}
