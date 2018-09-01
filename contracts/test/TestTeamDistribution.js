let LightstreamToken = artifacts.require("LightstreamToken");
let TeamDistribution = artifacts.require("distribution/TeamDistribution");
let LightstreamCrowdsale = artifacts.require("LightstreamCrowdsale");


const timeTravel = function (time) {
  return new Promise((resolve, reject) => {
      web3.currentProvider.sendAsync({
      jsonrpc: "2.0",
      method: "evm_increaseTime",
      params: [time], // 86400 is num seconds in day
      id: new Date().getTime()
    }, (err, result) => {
      if(err){ return reject(err) }
      return resolve(result)
    });
  })
};

const mineBlock = function () {
  return new Promise((resolve, reject) => {
      web3.currentProvider.sendAsync({
      jsonrpc: "2.0",
      method: "evm_mine"
    }, (err, result) => {
      if(err){ return reject(err) }
      return resolve(result)
    });
  })
};

const convertFromBnToInt = function(bn) {
  return Number(web3._extend.utils.fromWei(bn.toNumber(), 'ether'));
}


// Team Distribution Constants
const AVAILABLE_TOTAL_SUPPLY  =          135000000; // Initial amount minted and transfer to team distribution contract
const AVAILABLE_TEAM_SUPPLY   =           65424000; // 21.81% released over 24 months
const AVAILABLE_SEED_INVESTORS_SUPPLY =   36000000; // 12.00% released over 5 months
const AVAILABLE_FOUNDERS_SUPPLY   =       15000000; //  5.00% released over 24 months
const AVAILABLE_ADVISORS_SUPPLY   =         122100; //  0.04% released at Token Distribution (TD)
const AVAILABLE_CONSULTANTS_SUPPLY   =     1891300; //  0.63% released at Token Distribution (TD)
const AVAILABLE_OTHER_SUPPLY   =          16562600; //  5.52% released at Token Distribution (TD)


// Team Distribution Constants
const TEAM_SUPPLY_ID = 0;
const SEED_INVESTORS_SUPPLY_ID = 1;
const FOUNDERS_SUPPLY_ID = 2;
const ADVISORS_SUPPLY_ID = 3;
const CONSULTANTS_SUPPLY_ID = 4;
const OTHER_SUPPLY_ID = 5;

const ALLOCATION = {
  AllocationSupply: 0,
  startTimestamp: 1,
  endTimestamp: 2,
  lockPeriod: 3,
  initialAmount: 4,
  amountClaimed: 5,
  balance: 6,
  revocable: 7,
  revoked: 8
}

contract('LightstreamToken', async (accounts)=> {
  it('should deploy the token and store the address', async ()=> {
    const tokenInstance = await LightstreamToken.deployed();

    assert(tokenInstance.address, 'Token address couldn\'t be stored');
  });

  it('should transfer the ownership to the crowdsale contract', async ()=> {
      const instance = await LightstreamToken.deployed();
      const data = await instance.transferOwnership(LightstreamCrowdsale.address);
      const owner = await instance.owner();

      assert.equal(LightstreamCrowdsale.address, owner);
  });

});


