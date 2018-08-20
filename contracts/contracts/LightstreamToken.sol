pragma solidity ^0.4.24;

import "./token/MintableToken.sol";

contract LightstreamToken is MintableToken {

  string public constant name = "Lightstream Token";
  string public constant symbol = "PHT";
  uint8 public constant decimals = 18;

}