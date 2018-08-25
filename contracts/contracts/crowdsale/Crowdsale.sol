pragma solidity ^0.4.24;

import "../token/ERC20.sol";
import "../token/SafeERC20.sol";
import "../token/MintableToken.sol";
import "../utils/SafeMath.sol";
import "../utils/Ownable.sol";
import "../escrow/TokenEscrow.sol";


/**
 * @title Crowdsale
 * @dev Crowdsale is a base contract for managing a token crowdsale,
 * allowing investors to purchase tokens with ether. This contract implements
 * such functionality in its most fundamental form and can be extended to provide additional
 * functionality and/or custom behavior.
 * The external interface represents the basic interface for purchasing tokens, and conform
 * the base architecture for crowdsales. They are *not* intended to be modified / overridden.
 * The internal interface conforms the extensible and modifiable surface of crowdsales. Override
 * the methods to add functionality. Consider using 'super' where appropriate to concatenate
 * behavior.
 */

contract Crowdsale is Ownable, TokenEscrow {
  using SafeMath for uint256;
  using SafeERC20 for ERC20;

  // The token being sold
  ERC20 public token;

  // Address where funds are collected
  address public wallet;

  // How many token units a buyer gets per wei.
  // The rate is the conversion between wei and the smallest and indivisible token unit.
  // So, if you are using a rate of 1 with a DetailedERC20 token with 3 decimals called TOK
  // 1 wei will give you 1 unit, or 0.001 TOK.
  uint256 public rate;
  uint256 public openingTime;

  mapping (address => uint256) public bonuses;


  // Amount of wei raised
  uint256 public weiRaised;
  uint256 public tokensSold;

  /**
   * Event for token purchase logging
   * @param purchaser who paid for the tokens
   * @param beneficiary who got the tokens
   * @param value weis paid for purchase
   * @param amount amount of tokens purchased
   */
  event TokenPurchase(
    address indexed purchaser,
    address indexed beneficiary,
    uint256 value,
    uint256 amount
  );

  /**
   * Event for tokens minted by the owner for contributors in private sale
   * @param beneficiary Address of investor tokens minted and vested for
   * @param tokens number of PTH to be minted 1 PTH = 1000000000000000000
   * @param bonus number of PTH to be minted and given as bonus
   */
  event TokensMintedAndVested(
    address beneficiary,
    uint256 tokens,
    uint256 bonus
  );

  event LogAddress(string _type, address _address);
  event LogInt(string _type, uint _int);

  /**
   * @param _rate Number of token units a buyer gets per wei
   * @param _wallet Address where collected funds will be forwarded to
   * @param _token Address of the token being sold
   */
  constructor(uint256 _rate, address _wallet, MintableToken _token, uint256 _openingTime) public {
    require(_rate > 0);
    require(_wallet != address(0));
    require(_token != address(0));

    rate = _rate;
    wallet = _wallet;
    token = _token;
    //vestedToken = _token;
    openingTime  = _openingTime;
  }

  // -----------------------------------------
  // Crowdsale external interface
  // -----------------------------------------

  /**
   * @dev fallback function ***DO NOT OVERRIDE***
   */
  function () external payable {
    buyTokens(msg.sender);
  }

  function returnNow() public returns(uint256) {
    return now;
  }

  /**
   * @dev low level token purchase ***DO NOT OVERRIDE***
   * @param _beneficiary Address performing the token purchase
   */
  function buyTokens(address _beneficiary) public payable {
    uint256 weiAmount = msg.value;

    _preValidatePurchase(_beneficiary, weiAmount);

    // calculate token amount to be created
    uint256 tokens = _getTokenAmount(weiAmount);
    uint256 bonus =  _getBonus(tokens);

    // update state
    weiRaised = weiRaised.add(weiAmount);
    tokensSold = tokensSold.add(tokens).add(bonus);

    _processPurchase(_beneficiary, tokens, bonus);

    emit TokenPurchase(
      msg.sender,
      _beneficiary,
      weiAmount,
      tokens
    );

    _updatePurchasingState(_beneficiary, weiAmount);

    _forwardFunds();
    _postValidatePurchase(_beneficiary, weiAmount);
  }

  /**
 * @dev low level token purchase ***DO NOT OVERRIDE***
 * @param _beneficiary Address minting the tokens for
 * @param _tokens number fo PTH to be minted 1 PTH = 1000000000000000000
 * @param _bonus number fo PTH to be minted 1 PTH = 1000000000000000000
 */
  function mintAndVest(address _beneficiary, uint256 _tokens, uint256 _bonus) public onlyOwner {
    _preValidateMintAndVest(_beneficiary, _tokens, _bonus);

    // update state
    tokensSold = tokensSold.add(_tokens).add(_bonus);

    _processPurchase(_beneficiary, _tokens, _bonus);

    emit TokensMintedAndVested(
      _beneficiary,
      _tokens,
      _bonus
    );
  }

  function mintAndEscrow(address _beneficiary, uint256 _tokens, uint256 _bonus) public onlyOwner {
    _preValidateMintAndVest(_beneficiary, _tokens, _bonus);

    // update state
    tokensSold = tokensSold.add(_tokens).add(_bonus);

    _processEscrow(_beneficiary, _tokens, _bonus);

    emit TokensMintedAndVested(
      _beneficiary,
      _tokens,
      _bonus
    );
  }

  /**
   * @dev updates the number of PTH given per wei. It will not allow a change over 10 percent of the current rate
   * @param _newRate number of PTH given per wei
   */

  function updateRate(uint256 _newRate) public onlyOwner {
    uint256 lowestRate = SafeMath.div(
      SafeMath.mul(rate, 9),
      10
    );

    uint256 highestRate = SafeMath.div(
      SafeMath.mul(rate, 11),
      10
    );

    require(_newRate >= lowestRate && _newRate <= highestRate);

    rate = _newRate;
  }

  /**
   * @dev sets the bonus rate for the address
   * @param _address number of PTH given per wei
   * @param _bonus an integer with from 1 to 10000.
   * 1 =        .01 percent bonus
   * 10 =       .10 percent bonus
   * 100 =     1.00 percent bonus
   * 1000 =   10.00 percent bonus
   * 10000 = 100.00 percent bonus
   */

  function setBonus(address _address, uint256 _bonus) public onlyOwner {
    require(_bonus >= 1500 && _bonus <= 4000);
    bonuses[_address] = _bonus;
  }

  function getBonus(address _address) public onlyOwner returns(uint256 _bonus){
    return bonuses[_address];
  }

  // -----------------------------------------
  // Internal interface (extensible)
  // -----------------------------------------

  /**
   * @dev Validation of an incoming purchase. Use require statements to revert state when conditions are not met. Use `super` in contracts that inherit from Crowdsale to extend their validations.
   * Example from CappedCrowdsale.sol's _preValidatePurchase method: 
   *   super._preValidatePurchase(_beneficiary, _weiAmount);
   *   require(weiRaised.add(_weiAmount) <= cap);
   * @param _beneficiary Address performing the token purchase
   * @param _weiAmount Value in wei involved in the purchase
   */
  function _preValidatePurchase(
    address _beneficiary,
    uint256 _weiAmount
  )
    internal
  {
    require(_beneficiary != address(0));
    require(_weiAmount != 0);
  }

  /**
   * @dev Validation of an incoming minting  and vesting by the owner
   * @param _beneficiary Address of the investor/contributor tokens are being minted for
   * @param _tokens Number of tokens to purchased in smallest unit of PHT 18 decimals
   * @param _bonus Number of tokens allocated to the investor for contributing
   */
  function _preValidateMintAndVest(
    address _beneficiary,
    uint256 _tokens,
    uint256 _bonus
  )
  internal
  {
    require(_tokens >= 1000000000000000000 && _tokens <= 10000000000000000000000000);
    require(_bonus >= 1000000000000000000 && _bonus <= 10000000000000000000000000);
    require(_bonus <= _tokens);
  }

  /**
   * @dev Validation of an executed purchase. Observe state and use revert statements to undo rollback when valid conditions are not met.
   * @param _beneficiary Address performing the token purchase
   * @param _weiAmount Value in wei involved in the purchase
   */
  function _postValidatePurchase(
    address _beneficiary,
    uint256 _weiAmount
  )
    internal
  {

  }

  /**
   * @dev Source of tokens. Override this method to modify the way in which the crowdsale ultimately gets and sends its tokens.
   * @param _tokenAmount Number of tokens to be emitted
   */
  function _deliverTokens(
    address _beneficiary,
    uint256 _tokenAmount
  )
    internal
  {
    token.safeTransfer(address(this), _tokenAmount);
  }

  /**
   * @dev Executed when a purchase has been validated and is ready to be executed. Not necessarily emits/sends tokens.
   * @param _beneficiary Address receiving the tokens
   * @param _tokensPurchased Number of tokens to be purchased
   * @param _bonus Number of tokens awarded as a bonus
   */
  function _processPurchase(address _beneficiary, uint256 _tokensPurchased, uint _bonus) internal {
    uint256 totalTokens = _tokensPurchased.add(_bonus);
    _deliverTokens(_beneficiary, totalTokens);

    //setVestingSchedule(_beneficiary, _tokensPurchased, _bonus);
  }


  function _processEscrow(address _beneficiary, uint256 _tokensPurchased, uint _bonus) internal {
    uint256 totalTokens = _tokensPurchased.add(_bonus);
    _deliverTokens(_beneficiary, totalTokens);

    createEscrow(_beneficiary, _tokensPurchased, _bonus);
  }

  /**
   * @dev Override for extensions that require an internal state to check for validity (current user contributions, etc.)
   * @param _beneficiary Address receiving the tokens
   * @param _weiAmount Value in wei involved in the purchase
   */
  function _updatePurchasingState(
    address _beneficiary,
    uint256 _weiAmount
  )
    internal
  {
    // optional override
  }

  /**
   * @dev Override to extend the way in which ether is converted to tokens.
   * @param _weiAmount Value in wei to be converted into tokens
   * @return Number of tokens that can be purchased with the specified _weiAmount
   */
  function _getTokenAmount(uint256 _weiAmount)
    internal view returns (uint256)
  {
    return _weiAmount.mul(rate);
  }


  /**
   * @dev Override to extend the way in which ether is converted to tokens.
   * @return Number of tokens that the investor is entitled to based on bonus
   */
  function _getBonus(uint256 _tokens)
    internal returns (uint256 _bonus)
  {
    uint256 bonus = 0;

    if(now > openingTime && now < openingTime + 72 hours) {
      bonus = SafeMath.div(
        SafeMath.mul(_tokens, 20),
        100
      );
    } else if (now > openingTime + 72 hours && now < openingTime +  10 days) {
      bonus = SafeMath.div(
        SafeMath.mul(_tokens, 10),
        100
      );
    }

    emit LogInt('bonus', bonus);
    return bonus;
  }


  /**
   * @dev Determines how ETH is stored/forwarded on purchases.
   */
  function _forwardFunds() internal {
    wallet.transfer(msg.value);
  }

  // Allow transfer of accidentally sent ERC20 tokens
  function refundTokens(address _recipient, address _token) public onlyOwner {
    require(_token != address(token));
    ERC20 refundToken = ERC20(_token);
    uint256 balance = refundToken.balanceOf(this);
    require(refundToken.transfer(_recipient, balance));
  }
}
