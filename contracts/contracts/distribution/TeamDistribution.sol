pragma solidity ^0.4.24;

import '../token/SafeERC20.sol';
import '../token/ERC20.sol';
import '../LightstreamToken.sol';
import '../utils/SafeMath.sol';
import '../utils/Ownable.sol';
import './MonthlyTokenVesting.sol';

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

  uint256 public constant INITIAL_SUPPLY =             300000000 * decimalFactor;
  uint256 public AVAILABLE_TOTAL_SUPPLY  =             135000000 * decimalFactor;
  uint256 public AVAILABLE_TEAM_SUPPLY   =              65424000 * decimalFactor; // 21.81% released over 24 months
  uint256 public AVAILABLE_SEED_INVESTORS_SUPPLY  =     36000000 * decimalFactor; // 12.00% released over 5 months
  uint256 public AVAILABLE_FOUNDERS_SUPPLY   =          15000000 * decimalFactor; //  5.00% released over 24 months
  uint256 public AVAILABLE_ADVISORS_SUPPLY   =            122100 * decimalFactor; //  0.04% released at Token Distribution (TD)
  uint256 public AVAILABLE_CONSULTANTS_SUPPLY   =        1891300 * decimalFactor; //  0.63% released at Token Distribution (TD)
  uint256 public AVAILABLE_OTHER_SUPPLY   =             16562600 * decimalFactor; //  5.52% released at Token Distribution (TD)

  uint256 public grandTotalClaimed = 0;
  uint256 public startTime;

  mapping (address => address) public ownerAddressToVestingContractAddress;

  // Allocation with vesting information
  struct Allocation {
    uint8 AllocationSupply; // Type of allocation
    uint256 endVesting;     // This is when the tokens are fully unvested
    uint256 totalAllocated; // Total tokens allocated
    uint256 amountClaimed;
    uint256 endCliff;
  }
  mapping (address => Allocation) public allocations;
  
  event LogNewAllocation(address indexed _recipient, AllocationType indexed _fromSupply, uint256 _totalAllocated, uint256 _grandTotalAllocated);
  event RevokedAllocation(address indexed _recipient);

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

  /**
    * @dev Allow the owner of the contract to assign a new allocation
    * @param _beneficiary The recipient of the allocation
    * @param _totalAllocated The total amount of LIGHTSTREAM available to the receipient (after vesting)
    * @param _supply The LIGHTSTREAM supply the allocation will be taken from
    */
  function setAllocation (address _beneficiary, uint256 _totalAllocated, AllocationType _supply) onlyOwner public {

    // check to make sure the recipients address current allocation is zero and that the amount being allocated is greater than zero
    require(ownerAddressToVestingContractAddress[_beneficiary] == 0 && _totalAllocated > 0);
    // check to make sure the address exists so tokens don't get burnt
    require(_beneficiary != address(0));
    address vestingContractAddress;

    if (_supply == AllocationType.TEAM) {
      AVAILABLE_TEAM_SUPPLY = AVAILABLE_TEAM_SUPPLY.sub(_totalAllocated);

      vestingContractAddress = new MonthlyTokenVesting(token, _beneficiary, now, now + 720 days, now, 30 days, _totalAllocated, true);
      token.safeTransfer(vestingContractAddress, _totalAllocated);

      ownerAddressToVestingContractAddress[_beneficiary] = vestingContractAddress;
      allocations[_beneficiary] = Allocation(uint8(AllocationType.TEAM), now + 720 days, _totalAllocated, 0, 0);
    } else if (_supply == AllocationType.SEED_INVESTORS) {
      AVAILABLE_SEED_INVESTORS_SUPPLY = AVAILABLE_SEED_INVESTORS_SUPPLY.sub(_totalAllocated);

      vestingContractAddress = new MonthlyTokenVesting(token, _beneficiary, now, now + 150 days, now, 30 days, _totalAllocated, true);
      token.safeTransfer(vestingContractAddress, _totalAllocated);

      ownerAddressToVestingContractAddress[_beneficiary] = vestingContractAddress;
      allocations[_beneficiary] = Allocation(uint8(AllocationType.SEED_INVESTORS), now + 150 days, _totalAllocated, 0, 0);
    } else if (_supply == AllocationType.FOUNDERS) {
      AVAILABLE_FOUNDERS_SUPPLY = AVAILABLE_FOUNDERS_SUPPLY.sub(_totalAllocated);

      vestingContractAddress = new MonthlyTokenVesting(token, _beneficiary, now, now + 720 days, now, 30 days, _totalAllocated, true);
      token.safeTransfer(vestingContractAddress, _totalAllocated);

      ownerAddressToVestingContractAddress[_beneficiary] = vestingContractAddress;
      allocations[_beneficiary] = Allocation(uint8(AllocationType.FOUNDERS), now + 720 days, _totalAllocated, 0, 0);
    } else if (_supply == AllocationType.ADVISORS) {
      AVAILABLE_ADVISORS_SUPPLY = AVAILABLE_ADVISORS_SUPPLY.sub(_totalAllocated);

      token.safeTransfer(_beneficiary, _totalAllocated);
      allocations[_beneficiary] = Allocation(uint8(AllocationType.ADVISORS), 0, _totalAllocated, 0, 0);
    } else if (_supply == AllocationType.CONSULTANTS) {
      AVAILABLE_CONSULTANTS_SUPPLY = AVAILABLE_CONSULTANTS_SUPPLY.sub(_totalAllocated);

      token.safeTransfer(_beneficiary, _totalAllocated);
      allocations[_beneficiary] = Allocation(uint8(AllocationType.CONSULTANTS), 0, _totalAllocated, 0, 0);
    } else if (_supply == AllocationType.OTHER) {
      AVAILABLE_OTHER_SUPPLY = AVAILABLE_OTHER_SUPPLY.sub(_totalAllocated);

      token.safeTransfer(_beneficiary, _totalAllocated);
      allocations[_beneficiary] = Allocation(uint8(AllocationType.OTHER), 0, _totalAllocated, 0, 0);
    }

    // Update the total available supply
    AVAILABLE_TOTAL_SUPPLY = AVAILABLE_TOTAL_SUPPLY.sub(_totalAllocated);
    // emit a Log New Allocation event
    emit LogNewAllocation(_beneficiary, _supply, _totalAllocated, grandTotalAllocated());
  }


  function revokeAllocation (address _beneficiary) onlyOwner public {
    require(ownerAddressToVestingContractAddress[_beneficiary] != address(0));

    address vestingContractAddress = ownerAddressToVestingContractAddress[_beneficiary];
    //Allocation storage revokedAllocation = allocations[_beneficiary];
    MonthlyTokenVesting monthlyVesting = MonthlyTokenVesting(vestingContractAddress);

    monthlyVesting.revoke();

    emit RevokedAllocation(_beneficiary);
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
