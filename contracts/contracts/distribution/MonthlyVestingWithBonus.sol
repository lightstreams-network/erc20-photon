pragma solidity ^0.4.24;

import '../token/SafeERC20.sol';
import '../token/ERC20.sol';
import '../LightstreamToken.sol';
import '../utils/SafeMath.sol';
import '../utils/Ownable.sol';

/**
 * @title LIGHTSTREAM token team/foundation distribution
 *
 * @dev Distribute purchasers, airdrop, reserve, and founder tokens
 */
contract MonthlyVestingWithBonus is Ownable {
  using SafeMath for uint256;
  using SafeERC20 for ERC20;

  ERC20 public vestedToken;
  uint256 revokedAmount = 0;

  /**
   * @dev Creates vesting schedule with vesting information
   * beneficiary address of the beneficiary to whom vested tokens are transferred
   * startTimestamp timestamp of when vesting begins
   * endTimestamp timestamp of when vesting ends
   * lockPeriod amount of time in seconds between withdrawal periods. (EG. 6 months or 1 month)
   * initialAmount - the initial amount of tokens to be vested.
   * revocable whether the vesting is revocable or not
   * revoked whether the vesting has been revoked or not
   */

  struct VestingSchedule {
    uint256 startTimestamp;
    uint256 endTimestamp;
    uint256 lockPeriod;
    uint256 initialAmount;
    uint256 amountClaimed;
    uint256 balance;
    uint256 bonus;
    bool revocable;
    bool revoked;
  }
  mapping (address => VestingSchedule) public vestingSchedules;

  event LogNewVesting(address _beneficiary, uint256 _totalPurchased, uint256 _bonus);
  event Released(address _recipient, uint256 _amount);
  event RevokedVesting(address _beneficiary);

  /**
    * @dev Constructor function - Set the Lightstream token address
    */
  constructor(ERC20 _lightstream) public {
    vestedToken = _lightstream;
  }

  /**
    * @dev Allow the owner of the contract to assign a new allocation
    * @param _beneficiary The recipient of the allocation
    * @param _totalPurchased The total amount of LIGHTSTREAM purchased
    * @param _bonus The investors bonus from purchasing
    */
  function setVestingSchedule(address _beneficiary, uint256 _totalPurchased, uint256 _bonus) internal {
    //                                    startTimestamp, endTimestamp, lockPeriod, initialAmount, amountClaimed, balance, bonus, revocable, revoked;
    vestingSchedules[_beneficiary] = VestingSchedule(now, now + 150 days, 30 days, _totalPurchased, 0, _totalPurchased, _bonus, true, false);

    emit LogNewVesting(_beneficiary, _totalPurchased, _bonus);
  }

  function release(address _beneficiary) public {
    require(vestingSchedules[_beneficiary].balance > 0);

    VestingSchedule memory vestingSchedule = vestingSchedules[_beneficiary];
    uint256 totalAmountVested = calculateTotalAmountVested(_beneficiary, vestingSchedule.startTimestamp, vestingSchedule.endTimestamp, vestingSchedule.initialAmount);
    uint256 amountWithdrawable = totalAmountVested.sub(vestingSchedule.amountClaimed);
    uint256 releasable = withdrawalAllowed(amountWithdrawable,  vestingSchedule.startTimestamp, vestingSchedule.endTimestamp, vestingSchedule.lockPeriod, vestingSchedule.initialAmount);

    if(releasable > 0) {
      vestedToken.safeTransfer(_beneficiary, releasable);

      vestingSchedules[_beneficiary].amountClaimed = vestingSchedule.amountClaimed.add(releasable);
      vestingSchedules[_beneficiary].balance = vestingSchedule.balance.sub(releasable);

      emit Released(_beneficiary, releasable);
    }

    if (now > vestingSchedule.endTimestamp && vestingSchedule.bonus > 0) {
      uint256 withdrawableBonus = calculateBonusWithdrawal(vestingSchedule.startTimestamp, vestingSchedule.endTimestamp, vestingSchedule.lockPeriod, vestingSchedule.initialAmount, vestingSchedule.bonus);

      if(withdrawableBonus > 0) {
        vestedToken.safeTransfer(_beneficiary, withdrawableBonus);

        vestingSchedules[_beneficiary].amountClaimed = vestingSchedule.amountClaimed.add(withdrawableBonus);
        vestingSchedules[_beneficiary].bonus = vestingSchedule.bonus.sub(withdrawableBonus);

        emit Released(_beneficiary, withdrawableBonus);
      }
    }


  }

  function revokeVesting (address _beneficiary) onlyOwner public {
    require(vestingSchedules[_beneficiary].revocable == true);

    VestingSchedule memory vestingSchedule = vestingSchedules[_beneficiary];

    uint256 totalAmountVested = calculateTotalAmountVested(_beneficiary, vestingSchedule.startTimestamp, vestingSchedule.endTimestamp, vestingSchedule.initialAmount);
    uint256 amountWithdrawable = totalAmountVested.sub(vestingSchedule.amountClaimed);

    uint256 refundable = withdrawalAllowed(amountWithdrawable,  vestingSchedule.startTimestamp, vestingSchedule.endTimestamp, vestingSchedule.lockPeriod, vestingSchedule.initialAmount);
    uint256 backToProjectWallet = vestingSchedule.balance.sub(refundable);
    revokedAmount = revokedAmount.add(backToProjectWallet);

    if(refundable > 0) {
      vestedToken.safeTransfer(_beneficiary, refundable);

      vestingSchedules[_beneficiary].amountClaimed = vestingSchedule.amountClaimed.add(refundable);
      vestingSchedules[_beneficiary].balance = 0;

      emit Released(_beneficiary, refundable);
    }

    emit RevokedVesting(_beneficiary);
  }

  function getVestingSchedule (address _beneficiary) public view returns (
    uint256 _startTimestamp,
    uint256 _endTimestamp,
    uint256 _lockPeriod,
    uint256 _initialAmount,
    uint256 _amountClaimed,
    uint256 _balance,
    uint256 _bonus,
    bool _revocable,
    bool _revoked
  ){
    VestingSchedule storage vestingSchedule = vestingSchedules[_beneficiary];

    return (
      vestingSchedule.startTimestamp,
      vestingSchedule.endTimestamp,
      vestingSchedule.lockPeriod,
      vestingSchedule.initialAmount,
      vestingSchedule.amountClaimed,
      vestingSchedule.balance,
      vestingSchedule.bonus,
      vestingSchedule.revocable,
      vestingSchedule.revoked
    );
  }

  /**
 * @notice Calculates the total amount vested since the start time. If after the endTime
 * the entire balance is returned
 */

  function calculateTotalAmountVested(address _beneficiary, uint256 _startTimestamp, uint256 _endTimestamp, uint256 _initialAmount) internal view returns (uint256 _amountVested) {
    // If it's past the end time, the whole amount is available.
    if (now >= _endTimestamp) {
      return vestingSchedules[_beneficiary].balance;
    }

    // get the amount of time that passed since the start of vesting
    uint256 durationSinceStart = SafeMath.sub(now, _startTimestamp);
    // Get the amount of time amount of time the vesting will happen over
    uint256 totalVestingTime = SafeMath.sub(_endTimestamp, _startTimestamp);
    // Calculate the amount vested as a ratio
    uint256 vestedAmount = SafeMath.div(
      SafeMath.mul(durationSinceStart, _initialAmount),
      totalVestingTime
    );

    return vestedAmount;
  }

  /**
 * @notice Calculates the amount releasable. If the amount is less than the allowable amount
 * for each lock period zero will be returned. If more than the allowable amount each month will return
 * a multiple of the allowable amount each month
 */

  function withdrawalAllowed(uint256 _amountWithdrawable, uint256 _startTimestamp, uint256 _endTimestamp, uint256 _lockPeriod, uint256 _initialAmount) internal view returns(uint256 _amountReleasable) {
    // calculate the number of time periods vesting is done over
    uint256 lockPeriods = (_endTimestamp.sub(_startTimestamp)).div(_lockPeriod);
    uint256 amountWithdrawablePerLockPeriod = SafeMath.div(_initialAmount, lockPeriods);

    // get the remainder and subtract it from the amount amount withdrawable to get a multiple of the
    // amount withdrawable per lock period
    uint256 remainder = SafeMath.mod(_amountWithdrawable, amountWithdrawablePerLockPeriod);
    uint256 amountReleasable = _amountWithdrawable.sub(remainder);

    if (now < _endTimestamp && amountReleasable >= amountWithdrawablePerLockPeriod) {
      return amountReleasable;
    }

    return 0;
  }

  function calculateBonusWithdrawal(uint256 _startTimestamp, uint _endTimestamp, uint256 _lockPeriod, uint256 _initialAmount, uint256 _bonus) internal view returns(uint256) {
    // calculate the number of time periods vesting is done over
    uint256 lockPeriods = (_endTimestamp.sub(_startTimestamp)).div(_lockPeriod);
    uint256 amountWithdrawablePerLockPeriod = SafeMath.div(_initialAmount, lockPeriods);

    // get the remainder and subtract it from the amount amount withdrawable to get a multiple of the
    // amount withdrawable per lock period
    uint256 remainder = SafeMath.mod(_bonus, amountWithdrawablePerLockPeriod);
    uint256 amountReleasable = _bonus.sub(remainder);

    if (now > _endTimestamp.add(30 days) && amountReleasable >= amountWithdrawablePerLockPeriod) {
      return amountWithdrawablePerLockPeriod;
    } else if (now > _endTimestamp.add(60 days)){
      return _bonus;
    }

    return 0;
  }

  // Allow transfer of accidentally sent ERC20 tokens
  function refundTokens(address _recipient, address _token) public onlyOwner {
    require(_token != address(vestedToken));
    ERC20 refundToken = ERC20(_token);
    uint256 balance = refundToken.balanceOf(this);
    require(refundToken.transfer(_recipient, balance));
  }
}