contract('Team Distribution', async (accounts)=> {
  const OWNER_ACCOUNT =         accounts[0];
  const TEAM_MEMEBER_ACCOUNT =  accounts[1];
  const SEED_INVESTOR_ACCOUNT = accounts[2];
  const FOUNDER_ACCOUNT =       accounts[3];
  const ADVISOR_ACCOUNT =       accounts[4];
  const CONSULTANT_ACCOUNT =    accounts[5];
  const OTHER_ACCOUNT =         accounts[6];
  const CONTRIBUTOR_1_ACCOUNT = accounts[7];
  const CONTRIBUTOR_2_ACCOUNT = accounts[8];
  const NEW_ACCOUNT   =         accounts[9];

  it('should deploy the Team Distribution contract and store the address', async ()=>{
    const teamDistributionInstance = await TeamDistribution.deployed();

    assert(teamDistributionInstance.address, 'Token address couldn\'t be stored');
  });

  it('When finalize is called on the sales contract the team contract gets 135 million PTH', async ()=>{
    const crowdsalesInstance = await LightstreamCrowdsale.deployed();
    const tokenInstance = await LightstreamToken.deployed();
    const data = await tokenInstance.transferOwnership(LightstreamCrowdsale.address);

    const timeTravelTransaction = await timeTravel(3600 * 24 * 32); // Travel 32 days into the future so sale has finished
    const mineBlockTransaction = await mineBlock(); // workaround for https://github.com/ethereumjs/testrspc/issues/336

    const closingTime = await crowdsalesInstance.closingTime.call();
    const hasClosed = await crowdsalesInstance.hasClosed.call();
    const returnTimestamp = await crowdsalesInstance.returnTimestamp.call();

    const finalize = await crowdsalesInstance.finalize({from: OWNER_ACCOUNT});
    const crowdsaleBalanceBN = await tokenInstance.balanceOf(TeamDistribution.address);

    const crowdsaleBalance = convertFromBnToInt(crowdsaleBalanceBN);

    assert(crowdsaleBalance, 135000000);
  });

  it('The owner can create an allocation from the team supply', async ()=> {
    const teamDistributionInstance = await TeamDistribution.deployed();
    const PHT = web3._extend.utils.toWei('240', 'ether');

    const teamSupplyBeforeBN = await teamDistributionInstance.AVAILABLE_TEAM_SUPPLY.call();

    const transaction = await teamDistributionInstance.setAllocation(TEAM_MEMEBER_ACCOUNT, PHT, TEAM_SUPPLY_ID);
    const teamMemberAllocationData = await teamDistributionInstance.allocations(TEAM_MEMEBER_ACCOUNT);

    const teamSupplyAfterBN = await teamDistributionInstance.AVAILABLE_TEAM_SUPPLY.call();

    const teamMemberAllocation = convertFromBnToInt(teamMemberAllocationData[4]);

    const teamSupplyBefore = convertFromBnToInt(teamSupplyBeforeBN);
    const teamSupplyAfter = convertFromBnToInt(teamSupplyAfterBN);

    const grandTotalAllocatedBN = await teamDistributionInstance.grandTotalAllocated.call();
    const grandTotalAllocated = convertFromBnToInt(grandTotalAllocatedBN);

    assert.equal(AVAILABLE_TEAM_SUPPLY, teamSupplyBefore);
    assert.equal(teamMemberAllocation, 240);
    assert.equal(teamSupplyBefore - teamMemberAllocation, teamSupplyAfter);
    assert.equal(240, grandTotalAllocated);
  });

  it('The owner can not create an allocation from the team supply greater than the amount allocated to it', async ()=> {
    const teamDistributionInstance = await TeamDistribution.deployed();
    const PHT = web3._extend.utils.toWei(AVAILABLE_TEAM_SUPPLY + 100, 'ether');

    try {
      const transaction = await teamDistributionInstance.setAllocation(SEED_INVESTOR_ACCOUNT, PHT, TEAM_SUPPLY_ID);

      assert(false, true);
    } catch(error){
      assert(error);
    }

  });

  it('The only the owner can create an allocation from the team supply', async ()=> {
    try {
      const teamDistributionInstance = await TeamDistribution.deployed();
      const PHT = web3._extend.utils.toWei('240', 'ether');

      const transaction = await teamDistributionInstance.setAllocation(FOUNDER_ACCOUNT, PHT, TEAM_SUPPLY_ID, {from: SEED_INVESTOR_ACCOUNT});

      assert(false, true);
    } catch(error){
      assert(error);
    }
  });

  it('The owner can not create an allocation for an address that already has an allocation', async ()=> {
    try {
      const teamDistributionInstance = await TeamDistribution.deployed();
      const PHT = web3._extend.utils.toWei('240', 'ether');

      const transaction = await teamDistributionInstance.setAllocation(TEAM_MEMEBER_ACCOUNT, PHT, TEAM_SUPPLY_ID);

      assert(false, true);
    } catch(error){
      assert(error);
    }
  });


  it('The owner can create an allocation from the seed investors supply', async ()=> {
    const teamDistributionInstance = await TeamDistribution.deployed();
    const PHT = web3._extend.utils.toWei('500', 'ether');

    const seedInvestorSupplyBeforeBN = await teamDistributionInstance.AVAILABLE_SEED_INVESTORS_SUPPLY.call();
    const grandTotalAllocatedBeforeBN = await teamDistributionInstance.grandTotalAllocated.call();

    const setAllocationTransaction = await teamDistributionInstance.setAllocation(SEED_INVESTOR_ACCOUNT, PHT, SEED_INVESTORS_SUPPLY_ID);
    const seedInvestorAllocationData = await teamDistributionInstance.allocations(SEED_INVESTOR_ACCOUNT);

    const seedInvestorSupplyAfterBN = await teamDistributionInstance.AVAILABLE_SEED_INVESTORS_SUPPLY.call();
    const grandTotalAllocatedAfterBN = await teamDistributionInstance.grandTotalAllocated.call();
    const seedInvestorAllocation = convertFromBnToInt(seedInvestorAllocationData[4]);

    const seedInvestorSupplyBefore = convertFromBnToInt(seedInvestorSupplyBeforeBN);
    const seedInvestorSupplyAfter = convertFromBnToInt(seedInvestorSupplyAfterBN);
    const grandTotalAllocatedBefore = convertFromBnToInt(grandTotalAllocatedBeforeBN);
    const grandTotalAllocatedAfter = convertFromBnToInt(grandTotalAllocatedAfterBN);

    assert.equal(AVAILABLE_SEED_INVESTORS_SUPPLY, seedInvestorSupplyBefore);
    assert.equal(seedInvestorAllocation, 500);
    assert.equal(seedInvestorSupplyBefore - seedInvestorAllocation, seedInvestorSupplyAfter);
    assert.equal(grandTotalAllocatedBefore + 500 , grandTotalAllocatedAfter);
  });

  it('The owner can not create an allocation from the seed investor supply greater than the amount allocated to it', async ()=> {
    const teamDistributionInstance = await TeamDistribution.deployed();
    const PHT = web3._extend.utils.toWei(AVAILABLE_SEED_INVESTORS_SUPPLY + 100, 'ether');

    try {
      const transaction = await teamDistributionInstance.setAllocation(FOUNDER_ACCOUNT, PHT, SEED_INVESTORS_SUPPLY_ID);

      assert(false, true);
    } catch(error){
      assert(error);
    }

  });

  it('The owner can create an allocation from the founders supply', async ()=> {
    const teamDistributionInstance = await TeamDistribution.deployed();
    const PHT = web3._extend.utils.toWei('240', 'ether');

    const founderAllocationDataBefore = await teamDistributionInstance.allocations(FOUNDER_ACCOUNT);

    const foundersSupplyBeforeBN = await teamDistributionInstance.AVAILABLE_FOUNDERS_SUPPLY.call();

    const setAllocationTransaction = await teamDistributionInstance.setAllocation(FOUNDER_ACCOUNT, PHT, FOUNDERS_SUPPLY_ID);
    const founderAllocationData = await teamDistributionInstance.allocations(FOUNDER_ACCOUNT);

    const founderSupplyAfterBN = await teamDistributionInstance.AVAILABLE_FOUNDERS_SUPPLY.call();

    const founderAllocation = convertFromBnToInt(founderAllocationData[4]);

    const founderSupplyBefore = convertFromBnToInt(foundersSupplyBeforeBN);
    const founderSupplyAfter = convertFromBnToInt(founderSupplyAfterBN);

    assert.equal(AVAILABLE_FOUNDERS_SUPPLY, founderSupplyBefore);
    assert.equal(founderAllocation, 240);
    assert.equal(founderSupplyBefore - founderAllocation, founderSupplyAfter);
  });

  it('The owner can not create an allocation from the founders supply greater than the amount allocated to it', async ()=> {
    const teamDistributionInstance = await TeamDistribution.deployed();
    const PHT = web3._extend.utils.toWei(AVAILABLE_FOUNDERS_SUPPLY + 100, 'ether');

    try {
      const transaction = await teamDistributionInstance.setAllocation(NEW_ACCOUNT, PHT, FOUNDERS_SUPPLY_ID);

      assert(false, true);
    } catch(error){
      assert(error);
    }

  });


  it('The owner can create an allocation from the advisors supply', async ()=> {
    const teamDistributionInstance = await TeamDistribution.deployed();
    const tokenInstance = await LightstreamToken.deployed();
    const PHT = web3._extend.utils.toWei('100', 'ether');

    const advisorsSupplyBeforeBN = await teamDistributionInstance.AVAILABLE_ADVISORS_SUPPLY.call();

    const setAllocationTransaction = await teamDistributionInstance.setAllocation(ADVISOR_ACCOUNT, PHT, ADVISORS_SUPPLY_ID);
    const advisorAllocationData = await teamDistributionInstance.allocations(ADVISOR_ACCOUNT);

    const advisorSupplyAfterBN = await teamDistributionInstance.AVAILABLE_ADVISORS_SUPPLY.call();

    const advisorAllocation = convertFromBnToInt(advisorAllocationData[4]);

    const advisorsSupplyBefore = convertFromBnToInt(advisorsSupplyBeforeBN);
    const advisorsSupplyAfter = convertFromBnToInt(advisorSupplyAfterBN);

    const advisorAccountBalanceBN = await tokenInstance.balanceOf(ADVISOR_ACCOUNT);
    const advisorAccountBalance = convertFromBnToInt(advisorAccountBalanceBN);

    assert.equal(AVAILABLE_ADVISORS_SUPPLY, advisorsSupplyBefore);
    assert.equal(advisorAllocation, 100);
    assert.equal(advisorAccountBalance, 100);
    assert.equal(advisorsSupplyBefore - advisorAllocation, advisorsSupplyAfter);
  });

  it('The owner can not create an allocation from the advisors supply greater than the amount allocated to it', async ()=> {
    const teamDistributionInstance = await TeamDistribution.deployed();
    const PHT = web3._extend.utils.toWei(AVAILABLE_ADVISORS_SUPPLY + 1000, 'ether');

    try {
      const transaction = await teamDistributionInstance.setAllocation(NEW_ACCOUNT, PHT, ADVISORS_SUPPLY_ID);

      assert(false, true);
    } catch(error){
      assert(error);
    }
  });

  it('The owner can create an allocation from the consultants supply', async ()=> {
    const teamDistributionInstance = await TeamDistribution.deployed();
    const tokenInstance = await LightstreamToken.deployed();
    const PHT = web3._extend.utils.toWei('100', 'ether');

    const consultantSupplyBeforeBN = await teamDistributionInstance.AVAILABLE_CONSULTANTS_SUPPLY.call();

    const setAllocationTransaction = await teamDistributionInstance.setAllocation(CONSULTANT_ACCOUNT, PHT, CONSULTANTS_SUPPLY_ID);
    const consultantAllocationData = await teamDistributionInstance.allocations(CONSULTANT_ACCOUNT);

    const consultantSupplyAfterBN = await teamDistributionInstance.AVAILABLE_CONSULTANTS_SUPPLY.call();

    const consultantAllocation = convertFromBnToInt(consultantAllocationData[4]);

    const consultantSupplyBefore = convertFromBnToInt(consultantSupplyBeforeBN);
    const consultantSupplyAfter = convertFromBnToInt(consultantSupplyAfterBN);

    const consultantAccountBalanceBN = await tokenInstance.balanceOf(CONSULTANT_ACCOUNT);
    const consultantAccountBalance = convertFromBnToInt(consultantAccountBalanceBN);

    assert.equal(AVAILABLE_CONSULTANTS_SUPPLY, consultantSupplyBefore);
    assert.equal(consultantAllocation, 100);
    assert.equal(consultantAccountBalance, 100);
    assert.equal(consultantSupplyBefore - consultantAllocation, consultantSupplyAfter);
  });

  it('The owner can not create an allocation from the consultants supply greater than the amount allocated to it', async ()=> {
    const teamDistributionInstance = await TeamDistribution.deployed();
    const PHT = web3._extend.utils.toWei(AVAILABLE_CONSULTANTS_SUPPLY + 100, 'ether');

    try {
      const transaction = await teamDistributionInstance.setAllocation(NEW_ACCOUNT, PHT, CONSULTANTS_SUPPLY_ID);

      assert(false, true);
    } catch(error){
      assert(error);
    }
  });

  it('The owner can create an allocation from the others supply', async ()=> {
    const teamDistributionInstance = await TeamDistribution.deployed();
    const tokenInstance = await LightstreamToken.deployed();
    const PHT = web3._extend.utils.toWei('100', 'ether');

    const otherSupplyBeforeBN = await teamDistributionInstance.AVAILABLE_OTHER_SUPPLY.call();

    const setAllocationTransaction = await teamDistributionInstance.setAllocation(OTHER_ACCOUNT, PHT, OTHER_SUPPLY_ID);
    const otherAllocationData = await teamDistributionInstance.allocations(OTHER_ACCOUNT);

    const otherSupplyAfterBN = await teamDistributionInstance.AVAILABLE_OTHER_SUPPLY.call();

    const otherAllocation = convertFromBnToInt(otherAllocationData[4]);

    const otherSupplyBefore = convertFromBnToInt(otherSupplyBeforeBN);
    const otherSupplyAfter = convertFromBnToInt(otherSupplyAfterBN);

    const otherAccountBalanceBN = await tokenInstance.balanceOf(OTHER_ACCOUNT);
    const otherAccountBalance = convertFromBnToInt(otherAccountBalanceBN);

    assert.equal(AVAILABLE_OTHER_SUPPLY, otherSupplyBefore);
    assert.equal(otherAllocation, 100);
    assert.equal(otherAccountBalance, 100);
    assert.equal(otherSupplyBefore - otherAllocation, otherSupplyAfter);
  });


  it('The owner can not create an allocation from the other supply greater than the amount allocated to it', async ()=> {
    const teamDistributionInstance = await TeamDistribution.deployed();
    const PHT = web3._extend.utils.toWei(AVAILABLE_OTHER_SUPPLY + 1000, 'ether');

    try {
      const transaction = await teamDistributallocationDataAfterionInstance.setAllocation(NEW_ACCOUNT, PHT, CONSULTANTS_SUPPLY_ID);

      assert(false, true);
    } catch(error){
      assert(error);
    }
  });

  it('The team memeber can release their vested amount', async ()=> {
    const teamDistributionInstance = await TeamDistribution.deployed();
    const tokenInstance = await LightstreamToken.deployed();

    const timeTravelTransaction = await timeTravel(3600 * 24 * 30 * 3); // Travel 3 months into the future for testing
    await mineBlock();
    // Get the Team Member's allocation data before the they release the veted amount
    const allocationDataBefore = await teamDistributionInstance.allocations(TEAM_MEMEBER_ACCOUNT);
    const balanceBeforeRelease = convertFromBnToInt(allocationDataBefore[6]);
    // Team member call function to release the vested amount to their wallet
    const released = await teamDistributionInstance.release(TEAM_MEMEBER_ACCOUNT, {from: TEAM_MEMEBER_ACCOUNT});
    // Check the token for the balance of the team memeber's account
    const teamMemeberAccountBalanceBN = await tokenInstance.balanceOf(TEAM_MEMEBER_ACCOUNT);
    const teamMemeberAccountBalance = convertFromBnToInt(teamMemeberAccountBalanceBN);
    // Get the team memember's updated allocation data after vesting
    const allocationDataAfter = await teamDistributionInstance.allocations(TEAM_MEMEBER_ACCOUNT);
    const balanceAfterRelease = convertFromBnToInt(allocationDataAfter[ALLOCATION.balance]);
    const amountClaimedAfterRelease = convertFromBnToInt(allocationDataAfter[ALLOCATION.amountClaimed]);

    // team memeber allocation was originally 240 if 3 months pass they
    // should be allowed to withdraw 30 PTH
    assert.equal(teamMemeberAccountBalance, 30);
    assert.equal(amountClaimedAfterRelease, 30);
    assert.equal(balanceBeforeRelease - teamMemeberAccountBalance, balanceAfterRelease);

  });

  it('The seed investor can release their vested amount', async ()=> {
    const teamDistributionInstance = await TeamDistribution.deployed();
    const tokenInstance = await LightstreamToken.deployed();

    const allocationDataBefore = await teamDistributionInstance.allocations(SEED_INVESTOR_ACCOUNT);
    const allocationBalanceBeforeRelease = convertFromBnToInt(allocationDataBefore[ALLOCATION.balance]);

    const released = await teamDistributionInstance.release(SEED_INVESTOR_ACCOUNT, {from: SEED_INVESTOR_ACCOUNT});

    const accountBalanceBN = await tokenInstance.balanceOf(SEED_INVESTOR_ACCOUNT);
    const accountBalance = convertFromBnToInt(accountBalanceBN);

    const allocationDataAfter = await teamDistributionInstance.allocations(SEED_INVESTOR_ACCOUNT);
    const allocationBalanceAfterRelease = convertFromBnToInt(allocationDataAfter[ALLOCATION.balance]);
    const amountClaimedAfterRelease = convertFromBnToInt(allocationDataAfter[ALLOCATION.amountClaimed]);

    // seed investor allocation was originally 500 PTH if 3 months pass they
    // should be allowed to withdraw 300 PTH
    assert.equal(300, accountBalance, 'The seed investor\'s ballance in their account is wrong');
    assert.equal(300, amountClaimedAfterRelease, 'The seed investor\'s ballance in their allocation after releasing is wrong');
    assert.equal(allocationBalanceBeforeRelease - accountBalance, allocationBalanceAfterRelease, 'The amount the investor has in their account and allcation after is not matching');

  });

  it('The founder can release their vested amount', async ()=> {
    const teamDistributionInstance = await TeamDistribution.deployed();
    const tokenInstance = await LightstreamToken.deployed();

    const allocationDataBefore = await teamDistributionInstance.allocations(FOUNDER_ACCOUNT);
    const allocationBalanceBeforeRelease = convertFromBnToInt(allocationDataBefore[ALLOCATION.balance]);

    const released = await teamDistributionInstance.release(FOUNDER_ACCOUNT, {from: FOUNDER_ACCOUNT});

    const accountBalanceBN = await tokenInstance.balanceOf(FOUNDER_ACCOUNT);
    const accountBalance = convertFromBnToInt(accountBalanceBN);

    const allocationDataAfter = await teamDistributionInstance.allocations(FOUNDER_ACCOUNT);
    const allocationBalanceAfterRelease = convertFromBnToInt(allocationDataAfter[ALLOCATION.balance]);
    const amountClaimedAfterRelease = convertFromBnToInt(allocationDataAfter[ALLOCATION.amountClaimed]);

    // The founder allocation was originally 240 PTH if 3 months pass they
    // should be allowed to withdraw 30 PTH
    assert.equal(30, accountBalance, 'The founder\'s ballance in their account is wrong');
    assert.equal(30, amountClaimedAfterRelease, 'The founder\'s ballance in their allocation after releasing is wrong');
    assert.equal(allocationBalanceBeforeRelease - accountBalance, allocationBalanceAfterRelease, 'The amount the investor has in their account and allcation after is not matching');

  });

  it('The someone other than the team memeber can not release the vested amount', async ()=> {
    const teamDistributionInstance = await TeamDistribution.deployed();

    const nowBefore = await teamDistributionInstance.returnNow.call();
    try {
      const released = await teamDistributionInstance.release(TEAM_MEMEBER_ACCOUNT, {from: SEED_INVESTOR_ACCOUNT});
    } catch (error){
      assert(error);
    }
  });

  it('The the owner can revoke a seed investor\'s vesting', async ()=> {
    const teamDistributionInstance = await TeamDistribution.deployed();
    const tokenInstance = await LightstreamToken.deployed();

    const timeTravelTransaction = await timeTravel(3600 * 24 * 30 * 1); // Travel 1 month into the future for testing
    await mineBlock();

    // Get balances before revoking
    const otherBalanceBeforeBN = await teamDistributionInstance.AVAILABLE_OTHER_SUPPLY.call();
    const allocationDataBefore = await teamDistributionInstance.allocations(SEED_INVESTOR_ACCOUNT);
    // revoke vesting
    const revokeAllocation = await teamDistributionInstance.revokeAllocation(SEED_INVESTOR_ACCOUNT);
    // Get balances after revoking
    const otherBalanceAfterBN = await teamDistributionInstance.AVAILABLE_OTHER_SUPPLY.call();
    const allocationDataAfter = await teamDistributionInstance.allocations(SEED_INVESTOR_ACCOUNT);
    const seedInvestorBalanceBN = await tokenInstance.balanceOf(SEED_INVESTOR_ACCOUNT);

    // convert from Big Number to an integer
    const otherBalanceBefore = convertFromBnToInt(otherBalanceBeforeBN);
    const otherBalanceAfter = convertFromBnToInt(otherBalanceAfterBN);

    const allocationBalanceBefore = convertFromBnToInt(allocationDataBefore[ALLOCATION.balance]);
    const amountClaimedBefore = convertFromBnToInt(allocationDataBefore[ALLOCATION.amountClaimed]);
    const allocationBalanceAfter = convertFromBnToInt(allocationDataAfter[ALLOCATION.balance]);

    const amountClaimedAfter = convertFromBnToInt(allocationDataAfter[ALLOCATION.amountClaimed]);
    const seedInvestorBalance = convertFromBnToInt(seedInvestorBalanceBN);
    const addedToOtherBalance = allocationBalanceBefore + amountClaimedBefore - amountClaimedAfter;

    assert.equal(amountClaimedAfter, 400);
    assert.equal(seedInvestorBalance, 400);
    assert.equal(seedInvestorBalance, amountClaimedAfter);
    assert.equal(allocationBalanceAfter, 0);
    assert.equal(otherBalanceBefore + addedToOtherBalance, otherBalanceAfter);
  });

  it('The team memeber can release all their vested funds when the vesting time is complete', async ()=> {
    const teamDistributionInstance = await TeamDistribution.deployed();
    const tokenInstance = await LightstreamToken.deployed();

    const allocationDataBefore = await teamDistributionInstance.allocations(TEAM_MEMEBER_ACCOUNT);
    const allocationBalanceBeforeRelease = convertFromBnToInt(allocationDataBefore[6]);
    const teamMemeberAccountBalanceBeforeBN = await tokenInstance.balanceOf(TEAM_MEMEBER_ACCOUNT);
    const teamMemeberAccountBalanceBefore = convertFromBnToInt(teamMemeberAccountBalanceBeforeBN);

    // TRAVEL FORWARD IN TIME 24 MONTHS
    const timeTravelTransaction = await timeTravel(3600 * 24 * 30 * 24); // Travel 24 months into the future for testing
    await mineBlock();

    const released = await teamDistributionInstance.release(TEAM_MEMEBER_ACCOUNT, {from: TEAM_MEMEBER_ACCOUNT});

    const teamMemeberAccountBalanceAfterBN = await tokenInstance.balanceOf(TEAM_MEMEBER_ACCOUNT);
    const teamMemeberAccountBalanceAfter = convertFromBnToInt(teamMemeberAccountBalanceAfterBN);

    const allocationDataAfter = await teamDistributionInstance.allocations(TEAM_MEMEBER_ACCOUNT);
    const allocationBalanceAfterRelease = convertFromBnToInt(allocationDataAfter[ALLOCATION.balance]);
    const amountClaimedAfterRelease = convertFromBnToInt(allocationDataAfter[ALLOCATION.amountClaimed]);

    // team memeber allocation was originally 240 PTH
    assert.equal(teamMemeberAccountBalanceAfter, 240);
    assert.equal(amountClaimedAfterRelease, 240);
    assert.equal(allocationBalanceAfterRelease, 0);

  });

  it('The founder can release all their vested funds when the vesting time is complete', async ()=> {
    const teamDistributionInstance = await TeamDistribution.deployed();
    const tokenInstance = await LightstreamToken.deployed();

    const allocationDataBefore = await teamDistributionInstance.allocations(FOUNDER_ACCOUNT);
    const allocationBalanceBeforeRelease = convertFromBnToInt(allocationDataBefore[6]);
    const accountBalanceBeforeBN = await tokenInstance.balanceOf(FOUNDER_ACCOUNT);
    const accountBalanceBefore = convertFromBnToInt(accountBalanceBeforeBN);

    const released = await teamDistributionInstance.release(FOUNDER_ACCOUNT, {from: FOUNDER_ACCOUNT});

    const accountBalanceAfterBN = await tokenInstance.balanceOf(FOUNDER_ACCOUNT);
    const accountBalanceAfter = convertFromBnToInt(accountBalanceAfterBN);

    const allocationDataAfter = await teamDistributionInstance.allocations(FOUNDER_ACCOUNT);
    const allocationBalanceAfterRelease = convertFromBnToInt(allocationDataAfter[ALLOCATION.balance]);
    const amountClaimedAfterRelease = convertFromBnToInt(allocationDataAfter[ALLOCATION.amountClaimed]);

    // team memeber allocation was originally 240 PTH
    assert.equal(accountBalanceAfter, 240);
    assert.equal(amountClaimedAfterRelease, 240);
    assert.equal(allocationBalanceAfterRelease, 0);

  });


  it('The only the owner can revoke a team memeber\'s vesting', async ()=> {
    const teamDistributionInstance = await TeamDistribution.deployed();

    const nowBefore = await teamDistributionInstance.returnNow.call();
    try {
      const released = await teamDistributionInstance.revokeAllocation(accounts[2], {from: accounts[3]});
    } catch (error){
      assert(error);
    }
  });

});