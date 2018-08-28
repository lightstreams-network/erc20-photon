pragma solidity ^0.4.24;

import "../token/SafeERC20.sol";
import "../utils/Ownable.sol";
import "../utils/SafeMath.sol";
import "../distribution/MonthlyVestingWithBonus.sol";

contract TokenEscrow is Ownable, MonthlyVestingWithBonus {
  using SafeERC20 for ERC20;
  using SafeMath for uint256;

  enum EscrowStatus { Pending, Completed, Refunded }

  event EscrowCreation(address indexed contributor, uint256 value);
  event EscrowCompletion(address indexed contributor, uint256 value, EscrowStatus status);

  struct Escrow {
    address contributor;
    uint256 purchaseAmount;
    uint256 bonusAmount;
    EscrowStatus status;
    bool refunded;
  }

  mapping(address => Escrow) public escrows;

  ERC20 public token;
  address public projectWallet;

  constructor(ERC20 _tokenAddress, address _projectWallet) public {
    token = _tokenAddress;
    projectWallet = _projectWallet;
  }

  function createEscrow(address _contributor, uint256 _purchaseAmount, uint256 _bonusAmount) internal onlyOwner {
    escrows[_contributor] = Escrow(_contributor, _purchaseAmount, _bonusAmount, EscrowStatus.Pending, false);
    emit EscrowCreation(_contributor, _purchaseAmount);
  }


  function getEscrowData(address _contributor) public view onlyOwner
    returns(
      address contributor,
      uint256 purchaseAmount,
      uint256 bonusAmount,
      EscrowStatus status,
      bool refunded
    ) {
    Escrow storage escrow = escrows[_contributor];
    return (
      escrow.contributor,
      escrow.purchaseAmount,
      escrow.bonusAmount,
      escrow.status,
      escrow.refunded
    );
  }

  function refund(address _contributor) public onlyOwner {
    Escrow storage escrow = escrows[_contributor];
    uint256 transferAmount = escrow.purchaseAmount.add(escrow.bonusAmount);

    //token.transfer(projectWallet, transferAmount);
    emit EscrowCompletion(_contributor, transferAmount, EscrowStatus.Refunded);
  }

  function completeAndVest(address _contributor) public onlyOwner {
    Escrow storage escrow = escrows[_contributor];
    uint256 transferAmount = escrow.purchaseAmount.add(escrow.bonusAmount);

    setVestingSchedule(_contributor, escrow.purchaseAmount, escrow.bonusAmount);

    emit EscrowCompletion(escrow.contributor, transferAmount, EscrowStatus.Completed);
  }
}