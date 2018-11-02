pragma solidity ^0.4.24;

import "./token/MintableToken.sol";
import "./token/PausableToken.sol";
import "./token/CappedToken.sol";

contract LightstreamsToken is MintableToken, PausableToken, CappedToken {

  string public constant name = "Lightstream Token";
  string public constant symbol = "PHT";
  uint8 public constant decimals = 18;
  uint256 public constant decimalFactor = 10 ** uint256(decimals);
  uint256 public cap = 300000000 * decimalFactor; // There will be total 300 million PTH Tokens

  constructor() public
    CappedToken(cap)
  {

  }

}