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
  return web3._extend.utils.fromWei(bn.toNumber(), 'ether');
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

    assert.equal(AVAILABLE_TEAM_SUPPLY, teamSupplyBefore);
    assert.equal(teamMemberAllocation, 240);
    assert.equal(teamSupplyBefore - teamMemberAllocation, teamSupplyAfter);

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

    const setAllocationTransaction = await teamDistributionInstance.setAllocation(SEED_INVESTOR_ACCOUNT, PHT, SEED_INVESTORS_SUPPLY_ID);
    const seedInvestorAllocationData = await teamDistributionInstance.allocations(SEED_INVESTOR_ACCOUNT);

    const seedInvestorSupplyAfterBN = await teamDistributionInstance.AVAILABLE_SEED_INVESTORS_SUPPLY.call();

    const seedInvestorAllocation = convertFromBnToInt(seedInvestorAllocationData[4]);

    const seedInvestorSupplyBefore = convertFromBnToInt(seedInvestorSupplyBeforeBN);
    const seedInvestorSupplyAfter = convertFromBnToInt(seedInvestorSupplyAfterBN);

    assert.equal(AVAILABLE_SEED_INVESTORS_SUPPLY, seedInvestorSupplyBefore);
    assert.equal(seedInvestorAllocation, 500);
    assert.equal(seedInvestorSupplyBefore - seedInvestorAllocation, seedInvestorSupplyAfter);
  });

  it('The owner can create an allocation from the founders supply', async ()=> {
    const teamDistributionInstance = await TeamDistribution.deployed();
    const PHT = web3._extend.utils.toWei('240', 'ether');

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

  it('The team memeber can release their vested amount', async ()=> {
    const teamDistributionInstance = await TeamDistribution.deployed();
    const tokenInstance = await LightstreamToken.deployed();

    const nowBefore = await teamDistributionInstance.returnNow.call();

    const timeTravelTransaction = await timeTravel(3600 * 24 * 30 * 30); // Travel 3 months into the future for testing
    await mineBlock();

    const nowAfter = await teamDistributionInstance.returnNow.call();
    const allocation = await teamDistributionInstance.allocations(accounts[2]);
    const released = await teamDistributionInstance.release(accounts[2], {from: accounts[2]});

    const teamMemeberAccountBalance = await tokenInstance.balanceOf(accounts[2]);

  });

  it('The someone other than the team memeber can not release the vested amount', async ()=> {
    const teamDistributionInstance = await TeamDistribution.deployed();

    const nowBefore = await teamDistributionInstance.returnNow.call();
    try {
      const released = await teamDistributionInstance.release(accounts[2], {from: accounts[3]});
    } catch (error){
      assert(error);
    }
  });

  it('The the owner can revoke a team memeber\'s vesting', async ()=> {
    const teamDistributionInstance = await TeamDistribution.deployed();
    const tokenInstance = await LightstreamToken.deployed();

    const nowBefore = await teamDistributionInstance.returnNow.call();
    const otherBalance = await teamDistributionInstance.AVAILABLE_OTHER_SUPPLY.call();
    const released = await teamDistributionInstance.revokeAllocation(accounts[2]);

    const otherBalanceAfter = await teamDistributionInstance.AVAILABLE_OTHER_SUPPLY.call();
    const teamMemberBalance = await tokenInstance.balanceOf(accounts[2]);

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





//
//
// contract('LightstreamCrowdsale', function(accounts) {
//   it('should deploy the Lightstream Crowdsale contract and store the address', function(done){
//     LightstreamCrowdsale.deployed().then(async function(instance) {
//       assert(instance.address, 'Token address couldn\'t be stored');
//       done();
//     });
//   });
//
//   it('The owner should be able to add an address to the whitelist', function(done){
//     LightstreamCrowdsale.deployed().then(async function(instance) {
//       const transaction = await instance.addAddressToWhitelist(accounts[1], {from: accounts[0]});
//       const whitelisted = await instance.whitelist(accounts[1]);
//       console.log('whitelisted', whitelisted);
//       assert(whitelisted);
//       done();
//     });
//   });
//
//   it('A whitelisted address should be able to purchase tokens', function(done){
//     LightstreamCrowdsale.deployed().then(async function(instance) {
//       const etherInWei = web3._extend.utils.toWei(1, 'ether');
//       const weiBigNumber = web3._extend.utils.toBigNumber(etherInWei);
//
//       try {
//         const timeTravelPromise = await timeTravel(36 * 60 * 60);
//         const mineBlockPromise = await mineBlock();
//         const now = await instance.returnNow.call();
//         const startTime = await instance.openingTime.call();
//
//         console.log('sta', startTime);
//         console.log('now', now);
//         const transaction = await instance.buyTokens(accounts[1], { from: accounts[1], value: weiBigNumber });
//
//       } catch(error){
//         console.log('timeTravelPromise', error);
//       }
//
//       done();
//     });
//   });
//
// });


// before(async()=> {
//   LightstreamCrowdsale.deployed().then(async function(instance) {
//   // finalaize the sale which will mint the tokens and delilver them to the Team Distribution Contract
//   try {
//     const closingTime = await instance.closingTime.call();
//     const hasClosed = await instance.hasClosed.call();
//     const returnTimestamp = await instance.returnTimestamp.call();
//     console.log('closingTime         ', closingTime);
//     console.log('returnTimestampBefor', returnTimestamp);
//     console.log('hasClosed           ', hasClosed);
//
//     const timeTravelTransaction = await timeTravel(3600 * 24 * 30 * 3); // Travel three months into the future for testing
//     const mineBlockTransaction = await mineBlock(); // workaround for https://github.com/ethereumjs/testrspc/issues/336
//
//     const returnTimestampAfter = await instance.returnTimestamp.call();
//     const hasClosedAfter = await instance.hasClosed.call();
//     const closingTimeAfter = await instance.closingTime.call();
//     console.log('closingTimeAfter    ', closingTimeAfter);
//     console.log('returnTimestampAfter', returnTimestampAfter);
//     console.log('hasClosedAfter      ', hasClosed);
//     const owner = await instance.owner.call();
//     console.log('owner', owner);
//     console.log('acct0', accounts[0]);
//
//     // finalaize the sale which will mint the tokens and delilver them to the Team Distribution Contract
//     const finalize = await instance.finalize({from: accounts[0]});
//     console.log(finalize);
//     const mineAgain = await mineBlock();
//   } catch(error){
//     console.log('finalize -- error', error);
//   }
// });
// });