pragma solidity ^0.4.24;

import '../token/SafeERC20.sol';
import '../token/ERC20.sol';
import '../LightstreamToken.sol';
import '../utils/SafeMath.sol';
import '../utils/Ownable.sol';

/**
 * @title Monthly Vesting with Bonus
 *
 */
contract MonthlyVestingWithBonus is Ownable {
  using SafeMath for uint256;
  using SafeERC20 for ERC20;

  ERC20 public vestedToken;
  // Pool of revoked tokens and where tokens that have been adjusted from an error minting go
  // They can be transfered by the owner where ever they want to
  uint256 public revokedAmount = 0;

  event LogInt(string _type, uint _uint);

  /**
   * @dev Creates vesting schedule with vesting information
   * beneficiary address of the beneficiary to whom vested tokens are transferred
   * startTimestamp timestamp of when vesting begins
   * endTimestamp timestamp of when vesting ends
   * lockPeriod amount of time in seconds between withdrawal periods. (EG. 6 months or 1 month)
   * initialAmount - the initial amount of tokens to be vested that does not include the amount given as a bonus. Will not change
   * initialAmountClaimed - amount the beneficiary has released and claimed from the initial amount
   * initialBalance - the initialAmount less the initialAmountClaimed.  The remaining amount that can be vested.
   * initialBonus - the initial amount of tokens given as a bonus. Will not change
   * bonusClaimed - amount the beneficiary has released and claimed from the initial bonus
   * bonusBalance - the initialBonus less the bonusClaimed.  The remaining amount of the bonus that can be vested
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

  /**
   * Event for when a new vesting schedule is created
   * @param _beneficiary Address of investor tokens minted and vested for
   * @param _totalPurchased number of token purchased or minted not including any bonus
   * @param _initialBonus the number of tokens given as a bonus when minting or received from early crowdsale participation
   */
  event NewVesting(address _beneficiary, uint256 _totalPurchased, uint256 _initialBonus);

  /**
   * Event for when the beneficiary releases vested tokens to their account/wallet
   * @param _recipient address beneficiary/recipient tokens released to
   * @param _amount the number of tokens release
   */
  event Released(address _recipient, uint256 _amount);

  /**
   * Event for when the owner revokes the vesting of a contributor releasing any vested tokens to the beneficiary,
   * and the remaining balance going to the contract to be distributed by the contact owner
   * @param _beneficiary address of beneficiary vesting is being cancelled for
   */
  event RevokedVesting(address _beneficiary);

  /**
   * @dev Constructor function - Set the Lightstream token address
   */
  constructor(ERC20 _lightstream) public {
    vestedToken = _lightstream;
  }

  /**
   * @dev Allows the beneficiary of a vesting schedule to release vested tokens to their account/wallet
   * @param _beneficiary The address of the recipient of vested tokens
   */
  function release(address _beneficiary) public returns(uint){
    require(vestingSchedules[_beneficiary].initialBalance > 0 || vestingSchedules[_beneficiary].bonusBalance > 0);
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

    if (now > vestingSchedule.endTimestamp && vestingSchedule.bonusBalance > 0) {
      uint256 withdrawableBonus = calculateBonusWithdrawal(vestingSchedule.startTimestamp, vestingSchedule.endTimestamp, vestingSchedule.lockPeriod, vestingSchedule.initialAmount, vestingSchedule.bonusBalance);
  
      if (withdrawableBonus > 0) {
        emit LogInt('withdrawableBonus', withdrawableBonus);
    
        vestingSchedules[_beneficiary].bonusClaimed = vestingSchedule.bonusClaimed.add(withdrawableBonus);
        vestingSchedules[_beneficiary].bonusBalance = vestingSchedule.bonusBalance.sub(withdrawableBonus);
    
        vestedToken.safeTransfer(_beneficiary, withdrawableBonus);
        emit Released(_beneficiary, withdrawableBonus);
      }
    }
  }

  /**
   * @dev Allows the to revoke the vesting schedule for a contributor/investor with a vesting schedule
   * @param _beneficiary Address of contributor/investor with a vesting schedule to be revoked
   */
  function revokeVesting (address _beneficiary) onlyOwner public {
    require(vestingSchedules[_beneficiary].revocable == true);

    VestingSchedule memory vestingSchedule = vestingSchedules[_beneficiary];

    uint256 totalAmountVested = calculateTotalAmountVested(_beneficiary, vestingSchedule.startTimestamp, vestingSchedule.endTimestamp, vestingSchedule.initialAmount);
    uint256 amountWithdrawable = totalAmountVested.sub(vestingSchedule.initialAmountClaimed);

    uint256 refundable = withdrawalAllowed(amountWithdrawable,  vestingSchedule.startTimestamp, vestingSchedule.endTimestamp, vestingSchedule.lockPeriod, vestingSchedule.initialAmount);
    uint256 refundableBonus = calculateBonusWithdrawal(vestingSchedule.startTimestamp, vestingSchedule.endTimestamp, vestingSchedule.lockPeriod, vestingSchedule.initialAmount, vestingSchedule.bonusBalance);

    uint256 toProjectWalletFromInitialAmount = vestingSchedule.initialBalance.sub(refundable);
    uint256 toProjectWalletFromInitialBonus = vestingSchedule.initialBonus.sub(refundableBonus);
    uint256 backToProjectWallet = toProjectWalletFromInitialAmount.add(toProjectWalletFromInitialBonus);

    revokedAmount = revokedAmount.add(backToProjectWallet);

    vestingSchedules[_beneficiary].initialAmountClaimed = vestingSchedule.initialAmountClaimed.add(refundable);
    vestingSchedules[_beneficiary].initialBalance = 0;
    vestingSchedules[_beneficiary].bonusClaimed = vestingSchedule.bonusClaimed.add(refundableBonus);
    vestingSchedules[_beneficiary].bonusBalance = 0;
    vestingSchedules[_beneficiary].revoked = true;

    if(refundable > 0 || refundableBonus > 0) {
      uint256 totalRefundable = refundable.add(refundableBonus);
      vestedToken.safeTransfer(_beneficiary, totalRefundable);

      emit Released(_beneficiary, totalRefundable);
    }

    emit RevokedVesting(_beneficiary);
  }

  /**
   * @dev Allows the owner to transfer any tokens that have been revoked to be transfered to another address
   * @param _recipient The address where the tokens should be sent
   * @param _amount Number of tokens to be transfer to recipient
   */
  function transferRevokedTokens(address _recipient, uint256 _amount) public onlyOwner {
    require(_amount <= revokedAmount);
    require(_recipient != address(0));
    revokedAmount = revokedAmount.sub(_amount);
    require(vestedToken.transfer(_recipient, _amount));
  }


  /**
   * @dev Sets the vesting schedule for a beneficiary who either purchased tokens or had them minted
   * @param _beneficiary The recipient of the allocation
   * @param _totalPurchased The total amount of Lightstream purchased
   * @param _initialBonus The investors bonus from purchasing
   */
  function setVestingSchedule(address _beneficiary, uint256 _totalPurchased, uint256 _initialBonus) internal {
    require(vestingSchedules[_beneficiary].startTimestamp == 0);

    vestingSchedules[_beneficiary] = VestingSchedule(now, now + 150 days, 30 days, _totalPurchased, 0, _totalPurchased, _initialBonus, 0, _initialBonus, true, false);

    emit NewVesting(_beneficiary, _totalPurchased, _initialBonus);
  }

  function updateVestingSchedule(address _beneficiary, uint256 _totalPurchased, uint256 _initialBonus) public onlyOwner {
    VestingSchedule memory vestingSchedule = vestingSchedules[_beneficiary];
    require(vestingSchedule.startTimestamp != 0);
    require(vestingSchedule.initialAmount.sub(vestingSchedule.initialAmountClaimed) >= _totalPurchased);
    require(vestingSchedule.initialBonus.sub(vestingSchedule.bonusClaimed) >=  _initialBonus);
    
    uint256 totalPurchaseDifference = vestingSchedule.initialAmount.sub(vestingSchedule.initialAmountClaimed).sub(_totalPurchased);
    uint256 totalBonusDifference = vestingSchedule.initialBonus.sub(vestingSchedule.bonusClaimed).sub(_initialBonus);

    revokedAmount = revokedAmount.add(totalPurchaseDifference).add(totalBonusDifference);

    vestingSchedules[_beneficiary] = VestingSchedule(now, now + 150 days, 30 days, _totalPurchased, 0, _totalPurchased, _initialBonus, 0, _initialBonus, true, false);

    emit NewVesting(_beneficiary, _totalPurchased, _initialBonus);
  }

  /**
   * @dev Calculates the total amount vested since the start time. If after the endTime
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

    return vestedAmount;
  }

  /**
   * @dev Calculates the amount releasable. If the amount is less than the allowable amount
   * for each lock period zero will be returned. If more than the allowable amount each month will return
   * a multiple of the allowable amount each month
   * @param _amountWithdrawable The total amount vested so far less the amount that has been released so far
   * @param _startTimestamp The start time of for when vesting started
   * @param _endTimestamp The end time of for when vesting will be complete and all tokens available
   * @param _lockPeriod time interval (ins econds) in between vesting releases (example 30 days = 2592000 seconds)
   * @param _initialAmount The starting number of tokens vested
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

  /**
   * @dev Calculates the amount of the bonus that is releasable. If the amount is less than the allowable amount
   * for each lock period zero will be returned. It has been 30 days since the initial vesting has ended an amount
   * equal to the original releases will be returned.  If over 60 days the entire bonus can be released
   * @param _amountWithdrawable The total amount vested so far less the amount that has been released so far
   * @param _startTimestamp The start time of for when vesting started
   * @param _endTimestamp The end time of for when vesting will be complete and all tokens available
   * @param _lockPeriod time interval (ins econds) in between vesting releases (example 30 days = 2592000 seconds)
   * @param _initialAmount The starting number of tokens vested
   * @param _bonusBalance The current balance of the vested bonus
   */

  function calculateBonusWithdrawal(uint256 _startTimestamp, uint _endTimestamp, uint256 _lockPeriod, uint256 _initialAmount, uint256 _bonusBalance) internal view returns(uint256 _amountWithdrawable) {
    if (now >= _endTimestamp.add(30 days) && now < _endTimestamp.add(60 days)) {
      // calculate the number of time periods vesting is done over
      uint256 lockPeriods = (_endTimestamp.sub(_startTimestamp)).div(_lockPeriod);
      uint256 amountWithdrawablePerLockPeriod = SafeMath.div(_initialAmount, lockPeriods);
      
      if (_bonusBalance < amountWithdrawablePerLockPeriod) {
        return _bonusBalance;
      }
      
      return amountWithdrawablePerLockPeriod;
    } else if (now >= _endTimestamp.add(60 days)){
      return _bonusBalance;
    }

    return 0;
  }
}
