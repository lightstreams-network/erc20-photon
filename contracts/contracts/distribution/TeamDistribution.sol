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
contract TeamDistribution is Ownable {
  using SafeMath for uint256;
  using SafeERC20 for ERC20;

  ERC20 public token;

  uint256 private constant decimalFactor = 10 ** uint256(18);
  enum AllocationType { TEAM, SEED_INVESTORS, FOUNDERS, ADVISORS, CONSULTANTS, OTHER }

  uint256 public constant INITIAL_SUPPLY =             135000000 * decimalFactor;
  uint256 public AVAILABLE_TOTAL_SUPPLY  =             135000000 * decimalFactor;
  uint256 public AVAILABLE_TEAM_SUPPLY   =              65424000 * decimalFactor; // 21.81% released over 24 months
  uint256 public AVAILABLE_SEED_INVESTORS_SUPPLY  =     36000000 * decimalFactor; // 12.00% released over 5 months
  uint256 public AVAILABLE_FOUNDERS_SUPPLY   =          15000000 * decimalFactor; //  5.00% released over 24 months
  uint256 public AVAILABLE_ADVISORS_SUPPLY   =            122100 * decimalFactor; //  0.04% released at Token Distribution (TD)
  uint256 public AVAILABLE_CONSULTANTS_SUPPLY   =        1891300 * decimalFactor; //  0.63% released at Token Distribution (TD)
  uint256 public AVAILABLE_OTHER_SUPPLY   =             16562600 * decimalFactor; //  5.52% released at Token Distribution (TD)

  uint256 public grandTotalClaimed = 0;
  uint256 public startTime;

  /**
   * @dev Creates Allocation with vesting information
   * AllocationSupply Type of allocation
   * beneficiary address of the beneficiary to whom vested tokens are transferred
   * startTimestamp timestamp of when vesting begins
   * endTimestamp timestamp of when vesting ends
   * lockPeriod amount of time in seconds between withdrawal periods. (EG. 6 months or 1 month)
   * initialAmount - the initial amount of tokens to be vested.
   * revocable whether the vesting is revocable or not
   * revoked whether the vesting has been revoked or not
   */

  struct Allocation {
    uint8 AllocationSupply;
    uint256 startTimestamp;
    uint256 endTimestamp;
    uint256 lockPeriod;
    uint256 initialAmount;
    uint256 amountClaimed;
    uint256 balance;
    bool revocable;
    bool revoked;
  }
  mapping (address => Allocation) public allocations;
  
  event NewAllocation(address _recipient, AllocationType indexed _fromSupply, uint256 _totalAllocated, uint256 _grandTotalAllocated);
  event RevokedAllocation(address _recipient);
  event Released(address _recipient, uint256 _amount);
  event LogUint(string _type, uint256 _uint);

  /**
    * @dev Constructor function - Set the Lightstream token address
    * @param _startTime The time when Lightstream Distribution goes live
    */
  constructor(uint256 _startTime, ERC20 _lightstream) public {
    // make sure the start time is in the future
    require(_startTime >= now);
    // require that the total of the different pools is equal to the total supply
    require(AVAILABLE_TOTAL_SUPPLY == AVAILABLE_TEAM_SUPPLY.add(AVAILABLE_SEED_INVESTORS_SUPPLY).add(AVAILABLE_FOUNDERS_SUPPLY).add(AVAILABLE_ADVISORS_SUPPLY).add(AVAILABLE_CONSULTANTS_SUPPLY).add(AVAILABLE_OTHER_SUPPLY));
    startTime = _startTime;
    token = _lightstream;
  }

  function returnNow() public returns(uint){
    return now;
  }

  /**
    * @dev Allow the owner of the contract to assign a new allocation
    * @param _beneficiary The recipient of the allocation
    * @param _totalAllocated The total amount of LIGHTSTREAM available to the receipient (after vesting)
    * @param _supply The LIGHTSTREAM supply the allocation will be taken from
    */
  function setAllocation (address _beneficiary, uint256 _totalAllocated, AllocationType _supply) onlyOwner public {

    // check to make sure the recipients address current allocation is zero and that the amount being allocated is greater than zero
    require(_totalAllocated > 0);
    // check to make sure the address exists so tokens don't get burnt
    require(_beneficiary != address(0));
    Allocation memory allocation = allocations[_beneficiary];
    //prevent an allocation from being written over
    require(allocation.startTimestamp == 0);
    // TEAM
    if (_supply == AllocationType.TEAM) {
      require(_totalAllocated <= AVAILABLE_TEAM_SUPPLY);

      AVAILABLE_TEAM_SUPPLY = AVAILABLE_TEAM_SUPPLY.sub(_totalAllocated);

      allocations[_beneficiary] = Allocation(uint8(AllocationType.TEAM), now, now + 720 days, 30 days, _totalAllocated, 0, _totalAllocated, true, false);
    // SEED_INVESTORS
    } else if (_supply == AllocationType.SEED_INVESTORS) {
      require(_totalAllocated <= AVAILABLE_SEED_INVESTORS_SUPPLY);

      AVAILABLE_SEED_INVESTORS_SUPPLY = AVAILABLE_SEED_INVESTORS_SUPPLY.sub(_totalAllocated);

      allocations[_beneficiary] = Allocation(uint8(AllocationType.SEED_INVESTORS), now, now + 150 days, 30 days, _totalAllocated, 0, _totalAllocated, true, false);
    // FOUNDERS
    } else if (_supply == AllocationType.FOUNDERS) {
      require(_totalAllocated <= AVAILABLE_FOUNDERS_SUPPLY);

      AVAILABLE_FOUNDERS_SUPPLY = AVAILABLE_FOUNDERS_SUPPLY.sub(_totalAllocated);

      allocations[_beneficiary] = Allocation(uint8(AllocationType.FOUNDERS), now, now + 720 days, 30 days, _totalAllocated, 0, _totalAllocated, true, false);
    // ADVISORS
    } else if (_supply == AllocationType.ADVISORS) {
      require(_totalAllocated <= AVAILABLE_ADVISORS_SUPPLY);

      AVAILABLE_ADVISORS_SUPPLY = AVAILABLE_ADVISORS_SUPPLY.sub(_totalAllocated);

      token.safeTransfer(_beneficiary, _totalAllocated);
      allocations[_beneficiary] = Allocation(uint8(AllocationType.ADVISORS),now, now, 0 days, _totalAllocated, 0, 0, false, false);
     // CONSULTANTS
    } else if (_supply == AllocationType.CONSULTANTS) {
      require(_totalAllocated <= AVAILABLE_CONSULTANTS_SUPPLY);

      AVAILABLE_CONSULTANTS_SUPPLY = AVAILABLE_CONSULTANTS_SUPPLY.sub(_totalAllocated);

      token.safeTransfer(_beneficiary, _totalAllocated);
      allocations[_beneficiary] = Allocation(uint8(AllocationType.CONSULTANTS),now, now, 0 days, _totalAllocated, 0, 0, false, false);
    // OTHER
    } else if (_supply == AllocationType.OTHER) {
      require(_totalAllocated <= AVAILABLE_OTHER_SUPPLY);

      AVAILABLE_OTHER_SUPPLY = AVAILABLE_OTHER_SUPPLY.sub(_totalAllocated);

      token.safeTransfer(_beneficiary, _totalAllocated);
      allocations[_beneficiary] = Allocation(uint8(AllocationType.OTHER), now, now, 0 days, _totalAllocated, 0, 0, false, false);
    }

    // Update the total available supply
    AVAILABLE_TOTAL_SUPPLY = AVAILABLE_TOTAL_SUPPLY.sub(_totalAllocated);
    // emit a Log New Allocation event
    emit NewAllocation(_beneficiary, _supply, _totalAllocated, grandTotalAllocated());
  }



  function release(address _beneficiary) public {
    require(startTime <= now);
    require(allocations[_beneficiary].balance > 0);
    require(msg.sender == _beneficiary);

    Allocation memory allocation = allocations[_beneficiary];
    uint256 totalAmountVested = calculateTotalAmountVested(_beneficiary, allocation.startTimestamp, allocation.endTimestamp, allocation.initialAmount);
    uint256 amountWithdrawable = totalAmountVested.sub(allocation.amountClaimed);
    uint256 releasable = withdrawalAllowed(amountWithdrawable,  allocation.startTimestamp, allocation.endTimestamp, allocation.lockPeriod, allocation.initialAmount);

      if(releasable > 0) {
        allocations[_beneficiary].amountClaimed = allocation.amountClaimed.add(releasable);
        allocations[_beneficiary].balance = allocation.balance.sub(releasable);

        token.safeTransfer(_beneficiary, releasable);

        emit Released(_beneficiary, releasable);
      }
  }

  function revokeAllocation (address _beneficiary) onlyOwner public {
    Allocation memory allocation = allocations[_beneficiary];

    require(allocation.revocable == true);

    uint256 balance = token.balanceOf(_beneficiary);
    uint256 totalAmountVested = calculateTotalAmountVested(_beneficiary, allocation.startTimestamp, allocation.endTimestamp, allocation.initialAmount);
    uint256 amountWithdrawable = totalAmountVested.sub(allocation.amountClaimed);

    uint256 refundable = withdrawalAllowed(amountWithdrawable,  allocation.startTimestamp, allocation.endTimestamp, allocation.lockPeriod, allocation.initialAmount);
    emit LogUint('balance', balance);
    emit LogUint('refundable', refundable);


    uint256 backToProjectWallet = allocation.balance.sub(refundable);
    emit LogUint('backToProjectWallet', backToProjectWallet);

    if(refundable > 0) {
      token.safeTransfer(_beneficiary, refundable);

      allocations[_beneficiary].amountClaimed = allocation.amountClaimed.add(refundable);
      allocations[_beneficiary].balance = 0;

      emit Released(_beneficiary, refundable);
    }

    AVAILABLE_OTHER_SUPPLY = AVAILABLE_OTHER_SUPPLY.add(backToProjectWallet);
    emit RevokedAllocation(_beneficiary);
  }

  /**
 * @notice Calculates the total amount vested since the start time. If after the endTime
 * the entire balance is returned
 */

  function calculateTotalAmountVested(address _beneficiary, uint256 _startTimestamp, uint256 _endTimestamp, uint256 _initialAmount) internal view returns (uint256 _amountVested) {
    // If it's past the end time, the whole amount is available.
    if (now >= _endTimestamp) {
      return allocations[_beneficiary].initialAmount;
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

  function withdrawalAllowed(uint256 _amountWithdrawable, uint256 _startTimestamp, uint256 _endTimestamp, uint256 _lockPeriod, uint256 _initialAmount) internal view returns(uint256) {
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

  // Returns the amount of LIGHTSTREAM allocated
  function grandTotalAllocated() public view returns (uint256) {
    return INITIAL_SUPPLY - AVAILABLE_TOTAL_SUPPLY;
  }

  // Allow transfer of accidentally sent ERC20 tokens
  function refundTokens(address _recipient, address _token) public onlyOwner {
    require(_token != address(token));
    ERC20 refundToken = ERC20(_token);
    uint256 balance = refundToken.balanceOf(this);
    require(refundToken.transfer(_recipient, balance));
  }
}
