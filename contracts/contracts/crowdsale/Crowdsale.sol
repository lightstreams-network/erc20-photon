pragma solidity ^0.4.24;

import "../token/ERC20.sol";
import "../token/SafeERC20.sol";
import "../token/MintableToken.sol";
import "../utils/SafeMath.sol";
import "../utils/Ownable.sol";
import "../distribution/MonthlyVestingWithBonus.sol";
import "../lifecycle/Pausable.sol";
import "../LightstreamsToken.sol";


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

contract Crowdsale is Ownable, MonthlyVestingWithBonus, Pausable {
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
  uint16 public rate;
  uint256 public openingTime;

  mapping (address => uint256) public bonuses;


  // Amount of wei raised
  uint256 public weiRaised;
  uint256 public tokensSold;

  uint256 private constant decimalFactor = 10 ** uint256(18);
  uint256 private constant INITIAL_MINT_MAX =   13500000 * decimalFactor; // Max amount that can be minted approximately 2 million USD if sold at .15
  uint256 private constant INITIAL_MINT_MIN =      330000 * decimalFactor; // Min amount that can be minted approximately 50,000 USD if sold at .15
  uint256 private constant BONUS_MIN =                  0;                 // Min amount that can be minted approximately 50,000 USD if sold at .15

  /**
   * Event for token purchase logging
   * @param purchaser who paid for the tokens
   * @param beneficiary who got the tokens
   * @param value weis paid for purchase
   * @param amount amount of tokens purchased
   */
  event TokenPurchase(
    address purchaser,
    address beneficiary,
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

  event FundsReceivedOnFallback(address sender, uint256 value);

  /**
   * @param _rate Number of token units a buyer gets per wei
   * @param _wallet Address where collected funds will be forwarded to
   * @param _token Address of the token being sold
   */
  constructor(uint16 _rate, address _wallet, ERC20 _token, uint256 _openingTime) public {
    require(_rate > 0);
    require(_wallet != address(0));
    require(_token != address(0));

    rate = _rate;
    wallet = _wallet;
    token = _token;
    vestedToken = _token;
    openingTime  = _openingTime;
  }

  // -----------------------------------------
  // Crowdsale external interface
  // -----------------------------------------

  /**
   * @dev fallback function ***DO NOT OVERRIDE***
   */
  function () external payable {
    require(msg.data.length == 0);
    emit FundsReceivedOnFallback(msg.sender, msg.value);
    _forwardFunds();
  }

  /**
   * @dev low level token purchase ***DO NOT OVERRIDE***
   * @param _beneficiary Address performing the token purchase
   */
  function buyTokens(address _beneficiary) public payable whenNotPaused {
    require(vestingSchedules[_beneficiary].startTimestamp == 0);

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

    _forwardFunds();
  }

  /**
  * @param _beneficiary Address minting the tokens for
  * @param _tokens number fo PTH to be minted 1 PTH = 1000000000000000000
  * @param _bonus number fo PTH to be minted  1 PTH = 1000000000000000000
  */
  function mintAndVest(address _beneficiary, uint256 _tokens, uint256 _bonus) public onlyOwner {
    require(vestingSchedules[_beneficiary].startTimestamp == 0);

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

  /**
   * @dev updates the number of PTH given per wei. It will not allow a change over 10 percent of the current rate
   * @param _newRate number of PTH given per wei
   */
  function updateRate(uint16 _newRate) public onlyOwner {
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
   * @dev Allows transfer of accidentally sent ERC20 tokens to contract
   * @param _recipient address of recipient to receive ERC20 token
   * @param _token address ERC20 token to transfer
   */
  function refundTokens(address _recipient, address _token) public onlyOwner {
    require(_token != address(token));
    require(_recipient != address(0));
    require(_token != address(0));
    ERC20 refundToken = ERC20(_token);
    uint256 balance = refundToken.balanceOf(this);
    require(balance > 0);
    require(refundToken.transfer(_recipient, balance));
  }

  /**
   * @dev The sales contract needs to be made the owner of the token in order to mint tokens. If the owner
   * of the token needs to be updated it will have to come from the sales contract.  This was another contract
   * could be added later for second sale
   * @param _newOwnerAddress address of contract or wallet that will become owner of token giving it minting privileges
   */
  function updateTokenOwner(address _newOwnerAddress) public onlyOwner {
    require(_newOwnerAddress != address(0));
    LightstreamsToken lsToken = LightstreamsToken(token);
    lsToken.transferOwnership(_newOwnerAddress);
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
    uint256 bonusMax = SafeMath.div(
        SafeMath.mul(_tokens, 40),
        100
      );
    require(_tokens >= INITIAL_MINT_MIN && _tokens <= INITIAL_MINT_MAX);
    require(_bonus >= BONUS_MIN && _bonus <= bonusMax);
    require(_bonus <= _tokens);
  }

  /**
   * @dev Source of tokens. Override this method to modify the way in which the crowdsale ultimately gets and sends its tokens.
   * @param _beneficiary address to receive tokens after they're minted
   * @param _tokenAmount Number of tokens to be emitted
   */
  function _deliverTokens(
    address _beneficiary,
    uint256 _tokenAmount
  )
  internal
  {
    token.safeTransfer(_beneficiary, _tokenAmount);
  }

  /**
   * @dev Executed when a purchase has been validated and is ready to be executed. Not necessarily emits/sends tokens.
   * @param _beneficiary Address receiving the tokens
   * @param _tokensPurchased Number of tokens to be purchased
   * @param _bonus Number of tokens awarded as a bonus
   */
  function _processPurchase(
    address _beneficiary,
    uint256 _tokensPurchased,
    uint _bonus
  )
  internal
  {
    uint256 totalTokens = _tokensPurchased.add(_bonus);
    _deliverTokens(address(this), totalTokens);

    setVestingSchedule(_beneficiary, _tokensPurchased, _bonus);
  }

  /**
   * @dev Override to extend the way in which ether is converted to tokens.
   * @param _weiAmount Value in wei to be converted into tokens
   * @return Number of tokens that can be purchased with the specified _weiAmount
   */
  function _getTokenAmount(uint256 _weiAmount) internal view returns (uint256)
  {
    return _weiAmount.mul(rate);
  }


  /**
   * @dev Override to extend the way in which ether is converted to tokens.
   * @return Number of tokens that the investor is entitled to based on bonus
   */
  function _getBonus(uint256 _tokens) internal returns (uint256 _bonus) {
    uint256 bonus = 0;
    // If within days 0 - 2 contributor gets a 30 percent bonus
    if(now >= openingTime && now < openingTime + 2 days) {
      bonus = SafeMath.div(
        SafeMath.mul(_tokens, 30),
        100
      );
    // If within days 2 - 4 contributor gets a 20 percent bonus
    } else if (now >= openingTime + 2 days && now < openingTime + 4 days) {
      bonus = SafeMath.div(
        SafeMath.mul(_tokens, 20),
        100
      );
    // If within days 4 - 6 contributor gets a 10 percent bonus
    } else if (now >= openingTime + 4 days && now < openingTime + 6 days) {
      bonus = SafeMath.div(
        SafeMath.mul(_tokens, 10),
        100
      );
    // If within days 6 - 8 contributor gets a 5 percent bonus
    } else if (now >= openingTime + 6 days && now < openingTime + 8 days) {
      bonus = SafeMath.div(
        SafeMath.mul(_tokens, 5),
        100
      );
    }

    return bonus;
  }

  /**
   * @dev Determines how ETH is stored/forwarded on purchases.
   */
  function _forwardFunds() internal {
    wallet.transfer(msg.value);
  }
}