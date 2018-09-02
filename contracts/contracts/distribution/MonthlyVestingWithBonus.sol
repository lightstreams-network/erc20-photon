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
  // Pool of revoked tokens and where tokens that have been adjusted from an error minting go
  // They can be transfered by the owner where ever they want to
  uint256 public revokedAmount = 0;

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
    uint256 initialAmountClaimed;
    uint256 initialBalance;
    uint256 initialBonus;
    uint256 bonusClaimed;
    uint256 bonusBalance;
    bool revocable;
    bool revoked;
  }

  mapping (address => VestingSchedule) public vestingSchedules;

  event LogNewVesting(address _beneficiary, uint256 _totalPurchased, uint256 _initialBonus);
  event Released(address _recipient, uint256 _amount);
  event RevokedVesting(address _beneficiary);
  event LogInt(string _string, uint256 _uint256);

  /**
    * @dev Constructor function - Set the Lightstream token address
    */
  constructor(ERC20 _lightstream) public {
    vestedToken = _lightstream;
  }

  function returnNow() public returns(uint){
    return now;
  }

  /**
    * @dev Allow the owner of the contract to assign a new allocation
    * @param _beneficiary The recipient of the allocation
    * @param _totalPurchased The total amount of LIGHTSTREAM purchased
    * @param _initialBonus The investors bonus from purchasing
    */
  function setVestingSchedule(address _beneficiary, uint256 _totalPurchased, uint256 _initialBonus) internal {
    require(vestingSchedules[_beneficiary].startTimestamp == 0);

    vestingSchedules[_beneficiary] = VestingSchedule(now, now + 150 days, 30 days, _totalPurchased, 0, _totalPurchased, _initialBonus, 0, _initialBonus, true, false);

    emit LogNewVesting(_beneficiary, _totalPurchased, _initialBonus);
  }

  function updateVestingSchedule(address _beneficiary, uint256 _totalPurchased, uint256 _initialBonus) public onlyOwner {
    require(vestingSchedules[_beneficiary].startTimestamp != 0);
    require(vestingSchedules[_beneficiary].initialAmount >= _totalPurchased);
    require(vestingSchedules[_beneficiary].initialBonus >=  _initialBonus);

    VestingSchedule memory vestingSchedule = vestingSchedules[_beneficiary];

    uint256 totalPurchaseDifference = vestingSchedule.initialAmount.sub(_totalPurchased);
    uint256 totalBonusDifference = vestingSchedule.initialBonus.sub(_initialBonus);

    revokedAmount = revokedAmount.add(totalPurchaseDifference).add(totalBonusDifference);

    vestingSchedules[_beneficiary] = VestingSchedule(now, now + 150 days, 30 days, _totalPurchased, 0, _totalPurchased, _initialBonus, 0, _initialBonus, true, false);

    emit LogNewVesting(_beneficiary, _totalPurchased, _initialBonus);
  }

  function release(address _beneficiary) public returns(uint){
    require(vestingSchedules[_beneficiary].initialBalance > 0 || vestingSchedules[_beneficiary].initialBonus > 0);
    require(msg.sender == _beneficiary);

    VestingSchedule memory vestingSchedule = vestingSchedules[_beneficiary];

    uint256 totalAmountVested = calculateTotalAmountVested(_beneficiary, vestingSchedule.startTimestamp, vestingSchedule.endTimestamp, vestingSchedule.initialAmount);
    uint256 amountWithdrawable = totalAmountVested.sub(vestingSchedule.initialAmountClaimed);
    uint256 releasable = withdrawalAllowed(amountWithdrawable,  vestingSchedule.startTimestamp, vestingSchedule.endTimestamp, vestingSchedule.lockPeriod, vestingSchedule.initialAmount);

    if(releasable > 0) {
      vestingSchedules[_beneficiary].initialAmountClaimed = vestingSchedule.initialAmountClaimed.add(releasable);
      vestingSchedules[_beneficiary].initialBalance = vestingSchedule.initialBalance.sub(releasable);

      vestedToken.safeTransfer(_beneficiary, releasable);

      emit Released(_beneficiary, releasable);
    }

    if (now > vestingSchedule.endTimestamp && vestingSchedule.initialBonus > 0) {
      uint256 withdrawableBonus = calculateBonusWithdrawal(vestingSchedule.startTimestamp, vestingSchedule.endTimestamp, vestingSchedule.lockPeriod, vestingSchedule.initialAmount, vestingSchedule.initialBonus);

      if(withdrawableBonus > 0) {
        vestedToken.safeTransfer(_beneficiary, withdrawableBonus);

        vestingSchedules[_beneficiary].bonusClaimed = vestingSchedule.bonusClaimed.add(withdrawableBonus);
        vestingSchedules[_beneficiary].bonusBalance = vestingSchedule.initialBonus.sub(withdrawableBonus);

        emit Released(_beneficiary, withdrawableBonus);
      }
    }


  }

  function revokeVesting (address _beneficiary) onlyOwner public {
    require(vestingSchedules[_beneficiary].revocable == true);

    VestingSchedule memory vestingSchedule = vestingSchedules[_beneficiary];

    uint256 totalAmountVested = calculateTotalAmountVested(_beneficiary, vestingSchedule.startTimestamp, vestingSchedule.endTimestamp, vestingSchedule.initialAmount);
    uint256 amountWithdrawable = totalAmountVested.sub(vestingSchedule.initialAmountClaimed);

    uint256 refundable = withdrawalAllowed(amountWithdrawable,  vestingSchedule.startTimestamp, vestingSchedule.endTimestamp, vestingSchedule.lockPeriod, vestingSchedule.initialAmount);
    uint256 backToProjectWallet = vestingSchedule.initialBalance.sub(refundable);
    revokedAmount = revokedAmount.add(backToProjectWallet);

    if(refundable > 0) {
      vestedToken.safeTransfer(_beneficiary, refundable);

      vestingSchedules[_beneficiary].initialAmountClaimed = vestingSchedule.initialAmountClaimed.add(refundable);
      vestingSchedules[_beneficiary].initialBalance = 0;

      emit Released(_beneficiary, refundable);
    }

    emit RevokedVesting(_beneficiary);
  }

  /**
 * @notice Calculates the total amount vested since the start time. If after the endTime
 * the entire initialBalance is returned
 */

  function calculateTotalAmountVested(address _beneficiary, uint256 _startTimestamp, uint256 _endTimestamp, uint256 _initialAmount) internal view returns (uint256 _amountVested) {
    // If it's past the end time, the whole amount is available.
    if (now >= _endTimestamp) {
      return vestingSchedules[_beneficiary].initialAmount;
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

    emit LogInt('totalAmountVested', vestedAmount);
    return vestedAmount;
  }

  /**
 * @notice Calculates the amount releasable. If the amount is less than the allowable amount
 * for each lock period zero will be returned. If more than the allowable amount each month will return
 * a multiple of the allowable amount each month
 */

  function withdrawalAllowed(uint256 _amountWithdrawable, uint256 _startTimestamp, uint256 _endTimestamp, uint256 _lockPeriod, uint256 _initialAmount) internal view returns(uint256 _amountReleasable) {
    // If it's past the end time, the whole amount is available.
    if (now >= _endTimestamp) {
      return _amountWithdrawable;
    }
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

  function calculateBonusWithdrawal(uint256 _startTimestamp, uint _endTimestamp, uint256 _lockPeriod, uint256 _initialAmount, uint256 _initialBonus) internal view returns(uint256) {
    // calculate the number of time periods vesting is done over
    uint256 lockPeriods = (_endTimestamp.sub(_startTimestamp)).div(_lockPeriod);
    uint256 amountWithdrawablePerLockPeriod = SafeMath.div(_initialAmount, lockPeriods);

    // get the remainder and subtract it from the amount amount withdrawable to get a multiple of the
    // amount withdrawable per lock period
    uint256 remainder = SafeMath.mod(_initialBonus, amountWithdrawablePerLockPeriod);
    uint256 amountReleasable = _initialBonus.sub(remainder);

    if (now > _endTimestamp.add(30 days) && amountReleasable >= amountWithdrawablePerLockPeriod) {
      return amountWithdrawablePerLockPeriod;
    } else if (now > _endTimestamp.add(60 days)){
      return _initialBonus;
    }

    return 0;
  }

  function transferRevokedTokens(address _recipient, uint256 _amount) public onlyOwner {
    require(_amount <= revokedAmount);
    require(_recipient != address(0));

    require(vestedToken.transfer(_recipient, _amount));
  }

  // Allow transfer of accidentally sent ERC20 tokens
  function refundTokens(address _recipient, address _token) public onlyOwner {
    require(_token != address(vestedToken));
    ERC20 refundToken = ERC20(_token);
    uint256 balance = refundToken.balanceOf(this);
    require(refundToken.transfer(_recipient, balance));
  }
}
