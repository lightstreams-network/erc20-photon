/* solium-disable security/no-block-members */

pragma solidity ^0.4.24;

import "../token/SafeERC20.sol";
import "../utils/Ownable.sol";
import "../utils/SafeMath.sol";


/**
 * @title MonthlyTokenVesting
 * @dev A token holder contract that can release its token balance in even amounts over a lock period
 */

contract MonthlyTokenVesting is Ownable {
  using SafeMath for uint256;
  using SafeERC20 for ERC20;

  // The token being vested
  ERC20 public token;

  event Released(uint256 amount);
  event Revoked();

  address public beneficiary;

  uint256 public startTimestamp;
  uint256 public endTimestamp;
  uint256 public cliffTimestamp;
  uint256 public lockPeriod;
  uint256 public totalAmount;
  uint256 public released;

  bool public revoked;
  bool public revocable;

  /**
   * @dev Creates a vesting contract that vests its balance of any ERC20 token to the _beneficiary
   * @param _beneficiary address of the beneficiary to whom vested tokens are transferred
   * @param _startTimestamp timestamp of when vesting begins
   * @param _cliffTimestamp timestamp of when the cliff begins
   * @param _lockPeriod amount of time in seconds between withdrawal periods. (EG. 6 months or 1 month)
   * @param _totalAmount total amount of tokens to be vested.
   * @param _revocable whether the vesting is revocable or not
   */
  constructor(ERC20 _tokenAddress, address _beneficiary, uint256 _startTimestamp, uint256 _endTimestamp, uint256 _cliffTimestamp, uint256 _lockPeriod, uint256 _totalAmount, bool _revocable) public {
    require(_beneficiary != address(0));
    require(_cliffTimestamp >= _startTimestamp);
    require(_endTimestamp >= _startTimestamp);

    token = _tokenAddress;
    beneficiary = _beneficiary;
    startTimestamp = _startTimestamp;
    endTimestamp = _endTimestamp;
    cliffTimestamp = _cliffTimestamp;
    lockPeriod = _lockPeriod;
    totalAmount = _totalAmount;
    revocable = _revocable;
  }

  /**
   * @notice Transfers vested tokens to beneficiary.
   */
  // TODO - make this onlyOwner and have function in crowdsale contract call this
  function release() public {
    require(cliffTimestamp <= now);

    uint256 totalAmountVested = calculateTotalAmountVested();
    uint256 amountWithdrawable = totalAmountVested.sub(released);
    uint256 releasable = withdrawalAllowed(amountWithdrawable);

    if(releasable > 0) {
      token.safeTransfer(beneficiary, releasable);
      released = released.add(releasable);

      emit Released(amountWithdrawable);
    }
  }

  /**
   * @notice Allows the owner to revoke the vesting. Tokens already vested
   * remain in the contract, the rest are returned to the owner.
   */
  //onlyOwner
  function revoke() public  {
    //require(revocable);
    //require(!revoked);

    uint256 balance = token.balanceOf(address(this));

    uint256 unreleased = calculateTotalAmountVested();
    //uint256 refund = balance.sub(unreleased);

    revoked = true;

    token.safeTransfer(owner, unreleased);

    emit Revoked();
  }


  /**
   * @notice Calculates the total amount vested since the start time. If after the endTime
   * the entire balance is returned
   */

  function calculateTotalAmountVested() internal view returns (uint256 _amountVested) {
    // If it's past the end time, the whole amount is available.
    if (now >= endTimestamp) {
      return token.balanceOf(address(this));
    }

    // get the amount of time that passed since the start of vesting
    uint256 durationSinceStart = SafeMath.sub(now, startTimestamp);
    // Get the amount of time amount of time the vesting will happen over
    uint256 totalVestingTime = SafeMath.sub(endTimestamp, startTimestamp);
    // Calculate the amount vested as a ratio
    uint256 vestedAmount = SafeMath.div(
      SafeMath.mul(durationSinceStart, totalAmount),
      totalVestingTime
    );

    return vestedAmount;
  }

  /**
   * @notice Calculates the amount releasable. If the amount is less than the allowable amount
   * for each lock period zero will be returned. If more than the allowable amount each month will return
   * a multiple of the allowable amount each month
   */

  function withdrawalAllowed(uint256 _amountVested) internal view returns(uint256) {
    uint256 lockPeriods = (endTimestamp.sub(startTimestamp)).div(lockPeriod);
    uint256 amountWithdrawablePerLockPeriod = SafeMath.div(totalAmount, lockPeriods);

    uint256 remainder = SafeMath.mod(_amountVested, amountWithdrawablePerLockPeriod);
    uint256 amountReleasable = _amountVested.sub(remainder);

    if (now < endTimestamp && amountReleasable >= amountWithdrawablePerLockPeriod) {
      return amountReleasable;
    }

    return 0;
  }

  /**
 * @dev Calculates the amount that has already vested but hasn't been released yet.
 */
  function releasableAmount() public view returns (uint256) {
    uint256 totalAmountVested = calculateTotalAmountVested();
    uint256 releasable = totalAmountVested.sub(released);

    return releasable;
  }

  /**
   * @dev Calculates the amount that has already vested.
   */
  function vestedAmount() public view returns (uint256) {
    return calculateTotalAmountVested();
  }
}
